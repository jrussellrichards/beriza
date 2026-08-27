"""
Datos personales del trabajador y la validacion de RUT al darlo de alta.

Observacion #6 del feedback del 25 de agosto de 2026: al agregar un trabajador
solo se pedia RUT, nombre y cargo. Faltaba a quien llamar si le pasa algo en
faena, y la fecha de nacimiento, sin la cual no se puede comprobar una
restriccion de edad.

Y un bug encontrado al implementarlo: `nomina_service` validaba el digito
verificador del RUT y el endpoint de a uno NO, asi que la misma persona se
aceptaba o se rechazaba segun por donde entrara. Un RUT con el digito cambiado
deja los documentos colgando de alguien que no existe, y el mandante no puede
contrastarlo contra el contrato ni contra el examen ocupacional.

Correr:  python tests/test_datos_trabajador.py
"""
import os
import sys
import tempfile
from datetime import date, timedelta

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_trabajador_")

from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.core.exceptions import AsignacionInvalida, RutInvalido
from app.domain import trabajador_service
from app.models.base import Base
from app.models.contratista import EmpresaContratista

from tests._db import engine_sqlite


def run():
    eng = engine_sqlite()
    Base.metadata.create_all(eng)
    db = sessionmaker(bind=eng)()

    emp = EmpresaContratista(rut="77.123.456-7", razon_social="Contratista Demo")
    otra = EmpresaContratista(rut="78.123.456-2", razon_social="Otra Empresa")
    db.add_all([emp, otra])
    db.commit()

    # ── 1. El alta de a uno valida el RUT, igual que la nomina ───────────────
    try:
        trabajador_service.crear_trabajador(
            db, emp.id, rut="11.111.111-2", nombre_completo="Fantasma Perez",
        )
        raise AssertionError(
            "se creo un trabajador con el digito verificador cambiado. La nomina "
            "masiva rechaza esa misma fila: el mismo dato no puede aceptarse o "
            "rechazarse segun por donde entre.")
    except RutInvalido as e:
        assert "verificador" in str(e), f"el error no dice que fue el DV: {e}"
    print("PASS: el alta de a uno valida el DV del RUT, igual que la nomina masiva")

    # ── 2. Alta completa con los datos nuevos ────────────────────────────────
    t = trabajador_service.crear_trabajador(
        db, emp.id,
        rut="12345678-5", nombre_completo="  Carla Núñez Soto  ", cargo="Soldadora",
        fecha_nacimiento=date(1990, 5, 14),
        email="carla@contratista.cl", telefono="+56 9 1111 2222",
        direccion="Pasaje Los Aromos 45, Calama",
        contacto_emergencia_nombre="Rosa Soto", contacto_emergencia_telefono="+56 9 3333 4444",
    )
    assert t.rut == "12.345.678-5", f"el RUT no quedo normalizado: {t.rut}"
    assert t.nombre_completo == "Carla Núñez Soto", f"no se limpio el nombre: {t.nombre_completo!r}"
    assert t.fecha_nacimiento == date(1990, 5, 14)
    assert t.contacto_emergencia_telefono == "+56 9 3333 4444"
    print(f"PASS: alta completa, RUT normalizado a {t.rut}")

    # ── 3. RUT repetido en la MISMA empresa se rechaza ───────────────────────
    try:
        trabajador_service.crear_trabajador(
            db, emp.id, rut="12.345.678-5", nombre_completo="Otra Persona",
        )
        raise AssertionError("se duplico a la persona dentro de la misma empresa")
    except AsignacionInvalida as e:
        assert "Carla" in str(e), f"el error no dice quien ya estaba: {e}"
    print("PASS: un RUT repetido en la misma empresa se rechaza diciendo quien es")

    # ...pero la MISMA persona puede estar en otra empresa. Un soldador puede
    # trabajar para dos contratistas distintos y no son la misma ficha.
    t_otra = trabajador_service.crear_trabajador(
        db, otra.id, rut="12.345.678-5", nombre_completo="Carla Núñez Soto",
    )
    assert t_otra.id != t.id
    print("PASS: la misma persona puede estar dada de alta en dos empresas distintas")

    # ── 4. Fechas de nacimiento imposibles ───────────────────────────────────
    for fecha, motivo in (
        (date.today() + timedelta(days=1), "futuro"),
        (date.today() - timedelta(days=365 * 3), "3 años"),
        (date(1850, 1, 1), "175 años"),
    ):
        try:
            trabajador_service.crear_trabajador(
                db, emp.id, rut="16.789.012-1", nombre_completo="Prueba Fecha",
                fecha_nacimiento=fecha,
            )
            raise AssertionError(f"se acepto una fecha de nacimiento en el {motivo}")
        except AsignacionInvalida:
            pass
    print("PASS: fechas de nacimiento imposibles se rechazan (futuro, muy joven, muy viejo)")

    # ── 5. Edicion parcial y limpieza ────────────────────────────────────────
    trabajador_service.actualizar_trabajador(
        db, t.id, emp.id, telefono="+56 9 9999 0000",
    )
    db.refresh(t)
    assert t.email == "carla@contratista.cl", (
        f"cambiar el telefono borro el email: {t.email!r}. La edicion tiene que ser parcial.")
    assert t.telefono == "+56 9 9999 0000"
    assert t.direccion == "Pasaje Los Aromos 45, Calama"

    trabajador_service.actualizar_trabajador(db, t.id, emp.id, direccion="")
    db.refresh(t)
    assert t.direccion is None, f"la cadena vacia no limpio: {t.direccion!r}"
    print("PASS: la edicion es parcial y la cadena vacia limpia")

    # ── 6. Aislamiento entre empresas ────────────────────────────────────────
    try:
        trabajador_service.actualizar_trabajador(db, t.id, otra.id, telefono="+56 9 0000 0000")
        raise AssertionError(
            "se edito a un trabajador de OTRA empresa. Sin comprobar empresa_id, "
            "cualquier contratista_admin puede tocar la ficha de alguien ajeno "
            "conociendo su id.")
    except AsignacionInvalida:
        pass
    db.refresh(t)
    assert t.telefono == "+56 9 9999 0000", "el intento fallido igual escribio"
    print("PASS: no se puede editar a un trabajador de otra empresa")

    db.close()
    print("TODOS LOS TESTS DE DATOS DEL TRABAJADOR PASARON")


if __name__ == "__main__":
    run()


# ── Puente para pytest ────────────────────────────────────────────────────────
def test_datos_trabajador():
    run()
