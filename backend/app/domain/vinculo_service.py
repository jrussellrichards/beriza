"""
El vínculo entre un mandante y una empresa contratista.

`ContratistaMandante` es su propio agregado: tiene el estado de acreditación que
calcula el dominio y de él cuelgan los servicios. Lo que vive acá es su ciclo de
vida — archivarlo y borrarlo—, que no existía: un mandante podía invitar a una
empresa y después no tenía forma de sacarla, ni cuando invitaba a la equivocada
ni cuando la relación comercial terminaba.

Es deliberadamente un módulo aparte de `contratista_service`, que administra la
FICHA de la empresa (mutualidad, dirección, representante legal). Son dos cosas
distintas y con dueños distintos: la ficha es de la empresa y la misma para todos
sus mandantes; el vínculo es de UN mandante con esa empresa.

La distinción que gobierna todo el módulo:

    BORRAR   solo si el vínculo no dejó rastro — la invitación equivocada.
    ARCHIVAR para el resto: sale de la lista y conserva el historial.

Borrar un vínculo con acreditaciones destruiría el registro de qué se le exigió a
esa empresa y qué entregó, que es lo que hace defendible la acreditación ante una
fiscalización. Es el mismo criterio que servicio_service aplica a los servicios.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.exceptions import ContratistaNoEncontrado, VinculoEnUso
from app.domain.estados import EstadoServicio
from app.models.contratista import ContratistaMandante
from app.models.expediente import Acreditacion, Expediente
from app.models.servicio import Servicio
from app.models.trabajador import Trabajador


def obtener_vinculo(
    db: Session, mandante_id: uuid.UUID, contratista_id: uuid.UUID
) -> ContratistaMandante:
    """
    El vínculo de ESTE mandante con ESTA empresa.

    Se busca por el par y no por un id de vínculo: así la ruta no puede operar
    sobre el vínculo de otra organización aunque se conozca su id.
    """
    vinculo = db.query(ContratistaMandante).filter_by(
        mandante_id=mandante_id, contratista_id=contratista_id
    ).first()
    if not vinculo:
        raise ContratistaNoEncontrado(
            "Ese contratista no está vinculado a tu organización."
        )
    return vinculo


def _acreditaciones_del_vinculo(
    db: Session, mandante_id: uuid.UUID, contratista_id: uuid.UUID
) -> int:
    """
    Cuántas acreditaciones tiene esta empresa ante este mandante.

    Hay que llegar por el expediente porque `Acreditacion` no referencia el
    vínculo: cuelga de (expediente, mandante). Y el expediente pertenece a una
    empresa O a un trabajador —`ck_expediente_entidad_xor`—, así que el OR de
    abajo no es defensivo: sin la rama del trabajador se perderían todas las
    acreditaciones de documentos personales, que son la mayoría.

    No se usa `Expediente.empresa_duena_id`: es una property de Python y su
    propio docstring advierte que no sirve para filtrar en SQL.
    """
    return (
        db.query(Acreditacion)
        .join(Expediente, Acreditacion.expediente_id == Expediente.id)
        .outerjoin(Trabajador, Expediente.trabajador_id == Trabajador.id)
        .filter(
            Acreditacion.mandante_id == mandante_id,
            or_(
                Expediente.empresa_id == contratista_id,
                Trabajador.empresa_id == contratista_id,
            ),
        )
        .count()
    )


def motivos_no_eliminable(db: Session, vinculo: ContratistaMandante) -> list[str]:
    """
    Por qué NO se puede borrar este vínculo. Lista vacía = se puede.

    Los dos conteos son CRUDOS, sin filtrar por estado ni por archivado, y eso es
    lo importante: un servicio TERMINADO o archivado sigue siendo el registro de
    que esa empresa trabajó acá, y una acreditación de hace un año sigue siendo
    la prueba de qué se le exigió. La pregunta no es "¿está vigente?", es
    "¿quedó rastro?".
    """
    motivos: list[str] = []

    n_servicios = db.query(Servicio).filter_by(
        contratista_mandante_id=vinculo.id
    ).count()
    if n_servicios:
        motivos.append(f"tiene {n_servicios} servicio(s) en su historial")

    n_acred = _acreditaciones_del_vinculo(db, vinculo.mandante_id, vinculo.contratista_id)
    if n_acred:
        motivos.append(f"tiene {n_acred} documento(s) acreditados ante tu organización")

    return motivos


def archivar(
    db: Session,
    mandante_id: uuid.UUID,
    contratista_id: uuid.UUID,
    usuario_id: uuid.UUID | None = None,
) -> ContratistaMandante:
    """
    Saca al contratista de la lista sin tocar su historial ni su acreditación.

    Solo se archiva un vínculo SIN servicios ACTIVOS, y esa invariante es lo que
    hace que archivar sea seguro: `evaluar_relacion` retorna temprano cuando no
    hay servicios activos, así que el vínculo ya estaba fuera de toda evaluación
    antes de archivarse. Archivarlo no puede mover ningún número derivado.

    Si se permitiera archivar un vínculo con servicios activos, el mandante
    escondería de su lista a una empresa que está trabajando en su faena hoy —que
    es exactamente a quien no puede perder de vista—.
    """
    vinculo = obtener_vinculo(db, mandante_id, contratista_id)
    if vinculo.archivado_en is not None:
        return vinculo  # idempotente

    activos = [s for s in vinculo.servicios if s.estado == EstadoServicio.ACTIVO]
    if activos:
        raise VinculoEnUso(
            f"«{vinculo.contratista.razon_social}» tiene {len(activos)} servicio(s) "
            "activo(s) y no se puede archivar: está trabajando contigo ahora. "
            "Termina o suspende esos servicios primero."
        )

    vinculo.archivado_en = datetime.now(timezone.utc)
    vinculo.archivado_por_usuario_id = usuario_id
    db.commit()
    db.refresh(vinculo)
    return vinculo


def desarchivar(
    db: Session, mandante_id: uuid.UUID, contratista_id: uuid.UUID
) -> ContratistaMandante:
    """
    Devuelve el contratista a la lista. El `estado_acreditacion` nunca se tocó,
    así que sigue siendo el que era y desarchivar tampoco mueve nada derivado.
    """
    vinculo = obtener_vinculo(db, mandante_id, contratista_id)
    vinculo.archivado_en = None
    vinculo.archivado_por_usuario_id = None
    db.commit()
    db.refresh(vinculo)
    return vinculo


def eliminar(db: Session, mandante_id: uuid.UUID, contratista_id: uuid.UUID) -> None:
    """
    Borra el vínculo con una empresa que nunca llegó a trabajar acá.

    Existe para el caso que motivó la petición: el mandante invitó a la empresa
    equivocada —un RUT mal tecleado, una razón social parecida— y esa empresa
    ensucia su lista para siempre. Ahí no hay nada que proteger.

    Se borra el VÍNCULO, nunca la empresa: `EmpresaContratista` es una sola fila
    en toda la plataforma y puede estar trabajando con otros mandantes. Sus
    expedientes tampoco se tocan — son tenant-agnósticos, la biblioteca es del
    contratista, no de quien lo contrató—.
    """
    vinculo = obtener_vinculo(db, mandante_id, contratista_id)
    motivos = motivos_no_eliminable(db, vinculo)
    if motivos:
        raise VinculoEnUso(
            f"«{vinculo.contratista.razon_social}» no se puede eliminar porque "
            f"{' y '.join(motivos)}. Archívalo: sale de la lista y conserva el historial."
        )

    db.delete(vinculo)
    db.commit()
