"""
Seed completo de la plataforma Acredita.
Crea: pilares/requisitos, 4 mandantes con usuarios, 7 contratistas Codelco con
trabajadores y documentos en distintos estados, más contratistas bulk para los
demás mandantes.

Uso:
    cd backend
    python scripts/seed.py
"""

import sys
import os
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import uuid as uuid_lib

from app.core.config import settings
from app.domain import rut_service
from app.domain import plantillas as _plantillas
from app.domain.estados import Alcance, EstadoDocumento, EstadoServicio, TipoEvento
from app.models import Base, Usuario
from app.models.mandante import Mandante
from app.models.contratista import EmpresaContratista, ContratistaMandante
from app.models.pilar import Pilar, Subpilar, RequisitoDocumental
from app.models.servicio import PerfilRequisitos, PerfilRequisitoConfig, Servicio, ServicioTrabajador
from app.models.trabajador import Trabajador
from app.models.expediente import Acreditacion, AcreditacionEvento, Archivo, Entrega, Expediente
from app.models.centro_trabajo import CentroTrabajo
from app.models.permiso import UsuarioPilarPermiso

engine = create_engine(settings.DATABASE_URL)

HOY = date.today()

# ── Catálogo global de BERISA ────────────────────────────────────────────────
#
# Normativa chilena + práctica universal del rubro. NADA propio de un mandante:
# lo que un cliente exige de más son requisitos suyos (mandante_id NOT NULL) y
# este archivo no los toca.
#
# `nivel` describe la NATURALEZA NORMATIVA, que es un hecho sobre la ley:
#   BASE      obligación legal universal de todo empleador en Chile.
#   AMPLIADO  exigible solo si se cumple el supuesto escrito en la descripción
#             (dotación, exposición a un agente, nacionalidad, tipo de obra).
#   OPCIONAL  práctica de mercado; ninguna norma la impone al contratista.
#
# Qué exige un perfil el día uno es una decisión DISTINTA y vive en las
# PLANTILLAS de más abajo. Un requisito puede ser BASE y no estar en el arranque:
# el DS 44 obliga a toda empresa a tener programa preventivo, pero pedírselo a
# una PyME en su primera pantalla la hace abandonar.
#
# La vigencia no es un atributo del documento sino del umbral que exige cada
# mandante: viaja a PerfilRequisitoConfig.vigencia_max_dias. "No vence" NO se
# expresa con vigencia=0 sino con sin_vencimiento=True, que es lo que filtra
# vencimiento_service.

from dataclasses import dataclass

PDF_IMG = ["application/pdf", "image/jpeg", "image/png"]
PDF_TAB = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
]

PILARES_CATALOGO = [
    ("LEGAL", "Legal / Laboral", 1, "blue", [
        ("LEGAL_EMPRESA",     "Cumplimiento laboral y previsional", 1),
        ("LEGAL_REGLAMENTOS", "Obligaciones del empleador",         2),
        ("LEGAL_VINCULO",     "Contratación y vínculo laboral",     3),
    ]),
    ("HSE", "HSE — Salud, Seguridad y Medio Ambiente", 2, "amber", [
        ("HSE_GESTION",      "Gestión preventiva y documentos del sistema",           1),
        ("HSE_ORGANIZACION", "Organización preventiva y seguro Ley 16.744",           2),
        ("HSE_SALUD",        "Salud ocupacional, agentes de riesgo y medio ambiente", 3),
        ("HSE_PERSONAS",     "Protección e información de las personas",              4),
    ]),
    ("COMPLIANCE", "Compliance — Societario, tributario y de integridad", 3, "purple", [
        ("COMPLIANCE_SOCIETARIO", "Existencia legal y representación",       1),
        ("COMPLIANCE_TRIBUTARIO", "Situación tributaria y financiera",       2),
        ("COMPLIANCE_SEGUROS",    "Seguros y garantías del contrato",        3),
        ("COMPLIANCE_INTEGRIDAD", "Integridad, probidad y datos personales", 4),
    ]),
]


@dataclass(frozen=True)
class Req:
    codigo: str
    subpilar: str
    nombre: str
    entidad: str                   # EMPRESA | TRABAJADOR
    alcance: str                   # Alcance.ENTIDAD | Alcance.SERVICIO
    nivel: str                     # BASE | AMPLIADO | OPCIONAL
    vigencia: int = 365            # vigencia_max_dias por defecto del perfil
    sin_vencimiento: bool = False  # True => el cron de vencimientos lo ignora
    sensible: bool = False         # True => no se reutiliza solo entre mandantes
    max_archivos: int = 1
    formatos: list | None = None   # None => solo application/pdf
    desc: str = ""


