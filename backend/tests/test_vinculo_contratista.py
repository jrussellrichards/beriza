"""
Archivar y eliminar el vinculo de un mandante con una empresa contratista.

No existia en ninguna capa: un mandante podia invitar a una empresa y nunca
sacarla, ni cuando invitaba a la equivocada ni cuando la relacion comercial
terminaba.

Mismo criterio que con los servicios:

  - BORRADO real solo si el vinculo no dejo rastro (ni servicios ni
    acreditaciones): la invitacion equivocada.
  - ARCHIVADO para el resto: sale de la lista y conserva todo.

Lo que se verifica, y por que:

  1. archivar saca el vinculo del listado y `incluir_archivados=true` lo recupera,
  2. NO se archiva un vinculo con servicios ACTIVOS —esconderia de la lista a una
     empresa que esta en faena hoy—,
  3. archivar NO mueve el estado de acreditacion: es la invariante que lo hace
     seguro, y si alguna vez se rompe, un contratista pasaria de BLOQUEADA a
     ACREDITADA sin subir un documento,
  4. eliminar un vinculo sin rastro lo borra... y NO borra la empresa, que es una
     sola fila en la plataforma y puede estar trabajando con otros mandantes,
  5. eliminar uno con servicios o con acreditaciones se rechaza con 409,
  6. y nadie toca el vinculo de otra organizacion.

Correr:  python tests/test_vinculo_contratista.py
"""
import os
import sys
import tempfile
from datetime import date

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_vinculo_")

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.core.security import hash_password
from app.domain import servicio_service
from app.domain.estados import EstadoServicio
from app.infrastructure.database import get_db
from app.models.base import Base
from app.models.contratista import ContratistaMandante, EmpresaContratista
from app.models.expediente import Acreditacion, Expediente
from app.models.mandante import Mandante
from app.models.pilar import Pilar, RequisitoDocumental, Subpilar
from app.models.usuario import Usuario

from tests._db import engine_sqlite
from main import app


