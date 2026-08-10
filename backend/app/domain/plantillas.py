"""
Plantillas de exigencia: qué requisitos exige un perfil el DÍA UNO.

Es una decisión distinta de `RequisitoDocumental.nivel`, y la separación importa:

    nivel     describe la NORMA. BASE es obligación legal de todo empleador en
              Chile, AMPLIADO exige un supuesto, OPCIONAL es práctica de mercado.
              Es un hecho sobre la ley y no cambia entre mandantes.
    plantilla describe la EXIGENCIA de un mandante concreto. Es comercial.

Un requisito puede ser BASE y no estar en el arranque: el DS 44 obliga a toda
empresa a tener programa preventivo, pero pedírselo a una PyME contratista en su
primera pantalla, junto a otros 43, la hace abandonar.

Sin esta separación un catálogo de 44 requisitos obliga a todo mandante a los 44,
porque `PerfilRequisitoConfig.es_obligatorio` nace en True.

Vive en el dominio y no en `scripts/seed.py` —donde estuvo primero— porque el
seed no es importable desde la API: dejarlo ahí significaba que un mandante real,
que nunca corre el seed de demo, no tenía forma de aplicar una plantilla y debía
marcar 44 casillas a mano, un request por casilla.
"""
import uuid

from sqlalchemy.orm import Session

from app.models.pilar import RequisitoDocumental

# Documentos que se obtienen en línea en una tarde, más dos por trabajador que no
# se renuevan. Es el default del onboarding: un contratista de 50 personas ve
# ~108 expedientes, no ~2.200.
#
# Solo requisitos de nivel BASE. VIGENCIA_SOCIEDAD y VIGENCIA_PODERES estuvieron
# acá y se sacaron: son AMPLIADO porque un contratista persona natural no puede
# obtenerlos, así que exigirlos el día uno reintroduce una brecha imposible.
ARRANQUE = frozenset({
    "F30",
    "F30_1",
    "CERT_AFILIACION_OA",
    "SII_SITUACION_TRIBUTARIA",
    "MIPER",
    "RIHS",
    "CONTRATO",
    "IRL_ODI",
})

# Lo condicional que gatilla una faena de construcción u obra física, sobre la
# base legal completa.
EXTRA_OBRA = frozenset({
    "RIOHS",
    "CPHS_DELEGADO_ACTA",
    "EPP_GESTION",
    "EPP_ENTREGA",
    "PROC_TRABAJO_SEGURO",
    "HDS_SUSTANCIAS",
    "EXAM_MED",
    "POLIZA_RESP_CIVIL",
    "POLIZA_TODO_RIESGO_OBRA",
})

NOMBRES = ("ARRANQUE", "COMPLETA", "OBRA")


def _codigos_base(db: Session) -> set[str]:
    """
    Los requisitos globales de nivel BASE, leídos de la base y no de una lista
    escrita a mano: si BERISA agrega un requisito BASE al catálogo, la plantilla
    COMPLETA lo incluye sin que nadie tenga que acordarse de editar este archivo.
    """
    filas = (
        db.query(RequisitoDocumental.codigo)
        .filter(RequisitoDocumental.mandante_id.is_(None))
        .filter(RequisitoDocumental.nivel == "BASE")
        .all()
    )
    return {f[0] for f in filas}


def codigos_de(db: Session, nombre: str) -> set[str]:
    """Códigos de requisito que exige la plantilla. Lanza ValueError si no existe."""
    if nombre == "ARRANQUE":
        return set(ARRANQUE)
    if nombre == "COMPLETA":
        return _codigos_base(db)
    if nombre == "OBRA":
        return _codigos_base(db) | set(EXTRA_OBRA)
    raise ValueError(f"Plantilla desconocida: {nombre}. Opciones: {', '.join(NOMBRES)}")


def resumen(db: Session) -> list[dict]:
    """Las plantillas disponibles con su conteo, para que la UI las ofrezca."""
    salida = []
    for nombre in NOMBRES:
        codigos = codigos_de(db, nombre)
        salida.append({
            "nombre": nombre,
            "requisitos": len(codigos),
            "descripcion": {
                "ARRANQUE": "Lo mínimo para empezar: documentos que se obtienen en línea.",
                "COMPLETA": "Todo lo que la ley chilena exige a cualquier empleador.",
                "OBRA": "La base legal más lo que gatilla una obra física.",
            }[nombre],
        })
    return salida