CATALOGO = [
    # ── LEGAL · Cumplimiento laboral y previsional ───────────────────────────
    Req("F30", "LEGAL_EMPRESA",
        "Certificado F30 — Antecedentes laborales y previsionales",
        "EMPRESA", Alcance.ENTIDAD, "BASE", vigencia=30,
        desc="Certificado de la Dirección del Trabajo con las multas cursadas y deudas "
             "previsionales registradas del empleador. Se obtiene gratis en Mi DT con "
             "ClaveÚnica. Fundamento: art. 183-C del Código del Trabajo (derecho de "
             "información de la empresa principal) y DS 319/2006. Ninguna norma fija "
             "vigencia en días: los 30 son práctica y viven en la configuración del "
             "mandante. LÍMITE: refleja lo ya registrado, no audita planillas — un F30 "
             "limpio no prueba que todos los trabajadores estén cubiertos. "
             "REVISOR: emisor DT con folio verificable, RUT del contratista, emisión "
             "de menos de 30 días."),

    Req("F30_1", "LEGAL_EMPRESA",
        "Certificado F30-1 — Cumplimiento de obligaciones laborales y previsionales",
        "EMPRESA", Alcance.ENTIDAD, "BASE", vigencia=30,
        desc="Acredita el cumplimiento respecto de una obra, faena o servicio y por un "
             "período determinado. Es el pivote del ciclo mensual: se pide antes de "
             "cursar cada estado de pago. Fundamento: art. 183-C CT y DS 319/2006 — "
             "pedirlo periódicamente es lo que permite al mandante degradar su "
             "responsabilidad de solidaria a subsidiaria (arts. 183-B y 183-D). "
             "NOTA: el nombre anterior decía «Deuda previsional trabajadores», que es "
             "incorrecto — el certificado no certifica deuda. El alcance debería ser "
             "SERVICIO; se mantiene ENTIDAD hasta migrar los expedientes vivos. "
             "REVISOR: emisor DT, RUT del contratista, que nombre la obra o faena y el "
             "período, y que ese período sea el del estado de pago."),

    Req("NOMINA_PERSONAL", "LEGAL_EMPRESA",
        "Nómina de trabajadores asignados a la obra, faena o servicio",
        "EMPRESA", Alcance.SERVICIO, "AMPLIADO", vigencia=90,
        sensible=True, max_archivos=2, formatos=PDF_TAB,
        desc="SUPUESTO: el mandante necesita el padrón nominativo contra el que cuadrar "
             "el F30-1. Listado con nombre, RUT, cargo, tipo de contrato y fecha de "
             "ingreso. FUNDAMENTO ACOTADO: el DS 76/2006 art. 5 obliga a la EMPRESA "
             "PRINCIPAL a mantener un registro con el NÚMERO de trabajadores de cada "
             "contratista y las fechas estimadas de inicio y término — el detalle "
             "persona a persona es práctica de control de acceso, no obligación legal. "
             "El formato no está normado: no se puede rechazar por formato. "
             "REVISOR: papel del contratista con fecha y firma del representante legal, "
             "y que la cantidad de personas coincida con las asignadas al servicio."),

    # ── LEGAL · Obligaciones del empleador ───────────────────────────────────
    Req("PROTOCOLO_KARIN", "LEGAL_REGLAMENTOS",
        "Protocolo de prevención y procedimiento de investigación de acoso laboral, "
        "acoso sexual y violencia en el trabajo (Ley Karin)",
        "EMPRESA", Alcance.ENTIDAD, "BASE", vigencia=365, max_archivos=2,
        desc="Protocolo de prevención más el procedimiento de investigación y sanción, "
             "en dos archivos. Debe identificar canales de denuncia internos y externos "
             "y las medidas de resguardo. Fundamento: Ley 21.643, vigente desde el "
             "01-08-2024, SIN umbral de dotación — alcanza a toda empresa con al menos "
             "un trabajador. Incorpora el art. 211-A del Código del Trabajo y ordena "
             "elaborarlo a través de los organismos administradores de la Ley 16.744 "
             "según directrices de la SUSESO: se ACEPTA el protocolo emitido o visado "
             "por la mutualidad o el ISL. Las empresas de 10 o más lo incorporan a su "
             "RIOHS y pueden subir el mismo PDF en ambos requisitos. No hay plazo legal "
             "de caducidad: los 365 días son parámetro del producto. "
             "REVISOR: que nombre a la empresa con RUT, al menos un canal de denuncia, "
             "y firma o visación con fecha."),

    Req("DECL_INCLUSION_LABORAL", "LEGAL_REGLAMENTOS",
        "Comunicación electrónica de cumplimiento de la Ley 21.015 de inclusión laboral",
        "EMPRESA", Alcance.ENTIDAD, "AMPLIADO", vigencia=365,
        desc="SUPUESTO DE ACTIVACIÓN: el contratista ocupa 100 o más trabajadores. Bajo "
             "ese umbral la ley no lo exige y el requisito debe quedar apagado. "
             "Fundamento: Ley 21.015 — la comunicación se registra en Mi DT hasta el 31 "
             "de enero de cada año e informa el cumplimiento de la cuota del 1% o las "
             "medidas alternativas invocadas. "
             "REVISOR: comprobante electrónico de la DT del período vigente, con RUT del "
             "contratista y fecha de envío."),

    # ── LEGAL · Contratación y vínculo laboral ───────────────────────────────
    Req("CONTRATO", "LEGAL_VINCULO",
        "Contrato de trabajo y sus anexos",
        "TRABAJADOR", Alcance.ENTIDAD, "BASE",
        vigencia=365, sin_vencimiento=True, sensible=True, max_archivos=3,
        desc="Contrato escriturado y firmado por ambas partes, con sus anexos de "
             "modificación o destinación a la obra (hasta 3 archivos: no existe un "
             "requisito «anexo» aparte). FUNDAMENTO ACOTADO: el art. 9 del Código del "
             "Trabajo obliga a ESCRITURAR y FIRMAR entre empleador y trabajador; "
             "ENTREGARLO al mandante es práctica contractual, no obligación legal. "
             "MINIMIZACIÓN: el mandante que solo necesita constatar el vínculo puede "
             "aceptar el anexo de destinación o un certificado de vigencia de contrato "
             "en lugar del contrato íntegro. NO VENCE: lo que caduca es la certeza de "
             "que la persona sigue en faena, y eso lo resuelven la nómina y el F30-1, "
             "no una resubida anual. SENSIBLE: contiene remuneración y domicilio. "
             "REVISOR: nombre y RUT de ambas partes, cargo, fecha de ingreso y firma."),

    Req("CEDULA_IDENTIDAD", "LEGAL_VINCULO",
        "Cédula de identidad vigente del trabajador",
        "TRABAJADOR", Alcance.ENTIDAD, "OPCIONAL",
        vigencia=365, sensible=True, max_archivos=2, formatos=PDF_IMG,
        desc="Práctica de mercado para control de acceso a faena: ninguna norma la exige "
             "como documento de acreditación. Se sube por ambos lados, y por eso acepta "
             "fotografía además de PDF — exigir PDF aquí garantiza que el 100% de las "
             "entregas se rechacen. SENSIBLE: es un documento de identidad. "
             "SÍ VENCE, a diferencia del contrato y de la IRL: la cédula trae fecha de "
             "expiración impresa, así que marcarla sin_vencimiento la dejaría aprobada "
             "para siempre y el mandante controlaría acceso con un documento caducado. "
             "Mismo criterio que HABILITACION_MIGRATORIA. "
             "REVISOR: que el RUT y el nombre coincidan con los del trabajador cargado "
             "en Acredita y que la cédula esté vigente."),

    Req("HABILITACION_MIGRATORIA", "LEGAL_VINCULO",
        "Habilitación migratoria para trabajar (trabajador extranjero)",
        "TRABAJADOR", Alcance.ENTIDAD, "AMPLIADO", vigencia=365,
        sensible=True, max_archivos=2, formatos=PDF_IMG,
        desc="SUPUESTO DE ACTIVACIÓN: el trabajador es extranjero. Permiso de residencia "
             "o de trabajo vigente conforme a la Ley 21.325 de Migración y Extranjería. "
             "IMPORTANTE: NO pedir «contrato registrado en Extranjería» — la visa sujeta "
             "a contrato fue ELIMINADA por la Ley 21.325; pedirla es exigir un documento "
             "que ya no existe. SENSIBLE: dato de nacionalidad y situación migratoria. "
             "REVISOR: que el permiso esté vigente a la fecha y habilite para trabajar, "
             "y que el RUT o número de documento coincida con el del trabajador."),

    # ── HSE · Gestión preventiva y documentos del sistema ────────────────────
    Req("MIPER", "HSE_GESTION",
        "Matriz de Identificación de Peligros y Evaluación de Riesgos (MIPER) y mapa de riesgos",
        "EMPRESA", Alcance.SERVICIO, "BASE", vigencia=365, max_archivos=3,
        desc="Documento raíz del pilar: de él dependen el programa preventivo, la "
             "vigilancia de la salud y casi todos los requisitos condicionales. Se sube "
             "la matriz, el mapa de riesgos del art. 62 y, si existe, el registro de "
             "difusión firmado. Fundamento: DS 44/2024 art. 7 — toda entidad empleadora "
             "debe confeccionarla considerando riesgos ergonómicos, psicosociales, "
             "violencia y acoso, con enfoque de género, y revisarla al menos anualmente "
             "o ante cambios, accidente o riesgo grave e inminente. IMPORTANTE PARA EL "
             "REVISOR: las entidades de HASTA 25 PERSONAS cumplen con la matriz elaborada "
             "según la pauta y la asistencia técnica de su organismo administrador "
             "(art. 64) — NO rechazar una matriz simplificada de microempresa por "
             "«genérica». El DS 40/1969 está DEROGADO desde el 01-02-2025: no citarlo. "
             "REVISOR: peligros por puesto de trabajo, fecha de última revisión de menos "
             "de 12 meses, firma del representante legal o del responsable de prevención."),

    Req("PROG_PREVENTIVO", "HSE_GESTION",
        "Programa de trabajo preventivo y evaluación anual de cumplimiento",
        "EMPRESA", Alcance.SERVICIO, "BASE", vigencia=365, max_archivos=2,
        desc="Deriva de la MIPER: acciones, responsables y plazos para controlar los "
             "riesgos identificados. Fundamento: DS 44/2024 art. 8 — debe elaborarse "
             "dentro de los 30 días corridos siguientes a la matriz — y art. 14, que "
             "obliga a evaluar anualmente su cumplimiento. Las entidades de hasta 25 "
             "personas lo cumplen con la asistencia técnica de su organismo administrador "
             "(art. 64). Lo aprueba el REPRESENTANTE LEGAL, no la mutualidad: no exigir "
             "visación de la mutual. "
             "REVISOR: que las actividades se puedan rastrear a peligros de la MIPER, "
             "que tenga responsables y plazos, y firma del representante legal."),

    Req("RIHS", "HSE_GESTION",
        "Reglamento Interno de Higiene y Seguridad (RIHS) y comprobante de ingreso web DT/SEREMI",
        "EMPRESA", Alcance.ENTIDAD, "BASE", vigencia=730, max_archivos=2,
        desc="Fundamento: DS 44/2024 art. 56 — «toda entidad empleadora estará obligada a "
             "establecer y mantener al día un Reglamento Interno de Higiene y Seguridad "
             "en el Trabajo», SIN umbral de dotación, en desarrollo del art. 67 de la Ley "
             "16.744. Art. 57: no requiere aprobación previa, debe ingresarse en la web "
             "de la DT y de la SEREMI de Salud. El contenido mínimo del art. 58 ya incluye "
             "el procedimiento de EPP y el de investigación de siniestros. ES DISTINTO "
             "DEL RIOHS del art. 153 CT, que sí tiene umbral de 10 trabajadores; quien "
             "está obligado a ambos puede refundirlos y subir el mismo PDF en los dos. "
             "REVISOR: portada con razón social y RUT, índice que cubra el art. 58, y "
             "comprobante de ingreso web con fecha. La AUSENCIA del comprobante se "
             "OBSERVA, no se rechaza: la norma exige el ingreso, no nomina un comprobante."),

    Req("RIOHS", "HSE_GESTION",
        "Reglamento Interno de Orden, Higiene y Seguridad (RIOHS) y comprobante de registro",
        "EMPRESA", Alcance.ENTIDAD, "AMPLIADO", vigencia=730, max_archivos=2,
        desc="SUPUESTO DE ACTIVACIÓN: el contratista ocupa normalmente 10 O MÁS "
             "TRABAJADORES PERMANENTES. Bajo ese umbral la ley NO lo exige y el requisito "
             "debe quedar apagado — exigírselo a una contratista de 6 personas es pedir "
             "un documento que la ley no le pide, y es el error que el catálogo anterior "
             "cometía al tenerlo como requisito plano. Fundamento: art. 153 del Código "
             "del Trabajo. Desde la Ley 21.643 debe incorporar el protocolo y el "
             "procedimiento de la Ley Karin. Puede venir refundido con el RIHS. "
             "CAMBIO: deja de ser sin_vencimiento — el DS 44 art. 57 obliga a mantenerlo "
             "al día. REVISOR: que contenga materias de ORDEN (jornada, remuneraciones, "
             "sanciones, procedimiento de reclamos) además de higiene y seguridad, y el "
             "comprobante de registro en el sitio web de la DT."),

    Req("PLAN_EMERGENCIA", "HSE_GESTION",
        "Plan de emergencias y registro del simulacro anual",
        "EMPRESA", Alcance.ENTIDAD, "BASE", vigencia=365, max_archivos=2,
        desc="Fundamento: DS 44/2024 art. 19 — obligación universal, y el plan debe ser "
             "ensayado «a lo menos una vez al año». Es una de las pocas vigencias del "
             "catálogo con periodicidad fijada por norma —junto con CAPACITACION_SST "
             "(máximo 2 años, art. 16) y EVAL_PSICOSOCIAL— así que los 365 días aquí no "
             "son práctica de mercado. Se suben el plan y el acta del simulacro. "
             "REVISOR: procedimientos de evacuación, vías y zonas de seguridad, "
             "responsables identificados, y acta de simulacro de menos de 12 meses."),

    Req("PROC_TRABAJO_SEGURO", "HSE_GESTION",
        "Procedimientos de trabajo seguro aplicables al servicio",
        "EMPRESA", Alcance.SERVICIO, "OPCIONAL", vigencia=730, max_archivos=10,
        desc="Práctica de mercado: ninguna norma chilena exige esta carpeta como "
             "documento. Lo que el DS 44 art. 15 obliga es a INFORMAR los métodos de "
             "trabajo correctos, y eso se acredita con la IRL. Se ofrece porque casi "
             "todo mandante lo pide, pero se declara como lo que es. "
             "REVISOR: que cada procedimiento identifique la tarea, sus riesgos y los "
             "controles, y tenga fecha y aprobación."),

    # ── HSE · Organización preventiva y seguro Ley 16.744 ────────────────────
    Req("CERT_AFILIACION_OA", "HSE_ORGANIZACION",
        "Certificado de afiliación al organismo administrador de la Ley 16.744",
        "EMPRESA", Alcance.ENTIDAD, "BASE", vigencia=90,
        desc="Acredita ante qué mutualidad o ante el ISL está adherido el contratista. "
             "Fundamento: DS 76/2006 art. 5 — la empresa principal debe mantener en su "
             "registro, de cada contratista, el organismo administrador de la Ley 16.744; "
             "es un deber propio del mandante, y este documento es cómo lo cumple. La "
             "vigencia en días es práctica: la afiliación no caduca sola. "
             "REVISOR: emisor mutualidad o ISL, RUT del contratista, y que declare "
             "afiliación vigente."),

    Req("CERT_SINIESTRALIDAD", "HSE_ORGANIZACION",
        "Certificado de siniestralidad y tasa de cotización adicional",
        "EMPRESA", Alcance.ENTIDAD, "AMPLIADO", vigencia=365, max_archivos=3,
        desc="SUPUESTO DE ACTIVACIÓN: el contratista tiene al menos un período de "
             "evaluación cumplido ante su organismo administrador. Una empresa recién "
             "constituida no lo tiene y no puede obtenerlo. FUNDAMENTO CORREGIDO: el "
             "DS 76 art. 5 FACULTA a la empresa principal a solicitar información de "
             "siniestralidad, no la obliga a registrarla; el DS 67 regula cómo se calcula "
             "la cotización adicional, no un deber de exhibirla. Por eso AMPLIADO y no "
             "BASE. REVISOR: emisor mutualidad o ISL, período evaluado, y tasa de "
             "cotización adicional expresada."),

    Req("DAS", "HSE_ORGANIZACION",
        "Estadísticas de accidentabilidad y enfermedades profesionales declaradas",
        "EMPRESA", Alcance.ENTIDAD, "OPCIONAL", vigencia=365, sensible=True, max_archivos=2,
        desc="Autodeclaración del contratista sobre su accidentabilidad. Fundamento "
             "acotado: el DS 44 arts. 73 a 75 obligan a LLEVAR el registro de siniestros; "
             "entregarlo al mandante es práctica. Tiene MENOR valor probatorio que el "
             "certificado de siniestralidad de la mutualidad, que viene de un tercero — "
             "un mandante que ya activó CERT_SINIESTRALIDAD probablemente no necesita "
             "este. SENSIBLE: suele contener nombres de accidentados y relato de los "
             "hechos, que son datos de salud. "
             "REVISOR: período cubierto, tasa de accidentabilidad y de siniestralidad, "
             "firma del responsable de prevención."),

    Req("CPHS_DELEGADO_ACTA", "HSE_ORGANIZACION",
        "Acta de constitución del Comité Paritario o de elección del Delegado de SST",
        "EMPRESA", Alcance.ENTIDAD, "AMPLIADO", vigencia=730, max_archivos=2,
        desc="SUPUESTO DE ACTIVACIÓN: el contratista ocupa más de 25 personas (Comité "
             "Paritario, DS 44 art. 23) o entre 10 y 25 sin comité (Delegado de Seguridad "
             "y Salud en el Trabajo, art. 66). Bajo 10 trabajadores no existe ninguna de "
             "las dos figuras y el requisito debe quedar apagado. "
             "NO CONFUNDIR con el Comité Paritario DE FAENA del DS 76, cuya constitución "
             "es obligación de la EMPRESA PRINCIPAL, no del contratista: ese no va en "
             "este catálogo. REVISOR: acta con nombres de representantes de la empresa y "
             "de los trabajadores, fecha de constitución o elección, y firmas."),

    Req("RESP_PREVENCION", "HSE_ORGANIZACION",
        "Designación y acreditación del responsable de prevención asignado al servicio",
        "EMPRESA", Alcance.SERVICIO, "AMPLIADO", vigencia=730, sensible=True, max_archivos=2,
        desc="SUPUESTO: el mandante necesita una contraparte preventiva identificable "
             "para la faena. Fundamento: DS 44 art. 65 — hasta 100 trabajadores la "
             "gestión recae en el representante legal o en quien designe, capacitado por "
             "el organismo administrador; el art. 50 exige Departamento de Prevención con "
             "experto sobre 100. La norma no condiciona la DESIGNACIÓN, así que este "
             "requisito es AMPLIADO por decisión de producto, no porque la ley lo "
             "restrinja. SENSIBLE: incluye datos de contacto personales. "
             "REVISOR: carta de designación firmada por el representante legal, nombre y "
             "RUT del designado, y su certificado de experto o de capacitación."),

    # ── HSE · Salud ocupacional, agentes de riesgo y medio ambiente ──────────
    Req("PROG_VIGILANCIA_SALUD", "HSE_SALUD",
        "Programa de vigilancia ambiental y de la salud por agente de riesgo",
        "EMPRESA", Alcance.ENTIDAD, "AMPLIADO", vigencia=365, max_archivos=5,
        desc="SUPUESTO DE ACTIVACIÓN: existe exposición a un agente de riesgo declarada "
             "en la MIPER. Fundamento: DS 44 art. 67 — la obligación nace solo si el "
             "agente está presente. Cubre en un solo requisito los programas de "
             "vigilancia de la SUSESO y el MINSAL: PREXOR (ruido), PLANESI (sílice), "
             "TMERT-EESS (musculoesquelético de extremidades superiores), radiación UV "
             "(Ley 20.096 art. 19) e hipobaria intermitente crónica (DS 28/2012, entre "
             "3.000 y 5.500 msnm). Se sube un archivo por programa aplicable. "
             "REVISOR: que el agente vigilado corresponda a un peligro de la MIPER, que "
             "el programa lo respalde el organismo administrador, y su fecha."),

    Req("EVAL_PSICOSOCIAL", "HSE_SALUD",
        "Informe de evaluación de riesgos psicosociales CEAL-SM/SUSESO y plan de intervención",
        "EMPRESA", Alcance.ENTIDAD, "AMPLIADO", vigencia=730, max_archivos=2,
        desc="SUPUESTO DE ACTIVACIÓN: el contratista ocupa 10 o más trabajadores. "
             "Fundamento: protocolo de vigilancia de riesgos psicosociales del MINSAL y "
             "la SUSESO; el cuestionario CEAL-SM/SUSESO reemplazó al SUSESO-ISTAS21 y "
             "rige desde el 01-01-2023, con reaplicación cada 2 años. "
             "PRIVACIDAD: se sube el INFORME AGREGADO de resultados y el plan de "
             "intervención, NUNCA las respuestas individuales de los trabajadores. "
             "REVISOR: que sea el informe de resultados por dimensión, con fecha de "
             "aplicación de menos de 2 años, y que venga acompañado del plan si hay "
             "dimensiones en riesgo alto."),

    Req("EXAM_MED", "HSE_SALUD",
        "Certificado de aptitud ocupacional",
        "TRABAJADOR", Alcance.ENTIDAD, "AMPLIADO", vigencia=365, sensible=True,
        desc="SUPUESTO DE ACTIVACIÓN: el puesto tiene exposición a un agente de riesgo "
             "declarada en la MIPER, o el mandante califica la faena como de riesgo. "
             "FUNDAMENTO ACOTADO Y HONESTO: el DS 44 art. 67 ancla los exámenes a la "
             "existencia de un agente de riesgo; el art. 186 del Código del Trabajo "
             "remite al art. 185, cuyo reglamento NUNCA FUE DICTADO, de modo que la "
             "calificación de «faena peligrosa» no está normativamente cerrada. Por eso "
             "AMPLIADO y no BASE. "
             "PRIVACIDAD, NO NEGOCIABLE: se sube el CERTIFICADO de aptitud (apto / apto "
             "con restricciones / no apto), JAMÁS resultados clínicos, diagnósticos ni "
             "la batería de exámenes. SENSIBLE: es un dato de salud. "
             "REVISOR: nombre y RUT del trabajador, el veredicto de aptitud, la fecha, y "
             "el centro o médico que lo emite."),

    Req("HDS_SUSTANCIAS", "HSE_SALUD",
        "Hojas de datos de seguridad (HDS) de sustancias químicas peligrosas",
        "EMPRESA", Alcance.SERVICIO, "AMPLIADO", vigencia=730, max_archivos=30,
        formatos=PDF_IMG,
        desc="SUPUESTO DE ACTIVACIÓN: el servicio contempla el uso o almacenamiento de "
             "sustancias químicas peligrosas. Fundamento: DS 57/2019 del MINSAL, que "
             "implementa el Sistema Globalmente Armonizado (SGA) — obligatorio para el "
             "sector industrial desde el 09-02-2022 y para el no industrial desde el "
             "09-02-2023. La HDS y la etiqueta deben estar EN ESPAÑOL. Admite hasta 30 "
             "archivos porque una obra usa decenas de productos. "
             "REVISOR: que cada hoja tenga las 16 secciones del SGA, esté en español, e "
             "identifique el producto tal como se usa en faena."),

    Req("PLAN_RESIDUOS_PELIGROSOS", "HSE_SALUD",
        "Plan de manejo de residuos peligrosos aprobado por la SEREMI de Salud",
        "EMPRESA", Alcance.ENTIDAD, "AMPLIADO", vigencia=730, max_archivos=2,
        desc="SUPUESTO DE ACTIVACIÓN: el contratista genera residuos peligrosos por sobre "
             "el umbral de pequeño generador. Fundamento: DS 148/2003 del MINSAL. "
             "ADVERTENCIA DE DATO: los umbrales exactos de pequeño generador NO fueron "
             "verificados en fuente primaria al construir este catálogo — trátalos como "
             "referenciales y no los uses como criterio de rechazo sin confirmarlos. "
             "REVISOR: resolución de la SEREMI que aprueba el plan, con número y fecha, "
             "y RUT del generador."),

    # ── HSE · Protección e información de las personas ───────────────────────
    Req("EPP_GESTION", "HSE_PERSONAS",
        "Procedimiento de EPP, certificados de calidad y registro de capacitación anual",
        "EMPRESA", Alcance.ENTIDAD, "AMPLIADO", vigencia=730, max_archivos=10,
        desc="SUPUESTO DE ACTIVACIÓN: el servicio requiere elementos de protección "
             "personal. Reúne el procedimiento de selección, uso, mantención y reposición, "
             "los certificados de calidad o el registro ISP de los EPP, y el registro de "
             "la capacitación anual de al menos una hora sobre su uso. Fundamento: DS 44 "
             "art. 13 (entrega gratuita y capacitación), DS 594 art. 53 y DS 44 art. 58 "
             "N°2 letra e). Se ACEPTA el capítulo correspondiente del RIHS como el "
             "procedimiento: no exigir un documento separado. "
             "REVISOR: que los certificados correspondan a los EPP que el servicio usa y "
             "que el registro de capacitación tenga menos de 12 meses."),

    Req("CAPACITACION_SST", "HSE_PERSONAS",
        "Registro del curso de capacitación en seguridad y salud en el trabajo (mínimo 8 horas)",
        "EMPRESA", Alcance.ENTIDAD, "BASE", vigencia=730, sensible=True,
        max_archivos=10, formatos=PDF_IMG,
        desc="DECISIÓN DE VOLUMEN DELIBERADA: el sujeto obligado del art. 16 es la ENTIDAD "
             "EMPLEADORA y la evidencia que la propia norma describe (asistentes, "
             "relatores, evaluaciones) es el acta con nómina. Por eso es EMPRESA y no "
             "TRABAJADOR: modelado por persona, un contratista de 50 trabajadores "
             "generaría 50 expedientes por capacitación en una cola que hoy se revisa de "
             "a uno a mano. Fundamento: DS 44/2024 art. 16 — capacitación teórica o "
             "práctica de al menos 8 horas, con enfoque de género, con la periodicidad "
             "que defina el programa preventivo, «que no podrá exceder de dos años». "
             "La capacitación de EPP del art. 13 NO va aquí: es condicional y anual, y "
             "vive en EPP_GESTION. "
             "REVISOR: fecha, duración en horas, relator, contenidos y nómina firmada; "
             "que declare al menos 8 horas y tenga menos de dos años."),

    Req("IRL_ODI", "HSE_PERSONAS",
        "Información de Riesgos Laborales (IRL, ex ODI) firmada por el trabajador",
        "TRABAJADOR", Alcance.SERVICIO, "BASE",
        vigencia=365, sin_vencimiento=True, max_archivos=2, formatos=PDF_IMG,
        desc="ÚNICO REQUISITO DE TRABAJADOR BASE junto al contrato, y se justifica porque "
             "la ley lo exige persona por persona y ANTES del inicio de labores: su "
             "ausencia es una brecha legal directa que el mandante hereda al recibir a "
             "esa persona en faena. Fundamento: DS 44/2024 art. 15 — «cada persona "
             "trabajadora, previo al inicio de las labores» debe recibir información de "
             "los riesgos, las medidas preventivas y los métodos de trabajo correctos, "
             "determinados conforme a la matriz y el programa. "
             "NO TIENE PERIODICIDAD ANUAL: la norma no la establece. Por eso no vence, y "
             "se re-emite POR EVENTO — ingreso al servicio, cambio de puesto o proceso, "
             "cambio de tecnologías, materiales o sustancias. El mandante que quiera "
             "refresco anual sube vigencia_max_dias en su perfil, que es para lo que ese "
             "campo existe. Se acepta acta consolidada firmada por varios trabajadores, "
             "adjuntada en cada expediente. En la UI conviene decir «IRL (ex ODI)»: el "
             "mercado todavía dice ODI. "
             "REVISOR: nombre, RUT y cargo, los riesgos de sus tareas, firma del "
             "trabajador, y fecha anterior o igual a su ingreso al servicio."),

    Req("EPP_ENTREGA", "HSE_PERSONAS",
        "Registro de entrega de EPP firmado por el trabajador",
        "TRABAJADOR", Alcance.SERVICIO, "AMPLIADO", vigencia=365,
        sensible=True, max_archivos=2, formatos=PDF_IMG,
        desc="SUPUESTO DE ACTIVACIÓN: el servicio requiere EPP. ADVERTENCIA DE VOLUMEN: "
             "es el requisito más caro del catálogo — se multiplica por dotación Y por "
             "servicio. Un contratista de 50 personas en 2 servicios genera 100 "
             "expedientes solo por esto. Actívalo cuando el riesgo de la faena lo "
             "justifique, no por defecto. Fundamento: DS 594 art. 53 y DS 44 art. 13 "
             "obligan a ENTREGAR los elementos gratuitamente; el registro firmado es la "
             "evidencia estándar de esa entrega, no un documento nominado por la norma. "
             "REVISOR: nombre y RUT del trabajador, detalle de los elementos entregados, "
             "fecha y firma de recepción."),

    # ── COMPLIANCE · Existencia legal y representación ───────────────────────
    Req("SII_SITUACION_TRIBUTARIA", "COMPLIANCE_SOCIETARIO",
        "Constancia de situación tributaria del SII (inicio de actividades y giro)",
        "EMPRESA", Alcance.ENTIDAD, "BASE", vigencia=90, max_archivos=2,
        desc="Acredita que la empresa existe ante el SII, tiene inicio de actividades y "
             "un giro compatible con el servicio contratado. Es la verificación de "
             "homologación más universal del mercado chileno. "
             "PRECISIÓN: el e-RUT es la cédula de identificación tributaria, NO un "
             "certificado de inicio de actividades — puede subirse como archivo "
             "complementario, pero no reemplaza la constancia. Se omitió deliberadamente "
             "citar el art. 68 del Código Tributario porque no se verificó en fuente "
             "primaria. Redundante si el mandante activa CARPETA_TRIBUTARIA, que ya lo "
             "contiene. REVISOR: RUT y razón social, que registre inicio de actividades "
             "vigente, y el giro."),

    Req("VIGENCIA_SOCIEDAD", "COMPLIANCE_SOCIETARIO",
        "Certificado de vigencia de la sociedad, con anotaciones marginales",
        "EMPRESA", Alcance.ENTIDAD, "AMPLIADO", vigencia=60, max_archivos=2,
        desc="SUPUESTO DE ACTIVACIÓN: el contratista es persona jurídica. DEGRADADO desde "
             "BASE por una razón concreta del modelo: EmpresaContratista no tiene un "
             "campo tipo_persona, así que en BASE todo contratista persona natural "
             "quedaría con una brecha imposible de cerrar. Práctica de mercado, no "
             "obligación legal: en el mercado se pide entre 30 y 60 días de antigüedad. "
             "REVISOR: emisor Registro de Comercio o Registro de Empresas y Sociedades, "
             "razón social y RUT, y que incluya anotaciones marginales."),

    Req("VIGENCIA_PODERES", "COMPLIANCE_SOCIETARIO",
        "Certificado de vigencia de poderes o personería del representante legal",
        "EMPRESA", Alcance.ENTIDAD, "AMPLIADO", vigencia=60, max_archivos=2,
        desc="SUPUESTO DE ACTIVACIÓN: el contratista es persona jurídica y el mandante "
             "necesita verificar quién puede obligarla. DEGRADADO desde BASE: ninguna "
             "norma lo exige, y una SpA o EIRL cuya administración consta en el estatuto "
             "no obtiene este certificado sino uno de estatuto actualizado. Se aceptan "
             "las tres formas: certificado de vigencia de poderes, certificado de "
             "estatuto actualizado, o la escritura de poder. "
             "REVISOR: que identifique al representante con nombre y RUT y describa sus "
             "facultades, y que tenga menos de 60 días."),

    Req("ESCRITURA_CONSTITUCION", "COMPLIANCE_SOCIETARIO",
        "Escritura de constitución y sus modificaciones",
        "EMPRESA", Alcance.ENTIDAD, "OPCIONAL",
        vigencia=365, sin_vencimiento=True, max_archivos=5,
        desc="Práctica de homologación de proveedores. NO VENCE: una escritura de "
             "constitución es un hecho histórico; lo que cambia son las modificaciones, "
             "y por eso admite hasta 5 archivos. Un mandante que ya exige el certificado "
             "de vigencia con anotaciones marginales normalmente no necesita esto. "
             "REVISOR: que la razón social y el RUT coincidan con los del contratista y "
             "que estén todas las modificaciones que las anotaciones marginales declaran."),

    # ── COMPLIANCE · Situación tributaria y financiera ───────────────────────
    Req("CARPETA_TRIBUTARIA", "COMPLIANCE_TRIBUTARIO",
        "Carpeta tributaria electrónica del SII",
        "EMPRESA", Alcance.ENTIDAD, "OPCIONAL", vigencia=90, sensible=True, max_archivos=5,
        desc="Práctica de mercado para evaluación financiera del proveedor. La vigencia "
             "de 90 días está verificada en el SII y la carpeta trae código de "
             "verificación en línea. YA CONTIENE el F22 y los balances: no crear "
             "requisitos separados para esos. SENSIBLE: expone ingresos, deudas y "
             "situación financiera completa del contratista — nunca se propaga sola a "
             "otro mandante. REVISOR: que sea la carpeta emitida por el SII con código "
             "de verificación, RUT correcto, y menos de 90 días."),

    Req("TGR_DEUDA_FISCAL", "COMPLIANCE_TRIBUTARIO",
        "Certificado de deuda fiscal de la Tesorería General de la República",
        "EMPRESA", Alcance.ENTIDAD, "OPCIONAL", vigencia=30, sensible=True, max_archivos=2,
        desc="Práctica de mercado. Se acepta como segundo archivo el convenio de pago "
             "vigente: una deuda con convenio al día no debiera bloquear la acreditación, "
             "y esa decisión es del mandante. SENSIBLE: información financiera. "
             "REVISOR: emisor TGR, RUT del contratista, y el monto o la declaración de "
             "no tener deuda; menos de 30 días."),

    Req("INFORME_COMERCIAL", "COMPLIANCE_TRIBUTARIO",
        "Informe comercial de protestos y morosidades",
        "EMPRESA", Alcance.ENTIDAD, "OPCIONAL", vigencia=60, sensible=True,
        desc="Práctica de mercado para evaluar solvencia. DECISIÓN DE CATÁLOGO: no se "
             "nombra ningún proveedor comercial en el catálogo global — el mandante "
             "acepta el informe del bureau que prefiera. SENSIBLE: información "
             "financiera. REVISOR: emisor identificable, RUT del contratista, fecha de "
             "menos de 60 días, y el detalle de protestos y morosidades vigentes."),

    # ── COMPLIANCE · Seguros y garantías del contrato ────────────────────────
    Req("POLIZA_RESP_CIVIL", "COMPLIANCE_SEGUROS",
        "Póliza de responsabilidad civil vigente",
        "EMPRESA", Alcance.SERVICIO, "OPCIONAL", vigencia=365, max_archivos=2,
        desc="Exigencia contractual pura: ninguna norma obliga al contratista a "
             "contratarla. Segundo archivo: el comprobante de pago de la prima, sin el "
             "cual una póliza emitida puede no estar vigente. "
             "REVISOR: que el asegurado sea el contratista, el monto y la cobertura, y "
             "que la vigencia cubra el período del servicio."),

    Req("GARANTIA_FIEL_CUMPLIMIENTO", "COMPLIANCE_SEGUROS",
        "Boleta de garantía o póliza de fiel cumplimiento del contrato",
        "EMPRESA", Alcance.SERVICIO, "OPCIONAL", vigencia=365, sensible=True, max_archivos=2,
        desc="Instrumento contractual, típicamente entre el 5% y el 10% del valor del "
             "contrato. SENSIBLE por una razón no obvia: el monto de la garantía revela "
             "el valor del contrato con este mandante, que es información comercial que "
             "el contratista no quiere propagar a otros mandantes. "
             "REVISOR: tomador, beneficiario, monto, y que la vigencia cubra el plazo del "
             "contrato más el período de garantía pactado."),

    Req("GARANTIA_OBLIG_LABORALES", "COMPLIANCE_SEGUROS",
        "Garantía o póliza por obligaciones laborales y previsionales",
        "EMPRESA", Alcance.SERVICIO, "OPCIONAL", vigencia=365, sensible=True, max_archivos=2,
        desc="Cubre al mandante frente a su responsabilidad solidaria o subsidiaria. "
             "PRECISIÓN DE FUNDAMENTO: esa responsabilidad del mandante sí es legal "
             "(arts. 183-B y 183-D del Código del Trabajo), pero exigir al contratista "
             "que contrate una garantía por ella NO lo es — es exigencia contractual. "
             "SENSIBLE: revela el valor del contrato. "
             "REVISOR: tomador, beneficiario, monto y vigencia."),

    Req("POLIZA_TODO_RIESGO_OBRA", "COMPLIANCE_SEGUROS",
        "Póliza todo riesgo de construcción y montaje (CAR/EAR)",
        "EMPRESA", Alcance.SERVICIO, "AMPLIADO", vigencia=365, max_archivos=2,
        desc="SUPUESTO DE ACTIVACIÓN: el servicio es una obra física de construcción o "
             "montaje. No tiene sentido para un servicio de aseo, informático o de "
             "asesoría. Exigencia contractual, no legal. "
             "REVISOR: que la materia asegurada corresponda a la obra del servicio, el "
             "monto asegurado, y que la vigencia cubra el plazo de ejecución."),

    # ── COMPLIANCE · Integridad, probidad y datos personales ─────────────────
    Req("DJ_CONFLICTO", "COMPLIANCE_INTEGRIDAD",
        "Declaración jurada de conflicto de interés",
        "EMPRESA", Alcance.ENTIDAD, "OPCIONAL", vigencia=365,
        desc="Práctica de debida diligencia; solo es obligatoria ante ChileCompra. "
             "CORRECCIÓN DE DATO: en el catálogo anterior este requisito estaba a la vez "
             "en SIN_VENCIMIENTO y con vigencia 365 — dos parámetros contradictorios, "
             "donde el primero ganaba y la renovación anual nunca ocurría. Queda con "
             "renovación anual, que es lo que el documento pide: la declaración envejece "
             "porque las relaciones cambian. "
             "REVISOR: firma del representante legal, fecha, y que declare expresamente "
             "las relaciones con el mandante o la ausencia de ellas."),

    Req("MODELO_PREV_DELITOS", "COMPLIANCE_INTEGRIDAD",
        "Modelo de prevención de delitos (Ley 20.393) y designación del encargado",
        "EMPRESA", Alcance.ENTIDAD, "OPCIONAL", vigencia=730, max_archivos=3,
        desc="ADVERTENCIA DE FUNDAMENTO: la Ley 20.393 NO obliga a tener modelo de "
             "prevención de delitos. Es voluntario y opera como eximente o atenuante de "
             "responsabilidad penal de la persona jurídica. La Ley 21.595 de delitos "
             "económicos, vigente para personas jurídicas desde el 01-09-2024, amplió "
             "mucho el catálogo de delitos y ELIMINÓ la certificación del modelo por "
             "terceros: no exigir certificado de certificadora. Se acepta una declaración "
             "de controles equivalentes de un contratista que no tenga modelo formal. "
             "REVISOR: que exista designación del encargado de prevención con nombre, y "
             "que el modelo describa actividades de riesgo y controles."),

    Req("ADHESION_CODIGO_ETICA", "COMPLIANCE_INTEGRIDAD",
        "Carta de adhesión al código de ética o conducta del mandante",
        "EMPRESA", Alcance.ENTIDAD, "OPCIONAL", vigencia=730,
        desc="Práctica de mercado. Lo genérico —y por eso lo que vive en el catálogo "
             "global— es la CARTA DE ADHESIÓN firmada; el código de ética propiamente "
             "tal lo adjunta cada mandante en la configuración de su requisito, porque "
             "es un documento suyo. "
             "REVISOR: firma del representante legal, fecha, y que identifique el código "
             "al que adhiere."),

    Req("DJ_BENEFICIARIO_FINAL", "COMPLIANCE_INTEGRIDAD",
        "Declaración jurada de socios, beneficiarios finales y empresas relacionadas",
        "EMPRESA", Alcance.ENTIDAD, "OPCIONAL", vigencia=365, sensible=True, max_archivos=2,
        desc="Obligatoria solo ante ChileCompra; para el resto es debida diligencia. "
             "SENSIBLE: expone la estructura de propiedad del contratista. "
             "REVISOR: identificación de socios con porcentaje de participación, "
             "beneficiarios finales personas naturales, firma y fecha."),

    Req("DPA_DATOS_PERSONALES", "COMPLIANCE_INTEGRIDAD",
        "Acuerdo de tratamiento de datos personales (encargado del tratamiento)",
        "EMPRESA", Alcance.ENTIDAD, "AMPLIADO", vigencia=730, sensible=True, max_archivos=2,
        desc="SUPUESTO DE ACTIVACIÓN: el contratista trata datos personales por cuenta "
             "del mandante. Fundamento: Ley 21.719 sobre protección de datos personales, "
             "cuya entrada en vigencia el 01-12-2026 está verificada. "
             "ADVERTENCIA DE DATO: el contenido mínimo exacto que la ley exige al "
             "contrato de encargo NO fue verificado en fuente primaria — no lo uses como "
             "checklist de rechazo hasta confirmarlo. "
             "REVISOR: que identifique a las partes, la finalidad del tratamiento, las "
             "categorías de datos y las medidas de seguridad, con firma y fecha."),
]

