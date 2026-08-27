"""
Reemplazar una entrega que todavia nadie reviso.

Observacion #5 del feedback del 25 de agosto de 2026: el contratista sube el
documento equivocado y no puede corregirlo. Tiene que ESPERAR a que el mandante
revise y rechace algo que el ya sabe que esta malo. El mensaje del sistema era
literalmente "Espere el resultado antes de subir una nueva versión".

Lo que piden es poder BORRARLO. No se puede: este producto existe para poder
responder que entrego el contratista y cuando, y si se puede borrar, quien subio
un documento adulterado lo hace desaparecer. Lo que si se puede —y resuelve
exactamente el mismo dolor— es dejarlo REEMPLAZAR: sube una version nueva, la
anterior queda en el historial, y la cola del mandante pasa a mostrar la buena.

Para el contratista es indistinguible de lo que pidio. Para el sistema es la
diferencia entre tener registro y no tenerlo.

Lo que se verifica:

  1. que se pueda reemplazar una entrega en ENVIADO,
  2. que la entrega anterior NO desaparezca del expediente,
  3. que la acreditacion apunte a la nueva y el mandante vea esa,
  4. que quede registro de las dos subidas en la bitacora,
  5. que EN_ANALISIS siga bloqueado —ahi hay una tarea corriendo sobre la
     entrega vieja que pisaria el resultado de la nueva—,
  6. y que subir el MISMO archivo no cree una version nueva.

Correr:  python tests/test_reemplazar_entrega.py
"""
import os
import sys
import tempfile
from datetime import date

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_reemplazo_")

from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.core.exceptions import EntregaInvalida
from app.domain import documento_service
from app.domain.estados import EstadoDocumento
from app.models.base import Base
from app.models.contratista import ContratistaMandante, EmpresaContratista
from app.models.expediente import Acreditacion, Entrega, Expediente
from app.models.mandante import Mandante
from app.models.pilar import Pilar, RequisitoDocumental, Subpilar

from tests._db import engine_sqlite


class _ArchivoFalso:
    """Lo minimo que subir_entrega espera de un archivo."""
    def __init__(self, nombre: str, contenido: bytes):
        self.nombre_original = nombre
        self.contenido = contenido
        self.mime_type = "application/pdf"


def _armar(db):
    man = Mandante(razon_social="Minera Demo", rut="76.1-9", slug="m", plan="Pro")
    emp = EmpresaContratista(rut="77.2-8", razon_social="Contratista Demo")
    db.add_all([man, emp])
    db.flush()
    db.add(ContratistaMandante(mandante_id=man.id, contratista_id=emp.id))
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
    return man, emp, req


