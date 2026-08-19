"""
validar_documento contra el motor de base de datos REAL.

Existe por un bug encontrado en produccion: configs_para_requisito hacia
`SELECT DISTINCT` sobre perfil_requisito_config, que tiene una columna `json`
(parametros_extra). PostgreSQL no tiene operador de igualdad para `json` y la
consulta muere con:

    could not identify an equality operator for type json

O sea: el dia que se encienda el pipeline de IA, TODA validacion de documento
revienta con 500 en produccion.

Por que ningun test lo vio: la suite entera hace create_engine("sqlite://") a
mano, y SQLite acepta ese DISTINCT sin chistar. CI levanta un Postgres real,
pero solo lo usaban alembic y el seed —ningun test lo tocaba, y de hecho ningun
test llamaba nunca a validar_documento—.

Este test cierra las dos cosas a la vez: ejercita la funcion de verdad, y lo
hace sobre el motor que diga DATABASE_URL. En local eso es SQLite y sirve de
prueba de regresion basica; en CI es PostgreSQL y ahi es donde muerde.

Correr:  python tests/test_validar_documento_motor_real.py
"""
import os
import sys
import tempfile
import uuid
from datetime import date, timedelta

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_motor_")

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401  registra todos los modelos
from app.models.base import Base
from app.models.mandante import Mandante
from app.models.pilar import Pilar, Subpilar, RequisitoDocumental
from app.models.contratista import EmpresaContratista, ContratistaMandante
from app.models.servicio import PerfilRequisitos, PerfilRequisitoConfig, Servicio
from app.domain import reglas_service
from app.domain.estados import EstadoServicio, EstadoDocumento


def _motor():
    """El motor que diga DATABASE_URL. En CI es PostgreSQL; en local, SQLite."""
    url = os.environ["DATABASE_URL"]
    if url.startswith("sqlite"):
        return create_engine("sqlite://"), "sqlite", None
    # Postgres: esquema aparte para no pisar lo que dejaron alembic y el seed
    esquema = f"t_{uuid.uuid4().hex[:12]}"
    eng = create_engine(url)
    with eng.begin() as c:
        c.execute(text(f'CREATE SCHEMA "{esquema}"'))
    eng.dispose()
    return create_engine(url, connect_args={"options": f"-csearch_path={esquema}"}), "postgres", (url, esquema)


def run():
    eng, motor, limpieza = _motor()
    print(f"motor bajo prueba: {motor}")
    try:
        Base.metadata.create_all(eng)
        db = sessionmaker(bind=eng)()

        man = Mandante(razon_social="M SpA", rut="76.1-9", slug="m", plan="Pro")
        emp = EmpresaContratista(razon_social="C Ltda", rut="77.2-8")
        db.add_all([man, emp]); db.flush()
        rel = ContratistaMandante(mandante_id=man.id, contratista_id=emp.id)
        pil = Pilar(codigo="P", nombre="P", orden=1)
        db.add_all([rel, pil]); db.flush()
        sub = Subpilar(pilar_id=pil.id, codigo="S", nombre="S", orden=1)
        db.add(sub); db.flush()
        req = RequisitoDocumental(
            subpilar_id=sub.id, codigo="EXAM_MED", nombre="Examen ocupacional",
            entidad_tipo="TRABAJADOR", alcance="ENTIDAD",
        )
        db.add(req); db.flush()

        # UN perfil en DOS servicios activos: es lo que duplicaba las filas y
        # obligaba al DISTINCT que rompia en Postgres.
        perfil = PerfilRequisitos(mandante_id=man.id, nombre="P1")
        db.add(perfil); db.flush()
        db.add(PerfilRequisitoConfig(
            perfil_id=perfil.id, requisito_documental_id=req.id,
            es_obligatorio=True, vigencia_max_dias=365, umbral_deuda_max=0,
            parametros_extra={"algo": 1},   # la columna json que rompe el DISTINCT
        ))
        for n in ("S1", "S2"):
            db.add(Servicio(
                contratista_mandante_id=rel.id, perfil_requisitos_id=perfil.id,
                nombre=n, fecha_inicio=date.today() - timedelta(days=30),
                estado=EstadoServicio.ACTIVO,
            ))
        db.commit()

        # 1. La consulta corre en este motor y deduplica
        configs = reglas_service.configs_para_requisito(db, man.id, req.id, emp.id)
        assert len(configs) == 1, (
            f"el mismo perfil en 2 servicios activos devolvio {len(configs)} configs; "
            f"deberia deduplicar a 1")
        print("PASS: configs_para_requisito corre en este motor y deduplica a 1")

        # 2. validar_documento de punta a punta: NO APTO y vencido queda OBSERVADO
        r = reglas_service.validar_documento(
            db, req.id,
            {"resultado_aptitud": "NO APTO", "tipo_examen": "ALTURA",
             "fecha_examen": str(date.today() - timedelta(days=400))},
            man.id, contratista_id=emp.id,
        )
        assert not r.aprobado, "un examen NO APTO y vencido no puede aprobarse"
        assert r.estado == EstadoDocumento.OBSERVADO, r.estado
        assert any("NO APTO" in b for b in r.brechas), r.brechas
        assert any("400 días" in b for b in r.brechas), r.brechas
        print("PASS: examen NO APTO y vencido queda OBSERVADO con las dos brechas")

        # 3. Y uno bueno se aprueba: la regla no es un rechazo indiscriminado
        r2 = reglas_service.validar_documento(
            db, req.id,
            {"resultado_aptitud": "APTO", "tipo_examen": "ALTURA",
             "fecha_examen": str(date.today() - timedelta(days=10))},
            man.id, contratista_id=emp.id,
        )
        assert r2.aprobado and r2.estado == EstadoDocumento.APROBADO, (r2.estado, r2.brechas)
        print("PASS: examen APTO y vigente se aprueba")

        db.close()
        print("TODOS LOS TESTS DEL MOTOR REAL PASARON")
    finally:
        eng.dispose()
        if limpieza:
            url, esquema = limpieza
            lim = create_engine(url)
            with lim.begin() as c:
                c.execute(text(f'DROP SCHEMA IF EXISTS "{esquema}" CASCADE'))
            lim.dispose()


if __name__ == "__main__":
    run()


# ── Puente para pytest ────────────────────────────────────────────────────────
def test_validar_documento_motor_real():
    run()