VIGENCIA_DEFAULT = 90
VIGENCIAS = {r.codigo: r.vigencia for r in CATALOGO}

# Qué exige un perfil el DÍA UNO. La definición NO vive acá: vive en
# app/domain/plantillas.py, porque la API también la necesita — un mandante real
# nunca corre este script y sin plantilla tendría que marcar 44 casillas a mano.
# El seed solo la consume, para que no existan dos definiciones que se separen.
NIVEL_BASE = frozenset(r.codigo for r in CATALOGO if r.nivel == "BASE")

PLANTILLAS = {
    "ARRANQUE": _plantillas.ARRANQUE,
    "COMPLETA": NIVEL_BASE,
    "OBRA": NIVEL_BASE | _plantillas.EXTRA_OBRA,
}

CATALOGO_POR_CODIGO = {r.codigo: r for r in CATALOGO}

# Qué documenta la demo. Se DERIVA de la plantilla en vez de repetir una lista de
# códigos: si se hardcodea, cada cambio de ARRANQUE la desincroniza en silencio y
# la demo termina sembrando documentos de requisitos que el perfil no exige
# —invisibles, porque _configs_de_perfil filtra es_obligatorio=True— mientras deja
# sin cubrir los que sí exige, que aparecen como brechas de un contratista que la
# propia demo declara acreditado.
DOCS_DEMO_EMPRESA = [c for c in sorted(PLANTILLAS["ARRANQUE"])
                     if CATALOGO_POR_CODIGO[c].entidad == "EMPRESA"]
