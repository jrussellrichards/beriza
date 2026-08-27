"""
Motor de pruebas con integridad referencial encendida.

Existe porque SQLite ignora las claves foraneas por defecto y la suite entera
hace `create_engine("sqlite://")` pelado. Consecuencia concreta: un DELETE que
deja filas huerfanas —expedientes apuntando a un servicio que ya no existe—
PASA EN VERDE en los tests y solo revienta en el PostgreSQL de produccion.

Es la misma familia de agujero que dejo pasar el `SELECT DISTINCT` sobre una
columna json: la suite es permisiva donde produccion es estricta.

Usar `engine_sqlite()` en cualquier test que borre filas o dependa de una FK.
"""
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine


def engine_sqlite() -> Engine:
    """SQLite en memoria con PRAGMA foreign_keys=ON en cada conexion."""
    eng = create_engine("sqlite://")

    @event.listens_for(eng, "connect")
    def _encender_fks(dbapi_conn, _record):  # noqa: ANN001
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    return eng
