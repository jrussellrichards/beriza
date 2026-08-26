"""
Ficha de la empresa contratista: los datos que el mandante necesita en una
fiscalizacion.

Observacion #3 del feedback del 25 de agosto de 2026. EmpresaContratista tenia
tres campos —rut, razon_social y giro— y en una fiscalizacion de la Direccion del
Trabajo o la SUSESO el mandante no tenia de donde sacar a quien llamar ni a que
mutualidad esta afiliada la empresa.

Lo que se verifica:

  1. que la edicion sea PARCIAL —lo que no viaja no se toca—, porque si no,
     completar la mutualidad borraria la direccion que alguien cargo ayer,
  2. que la cadena vacia SI limpie: es la unica forma de corregir un dato mal
     cargado, y estos campos son opcionales,
  3. que una mutualidad inventada se rechace, que es la razon de que sea un enum
     cerrado y no texto libre,
  4. que el RUT del representante valide digito verificador, que es para lo que
     se guarda separado del nombre,
  5. y que la razon social no se pueda dejar vacia.

Correr:  python tests/test_datos_contratista.py
"""
import os
import sys
import tempfile

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_contratista_")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.core.exceptions import AsignacionInvalida, RutInvalido
from app.domain import contratista_service
from app.models.base import Base
from app.models.contratista import EmpresaContratista


def run():
    eng = create_engine("sqlite://")
    Base.metadata.create_all(eng)
    db = sessionmaker(bind=eng)()

    emp = EmpresaContratista(rut="77.123.456-7", razon_social="Contratista Demo Ltda")
    db.add(emp)
    db.commit()

    # ── 1. La edicion es parcial ─────────────────────────────────────────────
    contratista_service.actualizar_empresa(
        db, emp.id, direccion="Av. Siempre Viva 742, Antofagasta",
        telefono_emergencia="+56 9 1234 5678",
    )
    contratista_service.actualizar_empresa(db, emp.id, mutualidad="ACHS")
    db.refresh(emp)
    assert emp.direccion == "Av. Siempre Viva 742, Antofagasta", (
        f"completar la mutualidad borro la direccion: {emp.direccion!r}. La edicion "
        f"tiene que ser parcial o cada campo nuevo pisa el anterior.")
    assert emp.telefono_emergencia == "+56 9 1234 5678", emp.telefono_emergencia
    assert emp.mutualidad == "ACHS", emp.mutualidad
    assert emp.razon_social == "Contratista Demo Ltda", "no se toco y cambio"
    print("PASS: la edicion es parcial, lo que no viaja no se toca")

    # ── 2. La cadena vacia limpia ────────────────────────────────────────────
    contratista_service.actualizar_empresa(db, emp.id, direccion="")
    db.refresh(emp)
    assert emp.direccion is None, (
        f"la cadena vacia dejo {emp.direccion!r} en vez de limpiar. Sin esto no hay "
        f"forma de corregir una direccion mal cargada.")
    print("PASS: la cadena vacia limpia el campo")

    # ── 3. Mutualidad fuera de la lista se rechaza ───────────────────────────
    for inventada in ("Asociacion Chilena de Seguridad", "A.C.H.S.", "MUTUAL"):
        try:
            contratista_service.actualizar_empresa(db, emp.id, mutualidad=inventada)
            raise AssertionError(
                f"se acepto la mutualidad {inventada!r}. Con texto libre, ACHS y "
                f"'Asociacion Chilena de Seguridad' son dos organismos distintos y "
                f"no se puede ni filtrar ni reportar.")
        except AsignacionInvalida as e:
            assert "ACHS" in str(e), f"el error no dice cuales son validas: {e}"
    db.refresh(emp)
    assert emp.mutualidad == "ACHS", f"un rechazo dejo el campo sucio: {emp.mutualidad!r}"
    print("PASS: una mutualidad fuera de la lista se rechaza y no ensucia el campo")

    # Y las cuatro reales se aceptan, en minusculas incluidas
    for valida, guardada in (("achs", "ACHS"), ("MUTUAL_CCHC", "MUTUAL_CCHC"),
                             ("ist", "IST"), ("ISL", "ISL")):
        contratista_service.actualizar_empresa(db, emp.id, mutualidad=valida)
        db.refresh(emp)
        assert emp.mutualidad == guardada, (valida, emp.mutualidad)
    print("PASS: las 4 mutualidades reales se aceptan y se normalizan a mayusculas")

    # ── 4. El RUT del representante valida digito verificador ────────────────
    try:
        # 11.111.111-2 es invalido: el DV correcto de 11.111.111 es 1. Se eligio
        # un DV equivocado a proposito y no un RUT al azar, porque el error que
        # importa detectar es ese —el digito cambiado al transcribir a mano—.
        contratista_service.actualizar_empresa(db, emp.id, representante_legal_rut="11.111.111-2")
        raise AssertionError(
            "se acepto un RUT con digito verificador incorrecto. Un representante "
            "con RUT malo no sirve para contrastar contra VIGENCIA_PODERES, que es "
            "para lo que se guarda separado del nombre.")
    except RutInvalido as e:
        assert "verificador" in str(e), f"el error no dice que fue el DV: {e}"
    print("PASS: un RUT de representante con DV malo se rechaza diciendo por que")

    contratista_service.actualizar_empresa(
        db, emp.id,
        representante_legal_nombre="María Soto Rivas",
        representante_legal_rut="12.345.678-5",
        representante_legal_telefono="+56 2 2345 6789",
    )
    db.refresh(emp)
    assert emp.representante_legal_rut is not None
    assert emp.representante_legal_nombre == "María Soto Rivas"
    print(f"PASS: representante legal completo, RUT normalizado a {emp.representante_legal_rut}")

    # ── 5. La razon social no se puede vaciar ────────────────────────────────
    try:
        contratista_service.actualizar_empresa(db, emp.id, razon_social="   ")
        raise AssertionError("se dejo la empresa sin razon social")
    except AsignacionInvalida:
        pass
    db.refresh(emp)
    assert emp.razon_social == "Contratista Demo Ltda"
    print("PASS: la razon social no se puede dejar vacia")

    db.close()
    print("TODOS LOS TESTS DE DATOS DEL CONTRATISTA PASARON")


if __name__ == "__main__":
    run()


# ── Puente para pytest ────────────────────────────────────────────────────────
def test_datos_contratista():
    run()