DOCS_DEMO_TRABAJADOR = [c for c in sorted(PLANTILLAS["ARRANQUE"])
                        if CATALOGO_POR_CODIGO[c].entidad == "TRABAJADOR"]


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _vigencia(dias: int) -> date:
    return HOY + timedelta(days=dias)


# ── Pilares y requisitos ──────────────────────────────────────────────────────

def seed_pilares(session: Session) -> dict[str, RequisitoDocumental]:
    """
    Upsert idempotente del catálogo global, por CÓDIGO.

    Reemplaza dos mecanismos que se estorbaban entre sí:

    1. El guard todo-o-nada `if session.query(Pilar).count() > 0: return`, que
       convertía cualquier requisito nuevo en un no-op silencioso en toda base
       ya sembrada — incluida producción. El deploy pasaba verde y el catálogo
       seguía teniendo 10 requisitos.
    2. `_aplicar_parametros_catalogo`, que en cada corrida recorría TODOS los
       requisitos de la base —incluidos los propios de cada mandante— y
       reescribía alcance, max_archivos, sin_vencimiento y sensible desde dicts
       que solo conocían 10 códigos. El daño peor era `sensible`: lo devolvía a
       False y reutilizacion_service pasaba a propagar solo el contrato de
       trabajo y el certificado de aptitud al resto de los mandantes del
       contratista, sin que nadie hiciera nada.

    Esta función toca EXCLUSIVAMENTE las filas con mandante_id IS NULL cuyo
    código está en CATALOGO. Lo que un mandante creó para sí queda intacto.
    """
    codigos = [r.codigo for r in CATALOGO]
    if len(codigos) != len(set(codigos)):
        dups = sorted({c for c in codigos if codigos.count(c) > 1})
        raise RuntimeError(
            f"Códigos duplicados en CATALOGO: {dups}. El índice parcial "
            "uq_requisitos_documentales_codigo_global los rechazaría a mitad "
            "de la transacción, dejando el seed a medio aplicar."
        )

    subpilares_validos = {s for _, _, _, _, subs in PILARES_CATALOGO for s, _, _ in subs}
    huerfanos = sorted({r.subpilar for r in CATALOGO} - subpilares_validos)
    if huerfanos:
        raise RuntimeError(f"CATALOGO referencia subpilares inexistentes: {huerfanos}")

    pilares = {p.codigo: p for p in session.query(Pilar).all()}
    subpilares: dict[str, Subpilar] = {}

    for codigo, nombre, orden, color, subs in PILARES_CATALOGO:
        pilar = pilares.get(codigo)
        if pilar is None:
            pilar = Pilar(codigo=codigo, nombre=nombre, orden=orden, color=color)
            session.add(pilar)
        else:
            pilar.nombre, pilar.orden, pilar.color = nombre, orden, color
        session.flush()

        existentes = {
            s.codigo: s
            for s in session.query(Subpilar).filter_by(pilar_id=pilar.id).all()
        }
        for sub_cod, sub_nom, sub_ord in subs:
            sub = existentes.get(sub_cod)
            if sub is None:
                sub = Subpilar(pilar_id=pilar.id, codigo=sub_cod,
                               nombre=sub_nom, orden=sub_ord)
                session.add(sub)
            else:
                sub.nombre, sub.orden = sub_nom, sub_ord
            session.flush()
            subpilares[sub_cod] = sub

    reqs = {
        r.codigo: r
        for r in session.query(RequisitoDocumental)
        .filter(RequisitoDocumental.mandante_id.is_(None))
        .all()
    }
    creados = actualizados = 0

    for r in CATALOGO:
        req = reqs.get(r.codigo)
        if req is None:
            req = RequisitoDocumental(codigo=r.codigo, mandante_id=None)
            session.add(req)
            creados += 1
        else:
            actualizados += 1
        req.subpilar_id = subpilares[r.subpilar].id
        req.nombre = r.nombre
        req.descripcion = r.desc
        req.entidad_tipo = r.entidad
        req.alcance = r.alcance
        req.nivel = r.nivel
        req.max_archivos = r.max_archivos
        req.formatos_permitidos = r.formatos
        req.sin_vencimiento = r.sin_vencimiento
        req.sensible = r.sensible
        reqs[r.codigo] = req

    session.flush()
    print(f"  OK Catálogo global: {creados} creado(s), {actualizados} actualizado(s). "
          f"Total {len(CATALOGO)} requisitos en {len(subpilares)} subpilares.")
    return {r.codigo: reqs[r.codigo] for r in CATALOGO}