def _headers(cliente, email):
    token = cliente.post("/api/v1/usuarios/login", json={
        "email": email, "password": "secreta-larga"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _ruts(cliente, headers, archivados=False):
    url = f"/api/v1/mandantes/{MANDANTE_ID}/contratistas"
    if archivados:
        url += "?incluir_archivados=true"
    return {c["rut"] for c in cliente.get(url, headers=headers).json()}


MANDANTE_ID = None  # se llena en run(); lo usa _ruts


def run():
    global MANDANTE_ID
    eng = engine_sqlite(connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(eng)
    db = sessionmaker(bind=eng)()
    app.dependency_overrides[get_db] = lambda: db
    cliente = TestClient(app)

    codelco = Mandante(razon_social="Codelco", rut="61.704.000-K", slug="cod", plan="Pro")
    otro = Mandante(razon_social="Los Pelambres", rut="70.000.000-7", slug="lp", plan="Pro")
    # Tres empresas: una para borrar, una con servicio, una con acreditacion.
    equivocada = EmpresaContratista(rut="77.111.111-1", razon_social="Invitada por error")
    con_servicio = EmpresaContratista(rut="77.222.222-2", razon_social="Con servicio")
    con_docs = EmpresaContratista(rut="77.333.333-3", razon_social="Con documentos")
    db.add_all([codelco, otro, equivocada, con_servicio, con_docs]); db.flush()
    MANDANTE_ID = codelco.id

    for emp in (equivocada, con_servicio, con_docs):
        db.add(ContratistaMandante(mandante_id=codelco.id, contratista_id=emp.id))
    db.add_all([
        Usuario(email="jefa@cod.cl", password_hash=hash_password("secreta-larga"),
                rol="mandante_admin", nombre="Jefa", activo=True, mandante_id=codelco.id),
        Usuario(email="jefa@lp.cl", password_hash=hash_password("secreta-larga"),
                rol="mandante_admin", nombre="Ajena", activo=True, mandante_id=otro.id),
    ])
    pilar = Pilar(codigo="LEGAL", nombre="Legal", orden=1); db.add(pilar); db.flush()
    sub = Subpilar(pilar_id=pilar.id, codigo="EMP", nombre="Empresa", orden=1); db.add(sub); db.flush()
    req = RequisitoDocumental(subpilar_id=sub.id, codigo="F30", nombre="Certificado F30",
                              entidad_tipo="EMPRESA", alcance="ENTIDAD")
    db.add(req); db.commit()

    perfil = servicio_service.crear_perfil(db, codelco.id, "Obra civil")
    servicio = servicio_service.crear_servicio(
        db, codelco.id, con_servicio.id, perfil.id, "Faena viva", date.today())

    # La tercera empresa tiene una acreditacion pero ningun servicio: es el caso
    # que un guard escrito solo sobre servicios dejaria borrar.
    exp = Expediente(requisito_id=req.id, empresa_id=con_docs.id)
    db.add(exp); db.flush()
    db.add(Acreditacion(mandante_id=codelco.id, expediente_id=exp.id, estado=1))
    db.commit()

    h = _headers(cliente, "jefa@cod.cl")
    base = f"/api/v1/mandantes/{codelco.id}/contratistas"

    # ── 1. Archivar saca de la lista, y se puede recuperar ───────────────────
    assert cliente.post(f"{base}/{equivocada.id}/archivar", headers=h).status_code == 200
    assert "77.111.111-1" not in _ruts(cliente, h), "el archivado sigue en la lista"
    assert "77.111.111-1" in _ruts(cliente, h, archivados=True), (
        "el archivado desaparecio del todo: no habria como desarchivarlo")
    print("PASS: archivar saca de la lista y incluir_archivados lo recupera")

    assert cliente.post(f"{base}/{equivocada.id}/desarchivar", headers=h).status_code == 200
    assert "77.111.111-1" in _ruts(cliente, h)
    print("PASS: desarchivar lo devuelve a la lista")

    # ── 2. Un vinculo con servicio ACTIVO no se archiva ──────────────────────
    assert servicio.estado == EstadoServicio.ACTIVO
    r = cliente.post(f"{base}/{con_servicio.id}/archivar", headers=h)
    assert r.status_code == 409, f"se archivo una empresa con servicio activo: {r.status_code}"
    assert "activo" in r.json()["detail"], r.json()
    print("PASS: no se archiva un vinculo con servicios activos, y el error dice por que")

    # Terminado el servicio, si se puede: es la salida que ofrece el mensaje.
    # El 4to argumento es el ACTOR (un usuario), no el mandante: queda en la
    # bitacora del servicio y tiene FK contra usuarios.
    servicio_service.cambiar_estado_servicio(db, servicio.id, EstadoServicio.TERMINADO)
    assert cliente.post(f"{base}/{con_servicio.id}/archivar", headers=h).status_code == 200
    print("PASS: con el servicio terminado, archivar funciona")

    # ── 3. Archivar no mueve el estado de acreditacion ──────────────────────
    rel = db.query(ContratistaMandante).filter_by(
        mandante_id=codelco.id, contratista_id=con_servicio.id).first()
    db.refresh(rel)
    antes = rel.estado_acreditacion
    cliente.post(f"{base}/{con_servicio.id}/desarchivar", headers=h)
    db.refresh(rel)
    assert rel.estado_acreditacion == antes, (
        f"archivar/desarchivar movio el estado de acreditacion: {antes} -> "
        f"{rel.estado_acreditacion}. Es la invariante que hace seguro archivar.")
    print("PASS: archivar y desarchivar no tocan el estado de acreditacion")

    # ── 4. Eliminar el vinculo sin rastro NO borra la empresa ────────────────
    assert cliente.delete(f"{base}/{equivocada.id}", headers=h).status_code == 204
    assert "77.111.111-1" not in _ruts(cliente, h, archivados=True), "el vinculo sigue"
    assert db.query(EmpresaContratista).filter_by(rut="77.111.111-1").first() is not None, (
        "se borro la EMPRESA y no solo el vinculo: es una sola fila en la "
        "plataforma y puede estar trabajando con otros mandantes")
    print("PASS: eliminar borra el vinculo y deja intacta la empresa")

    # ── 5. Con rastro NO se elimina ──────────────────────────────────────────
    r = cliente.delete(f"{base}/{con_servicio.id}", headers=h)
    assert r.status_code == 409, f"se borro un vinculo con servicios: {r.status_code}"
    # "Arch" y no "rchiv": el mensaje dice "Archivalo" con tilde en la i.
    assert "servicio" in r.json()["detail"] and "Arch" in r.json()["detail"], r.json()

    # Y el caso que un guard solo sobre servicios dejaria pasar: sin servicios,
    # pero con documentos acreditados.
    r = cliente.delete(f"{base}/{con_docs.id}", headers=h)
    assert r.status_code == 409, (
        f"se borro un vinculo sin servicios pero CON acreditaciones: {r.status_code}. "
        "Eso destruye el registro de que se le exigio y que entrego.")
    assert "documento" in r.json()["detail"], r.json()
    print("PASS: no se elimina un vinculo con servicios ni uno con documentos acreditados")

    # ── 6. Aislamiento entre organizaciones ─────────────────────────────────
    ajena = _headers(cliente, "jefa@lp.cl")
    for metodo, url in (
        ("post", f"{base}/{con_docs.id}/archivar"),
        ("post", f"{base}/{con_docs.id}/desarchivar"),
        ("delete", f"{base}/{con_docs.id}"),
    ):
        r = getattr(cliente, metodo)(url, headers=ajena)
        assert r.status_code == 403, f"{metodo.upper()} {url} devolvio {r.status_code}"
    print("PASS: nadie archiva ni elimina el vinculo de otra organizacion")

    db.close()
    app.dependency_overrides.clear()
    print("TODOS LOS TESTS DEL VINCULO CONTRATISTA-MANDANTE PASARON")


if __name__ == "__main__":
    run()


# ── Puente para pytest ────────────────────────────────────────────────────────
def test_vinculo_contratista():
    run()
