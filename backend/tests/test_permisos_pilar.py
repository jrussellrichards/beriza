"""
Smoke test de los permisos de aprobacion por pilar, contra SQLite.

Es un cambio de PERMISOS, asi que lo que importa verificar es lo que NO se puede
hacer: que un revisor no apruebe fuera de sus pilares, que no pueda tocar
usuarios de otra organizacion, y que "ver" siga abierto dentro del mandante.

Correr:  python tests/test_permisos_pilar.py
"""
import os
import sys
import tempfile
from datetime import date

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql://x:x@localhost/x")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_perm_")

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.core.exceptions import PermisoInsuficiente
from app.models.base import Base
from app.models.contratista import ContratistaMandante, EmpresaContratista
from app.models.expediente import Acreditacion, Entrega, Expediente
from app.models.mandante import Mandante
from app.models.permiso import UsuarioPilarPermiso
from app.models.pilar import Pilar, RequisitoDocumental, Subpilar
from app.models.usuario import Usuario
from app.api import documentos as api_doc
from app.api import mandantes as api_mand
from app.api.schemas import DefinirPermisosRequest, RevisarDocumentoRequest
from app.domain import permiso_service
from app.domain.estados import EstadoDocumento
from app.middleware.auth import require_rol


def _acred(db, mandante, req, empresa):
    exp = Expediente(requisito_id=req.id, empresa_id=empresa.id); db.add(exp); db.flush()
    e = Entrega(expediente_id=exp.id, numero_version=1); db.add(e); db.flush()
    a = Acreditacion(mandante_id=mandante.id, expediente_id=exp.id, entrega_id=e.id,
                     numero_version=1, estado=EstadoDocumento.ENVIADO)
    db.add(a); db.commit()
    return a