# ── Admin BERISA ──────────────────────────────────────────────────────────────

def seed_admin(session: Session):
    if session.query(Usuario).filter_by(email="admin@berisa.cl").first():
        print("  OK Admin ya existe, saltando.")
        return
    session.add(Usuario(
        email="admin@berisa.cl", nombre="Admin BERISA",
        password_hash=_hash("admin123"), rol="berisa_admin", activo=True,
    ))
    # Sin la clave: la salida del seed queda en el log del job. Está en CLAUDE.md.
    print("  OK admin@berisa.cl creado (credenciales de demo en CLAUDE.md).")


# ── Mandantes ─────────────────────────────────────────────────────────────────

def _crear_mandante(session: Session, razon_social, rut, slug, plan, email_contacto,
                    sitio_web, activo, email_usuario, nombre_usuario) -> Mandante:
    m = Mandante(
        razon_social=razon_social, rut=rut, slug=slug,
        plan=plan, email_contacto=email_contacto, sitio_web=sitio_web, activo=activo,
    )
    session.add(m); session.flush()
    session.add(Usuario(
        email=email_usuario, nombre=nombre_usuario,
        password_hash=_hash("demo123"), rol="mandante_admin", activo=True, mandante_id=m.id,
    ))
    return m


def _get_or_create_mandante(session: Session, slugs: dict, razon_social, rut, slug, plan,
                             email_usuario, sitio_web, activo, email_contacto, nombre_admin):
    if slug in slugs:
        return slugs[slug]
    return _crear_mandante(session, razon_social, rut, slug, plan,
                           email_usuario, sitio_web, activo, email_contacto, nombre_admin)


def seed_mandantes(session: Session) -> dict[str, Mandante]:
    slugs = {m.slug: m for m in session.query(Mandante).all()}

    codelco = _get_or_create_mandante(session, slugs,
        "Codelco (Demo)", "61.704.000-K", "codelco-demo", "Enterprise",
        "mandante@demo.cl", "https://www.codelco.com", True,
        "mandante@demo.cl", "Carlos Mendoza",
    )
    if "codelco-demo" not in slugs:
        session.add(Usuario(
            email="prevencion@codelco.cl", nombre="Patricia Rojas",
            password_hash=_hash("demo123"), rol="prevencionista", activo=True, mandante_id=codelco.id,
        ))

    pelambres = _get_or_create_mandante(session, slugs,
        "Minera Los Pelambres", "96.525.120-9", "los-pelambres", "Enterprise",
        "mandante2@demo.cl", "https://www.lospelambres.cl", True,
        "mandante2@demo.cl", "Valentina Soto",
    )
    echeverria = _get_or_create_mandante(session, slugs,
        "Constructora Echeverría Izquierdo", "85.426.200-3", "echeverria-izquierdo", "Pro",
        "mandante3@demo.cl", "https://www.ei.cl", True,
        "mandante3@demo.cl", "Rodrigo Herrera",
    )
    enap = _get_or_create_mandante(session, slugs,
        "ENAP Refinerías", "99.590.200-6", "enap-refinerias", "Pro",
        "mandante4@demo.cl", "https://www.enap.cl", False,
        "mandante4@demo.cl", "Ignacio Fuentes",
    )

    nuevos = sum(1 for s in ["codelco-demo", "los-pelambres", "echeverria-izquierdo", "enap-refinerias"] if s not in slugs)
    if nuevos:
        print(f"  OK {nuevos} mandante(s) creado(s).")
    else:
        print("  OK Mandantes ya existen, saltando.")

    return {"codelco-demo": codelco, "los-pelambres": pelambres,
            "echeverria-izquierdo": echeverria, "enap-refinerias": enap}


# ── Perfiles y servicios ──────────────────────────────────────────────────────

def seed_perfiles_y_servicios(session: Session, reqs: dict[str, RequisitoDocumental]):
    """
    Idempotente. Para cada mandante asegura un perfil "General" con la config
    de todos los requisitos; para cada relación contratista↔mandante un servicio
    "General" activo; y todos los trabajadores de la empresa asignados a él.
    """
    perfiles_creados = servicios_creados = asignaciones_creadas = 0

    for mandante in session.query(Mandante).all():
        perfil = session.query(PerfilRequisitos).filter_by(
            mandante_id=mandante.id, nombre="General"
        ).first()
        if not perfil:
            perfil = PerfilRequisitos(
                mandante_id=mandante.id, nombre="General",
                descripcion="Perfil por defecto con todos los requisitos del catálogo", activo=True,
            )
            session.add(perfil); session.flush()
            perfiles_creados += 1

        configs_existentes = {
            str(c.requisito_documental_id)
            for c in session.query(PerfilRequisitoConfig).filter_by(perfil_id=perfil.id).all()
        }
        plantilla = PLANTILLAS["ARRANQUE"]
        for codigo, req in reqs.items():
            if str(req.id) not in configs_existentes:
                session.add(PerfilRequisitoConfig(
                    perfil_id=perfil.id, requisito_documental_id=req.id,
                    # Solo la plantilla nace obligatoria. El resto se siembra en
                    # False: config inerte para _configs_de_perfil (no genera
                    # brecha ni expediente) pero ya parametrizada y visible en la
                    # pantalla del mandante, a un clic de encenderse. Sin esto,
                    # 44 requisitos globales se convertirían en 44 exigencias
                    # para todo mandante nuevo el día uno.
                    es_obligatorio=(codigo in plantilla),
                    vigencia_max_dias=VIGENCIAS.get(codigo) or VIGENCIA_DEFAULT,
                    umbral_deuda_max=0,
                ))
        session.flush()

        for rel in session.query(ContratistaMandante).filter_by(mandante_id=mandante.id).all():
            # La clave de idempotencia es el PERFIL, no el nombre: el showcase
            # renombra estos servicios y con `nombre="General"` la corrida
            # siguiente no los encontraba y creaba un duplicado, que ademas
            # colisionaba en uq_servicio_codigo_referencia.
            servicio = session.query(Servicio).filter_by(
                contratista_mandante_id=rel.id, perfil_requisitos_id=perfil.id
            ).first()
            if not servicio:
                servicio = Servicio(
                    contratista_mandante_id=rel.id, perfil_requisitos_id=perfil.id,
                    nombre="General", fecha_inicio=HOY, estado=EstadoServicio.ACTIVO,
                )
                session.add(servicio); session.flush()
                servicios_creados += 1

            asignados = {
                str(a.trabajador_id)
                for a in session.query(ServicioTrabajador).filter_by(servicio_id=servicio.id).all()
            }
            for t in session.query(Trabajador).filter_by(empresa_id=rel.contratista_id).all():
                if str(t.id) not in asignados:
                    session.add(ServicioTrabajador(
                        servicio_id=servicio.id, trabajador_id=t.id,
                        activo=t.activo, fecha_asignacion=HOY,
                    ))
                    asignaciones_creadas += 1
    session.flush()

    # Ligar expedientes de alcance SERVICIO a su servicio "General". Se crean en
    # seed_*_contratistas ANTES de que existan los servicios, asi que aqui (ya
    # creados) se les asigna el servicio; el mandante lo aporta su acreditacion.
    exps_sin_servicio = (
        session.query(Expediente)
        .join(RequisitoDocumental, Expediente.requisito_id == RequisitoDocumental.id)
        .filter(Expediente.servicio_id.is_(None), RequisitoDocumental.alcance == Alcance.SERVICIO)
        .all()
    )
    ligados = 0
    for exp in exps_sin_servicio:
        empresa_id = exp.empresa_id or session.get(Trabajador, exp.trabajador_id).empresa_id
        acred = session.query(Acreditacion).filter_by(expediente_id=exp.id).first()
        if not acred:
            continue
        serv = _servicio_general(session, acred.mandante_id, empresa_id)
        if serv:
            exp.servicio_id = serv.id
            ligados += 1
    if ligados:
        print(f"  OK {ligados} expediente(s) de alcance SERVICIO ligados a su servicio General.")

    if perfiles_creados or servicios_creados or asignaciones_creadas:
        print(f"  OK {perfiles_creados} perfil(es), {servicios_creados} servicio(s), "
              f"{asignaciones_creadas} asignación(es) de trabajadores.")
    else:
        print("  OK Perfiles y servicios ya existen, saltando.")


# ── Helpers documentos ────────────────────────────────────────────────────────

def _servicio_general(session: Session, mandante_id, empresa_id):
    rel = session.query(ContratistaMandante).filter_by(
        mandante_id=mandante_id, contratista_id=empresa_id
    ).first()
    if not rel:
        return None
    # Se busca por PERFIL y no por nombre: el showcase renombra estos servicios
    # y con nombre="General" los expedientes de alcance SERVICIO quedarian sin
    # faena asignada (servicio_id NULL), que es un bug silencioso.
    perfil = session.query(PerfilRequisitos).filter_by(
        mandante_id=mandante_id, nombre="General"
    ).first()
    if not perfil:
        return None
    return session.query(Servicio).filter_by(
        contratista_mandante_id=rel.id, perfil_requisitos_id=perfil.id
    ).first()


def _crear_expediente(session: Session, req: RequisitoDocumental, mandante_id,
                      estado: int, vigencia_dias: int | None, brecha: str | None,
                      empresa_id=None, trabajador_id=None):
    """Crea Expediente + Entrega v1 + archivo demo + Acreditacion del mandante + evento."""
    fecha_vig = _vigencia(vigencia_dias) if vigencia_dias and estado == 4 else None
    empresa_efectiva = empresa_id or session.get(Trabajador, trabajador_id).empresa_id

    # Alcance SERVICIO: el expediente se ancla al servicio "General" de la relación.
    servicio_id = None
    if req.alcance == Alcance.SERVICIO:
        serv = _servicio_general(session, mandante_id, empresa_efectiva)
        servicio_id = serv.id if serv else None

    exp = Expediente(
        requisito_id=req.id, empresa_id=empresa_id,
        trabajador_id=trabajador_id, servicio_id=servicio_id,
    )
    session.add(exp); session.flush()

    entrega = Entrega(expediente_id=exp.id, numero_version=1, fecha_vigencia_hasta=fecha_vig)
    session.add(entrega); session.flush()

    entidad = str(empresa_id or trabajador_id)[:8]
    session.add(Archivo(
        entrega_id=entrega.id, orden=0,
        storage_key=f"demo/documentos/{req.codigo.lower()}_{entidad}_{uuid_lib.uuid4().hex}.pdf",
        nombre_original=f"{req.codigo.lower()}.pdf",
        mime_type="application/pdf", tamaño_bytes=0, hash_sha256="0" * 64,
    ))

    acred = Acreditacion(
        mandante_id=mandante_id, expediente_id=exp.id, entrega_id=entrega.id,
        numero_version=1, estado=estado, mensaje_brecha=brecha,
    )
    session.add(acred); session.flush()
    session.add(AcreditacionEvento(
        acreditacion_id=acred.id, tipo_evento=TipoEvento.SUBIDA,
        estado_nuevo=estado, detalle={"seed": True},
    ))


def _doc_empresa(session: Session, req: RequisitoDocumental, mandante_id, empresa_id,
                 estado: int, vigencia_dias: int | None = None, brecha: str | None = None):
    _crear_expediente(session, req, mandante_id, estado, vigencia_dias, brecha, empresa_id=empresa_id)


def _doc_trabajador(session: Session, req: RequisitoDocumental, mandante_id, trabajador_id,
                    estado: int, vigencia_dias: int | None = None, brecha: str | None = None):
    _crear_expediente(session, req, mandante_id, estado, vigencia_dias, brecha, trabajador_id=trabajador_id)


def _eliminar_expedientes(session: Session, expedientes: list[Expediente]):
    """Borra expedientes completos respetando las FKs (solo para limpieza de seed)."""
    for exp in expedientes:
        for acred in session.query(Acreditacion).filter_by(expediente_id=exp.id).all():
            session.query(AcreditacionEvento).filter_by(acreditacion_id=acred.id).delete()
            session.delete(acred)
        session.flush()
        for entrega in session.query(Entrega).filter_by(expediente_id=exp.id).all():
            session.query(Archivo).filter_by(entrega_id=entrega.id).delete()
            session.delete(entrega)
        session.delete(exp)


# ── Contratistas Codelco ──────────────────────────────────────────────────────

