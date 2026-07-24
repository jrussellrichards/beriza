"""
Tests unitarios de la autorización de pertenencia de tenant (Fase 0).

Cubre la decisión de acceso sin necesidad de una base de datos real ni de
email-validator: se construyen instancias de modelo en memoria y se usa un
FakeDB mínimo para los caminos que consultan (trabajador / vínculo).

Correr:  python tests/test_tenant.py     (o vía pytest)
"""
import os
import sys
import uuid

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql://x:x@localhost/x")
os.environ.setdefault("JWT_SECRET", "test")

from fastapi import HTTPException

from app.middleware.tenant import (
    verificar_acceso_documento,
    verificar_acceso_relacion,
    verificar_puede_subir_para,
)
from app.models.contratista import ContratistaMandante
from app.models.documento import Documento
from app.models.trabajador import Trabajador
from app.models.usuario import Usuario

M_A, M_B = uuid.uuid4(), uuid.uuid4()
C_A, C_B = uuid.uuid4(), uuid.uuid4()


def _mandante(mid):
    return Usuario(rol="mandante_admin", mandante_id=mid, contratista_id=None,
                   email="m@x.cl", nombre="m", password_hash="")


def _contratista(cid):
    return Usuario(rol="contratista_admin", mandante_id=None, contratista_id=cid,
                   email="c@x.cl", nombre="c", password_hash="")


def _admin():
    return Usuario(rol="berisa_admin", mandante_id=None, contratista_id=None,
                   email="a@x.cl", nombre="a", password_hash="")


def _expect_403(fn):
    try:
        fn()
    except HTTPException as e:
        assert e.status_code == 403, f"esperaba 403, vino {e.status_code}"
        return
    raise AssertionError("esperaba HTTPException 403, no se lanzó")


class _FakeQuery:
    def __init__(self, result):
        self._r = result

    def filter_by(self, **kw):
        return self

    def first(self):
        return self._r


class _FakeDB:
    def __init__(self, get_result=None, query_result=None):
        self._get, self._q = get_result, query_result

    def get(self, model, id_):
        return self._get

    def query(self, model):
        return _FakeQuery(self._q)


def test_acceso_documento_empresa():
    doc = Documento(mandante_id=M_A, empresa_id=C_A, trabajador_id=None)
    verificar_acceso_documento(_FakeDB(), doc, _mandante(M_A))     # mandante que lo exige
    verificar_acceso_documento(_FakeDB(), doc, _contratista(C_A))  # contratista dueño
    verificar_acceso_documento(_FakeDB(), doc, _admin())           # berisa transversal
    _expect_403(lambda: verificar_acceso_documento(_FakeDB(), doc, _mandante(M_B)))
    _expect_403(lambda: verificar_acceso_documento(_FakeDB(), doc, _contratista(C_B)))


def test_acceso_documento_trabajador():
    doc = Documento(mandante_id=M_A, empresa_id=None, trabajador_id=uuid.uuid4())
    db = _FakeDB(get_result=Trabajador(empresa_id=C_A, rut="1-9", nombre_completo="Juan"))
    verificar_acceso_documento(db, doc, _contratista(C_A))
    _expect_403(lambda: verificar_acceso_documento(db, doc, _contratista(C_B)))


def test_acceso_relacion():
    verificar_acceso_relacion(_FakeDB(), C_A, M_A, _mandante(M_A))
    verificar_acceso_relacion(_FakeDB(), C_A, M_A, _contratista(C_A))
    verificar_acceso_relacion(_FakeDB(), C_A, M_A, _admin())
    _expect_403(lambda: verificar_acceso_relacion(_FakeDB(), C_A, M_A, _mandante(M_B)))
    _expect_403(lambda: verificar_acceso_relacion(_FakeDB(), C_A, M_A, _contratista(C_B)))


def test_puede_subir():
    db_vinc = _FakeDB(query_result=ContratistaMandante(contratista_id=C_A, mandante_id=M_A))
    verificar_puede_subir_para(db_vinc, _contratista(C_A), M_A, C_A, None)                 # empresa propia + vinculado
    _expect_403(lambda: verificar_puede_subir_para(db_vinc, _contratista(C_A), M_A, C_B, None))  # empresa ajena
    db_novinc = _FakeDB(query_result=None)
    _expect_403(lambda: verificar_puede_subir_para(db_novinc, _contratista(C_A), M_A, C_A, None))  # mandante no vinculado


def _run():
    fallos = 0
    for nombre, fn in list(globals().items()):
        if nombre.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"PASS {nombre}")
            except AssertionError as e:
                fallos += 1
                print(f"FAIL {nombre}: {e}")
    print("Todos los tests de tenant PASARON" if not fallos else f"{fallos} test(s) fallaron")
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    _run()
