"""
Smoke test de la invitacion de un mandante por BERISA, contra SQLite.

Mismo flujo con el que un mandante invita a un contratista: se crea la entidad y
un usuario inactivo, y el invitado define su password al activar. Lo que importa
verificar es que la ACTIVACION —que antes asumia que el invitado era
contratista— funcione para un mandante sin romper el caso del contratista.

Correr:  python tests/test_invitar_mandante.py
"""
import os
import sys
import tempfile

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql://x:x@localhost/x")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_inv_")

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.models.base import Base
from app.models.contratista import ContratistaMandante, EmpresaContratista
from app.models.mandante import Mandante
from app.models.usuario import Usuario
from app.api import mandantes as api_mandantes
from app.api import usuarios as api_usuarios
from app.api.schemas import ActivarCuentaRequest, InvitarMandanteRequest


def run():
    eng = create_engine("sqlite://")
    Base.metadata.create_all(eng)
    db = Session(eng)

    admin = Usuario(email="admin@berisa.cl", password_hash="x", rol="berisa_admin",
                    nombre="Admin", activo=True)
    db.add(admin); db.commit()

    # 1. BERISA invita a un mandante nuevo.
    r = api_mandantes.invitar_mandante(
        body=InvitarMandanteRequest(email="nuevo@minera.cl", razon_social="Minera Escondida",
                                    rut="79.587.210-8"),
        db=db, usuario=admin,
    )
    assert "mandante_id" in r
    mandante = db.query(Mandante).filter_by(rut="79.587.210-8").first()
    assert mandante is not None and mandante.slug == "minera-escondida", \
        f"el slug debe derivarse de la razon social, fue {mandante.slug if mandante else None}"
    print("PASS: se crea el mandante con slug derivado de la razon social")

    invitado = db.query(Usuario).filter_by(email="nuevo@minera.cl").first()
    assert invitado.rol == "mandante_admin" and invitado.activo is False, \
        "el usuario debe quedar inactivo hasta que active"
    assert invitado.mandante_id == mandante.id and invitado.contratista_id is None
    print("PASS: usuario mandante_admin inactivo, sin contratista_id")

    # 2. La invitacion se puede consultar para prellenar el formulario.
    info = api_usuarios.obtener_invitacion(token=str(invitado.id), db=db)
    assert info.razon_social == "Minera Escondida" and info.rut == "79.587.210-8"
    assert info.rol == "mandante_admin"
    assert info.mandante_razon_social == "", \
        "a un mandante lo invita BERISA: no hay un tercero por encima que mostrar"
    print("PASS: la invitacion de mandante se consulta sin romperse")

    # 3. Activa y queda operativo.
    tok = api_usuarios.activar_cuenta(
        body=ActivarCuentaRequest(token=str(invitado.id), password="secreto123",
                                  razon_social="Minera Escondida Ltda", rut="79.587.210-8"),
        db=db,
    )
    db.refresh(invitado); db.refresh(mandante)
    assert invitado.activo is True and invitado.password_hash != ""
    assert mandante.razon_social == "Minera Escondida Ltda", "debe poder corregir su razon social"
    assert tok.rol == "mandante_admin" and tok.mandante_id == mandante.id
    print("PASS: activa, corrige sus datos y recibe token de mandante_admin")

    # 4. No se puede invitar dos veces el mismo RUT ni el mismo email.
    for campo, body in [
        ("email", InvitarMandanteRequest(email="nuevo@minera.cl", razon_social="Otra", rut="1-9")),
        ("rut", InvitarMandanteRequest(email="otro@minera.cl", razon_social="Otra", rut="79.587.210-8")),
    ]:
        try:
            api_mandantes.invitar_mandante(body=body, db=db, usuario=admin)
            raise AssertionError(f"no debio permitir {campo} duplicado")
        except HTTPException as e:
            assert e.status_code == 400
    print("PASS: rechaza email y RUT duplicados")

    # 5. El caso del contratista sigue funcionando (no se rompio al generalizar).
    empresa = EmpresaContratista(rut="76.9-9", razon_social="ABC"); db.add(empresa); db.flush()
    db.add(ContratistaMandante(contratista_id=empresa.id, mandante_id=mandante.id))
    ct = Usuario(email="ct@abc.cl", password_hash="", rol="contratista_admin",
                 nombre="ABC", activo=False, contratista_id=empresa.id)
    db.add(ct); db.commit()

    info_ct = api_usuarios.obtener_invitacion(token=str(ct.id), db=db)
    assert info_ct.rol == "contratista_admin"
    assert info_ct.mandante_razon_social == "Minera Escondida Ltda", \
        "al contratista si se le muestra quien lo invita"
    print("PASS: la invitacion de contratista sigue funcionando")

    # ── Invitar a un MIEMBRO DEL EQUIPO es distinto ─────────────────────────
    # Bug reportado: el formulario de activacion le pedia al invitado "confirmar
    # los datos de tu empresa" con la razon social y el RUT del mandante
    # precargados, asi que un miembro nuevo podia CAMBIAR EL RUT de Codelco.
    from app.api.schemas import InvitarUsuarioMandanteRequest
    from app.api import mandantes as api_m

    admin_activo = db.query(Usuario).filter_by(mandante_id=mandante.id, activo=True).first()
    assert admin_activo is not None, "precondicion: el mandante ya tiene un usuario activo"

    api_m.invitar_usuario_mandante(
        mandante_id=mandante.id,
        body=InvitarUsuarioMandanteRequest(email="patricia@minera.cl", nombre="Patricia Rojas",
                                           rol="prevencionista", pilar_ids=[]),
        db=db, usuario=admin_activo,
    )
    miembro = db.query(Usuario).filter_by(email="patricia@minera.cl").first()

    info_eq = api_usuarios.obtener_invitacion(token=str(miembro.id), db=db)
    assert info_eq.tipo == "EQUIPO", f"debio ser EQUIPO, fue {info_eq.tipo}"
    assert info_eq.organizacion == mandante.razon_social
    assert info_eq.nombre == "Patricia Rojas"
    print("PASS: invitar a un colega se marca como EQUIPO, no como alta de empresa")

    # Y el mandante que invito sigue siendo ORGANIZACION si aun no activo... pero
    # ya activo, asi que el caso de alta se verifico arriba con tipo por defecto.

    # Lo central: aunque manden un RUT distinto, NO se toca la organizacion.
    rut_original = mandante.rut
    razon_original = mandante.razon_social
    api_usuarios.activar_cuenta(
        body=ActivarCuentaRequest(token=str(miembro.id), password="secreto123",
                                  razon_social="Empresa Pirata SpA", rut="99.999.999-9",
                                  nombre="Patricia Rojas Soto"),
        db=db,
    )
    db.refresh(mandante); db.refresh(miembro)
    assert mandante.rut == rut_original,         f"un miembro del equipo NO puede cambiar el RUT de la empresa: {mandante.rut}"
    assert mandante.razon_social == razon_original,         "un miembro del equipo NO puede cambiar la razon social"
    assert miembro.activo is True and miembro.password_hash != ""
    assert miembro.nombre == "Patricia Rojas Soto", "si puede corregir SU propio nombre"
    print("PASS: un miembro del equipo NO puede alterar los datos de la empresa")

    print("TODOS LOS TESTS DE INVITACION PASARON")


if __name__ == "__main__":
    run()

# ── Puente para pytest ────────────────────────────────────────────────────────
# Estos archivos nacieron como scripts (`python tests/test_x.py`) y su punto de
# entrada se llama run(), que pytest NO recolecta porque no empieza con "test_".
# Resultado: la suite reportaba verde corriendo 5 de los ~30 tests que existen.
# El envoltorio los expone sin tocar la lógica, y el modo script sigue andando.
def test_invitar_mandante():
    run()