def seed_codelco_contratistas(session: Session, codelco: Mandante, reqs: dict):
    # El guard mira los EXPEDIENTES, no solo la empresa: si Cóndor existe pero
    # se quedó sin documentos (le pasó en producción tras la migración de Fase 1,
    # que reemplazó el modelo documental), hay que recrearlos. Con el guard
    # anterior —"si existe la empresa, saltar todo"— la demo quedaba sin un solo
    # documento y el portal se veía vacío para siempre.
    condor = session.query(EmpresaContratista).filter_by(rut="76.111.222-8").first()
    if condor and session.query(Expediente).filter_by(empresa_id=condor.id).first():
        print("  OK Contratistas Codelco ya existen con documentos, saltando.")
        return

    # Limpiar contratistas viejos del seed anterior (Constructora Demo SpA, etc.)
    # Se purga cada empresa COMPLETA —todas sus relaciones, no solo la de
    # Codelco— porque borrarla dejando una relación viva con otro mandante
    # violaría la foreign key.
    empresas = [
        session.get(EmpresaContratista, rel.contratista_id)
        for rel in session.query(ContratistaMandante).filter_by(mandante_id=codelco.id).all()
    ]
    for empresa in [e for e in empresas if e]:
        _eliminar_expedientes(session, session.query(Expediente).filter_by(empresa_id=empresa.id).all())
        for t in session.query(Trabajador).filter_by(empresa_id=empresa.id).all():
            _eliminar_expedientes(session, session.query(Expediente).filter_by(trabajador_id=t.id).all())
        for rel in session.query(ContratistaMandante).filter_by(contratista_id=empresa.id).all():
            for s in session.query(Servicio).filter_by(contratista_mandante_id=rel.id).all():
                session.query(ServicioTrabajador).filter_by(servicio_id=s.id).delete()
                session.delete(s)
            session.delete(rel)
        session.query(Trabajador).filter_by(empresa_id=empresa.id).delete()
        session.query(Usuario).filter_by(contratista_id=empresa.id).delete()
        session.flush()
        session.delete(empresa)
    session.flush()
    print("  OK Contratistas viejos de Codelco eliminados, creando nuevos...")

    mid = codelco.id
    r = reqs  # alias corto

    # 1 — Constructora Cóndor SpA — ACREDITADA
    condor = EmpresaContratista(rut="76.111.222-8", razon_social="Constructora Cóndor SpA",
                                giro="Construcción de obras civiles")
    session.add(condor); session.flush()
    session.add(ContratistaMandante(contratista_id=condor.id, mandante_id=mid, estado_acreditacion="ACREDITADA"))
    session.add(Usuario(email="contratista@demo.cl", nombre="Admin Constructora Cóndor",
                        password_hash=_hash("demo123"), rol="contratista_admin",
                        activo=True, contratista_id=condor.id))

    # trabajadores condor
    pedro = Trabajador(empresa_id=condor.id, rut="12.345.678-5", nombre_completo="Pedro González Rojas",
                       cargo="Jefe de Obra", activo=True)
    maria = Trabajador(empresa_id=condor.id, rut="9.876.543-3", nombre_completo="María Soto Vargas",
                       cargo="Prevencionista", activo=True)
    session.add_all([pedro, maria]); session.flush()

    for codigo in DOCS_DEMO_EMPRESA:
        _doc_empresa(session, r[codigo], mid, condor.id, 4, 90)
    for trabajador in (pedro, maria):
        for codigo in DOCS_DEMO_TRABAJADOR:
            _doc_trabajador(session, r[codigo], mid, trabajador.id, 4, 365)

    # 2 — Ingeniería Subterránea Ltda — EN_PROCESO
    subterranea = EmpresaContratista(rut="77.333.444-7", razon_social="Ingeniería Subterránea Ltda",
                                     giro="Servicios de ingeniería minera")
    session.add(subterranea); session.flush()
    session.add(ContratistaMandante(contratista_id=subterranea.id, mandante_id=mid, estado_acreditacion="EN_PROCESO"))

    luis = Trabajador(empresa_id=subterranea.id, rut="15.234.567-4", nombre_completo="Luis Herrera Castro",
                      cargo="Ingeniero Civil", activo=True)
    session.add(luis); session.flush()

    _doc_empresa(session, r["F30"], mid, subterranea.id, 4, 25)
    _doc_empresa(session, r["F30_1"], mid, subterranea.id, 2)      # en análisis
    _doc_empresa(session, r["MIPER"], mid, subterranea.id, 4, 300)
    _doc_empresa(session, r["RIOHS"], mid, subterranea.id, 4, 300)
    _doc_empresa(session, r["DAS"], mid, subterranea.id, 1)        # enviado
    _doc_empresa(session, r["CARPETA_TRIBUTARIA"], mid, subterranea.id, 4, 60)
    _doc_empresa(session, r["VIGENCIA_SOCIEDAD"], mid, subterranea.id, 4, 300)
    _doc_empresa(session, r["DJ_CONFLICTO"], mid, subterranea.id, 4, 300)
    _doc_trabajador(session, r["CONTRATO"], mid, luis.id, 4, 365)
    _doc_trabajador(session, r["EXAM_MED"], mid, luis.id, 2)       # en análisis

    # 3 — Mantenciones del Norte SpA — BLOQUEADA
    mantenciones = EmpresaContratista(rut="78.555.666-6", razon_social="Mantenciones del Norte SpA",
                                      giro="Mantención industrial")
    session.add(mantenciones); session.flush()
    session.add(ContratistaMandante(contratista_id=mantenciones.id, mandante_id=mid, estado_acreditacion="BLOQUEADA"))

    jorge = Trabajador(empresa_id=mantenciones.id, rut="11.222.333-9", nombre_completo="Jorge Vega Muñoz",
                       cargo="Técnico Mecánico", activo=True)
    sandra = Trabajador(empresa_id=mantenciones.id, rut="16.789.012-1", nombre_completo="Sandra López Pérez",
                        cargo="Operadora", activo=True)
    session.add_all([jorge, sandra]); session.flush()

    _doc_empresa(session, r["F30"], mid, mantenciones.id, 3,
                 brecha="F30 rechazado: deuda previsional detectada de $2.345.000")
    _doc_empresa(session, r["F30_1"], mid, mantenciones.id, 3,
                 brecha="F30-1 vencido: fecha de vigencia expiró el 2026-03-15")
    _doc_empresa(session, r["MIPER"], mid, mantenciones.id, 4, 180)
    _doc_empresa(session, r["RIOHS"], mid, mantenciones.id, 4, 300)
    _doc_empresa(session, r["DAS"], mid, mantenciones.id, 1)
    _doc_empresa(session, r["CARPETA_TRIBUTARIA"], mid, mantenciones.id, 4, 60)
    _doc_empresa(session, r["VIGENCIA_SOCIEDAD"], mid, mantenciones.id, 4, 300)
    _doc_empresa(session, r["DJ_CONFLICTO"], mid, mantenciones.id, 4, 300)
    _doc_trabajador(session, r["CONTRATO"], mid, jorge.id, 3,
                    brecha="Contrato no vigente: fecha término 2026-04-01")
    _doc_trabajador(session, r["EXAM_MED"], mid, jorge.id, 4, 180)
    _doc_trabajador(session, r["CONTRATO"], mid, sandra.id, 4, 365)
    _doc_trabajador(session, r["EXAM_MED"], mid, sandra.id, 4, 180)

    # 4 — Transportes Altiplano Ltda — EN_PROCESO (sin docs aún)
    transp = EmpresaContratista(rut="79.777.888-5", razon_social="Transportes Altiplano Ltda",
                                giro="Transporte de carga minera")
    session.add(transp); session.flush()
    session.add(ContratistaMandante(contratista_id=transp.id, mandante_id=mid, estado_acreditacion="EN_PROCESO"))
    t1 = Trabajador(empresa_id=transp.id, rut="13.111.222-K", nombre_completo="Roberto Fuentes Díaz",
                    cargo="Conductor", activo=True)
    t2 = Trabajador(empresa_id=transp.id, rut="14.333.444-9", nombre_completo="Carmen Silva Vega",
                    cargo="Supervisora", activo=True)
    session.add_all([t1, t2])

    # 5 — Excavaciones Cobre SpA — ACREDITADA
    excav = EmpresaContratista(rut="80.999.111-3", razon_social="Excavaciones Cobre SpA",
                               giro="Excavación y movimiento de tierras")
    session.add(excav); session.flush()
    session.add(ContratistaMandante(contratista_id=excav.id, mandante_id=mid, estado_acreditacion="ACREDITADA"))
    e1 = Trabajador(empresa_id=excav.id, rut="17.555.666-4", nombre_completo="Felipe Morales Castro",
                    cargo="Operador de Maquinaria", activo=True)
    e2 = Trabajador(empresa_id=excav.id, rut="18.777.888-3", nombre_completo="Andrea Rojas Pérez",
                    cargo="Capataz", activo=True)
    session.add_all([e1, e2]); session.flush()
    for codigo in DOCS_DEMO_EMPRESA:
        _doc_empresa(session, r[codigo], mid, excav.id, 4, 75)
    for trabajador in (e1, e2):
        for codigo in DOCS_DEMO_TRABAJADOR:
            _doc_trabajador(session, r[codigo], mid, trabajador.id, 4, 300)

    # 6 — Servicios Mineros del Pacífico SA — EN_PROCESO
    pacif = EmpresaContratista(rut="81.222.333-K", razon_social="Servicios Mineros del Pacífico SA",
                               giro="Servicios especializados minería")
    session.add(pacif); session.flush()
    session.add(ContratistaMandante(contratista_id=pacif.id, mandante_id=mid, estado_acreditacion="EN_PROCESO"))
    p1 = Trabajador(empresa_id=pacif.id, rut="19.444.555-5", nombre_completo="Diego Contreras Muñoz",
                    cargo="Ingeniero de Minas", activo=True)
    session.add(p1); session.flush()
    _doc_empresa(session, r["F30"], mid, pacif.id, 4, 20)
    _doc_empresa(session, r["F30_1"], mid, pacif.id, 4, 20)
    _doc_empresa(session, r["MIPER"], mid, pacif.id, 2)
    _doc_empresa(session, r["RIOHS"], mid, pacif.id, 4, 300)
    _doc_empresa(session, r["DAS"], mid, pacif.id, 4, 300)
    _doc_empresa(session, r["CARPETA_TRIBUTARIA"], mid, pacif.id, 4, 80)
    _doc_empresa(session, r["VIGENCIA_SOCIEDAD"], mid, pacif.id, 1)
    _doc_empresa(session, r["DJ_CONFLICTO"], mid, pacif.id, 4, 300)
    _doc_trabajador(session, r["CONTRATO"], mid, p1.id, 4, 365)
    _doc_trabajador(session, r["EXAM_MED"], mid, p1.id, 1)

    # 7 — Montajes Industriales Tarapacá Ltda — BLOQUEADA
    montajes = EmpresaContratista(rut="82.444.555-9", razon_social="Montajes Industriales Tarapacá Ltda",
                                  giro="Montajes electromecánicos")
    session.add(montajes); session.flush()
    session.add(ContratistaMandante(contratista_id=montajes.id, mandante_id=mid, estado_acreditacion="BLOQUEADA"))
    m1 = Trabajador(empresa_id=montajes.id, rut="20.666.777-K", nombre_completo="Héctor Ramírez Torres",
                    cargo="Técnico Electricista", activo=True)
    session.add(m1); session.flush()
    _doc_empresa(session, r["F30"], mid, montajes.id, 3,
                 brecha="F30 rechazado: cotizaciones previsionales no pagadas (3 meses)")
    _doc_empresa(session, r["F30_1"], mid, montajes.id, 1)
    _doc_empresa(session, r["MIPER"], mid, montajes.id, 4, 180)
    _doc_empresa(session, r["RIOHS"], mid, montajes.id, 4, 300)
    _doc_empresa(session, r["DAS"], mid, montajes.id, 4, 300)
    _doc_empresa(session, r["CARPETA_TRIBUTARIA"], mid, montajes.id, 4, 60)
    _doc_empresa(session, r["VIGENCIA_SOCIEDAD"], mid, montajes.id, 4, 300)
    _doc_empresa(session, r["DJ_CONFLICTO"], mid, montajes.id, 4, 300)
    _doc_trabajador(session, r["CONTRATO"], mid, m1.id, 4, 365)
    _doc_trabajador(session, r["EXAM_MED"], mid, m1.id, 3, brecha="Examen médico vencido desde 2026-01-15")
    print("  OK 7 contratistas Codelco con trabajadores y documentos creados.")


# ── Contratistas bulk (otros mandantes) ───────────────────────────────────────

def _contratista_bulk(session: Session, rut, nombre, giro, mandante_id, estado):
    e = EmpresaContratista(rut=rut, razon_social=nombre, giro=giro)
    session.add(e); session.flush()
    session.add(ContratistaMandante(contratista_id=e.id, mandante_id=mandante_id, estado_acreditacion=estado))
    return e


