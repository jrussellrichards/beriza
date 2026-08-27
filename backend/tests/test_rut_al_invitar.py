"""
El RUT de la empresa se valida y se normaliza al invitar un contratista.

Encontrado mientras se arreglaba lo mismo para trabajadores: el endpoint de
invitar contratista tomaba `body.rut` tal cual, sin validar y sin normalizar.
Eso son DOS problemas distintos, y el segundo es el peor.

PROBLEMA 1 — se acepta un RUT que no existe. Verificado en produccion: hay una
empresa con "76.766.766-6", cuyo digito verificador esta mal. Un RUT invalido no
sirve para contrastar contra ningun documento oficial, que es para lo que el
mandante lo guarda.

PROBLEMA 2 — la busqueda de "esta empresa ya esta en la plataforma?" era
`filter_by(rut=body.rut)`, un string exacto. Asi que "77777777-7" y
"77.777.777-7" son dos empresas DISTINTAS para el sistema. Y produccion ya tiene
los dos formatos mezclados, o sea que el caso esta vivo.

Por que el segundo es peor: todo el modelo de reutilizacion depende de que una
empresa sea UNA fila. Con dos, el contratista tiene que subir todo dos veces, sus
documentos no se comparten entre mandantes, y aparece como dos empresas
distintas en la plataforma.

Correr:  python tests/test_rut_al_invitar.py
"""
import os
import sys
import tempfile

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_rut_invitar_")

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.core.security import hash_password
from app.infrastructure.database import get_db
from app.models.base import Base
from app.models.contratista import EmpresaContratista
from app.models.mandante import Mandante
from app.models.usuario import Usuario

from tests._db import engine_sqlite


def _armar():
    eng = engine_sqlite(
        connect_args={"check_same_thread": False}, poolclass=StaticPool,
    )
    Base.metadata.create_all(eng)
    Sesion = sessionmaker(bind=eng)
    db = Sesion()

    man = Mandante(razon_social="Minera Demo", rut="76.943.205-1", slug="m", plan="Pro")
    db.add(man)
    db.flush()
    admin = Usuario(
        email="admin@minera.cl", nombre="Admin",
        password_hash=hash_password("secreta-larga"),
        rol="mandante_admin", activo=True, mandante_id=man.id,
    )
    db.add(admin)
    db.commit()

    from main import app
    app.dependency_overrides[get_db] = lambda: Sesion()
    cliente = TestClient(app)
    token = cliente.post("/api/v1/usuarios/login", json={
        "email": "admin@minera.cl", "password": "secreta-larga",
    }).json()["access_token"]
    return db, cliente, man, {"Authorization": f"Bearer {token}"}


def run():
    db, cliente, man, cab = _armar()
    url = f"/api/v1/mandantes/{man.id}/invitar-contratista"

    # ── 1. Un RUT con el digito cambiado se rechaza ──────────────────────────
    r = cliente.post(url, json={
        "email": "a@fantasma.cl", "razon_social": "Fantasma SpA", "rut": "76.766.766-6",
    }, headers=cab)
    assert r.status_code == 400, (
        f"se acepto un RUT con digito verificador incorrecto (HTTP {r.status_code}). "
        f"Un RUT invalido no sirve para contrastar contra ningun documento oficial, "
        f"que es para lo que el mandante lo guarda.")
    assert "verificador" in r.json()["detail"], r.json()
    assert db.query(EmpresaContratista).count() == 0, "se creo la empresa igual"
    print(f"PASS: RUT invalido rechazado con 400 — «{r.json()['detail']}»")

    # ── 2. Un RUT valido se guarda NORMALIZADO ───────────────────────────────
    r = cliente.post(url, json={
        "email": "admin@constructora.cl", "razon_social": "Constructora Uno SpA",
        "rut": "77777777-7",
    }, headers=cab)
    assert r.status_code in (200, 201), (r.status_code, r.text[:200])
    emp = db.query(EmpresaContratista).one()
    assert emp.rut == "77.777.777-7", (
        f"se guardo {emp.rut!r} tal como venia. Si no se normaliza, el mismo RUT "
        f"escrito distinto crea empresas distintas.")
    print(f"PASS: «77777777-7» se guardo normalizado como «{emp.rut}»")

    # ── 3. El mismo RUT en OTRO formato encuentra a la empresa ───────────────
    # Este es el que importa: sin normalizar, aca se creaba un DUPLICADO y el
    # contratista terminaba con dos fichas, subiendo todo dos veces.
    for otra_forma in ("77.777.777-7", "77777777-7", " 77.777.777-7 "):
        r = cliente.post(url, json={
            "email": "admin@constructora.cl", "razon_social": "Constructora Uno SpA",
            "rut": otra_forma,
        }, headers=cab)
        # Que responda "ya esta vinculada" es JUSTAMENTE la prueba: encontro la
        # empresa existente en vez de crear una copia. Antes, con el string
        # exacto, "77777777-7" no encontraba a "77.777.777-7" y creaba otra.
        assert r.status_code == 400 and "ya está vinculada" in r.json()["detail"], (
            otra_forma, r.status_code, r.text[:200])
        n = db.query(EmpresaContratista).count()
        assert n == 1, (
            f"escribir el RUT como {otra_forma!r} creo una empresa nueva: hay {n}. "
            f"Todo el modelo de reutilizacion depende de que una empresa sea UNA "
            f"fila; con dos, el contratista sube todo dos veces y sus documentos no "
            f"se comparten.")
    print("PASS: el mismo RUT en tres formatos distintos reconoce la MISMA empresa")

    # ── 4. Basura tambien se rechaza, diciendo que pasa ──────────────────────
    for basura, esperado in (
        ("", "Falta"),
        ("no-es-un-rut", "formato"),
        ("123-4", "corto"),
    ):
        r = cliente.post(url, json={
            "email": f"x{len(basura)}@y.cl", "razon_social": "Z", "rut": basura,
        }, headers=cab)
        assert r.status_code == 400, (basura, r.status_code)
        assert esperado.lower() in r.json()["detail"].lower(), (basura, r.json())
    print("PASS: RUT vacio, con letras o demasiado corto se rechazan con su motivo")

    db.close()
    print("TODOS LOS TESTS DE RUT AL INVITAR PASARON")


if __name__ == "__main__":
    run()


# ── Puente para pytest ────────────────────────────────────────────────────────
def test_rut_al_invitar():
    run()