def run():
    eng = engine_sqlite()
    Base.metadata.create_all(eng)
    db = sessionmaker(bind=eng)()
    man, emp, req = _armar(db)

    # ── 1. Primera subida: el documento equivocado ───────────────────────────
    r1 = documento_service.subir_entrega(
        db, requisito_id=req.id, mandante_id=man.id, empresa_id=emp.id,
        trabajador_id=None, servicio_id=None,
        archivos=[_ArchivoFalso("f30-del-mes-pasado.pdf", b"%PDF-1.4 equivocado")],
        subido_por_usuario_id=None,
    )
    acred = db.get(Acreditacion, r1.documento_id)
    assert acred.estado == EstadoDocumento.ENVIADO, acred.estado
    entrega_mala = acred.entrega_id
    print(f"PASS: primera subida, version {r1.numero_version}, estado ENVIADO")

    # ── 2. Reemplazo, sin que nadie haya revisado ────────────────────────────
    r2 = documento_service.subir_entrega(
        db, requisito_id=req.id, mandante_id=man.id, empresa_id=emp.id,
        trabajador_id=None, servicio_id=None,
        archivos=[_ArchivoFalso("f30-correcto.pdf", b"%PDF-1.4 el bueno")],
        subido_por_usuario_id=None,
    )
    assert r2.numero_version == 2, (
        f"el reemplazo dio version {r2.numero_version}. Se esperaba una version "
        f"nueva, no reusar la anterior.")
    print("PASS: se puede reemplazar una entrega que nadie reviso todavia")

    # ── 3. La entrega anterior NO desaparece ─────────────────────────────────
    db.refresh(acred)
    exp = db.get(Expediente, acred.expediente_id)
    versiones = db.query(Entrega).filter_by(expediente_id=exp.id).all()
    assert len(versiones) == 2, (
        f"quedaron {len(versiones)} entregas. La anterior tiene que seguir en el "
        f"historial: si se borra, se pierde el registro de que entrego el "
        f"contratista y cuando, que es para lo que existe el producto.")
    assert entrega_mala in {e.id for e in versiones}, "la entrega reemplazada se borro"
    print("PASS: la entrega reemplazada sigue en el historial del expediente")

    # ── 4. La acreditacion apunta a la NUEVA, y eso es lo que ve el mandante ─
    assert acred.entrega_id == r2.version_id, (
        "la acreditacion sigue apuntando a la entrega vieja; el mandante revisaria "
        "el documento que el contratista ya reemplazo.")
    assert acred.numero_version == 2, acred.numero_version
    assert acred.estado == EstadoDocumento.ENVIADO, acred.estado

    cola = documento_service.listar_pendientes_revision(db, man.id)
    assert len(cola) == 1, f"la cola del mandante tiene {len(cola)} items, deberia tener 1"
    assert cola[0].entrega_id == r2.version_id, "la cola muestra la entrega vieja"
    print("PASS: la cola del mandante muestra la version nueva, no la reemplazada")

    # ── 5. Las dos subidas quedaron en la bitacora ───────────────────────────
    from app.models.expediente import AcreditacionEvento
    subidas = db.query(AcreditacionEvento).filter_by(
        acreditacion_id=acred.id, tipo_evento="SUBIDA",
    ).all()
    assert len(subidas) == 2, (
        f"hay {len(subidas)} eventos de SUBIDA. Tienen que estar las dos: el "
        f"reemplazo no puede borrar la huella de que hubo un primer intento.")
    print("PASS: la bitacora conserva las dos subidas")

    # ── 6. El mismo archivo no crea version nueva ────────────────────────────
    r3 = documento_service.subir_entrega(
        db, requisito_id=req.id, mandante_id=man.id, empresa_id=emp.id,
        trabajador_id=None, servicio_id=None,
        archivos=[_ArchivoFalso("f30-correcto.pdf", b"%PDF-1.4 el bueno")],
        subido_por_usuario_id=None,
    )
    assert r3.numero_version == 2, (
        f"subir el mismo contenido creo la version {r3.numero_version}. La "
        f"deduplicacion por hash tiene que seguir funcionando.")
    print("PASS: subir el mismo archivo no crea una version nueva")

    # ── 7. EN_ANALISIS sigue bloqueado ───────────────────────────────────────
    # No es un olvido: la tarea de IA esta corriendo sobre la entrega vieja y al
    # terminar escribe el resultado en la acreditacion. Si mientras tanto se
    # reemplaza, ese resultado se aplica al documento equivocado.
    db.refresh(acred)
    acred.estado = EstadoDocumento.EN_ANALISIS
    db.commit()
    try:
        documento_service.subir_entrega(
            db, requisito_id=req.id, mandante_id=man.id, empresa_id=emp.id,
        trabajador_id=None, servicio_id=None,
            archivos=[_ArchivoFalso("otro.pdf", b"%PDF-1.4 otro mas")],
            subido_por_usuario_id=None,
        )
        raise AssertionError(
            "se permitio reemplazar una entrega EN_ANALISIS. La tarea de IA que "
            "corre sobre la entrega vieja escribiria su resultado sobre la nueva.")
    except EntregaInvalida as e:
        assert "analiz" in str(e).lower(), f"el mensaje no explica por que: {e}"
    print("PASS: EN_ANALISIS sigue bloqueado, y el mensaje dice por que")

    db.close()
    print("TODOS LOS TESTS DE REEMPLAZO DE ENTREGA PASARON")


if __name__ == "__main__":
    run()


# ── Puente para pytest ────────────────────────────────────────────────────────
def test_reemplazar_entrega():
    run()
