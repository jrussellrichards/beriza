"""
El agregado de acreditacion se recalcula al cambiar el estado de un servicio.

Bug preexistente, encontrado analizando el radio de impacto de otra tarea.

`recalcular_estado_global` persiste en contratistas_mandantes.estado_acreditacion
si el contratista esta ACREDITADA, EN_PROCESO, BLOQUEADA o PENDIENTE. Ese numero
es el que ve el mandante en su lista y el que decide de un vistazo si deja entrar
gente a faena.

Lo llamaban tres lugares —subir un documento, el cron de vencimientos y el
pipeline de IA—, todos disparados por un DOCUMENTO. Ninguno por un SERVICIO. Y
el estado depende de los servicios: `recalcular_estado_global` arranca con

    if not evaluacion.tiene_servicios_activos: -> PENDIENTE

Reproducido antes de arreglarlo:

    1 servicio activo, F30 sin subir   -> BLOQUEADA
    tras TERMINAR el unico servicio    -> BLOQUEADA   (queda persistido)
    si alguien recalcula despues       -> PENDIENTE   (lo correcto)

O sea: un contratista que ya no trabaja para el mandante sigue figurando
BLOQUEADO hasta que alguien suba un documento cualquiera. Y cuando por fin
cambia, el cambio queda atribuido a quien subio ese documento, no a quien cerro
la faena dias antes.

Correr:  python tests/test_recalculo_al_cambiar_estado.py
"""
import os
import sys
import tempfile
from datetime import date

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_recalculo_")

from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.domain import acreditacion_service, servicio_service
from app.domain.estados import EstadoAcreditacion, EstadoServicio
from app.models.base import Base
from app.models.contratista import ContratistaMandante, EmpresaContratista
from app.models.mandante import Mandante
from app.models.pilar import Pilar, RequisitoDocumental, Subpilar

from tests._db import engine_sqlite


def _armar(db):
    man = Mandante(razon_social="Minera Demo", rut="76.1-9", slug="m", plan="Pro")
    emp = EmpresaContratista(razon_social="Contratista Demo", rut="77.2-8")
    db.add_all([man, emp])
    db.flush()
    rel = ContratistaMandante(mandante_id=man.id, contratista_id=emp.id)
    db.add(rel)
    db.flush()
    pilar = Pilar(codigo="LEGAL", nombre="Legal", orden=1)
    db.add(pilar)
    db.flush()
    sub = Subpilar(pilar_id=pilar.id, codigo="EMP", nombre="Empresa", orden=1)
    db.add(sub)
    db.flush()
    req = RequisitoDocumental(
        subpilar_id=sub.id, codigo="F30", nombre="Certificado F30",
        entidad_tipo="EMPRESA", alcance="ENTIDAD",
    )
    db.add(req)
    db.commit()

    perfil = servicio_service.crear_perfil(db, man.id, "Obra civil")
    servicio_service.configurar_requisito_perfil(
        db, perfil.id, req.id, es_obligatorio=True, vigencia_max_dias=90,
    )
    return man, emp, rel, perfil


def run():
    eng = engine_sqlite()
    Base.metadata.create_all(eng)
    db = sessionmaker(bind=eng)()
    man, emp, rel, perfil = _armar(db)

    srv = servicio_service.crear_servicio(
        db, man.id, emp.id, perfil.id, "Faena Uno", date.today(),
    )
    acreditacion_service.recalcular_estado_global(db, emp.id, man.id)
    db.refresh(rel)
    assert rel.estado_acreditacion == EstadoAcreditacion.BLOQUEADA, rel.estado_acreditacion
    print("PASS: con 1 servicio activo y el F30 sin subir, queda BLOQUEADA")

    # ── 1. Terminar el unico servicio tiene que recalcular ───────────────────
    servicio_service.cambiar_estado_servicio(db, srv.id, EstadoServicio.TERMINADO)
    db.refresh(rel)
    assert rel.estado_acreditacion == EstadoAcreditacion.PENDIENTE, (
        f"tras terminar el unico servicio quedo {rel.estado_acreditacion}. Deberia "
        f"ser PENDIENTE: sin servicios activos no hay nada que exigirle. El "
        f"contratista figura BLOQUEADO ante el mandante por una faena que ya "
        f"cerro, y no se corrige hasta que alguien suba un documento cualquiera.")
    print("PASS: terminar el ultimo servicio activo recalcula a PENDIENTE")

    # ── 2. Suspender tambien ─────────────────────────────────────────────────
    srv2 = servicio_service.crear_servicio(
        db, man.id, emp.id, perfil.id, "Faena Dos", date.today(),
    )
    acreditacion_service.recalcular_estado_global(db, emp.id, man.id)
    db.refresh(rel)
    assert rel.estado_acreditacion == EstadoAcreditacion.BLOQUEADA, rel.estado_acreditacion

    servicio_service.cambiar_estado_servicio(db, srv2.id, EstadoServicio.SUSPENDIDO)
    db.refresh(rel)
    assert rel.estado_acreditacion == EstadoAcreditacion.PENDIENTE, (
        f"suspender el unico servicio dejo {rel.estado_acreditacion}. Suspender "
        f"tambien saca al servicio de la evaluacion, asi que tiene el mismo efecto.")
    print("PASS: suspender el ultimo servicio activo tambien recalcula")

    # ── 3. Reactivar vuelve a exigir ─────────────────────────────────────────
    servicio_service.cambiar_estado_servicio(db, srv2.id, EstadoServicio.ACTIVO)
    db.refresh(rel)
    assert rel.estado_acreditacion == EstadoAcreditacion.BLOQUEADA, (
        f"reactivar dejo {rel.estado_acreditacion}. Al volver a estar activo, el "
        f"F30 que falta vuelve a ser una brecha y el contratista vuelve a estar "
        f"bloqueado. Recalcular en un solo sentido seria peor que no recalcular: "
        f"dejaria pasar gente a una faena reabierta sin papeles.")
    print("PASS: reactivar vuelve a exigir y devuelve a BLOQUEADA")

    # ── 4. Con OTRO servicio activo, terminar uno no cambia nada ─────────────
    srv3 = servicio_service.crear_servicio(
        db, man.id, emp.id, perfil.id, "Faena Tres", date.today(),
    )
    servicio_service.cambiar_estado_servicio(db, srv3.id, EstadoServicio.TERMINADO)
    db.refresh(rel)
    assert rel.estado_acreditacion == EstadoAcreditacion.BLOQUEADA, (
        f"terminar UNO de dos servicios dejo {rel.estado_acreditacion}. El otro "
        f"sigue activo y su F30 sigue faltando: no puede quedar PENDIENTE.")
    print("PASS: terminar uno de varios no relaja la exigencia de los otros")

    db.close()
    print("TODOS LOS TESTS DE RECALCULO PASARON")


if __name__ == "__main__":
    run()


# ── Puente para pytest ────────────────────────────────────────────────────────
def test_recalculo_al_cambiar_estado():
    run()
