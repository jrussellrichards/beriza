"""
Regresión de los tres huecos de seguridad que la auditoría encontró abiertos.

Cada uno estuvo en producción-listo y ninguno tenía test. Son las tres formas en
que este producto puede fallar de verdad: que un cliente lea los datos de otro,
que alguien escriba en el tenant ajeno, y que una persona a la que le quitaron el
acceso se lo devuelva sola.

Corre contra SQLite en memoria, sin DB externa. `python tests/test_aislamiento.py`
o vía pytest.
"""
import os
import sys
import uuid

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql://x:x@localhost/x")
os.environ.setdefault("JWT_SECRET", "test")

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import app.models  # noqa: F401 — registra los modelos
from app.models.base import Base
from app.models.mandante import Mandante
from app.models.usuario import Usuario
from app.middleware.auth import exigir_acceso_a_contratista, exigir_mandante_propio
from app.domain import usuario_service


def _db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return Session(engine)


def _usuario(rol, mandante_id=None, contratista_id=None, password_hash="x"):
    return Usuario(
        id=uuid.uuid4(), email=f"{uuid.uuid4().hex[:8]}@t.cl", nombre="T",
        rol=rol, activo=True, mandante_id=mandante_id, contratista_id=contratista_id,
        password_hash=password_hash,
    )


# ── 1. Un mandante no toca el tenant de otro ─────────────────────────────────
# require_rol solo valida el string del rol, y dos mandantes distintos tienen los
# dos "mandante_admin": sin esta guarda alcanzaba con cambiar el UUID de la URL.

def test_mandante_ajeno_es_rechazado():
    mio, ajeno = uuid.uuid4(), uuid.uuid4()
    with pytest.raises(HTTPException) as e:
        exigir_mandante_propio(_usuario("mandante_admin", mandante_id=mio), ajeno)
    assert e.value.status_code == 403


def test_mandante_propio_pasa():
    mio = uuid.uuid4()
    exigir_mandante_propio(_usuario("mandante_admin", mandante_id=mio), mio)


def test_berisa_pasa_en_cualquier_tenant():
    exigir_mandante_propio(_usuario("berisa_admin"), uuid.uuid4())


def test_mandante_admin_sin_mandante_no_es_superadmin():
    """
    El caso que convierte un dato malo en escalada: un mandante_admin con
    mandante_id NULL. Si la guarda mirara solo el NULL en vez del rol, pasaría
    en TODOS los tenants.
    """
    with pytest.raises(HTTPException) as e:
        exigir_mandante_propio(_usuario("mandante_admin", mandante_id=None), uuid.uuid4())
    assert e.value.status_code == 403


def test_contratista_no_entra_por_ruta_de_mandante():
    with pytest.raises(HTTPException):
        exigir_mandante_propio(_usuario("contratista_admin", contratista_id=uuid.uuid4()), uuid.uuid4())


# ── 2. Una cuenta revocada no se reactiva sola ───────────────────────────────
# DELETE /usuarios/{id} desactiva en vez de borrar, así que una cuenta revocada
# queda con activo=False — el mismo estado que una invitación pendiente. Sin
# distinguirlas, cualquiera con el UUID volvía a "activarla" con clave nueva.

def test_invitacion_pendiente_es_activable():
    assert usuario_service.nunca_activo(_usuario("prevencionista", password_hash="")) is True


def test_cuenta_revocada_no_es_activable():
    revocado = _usuario("prevencionista", password_hash="$2b$12$hashreal")
    revocado.activo = False
    assert usuario_service.nunca_activo(revocado) is False


# ── 3. Nadie se desactiva ni deja su organización sin administrador ──────────

def test_no_puede_gestionarse_a_si_mismo():
    u = _usuario("mandante_admin", mandante_id=uuid.uuid4())
    with pytest.raises(Exception):
        usuario_service.exigir_no_es_uno_mismo(u, u, "desactivar")


def test_no_cruza_organizaciones():
    a = _usuario("mandante_admin", mandante_id=uuid.uuid4())
    b = _usuario("prevencionista", mandante_id=uuid.uuid4())
    assert usuario_service.puede_gestionar(a, b) is False


def test_gestiona_dentro_de_su_organizacion():
    m = uuid.uuid4()
    assert usuario_service.puede_gestionar(
        _usuario("mandante_admin", mandante_id=m),
        _usuario("prevencionista", mandante_id=m),
    ) is True


def test_no_se_puede_dejar_al_mandante_sin_administrador():
    db = _db()
    mid = uuid.uuid4()
    db.add(Mandante(id=mid, razon_social="M", rut="1-9", slug="m", activo=True))
    unico = _usuario("mandante_admin", mandante_id=mid)
    db.add(unico)
    db.commit()
    with pytest.raises(Exception):
        usuario_service.exigir_no_es_ultimo_admin(db, unico)


def test_con_otro_administrador_activo_si_se_puede():
    db = _db()
    mid = uuid.uuid4()
    db.add(Mandante(id=mid, razon_social="M", rut="1-9", slug="m", activo=True))
    uno, dos = _usuario("mandante_admin", mandante_id=mid), _usuario("mandante_admin", mandante_id=mid)
    db.add_all([uno, dos])
    db.commit()
    usuario_service.exigir_no_es_ultimo_admin(db, uno)   # no lanza