def run():
    eng = create_engine("sqlite://")
    Base.metadata.create_all(eng)
    db = Session(eng)

    m = Mandante(razon_social="Codelco", rut="1-9", slug="codelco", plan="Pro")
    otro_m = Mandante(razon_social="Falabella", rut="2-7", slug="fala", plan="Pro")
    c = EmpresaContratista(rut="76.1-1", razon_social="ABC")
    db.add_all([m, otro_m, c]); db.flush()
    db.add(ContratistaMandante(contratista_id=c.id, mandante_id=m.id))

    hse = Pilar(codigo="HSE", nombre="HSE", orden=1)
    legal = Pilar(codigo="LEGAL", nombre="Legal / Laboral", orden=2)
    db.add_all([hse, legal]); db.flush()
    sub_hse = Subpilar(pilar_id=hse.id, codigo="H", nombre="H", orden=1)
    sub_legal = Subpilar(pilar_id=legal.id, codigo="L", nombre="L", orden=1)
    db.add_all([sub_hse, sub_legal]); db.flush()
    req_hse = RequisitoDocumental(subpilar_id=sub_hse.id, codigo="RIOHS", nombre="RIOHS",
                                  entidad_tipo="EMPRESA", alcance="ENTIDAD")
    req_legal = RequisitoDocumental(subpilar_id=sub_legal.id, codigo="F30", nombre="F30",
                                     entidad_tipo="EMPRESA", alcance="ENTIDAD")
    db.add_all([req_hse, req_legal]); db.flush()

    admin = Usuario(email="admin@cod.cl", password_hash="x", rol="mandante_admin",
                    nombre="Admin", mandante_id=m.id, activo=True)
    revisor = Usuario(email="hse@cod.cl", password_hash="x", rol="prevencionista",
                      nombre="Revisor HSE", mandante_id=m.id, activo=True)
    ajeno = Usuario(email="a@fala.cl", password_hash="x", rol="prevencionista",
                    nombre="Ajeno", mandante_id=otro_m.id, activo=True)
    db.add_all([admin, revisor, ajeno]); db.commit()

    # El revisor solo tiene HSE
    db.add(UsuarioPilarPermiso(usuario_id=revisor.id, pilar_id=hse.id)); db.commit()

    a_hse = _acred(db, m, req_hse, c)
    a_legal = _acred(db, m, req_legal, c)

    # 1. mandante_admin aprueba cualquier pilar: no necesita filas de permiso.
    assert permiso_service.pilares_que_aprueba(db, admin) is None, \
        "None significa 'todos', distinto de lista vacia que es 'ninguno'"
    assert permiso_service.puede_aprobar(db, admin, a_legal)
    print("PASS: mandante_admin aprueba cualquier pilar sin permisos explicitos")

    # 2. El revisor aprueba SU pilar.
    api_doc.revisar_documento(documento_id=a_hse.id,
                              body=RevisarDocumentoRequest(aprobar=True), db=db, usuario=revisor)
    db.refresh(a_hse)
    assert a_hse.estado == EstadoDocumento.APROBADO
    print("PASS: el revisor aprueba documentos de su pilar")

    # 3. Y NO puede aprobar fuera de el. Es lo central del cambio.
    try:
        api_doc.revisar_documento(documento_id=a_legal.id,
                                  body=RevisarDocumentoRequest(aprobar=True), db=db, usuario=revisor)
        raise AssertionError("aprobo un pilar que no tiene asignado")
    except HTTPException as e:
        assert e.status_code == 403, f"debio ser 403, fue {e.status_code}"
        assert "Legal / Laboral" in e.detail, \
            f"el error debe nombrar el pilar, que es lo accionable: {e.detail}"
    db.refresh(a_legal)
    assert a_legal.estado == EstadoDocumento.ENVIADO, "el documento no debe haberse tocado"
    print("PASS: el revisor NO aprueba fuera de sus pilares (403 nombrando el pilar)")

    # 4. Ver sigue abierto dentro del mandante: se restringe aprobar, no leer.
    hist = api_doc.historial_documento(documento_id=a_legal.id, db=db, usuario=revisor)
    assert len(hist.versiones) == 1, "el revisor debe poder VER documentos de otros pilares"
    print("PASS: ver no se restringe dentro del mandante")

    # 5. Un mandante no puede tocar permisos de usuarios de otra organizacion.
    try:
        api_mand.definir_permisos_usuario(
            mandante_id=m.id, usuario_id=ajeno.id,
            body=DefinirPermisosRequest(pilar_ids=[hse.id]), db=db, usuario=admin)
        raise AssertionError("otorgo permisos sobre un usuario de otro mandante")
    except HTTPException as e:
        assert e.status_code == 403
    print("PASS: no se otorgan permisos sobre usuarios de otra organizacion")

    # 6. Reemplazar permisos: el revisor pasa de HSE a Legal.
    api_mand.definir_permisos_usuario(
        mandante_id=m.id, usuario_id=revisor.id,
        body=DefinirPermisosRequest(pilar_ids=[legal.id]), db=db, usuario=admin)
    pilares = permiso_service.pilares_que_aprueba(db, revisor)
    assert [p.codigo for p in pilares] == ["LEGAL"], f"debio quedar solo LEGAL: {pilares}"
    assert not permiso_service.puede_aprobar(db, revisor, a_hse), "ya no deberia aprobar HSE"
    print("PASS: definir permisos REEMPLAZA los anteriores")

    # 7. No tiene sentido dar permisos por pilar a quien ya aprueba todo.
    try:
        api_mand.definir_permisos_usuario(
            mandante_id=m.id, usuario_id=admin.id,
            body=DefinirPermisosRequest(pilar_ids=[hse.id]), db=db, usuario=admin)
        raise AssertionError("acepto permisos por pilar para un mandante_admin")
    except HTTPException as e:
        assert e.status_code == 403
    print("PASS: rechaza permisos por pilar para quien ya aprueba todo")

    # 8. Un revisor SIN permisos no aprueba nada (lista vacia != None).
    sin_permisos = Usuario(email="nuevo@cod.cl", password_hash="x", rol="prevencionista",
                           nombre="Nuevo", mandante_id=m.id, activo=True)
    db.add(sin_permisos); db.commit()
    assert permiso_service.pilares_que_aprueba(db, sin_permisos) == []
    assert not permiso_service.puede_aprobar(db, sin_permisos, a_hse)
    print("PASS: sin permisos asignados no aprueba nada")

    # ── Alcance de aprobacion separado de la administracion de la cuenta ──────
    #
    # Lo central del cambio: antes, para que alguien aprobara TODOS los pilares
    # habia que hacerlo mandante_admin, lo que ademas le entregaba invitar gente
    # y reconfigurar los perfiles de exigencias. El "revisor senior" es ese caso
    # que era imposible de expresar.

    senior = Usuario(email="senior@cod.cl", password_hash="x", rol="prevencionista",
                     nombre="Revisor Senior", mandante_id=m.id, activo=True,
                     aprueba_todo=True, cargo="Jefe de Terreno")
    db.add(senior); db.commit()

    # 9. Aprueba cualquier pilar sin tener una sola fila de permiso.
    assert db.query(UsuarioPilarPermiso).filter_by(usuario_id=senior.id).count() == 0
    assert permiso_service.pilares_que_aprueba(db, senior) is None, \
        "aprueba_todo debe significar 'todos', igual que el rol sin restriccion"
    assert permiso_service.puede_aprobar(db, senior, a_legal)
    api_doc.revisar_documento(documento_id=a_legal.id,
                              body=RevisarDocumentoRequest(aprobar=True), db=db, usuario=senior)
    db.refresh(a_legal)
    assert a_legal.estado == EstadoDocumento.APROBADO
    print("PASS: el revisor senior aprueba cualquier pilar sin filas de permiso")

    # 10. Y NO administra la cuenta. Es la razon de existir de la separacion:
    #     si esto falla, volvimos a regalar la administracion para dar alcance.
    guard = require_rol(["berisa_admin", "mandante_admin"])
    try:
        guard(usuario=senior)
        raise AssertionError("un revisor senior paso el guard de administracion")
    except HTTPException as e:
        assert e.status_code == 403, f"debio ser 403, fue {e.status_code}"
    assert guard(usuario=admin) is admin, "el administrador si debe pasar"
    print("PASS: el revisor senior NO administra la cuenta (403 en endpoints de admin)")

    # 11. Marcar alcance total BORRA las filas por pilar: una sola fuente de
    #     verdad. Con las dos vias activas se contradicen y deja de poder
    #     explicarse por que alguien aprueba algo.
    api_mand.definir_permisos_usuario(
        mandante_id=m.id, usuario_id=revisor.id,
        body=DefinirPermisosRequest(pilar_ids=[hse.id], aprueba_todo=True), db=db, usuario=admin)
    db.refresh(revisor)
    assert revisor.aprueba_todo is True
    assert db.query(UsuarioPilarPermiso).filter_by(usuario_id=revisor.id).count() == 0, \
        "no deben quedar filas por pilar cuando el alcance es total"
    assert permiso_service.pilares_que_aprueba(db, revisor) is None
    print("PASS: alcance total descarta los pilares sueltos")

    # 12. Y se puede volver atras: el alcance total no es irreversible.
    api_mand.definir_permisos_usuario(
        mandante_id=m.id, usuario_id=revisor.id,
        body=DefinirPermisosRequest(pilar_ids=[hse.id], aprueba_todo=False), db=db, usuario=admin)
    db.refresh(revisor)
    assert revisor.aprueba_todo is False
    pilares = permiso_service.pilares_que_aprueba(db, revisor)
    assert [p.codigo for p in pilares] == ["HSE"], f"debio volver a solo HSE: {pilares}"
    assert not permiso_service.puede_aprobar(db, revisor, a_legal)
    print("PASS: se puede volver de alcance total a alcance parcial")

    # 13. El administrador sigue aprobando todo por su ROL, sin la marca.
    db.refresh(admin)
    assert admin.aprueba_todo is False, "no se le pone la marca: ya aprueba todo por el rol"
    assert permiso_service.pilares_que_aprueba(db, admin) is None
    print("PASS: el administrador aprueba todo por su rol, sin marca redundante")

    # 14. La cola de revision dice, por entrega, si ESTE usuario puede resolverla.
    #     Lo decide el backend y no el frontend recalculando permisos: la
    #     autoridad sobre autorizacion es una sola. Sirve para no ofrecer un boton
    #     que va a devolver 403.
    # Se reusan las dos acreditaciones ya creadas: el expediente es unico por
    # (requisito, empresa), asi que no se pueden duplicar. Vuelven a ENVIADO para
    # que aparezcan en la cola.
    a_hse.estado = EstadoDocumento.ENVIADO
    a_legal.estado = EstadoDocumento.ENVIADO
    db.commit()

    def cola(quien):
        return {p.requisito_codigo: p.puede_aprobar
                for p in api_doc.pendientes_revision(db=db, usuario=quien)}

    # El revisor quedo con HSE en el paso 12.
    del_revisor = cola(revisor)
    assert del_revisor.get("RIOHS") is True, f"deberia poder aprobar HSE: {del_revisor}"
    assert del_revisor.get("F30") is False, f"NO deberia poder aprobar Legal: {del_revisor}"
    # Pero las VE igual: se restringe aprobar, no leer.
    assert "F30" in del_revisor, "el revisor debe seguir viendo las entregas de otros pilares"
    print("PASS: la cola marca por entrega si el revisor puede resolverla")

    assert all(cola(admin).values()), "el administrador puede resolver cualquiera"
    assert all(cola(senior).values()), "el revisor senior tambien, por su alcance"
    assert not any(cola(sin_permisos).values()), "sin pilares no puede resolver ninguna"
    print("PASS: puede_aprobar coincide con el alcance de cada perfil")

    # 15. El cargo es una ETIQUETA: no participa de ninguna decision.
    etiquetado = Usuario(email="cargo@cod.cl", password_hash="x", rol="prevencionista",
                         nombre="Con Cargo", mandante_id=m.id, activo=True,
                         cargo="Gerente HSE")
    db.add(etiquetado); db.commit()
    assert permiso_service.pilares_que_aprueba(db, etiquetado) == [], \
        "un cargo no otorga alcance de aprobacion"
    assert not permiso_service.puede_aprobar(db, etiquetado, a_hse)
    print("PASS: el cargo no otorga permisos")

    print("TODOS LOS TESTS DE PERMISOS PASARON")


if __name__ == "__main__":
    run()

# ── Puente para pytest ────────────────────────────────────────────────────────
# Estos archivos nacieron como scripts (`python tests/test_x.py`) y su punto de
# entrada se llama run(), que pytest NO recolecta porque no empieza con "test_".
# Resultado: la suite reportaba verde corriendo 5 de los ~30 tests que existen.
# El envoltorio los expone sin tocar la lógica, y el modo script sigue andando.
def test_permisos_pilar():
    run()
