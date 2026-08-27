"""
La suite corre con integridad referencial encendida.

Existe para que esto no se revierta en silencio.

SQLite ignora las claves foraneas por defecto. Durante mucho tiempo los 20
archivos de test hacian `create_engine("sqlite://")` pelado, asi que un DELETE
que dejaba filas huerfanas PASABA EN VERDE y solo se habria descubierto en el
PostgreSQL de produccion.

Es la misma familia que el `SELECT DISTINCT` sobre una columna json —que la
suite aceptaba y produccion rechazaba— y que el borrado de servicios, donde
`Expediente.servicio_id` es nullable y un DELETE mal hecho no falla: deja
expedientes apuntando a la nada, sin ruido.

El costo de que alguien escriba `create_engine("sqlite://")` en un archivo nuevo
no es que ese test sea peor: es que vuelve a ser CIEGO a una clase entera de
error, y nadie se entera hasta produccion.

Correr:  python tests/test_suite_con_fks.py
"""
import ast
import os
import pathlib
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test")

from sqlalchemy import text

from tests._db import engine_sqlite

_TESTS = pathlib.Path(__file__).parent

# El unico archivo que puede nombrar create_engine("sqlite://") es el helper.
_EXENTOS = {"_db.py"}


def run():
    # ── 1. El helper de verdad enciende las FKs ──────────────────────────────
    eng = engine_sqlite()
    with eng.connect() as c:
        assert c.execute(text("PRAGMA foreign_keys")).scalar() == 1, (
            "engine_sqlite() no esta encendiendo PRAGMA foreign_keys. Todos los "
            "tests que dependen de integridad referencial estan pasando en falso.")
    print("PASS: engine_sqlite() enciende PRAGMA foreign_keys")

    # ── 2. Y las rechaza de verdad, no solo dice que estan encendidas ────────
    import uuid
    from sqlalchemy.orm import sessionmaker
    import app.models  # noqa: F401
    from app.models.base import Base
    from app.models.trabajador import Trabajador

    Base.metadata.create_all(eng)
    db = sessionmaker(bind=eng)()
    try:
        db.add(Trabajador(
            empresa_id=uuid.uuid4(),  # no existe
            rut="12.345.678-5", nombre_completo="Fantasma",
        ))
        db.commit()
        raise AssertionError(
            "se inserto un trabajador cuya empresa no existe. El PRAGMA dice estar "
            "encendido pero la base no lo aplica.")
    except Exception as e:
        db.rollback()
        assert "FOREIGN KEY" in str(e).upper(), f"fallo por otra razon: {e}"
    db.close()
    print("PASS: una clave foranea inexistente se rechaza de verdad")

    # ── 3. Ningun test crea su motor a mano ──────────────────────────────────
    culpables = []
    for f in sorted(_TESTS.glob("*.py")):
        if f.name in _EXENTOS:
            continue
        arbol = ast.parse(f.read_text(encoding="utf-8"))
        for nodo in ast.walk(arbol):
            if not isinstance(nodo, ast.Call):
                continue
            nombre = getattr(nodo.func, "id", None) or getattr(nodo.func, "attr", None)
            if nombre != "create_engine":
                continue
            # Solo importa SQLite: un test contra Postgres real ya valida FKs.
            for arg in nodo.args:
                if isinstance(arg, ast.Constant) and str(arg.value).startswith("sqlite"):
                    culpables.append(f"{f.name}:{nodo.lineno}")
    assert not culpables, (
        f"estos tests crean su motor SQLite a mano en vez de usar "
        f"tests._db.engine_sqlite(): {culpables}. Sin PRAGMA foreign_keys=ON, "
        f"SQLite acepta filas huerfanas y el test queda ciego a una clase entera "
        f"de error que solo aparece en el PostgreSQL de produccion.")
    n = len([f for f in _TESTS.glob("test_*.py")])
    print(f"PASS: ninguno de los {n} archivos de test crea su motor SQLite a mano")

    print("TODOS LOS TESTS DE LA SUITE CON FKS PASARON")


if __name__ == "__main__":
    run()


# ── Puente para pytest ────────────────────────────────────────────────────────
def test_suite_con_fks():
    run()