def seed_otros_mandantes(session: Session, mandantes: dict, reqs: dict):
    if session.query(ContratistaMandante).filter_by(mandante_id=mandantes["los-pelambres"].id).count() > 0:
        print("  OK Contratistas otros mandantes ya existen, saltando.")
        return

    pel_id = mandantes["los-pelambres"].id
    ech_id = mandantes["echeverria-izquierdo"].id
    ena_id = mandantes["enap-refinerias"].id

    # Los Pelambres — 12 contratistas (9 ACREDITADA, 2 EN_PROCESO, 1 BLOQUEADA)
    pelambres_data = [
        ("83.001.002-3", "Ingeniería Cobre Norte SA", "Ingeniería minera", "ACREDITADA"),
        ("83.003.004-5", "Construcciones Andinas SpA", "Obras civiles", "ACREDITADA"),
        ("83.005.006-7", "Servicios Industriales Andes Ltda", "Mantención industrial", "ACREDITADA"),
        ("83.007.008-9", "Transportes Mineros del Norte SA", "Transporte", "ACREDITADA"),
        ("83.009.010-1", "Electromecánica Atacama SpA", "Montajes", "ACREDITADA"),
        ("83.011.012-3", "Contratistas Especializados Ltda", "Servicios mineros", "ACREDITADA"),
        ("83.013.014-5", "Maquinaria Pesada del Pacífico SA", "Arriendo equipos", "ACREDITADA"),
        ("83.015.016-7", "Laboratorio Minero SpA", "Análisis de muestras", "ACREDITADA"),
        ("83.017.018-9", "Geología Aplicada Norte Ltda", "Geología", "ACREDITADA"),
        ("83.019.020-1", "Constructora Altura Ltda", "Construcción", "EN_PROCESO"),
        ("83.021.022-3", "Drilling Services Chile SA", "Perforación", "EN_PROCESO"),
        ("83.023.024-5", "Explosivos del Norte SpA", "Tronadura", "BLOQUEADA"),
    ]
    for rut, nombre, giro, estado in pelambres_data:
        _contratista_bulk(session, rut, nombre, giro, pel_id, estado)

    # Echeverría — 8 contratistas (5 ACREDITADA, 2 EN_PROCESO, 1 BLOQUEADA)
    ech_data = [
        ("84.001.002-3", "Suministros Construcción SA", "Materiales", "ACREDITADA"),
        ("84.003.004-5", "Electricistas Metropolitanos Ltda", "Electricidad", "ACREDITADA"),
        ("84.005.006-7", "Pinturas y Recubrimientos SpA", "Pintura industrial", "ACREDITADA"),
        ("84.007.008-9", "Grúas y Elevadores Chile SA", "Arriendo grúas", "ACREDITADA"),
        ("84.009.010-1", "Topografía Digital Ltda", "Topografía", "ACREDITADA"),
        ("84.011.012-3", "Hormigón Proyectado SpA", "Hormigones", "EN_PROCESO"),
        ("84.013.014-5", "Ventilación Industrial SA", "HVAC", "EN_PROCESO"),
        ("84.015.016-7", "Andamios Seguros Ltda", "Andamiaje", "BLOQUEADA"),
    ]
    for rut, nombre, giro, estado in ech_data:
        _contratista_bulk(session, rut, nombre, giro, ech_id, estado)

    # ENAP — 4 contratistas (2 ACREDITADA, 1 EN_PROCESO, 1 BLOQUEADA)
    ena_data = [
        ("85.001.002-3", "Refinería Servicios SpA", "Mantenimiento refinerías", "ACREDITADA"),
        ("85.003.004-5", "Química Industrial del Sur SA", "Productos químicos", "ACREDITADA"),
        ("85.005.006-7", "Ingeniería Petroquímica Ltda", "Ingeniería", "EN_PROCESO"),
        ("85.007.008-9", "Transporte Combustibles SA", "Transporte", "BLOQUEADA"),
    ]
    for rut, nombre, giro, estado in ena_data:
        _contratista_bulk(session, rut, nombre, giro, ena_id, estado)

    print("  OK 24 contratistas bulk creados para Los Pelambres, Echeverría y ENAP.")


# ── Main ──────────────────────────────────────────────────────────────────────

DOCS_CONDOR_EMPRESA = DOCS_DEMO_EMPRESA
DOCS_CONDOR_TRABAJADOR = DOCS_DEMO_TRABAJADOR


def seed_documentos_condor(session: Session, codelco: Mandante, reqs: dict):
    """
    Asegura los documentos del contratista de demo, uno por uno.

    `seed_codelco_contratistas` es todo-o-nada: su guard salta la función entera
    si Cóndor ya existe. Basta **un** expediente suelto para que los otros
    catorce nunca se creen — que es exactamente lo que pasó en producción, donde
    la demo quedó con 1 de 15 documentos y el portal vacío.

    Acá la idempotencia es por documento: se crea solo lo que falta.
    """
    condor = session.query(EmpresaContratista).filter_by(rut="76.111.222-8").first()
    if not condor:
        return

    def falta(req, trabajador_id=None):
        q = session.query(Expediente).filter_by(
            requisito_id=req.id, eliminado_en=None,
            **({"trabajador_id": trabajador_id} if trabajador_id else {"empresa_id": condor.id}),
        )
        return q.first() is None

    creados = 0
    for codigo in DOCS_CONDOR_EMPRESA:
        req = reqs.get(codigo)
        if req and falta(req):
            _doc_empresa(session, req, codelco.id, condor.id, 4, 90)
            creados += 1

    for trabajador in session.query(Trabajador).filter_by(empresa_id=condor.id).all():
        for codigo in DOCS_CONDOR_TRABAJADOR:
            req = reqs.get(codigo)
            if req and falta(req, trabajador_id=trabajador.id):
                _doc_trabajador(session, req, codelco.id, trabajador.id, 4, 365)
                creados += 1

    session.commit()
    if creados:
        print(f"  OK {creados} documento(s) de Cóndor creado(s).")
    else:
        print("  OK Documentos de Cóndor completos, saltando.")


def seed_segundo_mandante_condor(session: Session):
    """
    Vincula al contratista de demo (Cóndor) con un SEGUNDO mandante y reutiliza
    sus documentos ya subidos.

    Sin esto la demo no muestra lo que el portal existe para mostrar: con un solo
    cliente, cada documento tiene un badge y la vista por documento se ve igual
    que la vieja. Con dos, se ve que el F30 se subió una vez y sirve para ambos,
    y que el contrato de trabajo (sensible) queda esperando autorización.

    El ejemplo sensible es el CONTRATO y no la carpeta tributaria: reconciliar
    reutilización solo mira configs con es_obligatorio=True, y CARPETA_TRIBUTARIA
    es nivel OPCIONAL, así que no entra en la plantilla de arranque del perfil de
    demo. CONTRATO sí, y también es sensible.

    Idempotente: si la relación ya existe, no hace nada.
    """
    from app.domain import reutilizacion_service, servicio_service

    condor = session.query(EmpresaContratista).filter_by(rut="76.111.222-8").first()
    pelambres = session.query(Mandante).filter_by(slug="los-pelambres").first()
    if not condor or not pelambres:
        return

    rel = session.query(ContratistaMandante).filter_by(
        contratista_id=condor.id, mandante_id=pelambres.id
    ).first()

    if not rel:
        session.add(ContratistaMandante(
            contratista_id=condor.id, mandante_id=pelambres.id, estado_acreditacion="PENDIENTE",
        ))
        session.commit()
        perfil = session.query(PerfilRequisitos).filter_by(
            mandante_id=pelambres.id, nombre="General"
        ).first()
        if perfil:
            # Vía crear_servicio (no INSERT directo) para que dispare la
            # reconciliación de reutilización, igual que en producción.
            servicio_service.crear_servicio(
                db=session, mandante_id=pelambres.id, contratista_id=condor.id,
                perfil_requisitos_id=perfil.id, nombre="Ampliación Planta Concentradora",
                fecha_inicio=HOY, codigo_referencia="LP-2026-004",
            )

    # La reconciliación corre SIEMPRE, no solo al crear la relación: los
    # documentos pueden haberse creado después (seed_documentos_condor) y sin
    # esto nunca se reutilizarían. Es idempotente, así que repetirla no duplica.
    reutilizacion_service.reconciliar_reutilizacion(session, condor.id, pelambres.id)

    # Se cuenta el resultado real: llamar de nuevo a reconciliar sería no-op
    # (es idempotente) y reportaría cero.
    acreds = session.query(Acreditacion).filter_by(
        mandante_id=pelambres.id, eliminado_en=None
    ).join(Expediente).filter(
        (Expediente.empresa_id == condor.id) | (Expediente.trabajador_id.isnot(None))
    ).all()
    pendientes = sum(1 for a in acreds if a.estado == EstadoDocumento.PENDIENTE_AUTORIZACION)
    print(f"  OK Cóndor vinculado a Los Pelambres: {len(acreds)} documento(s) reutilizado(s), "
          f"{pendientes} esperando autorización.")


def _normalizar_ruts(session: Session):
    """
    Corrige el dígito verificador de los RUT ya guardados, ANTES de cualquier
    búsqueda.

    Es lo primero del seed y el orden no es casual: el seed identifica a los
    contratistas por RUT (`filter_by(rut="76.111.222-8")`). Si la base tuviera
    todavía el dígito viejo, no encontraría a Cóndor y crearía un duplicado con
    todos sus documentos. Normalizar primero deja la base y las constantes de
    este archivo hablando el mismo idioma.
    """
    cambios = (rut_service.normalizar_en_tabla(session, EmpresaContratista, aplicar=True)
               + rut_service.normalizar_en_tabla(session, Trabajador, aplicar=True))
    session.commit()
    if cambios:
        for nombre, viejo, nuevo in cambios:
            print(f"     {nombre[:38]:38} {viejo:16} -> {nuevo}")
        print(f"  OK {len(cambios)} RUT con dígito verificador corregido.")
    else:
        print("  OK Todos los RUT tienen dígito verificador válido.")


def _demo_habilitada() -> tuple[bool, str]:
    """
    Si toca cargar los datos de demo. Devuelve también el motivo, para que el
    log del despliegue diga qué decidió y no haya que adivinarlo.

    Es OPT-IN: sin SEED_DEMO no se carga nada de demo. Un default que cargara
    la demo salvo que alguien se acuerde de apagarla es la forma de que un día
    aparezca "Codelco (Demo)" en la base de un cliente real. Y aunque esté
    puesta, en producción no se carga igual: un .env copiado de desarrollo no
    puede ser lo único que separe la demo de los datos de verdad.
    """
    if settings.ENVIRONMENT == "production":
        return False, "ENVIRONMENT=production"
    if os.getenv("SEED_DEMO", "").lower() not in ("1", "true", "si", "sí"):
        return False, "SEED_DEMO no está activo"
    return True, f"SEED_DEMO activo y ENVIRONMENT={settings.ENVIRONMENT}"


def main():
    print("\n--- Seed Acredita ---")
    demo, motivo = _demo_habilitada()

    with Session(engine) as session:
        # El catálogo de pilares y requisitos NO es demo: es el catálogo global
        # que administra BERISA y que una instalación nueva necesita para poder
        # operar. Por eso se carga siempre, también en producción.
        seed_pilares(session)
        session.commit()
        print("  OK Catálogo global de pilares y requisitos al día.")

        if not demo:
            print(f"\n  Datos de demo OMITIDOS ({motivo}).")
            print("  Para el primer administrador: python scripts/crear_admin.py")
            print("--- Listo ---\n")
            return

        print(f"\n  Cargando datos de demo ({motivo})...")
        _normalizar_ruts(session)
        seed_admin(session)
        reqs = seed_pilares(session)
        session.flush()
        mandantes = seed_mandantes(session)
        session.flush()
        seed_codelco_contratistas(session, mandantes["codelco-demo"], reqs)
        session.flush()
        seed_otros_mandantes(session, mandantes, reqs)
        session.flush()
        seed_perfiles_y_servicios(session, reqs)
        session.commit()
        # Los documentos van DESPUÉS de los perfiles y servicios: los de alcance
        # SERVICIO (MIPER) se anclan al servicio "General", que se crea ahí.
        seed_documentos_condor(session, mandantes["codelco-demo"], reqs)
        seed_segundo_mandante_condor(session)
        seed_showcase_demo(session)

    # Las claves de la demo NO se imprimen: este script corre dentro del job de
    # despliegue y su salida queda en el log de GitHub Actions, legible para
    # cualquiera con acceso al repo. Están en CLAUDE.md, que es donde toca.
    print("--- Listo (datos de demo cargados) ---\n")


# ── Showcase para demo comercial ──────────────────────────────────────────────

# Nombres reales del rubro por mandante. Se reparten entre sus contratistas para
# que la demo no muestre 17 servicios llamados "General": un cliente que ve eso
# no puede imaginarse su propia operación en el producto.
SERVICIOS_DEMO = {
    "codelco-demo": [
        "Chuquicamata — Mantención planta concentradora",
        "Radomiro Tomic — Movimiento de tierras",
        "Ampliación planta de cátodos",
        "Transporte de personal turno noche",
        "Ministro Hales — Sostenimiento de túneles",
        "Aseo industrial y manejo de residuos",
        "Montaje estructuras área seca",
    ],
    "los-pelambres": [
        "Ampliación planta concentradora",
        "Mantención correa transportadora",
        "Habilitación campamento Cuncumén",
        "Perforación y tronadura rajo",
        "Servicio de alimentación casino",
    ],
    "echeverria-izquierdo": [
        "Edificio Nueva Las Condes — Torre B",
        "Habilitación oficinas piso 12",
        "Instalaciones eléctricas subterráneo",
        "Suministro de hormigón",
    ],
    "enap-refinerias": [
        "Refinería Aconcagua — Parada de planta",
        "Inspección técnica de estanques",
    ],
}