def test_no_se_otorgan_roles_por_encima_del_propio():
    """Un mandante no fabrica un berisa_admin, ni un contratista un mandante_admin."""
    with pytest.raises(Exception):
        usuario_service.exigir_rol_otorgable(_usuario("mandante_admin"), "berisa_admin")
    with pytest.raises(Exception):
        usuario_service.exigir_rol_otorgable(_usuario("contratista_admin"), "mandante_admin")
    usuario_service.exigir_rol_otorgable(_usuario("mandante_admin"), "prevencionista")


# ── 4. La nómina de un contratista no es pública entre clientes ──────────────
# Encontrado por la prueba end-to-end, no por esta suite: GET
# /trabajadores/empresa/{id} devolvía RUT y nombre completo de cualquier empresa
# a cualquier usuario autenticado. Los tests de arriba probaban la guarda; nadie
# probaba que los endpoints la LLAMARAN. De ahí el test estructural del bloque 5.

def _empresa(db, mandante_id=None):
    from app.models.contratista import ContratistaMandante, EmpresaContratista
    e = EmpresaContratista(id=uuid.uuid4(), razon_social="C", rut=f"{uuid.uuid4().int % 10**8}-1")
    db.add(e)
    if mandante_id:
        db.add(ContratistaMandante(id=uuid.uuid4(), contratista_id=e.id, mandante_id=mandante_id))
    db.commit()
    return e


def test_la_empresa_ve_su_propia_nomina():
    db = _db()
    e = _empresa(db)
    exigir_acceso_a_contratista(db, _usuario("contratista_admin", contratista_id=e.id), e.id)


def test_un_contratista_no_ve_la_nomina_de_otro():
    db = _db()
    mia, ajena = _empresa(db), _empresa(db)
    with pytest.raises(HTTPException) as ex:
        exigir_acceso_a_contratista(db, _usuario("contratista_admin", contratista_id=mia.id), ajena.id)
    assert ex.value.status_code == 403


def test_el_mandante_que_la_contrato_si_ve_su_nomina():
    db = _db()
    mid = uuid.uuid4()
    db.add(Mandante(id=mid, razon_social="M", rut="1-9", slug="m", activo=True))
    db.commit()
    e = _empresa(db, mandante_id=mid)
    exigir_acceso_a_contratista(db, _usuario("mandante_admin", mandante_id=mid), e.id)


def test_un_mandante_sin_vinculo_no_ve_la_nomina():
    """El caso reproducido en producción-listo: cambiar el UUID de la URL."""
    db = _db()
    e = _empresa(db)   # sin ningún vínculo
    with pytest.raises(HTTPException) as ex:
        exigir_acceso_a_contratista(db, _usuario("mandante_admin", mandante_id=uuid.uuid4()), e.id)
    assert ex.value.status_code == 403


def test_berisa_ve_cualquier_nomina():
    db = _db()
    exigir_acceso_a_contratista(db, _usuario("berisa_admin"), _empresa(db).id)


# ── 5. Ningún endpoint con id de otro tenant puede saltarse la comprobación ───

def test_todo_endpoint_con_id_ajeno_valida_pertenencia():
    """
    El test que faltaba, y el único que habría atrapado la fuga de nóminas.

    Los demás prueban que las guardas funcionan. Este prueba que se USEN: recorre
    las rutas reales de la aplicación y exige que toda la que reciba el id de una
    entidad de otro tenant contenga alguna comprobación de pertenencia. Un
    endpoint nuevo que sólo ponga `require_rol` —que valida el rol, no de quién
    son los datos— pone este test en rojo.
    """
    import inspect
    from main import app

    IDS = ("{empresa_id}", "{mandante_id}", "{trabajador_id}",
           "{servicio_id}", "{contratista_id}")
    COMPROBACIONES = (
        "exigir_acceso_a_contratista", "exigir_mandante_propio", "mandante_propio",
        "verificar_acceso_relacion", "_validar_acceso_al_servicio",
        "_validar_servicio_del_contratista", "_resolver_mandante_id",
        "exigir_puede_gestionar", "puede_gestionar",
        "usuario.contratista_id", "usuario.mandante_id",
    )

    sin_guarda = []
    for ruta in app.routes:
        path = getattr(ruta, "path", "")
        fn = getattr(ruta, "endpoint", None)
        if fn is None or not any(t in path for t in IDS):
            continue
        try:
            fuente = inspect.getsource(fn)
        except (OSError, TypeError):
            continue
        if not any(c in fuente for c in COMPROBACIONES):
            sin_guarda.append(f"{','.join(sorted(ruta.methods))} {path}")

    assert not sin_guarda, (
        "Estos endpoints reciben el id de una entidad que puede ser de otro "
        "cliente y no comprueban pertenencia:\n  " + "\n  ".join(sin_guarda)
    )


def run():
    fallos = 0
    for nombre, fn in list(globals().items()):
        if nombre.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"PASS {nombre}")
            except Exception as e:
                fallos += 1
                print(f"FAIL {nombre}: {e}")
    print("Todos los tests de aislamiento PASARON" if not fallos else f"{fallos} fallaron")
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    run()