def seed_showcase_demo(session: Session):
    """
    Da variedad realista a la demo: nombres de servicio del rubro, y
    documentos en estados distintos para que cada pantalla tenga contenido.

    Sin esto la demo mostraba 17 servicios llamados "General", todos "en
    riesgo" y con la cola de revisión del mandante vacía —
    justo la pantalla donde el mandante hace su trabajo diario.

    Idempotente: solo toca los servicios que siguen llamándose "General".
    """
    renombrados = 0
    for slug, nombres in SERVICIOS_DEMO.items():
        mandante = session.query(Mandante).filter_by(slug=slug).first()
        if not mandante:
            continue
        relaciones = (
            session.query(ContratistaMandante)
            .filter_by(mandante_id=mandante.id)
            .order_by(ContratistaMandante.created_at)
            .all()
        )
        for i, rel in enumerate(relaciones):
            # Solo el servicio del perfil "General" —el que crea el seed— y solo
            # si sigue sin renombrar. Asi no pisa nombres puestos a mano desde
            # la interfaz ni depende de un nombre que el mismo cambia.
            perfil_general = session.query(PerfilRequisitos).filter_by(
                mandante_id=mandante.id, nombre="General"
            ).first()
            if not perfil_general:
                continue
            servicio = session.query(Servicio).filter_by(
                contratista_mandante_id=rel.id, perfil_requisitos_id=perfil_general.id,
                nombre="General",
            ).first()
            if not servicio:
                continue
            servicio.nombre = nombres[i % len(nombres)]
            servicio.codigo_referencia = f"{slug[:3].upper()}-2026-{100 + i}"
            renombrados += 1
    session.commit()
    if renombrados:
        print(f"  OK {renombrados} servicio(s) con nombre realista.")
    else:
        print("  OK Servicios ya tienen nombres realistas, saltando.")

    _showcase_centros_trabajo(session)
    _showcase_permisos_equipo(session)
    en_regla = _showcase_faenas_en_regla(session)
    _showcase_estados_documentos(session, excluir_contratistas=en_regla)


# Cuantas relaciones de Codelco se dejan 100% cumpliendo. Con todas en riesgo la
# demo da la impresion de que nada funciona y no se puede mostrar el caso verde,
# que es el que el cliente quiere ver.
FAENAS_EN_REGLA = 3


# Faenas reales de Codelco. El servicio de cada contratista se ancla a una de
# ellas por posicion, igual que los nombres de servicio: asi la demo muestra
# varios contratistas compartiendo faena, que es el caso que justifica la entidad.
CENTROS_DEMO = [
    ("Chuquicamata", "Calama, Región de Antofagasta"),
    ("Radomiro Tomic", "Calama, Región de Antofagasta"),
    ("Ministro Hales", "Calama, Región de Antofagasta"),
    ("El Teniente", "Machalí, Región de O'Higgins"),
]


def _showcase_centros_trabajo(session: Session):
    """
    Crea los centros de Codelco y ancla a ellos los servicios existentes.

    Sin esto la demo muestra "Sin centro asignado" en todos los servicios, que es
    correcto —son anteriores a la entidad— pero no deja ver para que sirve. Con
    los centros puestos se aprecia lo importante: varios contratistas distintos
    compartiendo faena, y un mismo contratista presente en dos.
    """
    codelco = session.query(Mandante).filter_by(slug="codelco-demo").first()
    if not codelco:
        return

    encargado = (
        session.query(Usuario)
        .filter_by(mandante_id=codelco.id, rol="prevencionista", activo=True)
        .order_by(Usuario.email)
        .first()
    )

    centros = []
    for nombre, direccion in CENTROS_DEMO:
        centro = session.query(CentroTrabajo).filter_by(
            mandante_id=codelco.id, nombre=nombre
        ).first()
        if not centro:
            centro = CentroTrabajo(
                mandante_id=codelco.id, nombre=nombre, direccion=direccion,
                encargado_id=encargado.id if encargado else None, activo=True,
            )
            session.add(centro); session.flush()
        centros.append(centro)

    todos = (
        session.query(Servicio)
        .join(ContratistaMandante, Servicio.contratista_mandante_id == ContratistaMandante.id)
        .filter(ContratistaMandante.mandante_id == codelco.id)
        .order_by(Servicio.created_at)
        .all()
    )
    por_nombre = {c.nombre: c for c in centros}

    # Se procesa un servicio si le falta el centro, O si su nombre todavia trae
    # la faena como prefijo. Lo segundo corrige asignaciones previas que se
    # hicieron por posicion y dejaron "Ministro Hales - ..." bajo Chuquicamata.
    #
    # Y es idempotente sin pisar decisiones humanas: en cuanto se limpia el
    # prefijo el servicio deja de coincidir, y un nombre puesto a mano nunca
    # empieza con el nombre de un centro.
    def _prefijo(nombre: str):
        return next((n for n in por_nombre if nombre.startswith(n)), None)

    servicios = [s for s in todos if s.centro_trabajo_id is None or _prefijo(s.nombre)]
    for i, servicio in enumerate(servicios):
        # Varios servicios traian la faena EN EL NOMBRE ("Ministro Hales -
        # Sostenimiento de tuneles") porque antes no habia donde ponerla. Si se
        # asignara por posicion, ese servicio podia terminar archivado bajo
        # Chuquicamata, que en una demo se lee como un error.
        prefijo = next((n for n in por_nombre if servicio.nombre.startswith(n)), None)
        if prefijo:
            servicio.centro_trabajo_id = por_nombre[prefijo].id
            # Y se le quita el prefijo: la faena ya la lleva el centro, y
            # repetirla es el nombre viejo compensando un dato que no existia.
            resto = servicio.nombre[len(prefijo):].lstrip(" -—")
            if resto:
                servicio.nombre = resto
        else:
            servicio.centro_trabajo_id = centros[i % len(centros)].id
    session.commit()
    if servicios:
        print(f"  OK {len(centros)} centros de trabajo, {len(servicios)} servicio(s) anclados.")
    else:
        print(f"  OK {len(centros)} centros de trabajo ya existen y los servicios estan anclados.")


def _showcase_permisos_equipo(session: Session):
    """
    Deja el equipo de la demo mostrando los cuatro perfiles posibles.

    A la prevencionista se le asigna HSE: sin permisos no puede aprobar nada
    —que es el default seguro correcto— pero entonces la demo muestra un revisor
    que no revisa. Con HSE se puede demostrar que aprueba examenes medicos y que
    al intentar un documento tributario recibe el 403 con el motivo.

    Y se agrega un revisor senior, que es el caso que justifica separar el
    alcance de la administracion: aprueba TODOS los pilares sin poder invitar
    gente ni reconfigurar los perfiles de exigencias. Antes era imposible de
    expresar y habia que entregarle la cuenta completa.
    """
    codelco = session.query(Mandante).filter_by(slug="codelco-demo").first()
    prevencionista = session.query(Usuario).filter_by(email="prevencion@codelco.cl").first()
    hse = session.query(Pilar).filter_by(codigo="HSE").first()
    if not codelco or not prevencionista or not hse:
        return

    if not prevencionista.cargo:
        prevencionista.cargo = "Prevencionista de Riesgos"
    ya = session.query(UsuarioPilarPermiso).filter_by(
        usuario_id=prevencionista.id, pilar_id=hse.id
    ).first()
    if not ya:
        session.add(UsuarioPilarPermiso(usuario_id=prevencionista.id, pilar_id=hse.id))
        print("  OK Prevencionista de la demo con permiso para aprobar HSE.")

    senior_email = "contratos@codelco.cl"
    senior = session.query(Usuario).filter_by(email=senior_email).first()
    if not senior:
        session.add(Usuario(
            email=senior_email,
            nombre="Verónica Ibáñez",
            password_hash=_hash("demo123"),
            rol="prevencionista",   # no administra la cuenta
            aprueba_todo=True,      # pero aprueba cualquier pilar
            cargo="Jefa de Contratos",
            activo=True,
            mandante_id=codelco.id,
        ))
        print("  OK Revisor senior de la demo: aprueba todo, no administra.")
    session.commit()


def _showcase_faenas_en_regla(session: Session):
    """
    Completa los documentos de unas pocas relaciones para que sus faenas queden
    "todo en regla".

    Sin esto ningun contratista cumple del todo y el dashboard del mandante
    muestra el 100% de las faenas en riesgo.

    Solo recorre las configs OBLIGATORIAS del perfil. El perfil "General" ya no
    exige todo el catalogo —desde que existen las PLANTILLAS exige la de
    arranque— y las demas configs estan sembradas en es_obligatorio=False a
    proposito. Crearles documento fabricaria filas que ninguna pantalla derivada
    muestra, porque _configs_de_perfil filtra es_obligatorio=True.
    """
    codelco = session.query(Mandante).filter_by(slug="codelco-demo").first()
    if not codelco:
        return

    relaciones = (
        session.query(ContratistaMandante)
        .filter_by(mandante_id=codelco.id)
        .order_by(ContratistaMandante.created_at)
        .all()
    )
    # Condor se deja FUERA a proposito: es el login con el que se demuestra el
    # lado del contratista, y si estuviera 100% verde su Inicio diria "Estas al
    # dia" sin nada que mostrar. Su estado variado es el que hace la demo.
    condor = session.query(EmpresaContratista).filter_by(rut="76.111.222-8").first()
    condor_id = condor.id if condor else None

    completadas = creados = 0
    en_regla: set = set()
    for rel in relaciones:
        if completadas >= FAENAS_EN_REGLA:
            break
        if rel.contratista_id == condor_id:
            continue
        servicio = _servicio_general(session, codelco.id, rel.contratista_id)
        if not servicio:
            continue
        trabajadores = session.query(Trabajador).filter_by(
            empresa_id=rel.contratista_id, activo=True
        ).all()
        if not trabajadores:
            continue   # sin dotacion no hay caso interesante que mostrar

        for cfg in session.query(PerfilRequisitoConfig).filter_by(
            perfil_id=servicio.perfil_requisitos_id, es_obligatorio=True
        ).all():
            req = cfg.requisito
            if req.entidad_tipo == "EMPRESA":
                existe = session.query(Expediente).filter_by(
                    requisito_id=req.id, empresa_id=rel.contratista_id, eliminado_en=None
                ).first()
                if not existe:
                    _doc_empresa(session, req, codelco.id, rel.contratista_id, 4, 365)
                    creados += 1
            else:
                for t in trabajadores:
                    existe = session.query(Expediente).filter_by(
                        requisito_id=req.id, trabajador_id=t.id, eliminado_en=None
                    ).first()
                    if not existe:
                        _doc_trabajador(session, req, codelco.id, t.id, 4, 365)
                        creados += 1
        completadas += 1
        en_regla.add(rel.contratista_id)

    session.commit()
    if creados:
        print(f"  OK {creados} documento(s) creado(s) para dejar {completadas} faena(s) en regla.")
    else:
        print("  OK Faenas en regla ya completas, saltando.")
    return en_regla


def _showcase_estados_documentos(session: Session, excluir_contratistas: set | None = None):
    """
    Reparte estados para que ninguna pantalla quede vacía en la demo:
    algunos documentos esperando revisión (la cola del mandante), algunos
    observados, y algunos por vencer (las alertas del contratista).

    `excluir_contratistas` protege a las faenas que se dejaron en regla: si se
    les tocara un documento dejarian de estar verdes y volveriamos al problema
    de que el 100% aparece en riesgo.
    """
    excluir = excluir_contratistas or set()
    codelco = session.query(Mandante).filter_by(slug="codelco-demo").first()
    if not codelco:
        return

    acreds = (
        session.query(Acreditacion)
        .filter_by(mandante_id=codelco.id, eliminado_en=None)
        .filter(Acreditacion.entrega_id.isnot(None))
        .order_by(Acreditacion.created_at)
        .all()
    )
    def es_de_excluido(a):
        exp = a.expediente
        dueño = exp.empresa_id or (exp.trabajador.empresa_id if exp.trabajador_id else None)
        return dueño in excluir

    aprobadas = [a for a in acreds if a.estado == 4 and not es_de_excluido(a)]
    if len(aprobadas) < 6:
        print("  OK Sin suficientes documentos aprobados para repartir estados, saltando.")
        return

    # Ya se repartió antes si hay algo esperando revisión.
    if any(a.estado == 1 for a in acreds):
        print("  OK Estados de demo ya repartidos, saltando.")
        return

    for a in aprobadas[:4]:                      # cola de revisión del mandante
        a.estado = 1
    for a in aprobadas[4:6]:                     # observados: brecha con motivo
        a.estado = 3
        a.mensaje_brecha = "El documento está ilegible en la última página."
    for a in aprobadas[6:9]:                     # por vencer: alertas del contratista
        if a.entrega:
            a.entrega.fecha_vigencia_hasta = HOY + timedelta(days=5)
    session.commit()
    print("  OK Estados de demo repartidos: 4 por revisar, 2 observados, 3 por vencer.")


if __name__ == "__main__":
    main()
