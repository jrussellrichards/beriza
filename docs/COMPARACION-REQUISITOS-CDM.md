# Requisitos de Constructora del Mar II vs. el catalogo de la app

Comparacion de los dos documentos oficiales entregados el 18 de agosto de 2026 contra
el catalogo global de requisitos documentales que la app tiene hoy.

**Los documentos comparados**

| Archivo | Que es |
|---|---|
| `REQUISITOS HSE - PPRR.pdf` | Procedimiento interno `PR-MA-PRC-00-15` de Constructora del Mar II, revision agosto 2025, firmado por su Depto. de Prevencion de Riesgos. Contiene cuatro listas: §5.1 carpeta de arranque, §5.2 trabajador nuevo, §5.3 durante la obra, §5.4 maquinaria y vehiculos. |
| `REQUISITOS RECURSOS HUMANOS (ADMINISTRATIVOS).docx` | Instructivo de RRHH del mismo cliente: documentacion de la empresa, de cada trabajador, entrega mensual y al termino del servicio. |

> Los dos son documentos **de un cliente concreto**, no una norma general. Dicen
> literalmente *"documentacion que se entrega a Constructora del Mar II SPA"*, y
> algunos items son especificos de ellos (el numero de contrato con su empresa, el
> codigo de color de casco de su obra).

---

## Resumen

Los dos documentos suman **91 lineas**. No son 91 documentos distintos:
hay repeticiones entre secciones, y varias lineas no son documentos.

| | Cantidad | |
|---|---|---|
| Lineas que **ya cubre** el catalogo | 31 | corresponden a **21 requisitos** nuestros |
| Documentos que **no tenemos** | 54 | se pueden agrupar en **~33 requisitos** reales |
| Lineas que **no son documentos** | 6 | ver Anexo A |
| **Total de lineas** | **91** | |

Del catalogo actual de **44 requisitos**: **21** aparecen en sus
documentos y **23** no. (21 + 23 = 44.)

### Por que 31 lineas equivalen a solo 21 requisitos

Porque sus documentos **piden lo mismo dos veces** en secciones distintas. 10 casos:

| Nuestro requisito | Aparece en sus documentos como |
|---|---|
| `CERT_AFILIACION_OA` | *Certificado de afiliacion de la Mutualidad* · *Certificado de afiliacion organismo administrador ley 16.744* |
| `CERT_SINIESTRALIDAD` | *Siniestralidad y cotizaciones de la Mutualidad* · *Tasa de siniestralidad, accidentabilidad y cotizacion adicional* |
| `NOMINA_PERSONAL` | *Listado de personal de obra (rut, cargo, direccion, telefono)* · *Nomina de trabajadores asignados a la obra* |
| `EPP_GESTION` | *Procedimiento de seleccion, uso y mantencion de EPP* · *Certificaciones de los EPP* |
| `PROTOCOLO_KARIN` | *Protocolo de actuacion ante acoso (ley Karin 21.643)* · *Procedimiento de investigacion ante acoso (ley Karin)* |
| `EXAM_MED` | *Examen ocupacional de altura fisica (cuando corresponda)* · *Examen ocupacional del conductor* |
| `CAPACITACION_SST` | *Capacitaciones realizadas al personal* · *Entrega de capacitaciones* |
| `CONTRATO` | *Contrato de trabajo de cada trabajador* · *Copia del contrato de trabajo y anexo de contrato* |
| `F30_1` | *Certificado F30-1 (ley de subcontratacion)* · *F30-1 mensual (mes anterior)* |
| `CEDULA_IDENTIDAD` | *Cedula de identidad del conductor* · *Fotocopia de cedula de identidad por ambos lados* |

No se pierde nada: es que el mismo papel esta listado dos veces.

---

## Como se decide si dos nombres son el mismo documento

El cliente planteo que nuestro `MIPER` deberia partirse en dos: *matriz de
identificacion de peligros* por un lado y *evaluacion de riesgos* por otro. Se
verifico contra el texto oficial del **DS 44/2024** (BCN, https://bcn.cl/3oe4l) y
**no corresponde**:

> *Articulo 7.- Matriz de identificacion de peligros y evaluacion de riesgos. La
> entidad empleadora debera confeccionar **una** matriz de identificacion de
> peligros y evaluacion de los riesgos laborales... Esta matriz contendra como
> minimo los siguientes elementos: 1. La identificacion de los peligros del puesto
> de trabajo. 2. La evaluacion de los riesgos.*

La identificacion y la evaluacion son los dos **contenidos minimos de una misma
matriz**, no dos entregables. El art. 4 N2 confirma cuales son los dos documentos
separados: una matriz **y** un programa de gestion de riesgos.

**Pero el cliente tiene razon en que falta un documento.** Su propio procedimiento
pide tres cosas en 5.1 y el catalogo solo cubre dos:

| Lo que piden en 5.1 | Que tenemos |
|---|---|
| Matriz de riesgos | `MIPER` |
| **Procedimiento IPER** | **falta** |
| Programa de prevencion en base a la matriz IPER | `PROG_PREVENTIVO` |

El **procedimiento IPER** describe *como* la empresa identifica y evalua:
metodologia, escalas de probabilidad y severidad, quien participa, cada cuanto se
revisa. La matriz es el *resultado* de aplicarlo. ACHS y Mutual de Seguridad
publican los dos por separado en sus kits del DS 44.

Ojo con el fundamento: **ninguna norma chilena exige ese procedimiento**. El DS 44
art. 7 remite el metodo a la Guia Tecnica del ISP en vez de pedirle a cada empresa
que escriba el suyo. Viene de OHSAS 18001; ISO 45001 lo elimino pero el nombre
quedo. Es exigencia contractual, no legal, y por eso entraria como **OPCIONAL**, el
mismo trato honesto que ya tiene `PROC_TRABAJO_SEGURO`.

> **El criterio que deja este caso:** un nombre distinto no es un documento
> distinto. Antes de dar de alta cada uno de los que faltan hay que preguntarse si
> es el mismo papel con otra etiqueta, y si lo respalda una norma o solo la
> costumbre.

---

## 1. Documentos que ya tenemos

31 lineas de sus documentos corresponden a 21 requisitos que
el catalogo ya incluye, casi siempre con otro nombre.

| Lo que piden ellos | Origen | Nuestro requisito |
|---|---|---|
| Giro (SII) | 5.1 | `SII_SITUACION_TRIBUTARIA` — Constancia de situación tributaria del SII (inicio de actividades y giro) |
| Certificado de afiliacion de la Mutualidad | 5.1 | `CERT_AFILIACION_OA` — Certificado de afiliación al organismo administrador de la Ley 16.744 |
| Certificado de afiliacion organismo administrador ley 16.744 | 5.1 | `CERT_AFILIACION_OA` — Certificado de afiliación al organismo administrador de la Ley 16.744 |
| Siniestralidad y cotizaciones de la Mutualidad | 5.1 | `CERT_SINIESTRALIDAD` — Certificado de siniestralidad y tasa de cotización adicional |
| Tasa de siniestralidad, accidentabilidad y cotizacion adicional | 5.1 | `CERT_SINIESTRALIDAD` — Certificado de siniestralidad y tasa de cotización adicional |
| Listado de personal de obra (rut, cargo, direccion, telefono) | 5.1 | `NOMINA_PERSONAL` — Nómina de trabajadores asignados a la obra, faena o servicio |
| Matriz de riesgos | 5.1 | `MIPER` — Matriz de Identificación de Peligros y Evaluación de Riesgos (MIPER) y mapa de riesgos |
| Programa de prevencion en base a la matriz IPER | 5.1 | `PROG_PREVENTIVO` — Programa de trabajo preventivo y evaluación anual de cumplimiento |
| Procedimientos de trabajo seguro segun su labor, con evaluacion | 5.1 | `PROC_TRABAJO_SEGURO` — Procedimientos de trabajo seguro aplicables al servicio |
| Procedimiento de seleccion, uso y mantencion de EPP | 5.1 | `EPP_GESTION` — Procedimiento de EPP, certificados de calidad y registro de capacitación anual |
| Certificaciones de los EPP | 5.1 | `EPP_GESTION` — Procedimiento de EPP, certificados de calidad y registro de capacitación anual |
| Protocolo de actuacion ante acoso (ley Karin 21.643) | 5.1 | `PROTOCOLO_KARIN` — Protocolo de prevención y procedimiento de investigación de acoso laboral, acoso sexual y violencia en el trabajo (Ley Karin) |
| Procedimiento de investigacion ante acoso (ley Karin) | 5.1 | `PROTOCOLO_KARIN` — Protocolo de prevención y procedimiento de investigación de acoso laboral, acoso sexual y violencia en el trabajo (Ley Karin) |
| Plan de emergencia y plan de gestion del riesgo de desastres | 5.1 | `PLAN_EMERGENCIA` — Plan de emergencias y registro del simulacro anual |
| Examen ocupacional de altura fisica (cuando corresponda) | 5.1 | `EXAM_MED` — Certificado de aptitud ocupacional |
| Capacitaciones realizadas al personal | 5.1 | `CAPACITACION_SST` — Registro del curso de capacitación en seguridad y salud en el trabajo (mínimo 8 horas) |
| Entregar R.I.O.H.S (reglamento interno) | 5.1 | `RIOHS` — Reglamento Interno de Orden, Higiene y Seguridad (RIOHS) y comprobante de registro |
| Designacion encargado de prevencion y/o delegado (DS 44) | 5.1 | `RESP_PREVENCION` — Designación y acreditación del responsable de prevención asignado al servicio |
| Induccion informando los riesgos laborales (IRL) | 5.2 | `IRL_ODI` — Información de Riesgos Laborales (IRL, ex ODI) firmada por el trabajador |
| Acuso recibo de entrega de elementos de proteccion personal | 5.2 | `EPP_ENTREGA` — Registro de entrega de EPP firmado por el trabajador |
| Contrato de trabajo de cada trabajador | 5.2 | `CONTRATO` — Contrato de trabajo y sus anexos |
| Estadisticas de accidente | 5.3 | `DAS` — Estadísticas de accidentabilidad y enfermedades profesionales declaradas |
| Certificado F30-1 (ley de subcontratacion) | 5.3 | `F30_1` — Certificado F30-1 — Cumplimiento de obligaciones laborales y previsionales |
| Entrega de capacitaciones | 5.3 | `CAPACITACION_SST` — Registro del curso de capacitación en seguridad y salud en el trabajo (mínimo 8 horas) |
| Cedula de identidad del conductor | 5.4 | `CEDULA_IDENTIDAD` — Cédula de identidad vigente del trabajador |
| Examen ocupacional del conductor | 5.4 | `EXAM_MED` — Certificado de aptitud ocupacional |
| Nomina de trabajadores asignados a la obra | RRHH | `NOMINA_PERSONAL` — Nómina de trabajadores asignados a la obra, faena o servicio |
| F-30 certificado de antecedentes laborales | RRHH | `F30` — Certificado F30 — Antecedentes laborales y previsionales |
| Fotocopia de cedula de identidad por ambos lados | RRHH | `CEDULA_IDENTIDAD` — Cédula de identidad vigente del trabajador |
| Copia del contrato de trabajo y anexo de contrato | RRHH | `CONTRATO` — Contrato de trabajo y sus anexos |
| F30-1 mensual (mes anterior) | RRHH | `F30_1` — Certificado F30-1 — Cumplimiento de obligaciones laborales y previsionales |

---

## 2. Documentos que ellos piden y no tenemos

Son **54 lineas**. Pero muchas son el mismo tramite repetido, asi que como
requisitos reales serian alrededor de **33**.

### 2.1 Lineas que en realidad son un solo requisito

Estas son las que inflan la cuenta. Agrupadas quedan en un requisito cada una,
con varios archivos si hace falta.


**Registro de difusion al trabajador** — 10 lineas → 1 requisito

> Diez lineas distintas del PDF, un mismo tramite: dejar constancia firmada de que al trabajador se le comunico un documento que la empresa ya entrego.

- [5.2] Difusion matriz de riesgos
- [5.2] Difusion procedimiento de trabajo seguro (especifico de su labor)
- [5.2] Difusion procedimiento de accidente, incidente y enfermedad profesional
- [5.2] Difusion programa de prevencion en base a la matriz IPER
- [5.2] Difusion sistema de gestion de SST
- [5.2] Difusion procedimiento IPER
- [5.2] Difusion procedimiento elementos de proteccion personal
- [5.2] Difusion protocolo y procedimiento ley Karin
- [5.2] Difusion plan de emergencia y plan de gestion del riesgo de desastres
- [5.2] Difusion de los protocolos y guias tecnicas del MINSAL

**Registros operativos de obra (ATS, charla de 5 minutos, check list, programas personalizados)** — 4 lineas → 1 requisito

> Son evidencias del dia a dia en faena, no de acreditacion de ingreso. Se entregan continuamente, no una vez.

- [5.3] Retiro y ejecucion de los Programas Personalizados de Actividades
- [5.3] Entrega de charla de 5 minutos
- [5.3] Entrega de ATS (analisis de trabajo seguro)
- [5.3] Entrega de check list

**Protocolos y guias tecnicas del MINSAL** — 3 lineas → 1 requisito

> Carta gantt, difusion y avances de TMERT, MMC, radiacion UV, silice, PREXOR, psicosocial y altas temperaturas.

- [5.1] Carta gantt de protocolos y guias MINSAL (TMERT, MMC, UV, silice, PREXOR, psicosocial, altas temperaturas)
- [5.1] Difusion de los protocolos y guias tecnicas del MINSAL
- [5.3] Avances de los protocolos y guias tecnicas del MINSAL

**Informes de la mutualidad (evaluacion cualitativa, cuantitativa y hoja de visitas)** — 3 lineas → 1 requisito

> Los emite el organismo administrador, no el contratista.

- [5.3] Evaluacion cualitativa de su mutualidad
- [5.3] Evaluacion cuantitativa de su mutualidad
- [5.3] Hoja de visitas de su mutualidad

**Registro de difusiones realizadas al personal** — 2 lineas → 1 requisito

> Aparece en 5.1 y otra vez en 5.3; es el consolidado que guarda la empresa.

- [5.1] Difusiones realizadas al personal
- [5.3] Entrega de difusiones

**Registro de mantencion de herramientas y maquinaria** — 2 lineas → 1 requisito

> Aparece en 5.1 (herramientas electricas) y en 5.3 (maquinarias y vehiculos).

- [5.1] Registro de mantencion de herramientas electricas y maquinarias
- [5.3] Registro de mantenciones de maquinarias y vehiculos

**Acuso de recibo del trabajador** — 2 lineas → 1 requisito

> Reglamento interno y bloqueador solar. Mismo acto que la difusion, con otro nombre.

- [5.2] Acuso recibo de entrega del reglamento interno
- [5.2] Acuso recibo del uso correcto del bloqueador solar

**Capacitacion al trabajador (EPP y extintores)** — 2 lineas → 1 requisito

> Dos capacitaciones especificas por persona, distintas del registro de capacitacion de la empresa.

- [5.2] Capacitacion uso correcto de los elementos de proteccion personal
- [5.2] Capacitacion uso correcto de los extintores

**Certificado de afiliacion previsional y de salud** — 2 lineas → 1 requisito

> AFP y Fonasa/ISAPRE; se piden juntos y se obtienen igual.

- [RRHH] Certificado de afiliacion a AFP
- [RRHH] Certificado de afiliacion de salud (Fonasa / ISAPRE)

### 2.2 Documentos distintos, uno por uno (24)


**De la empresa** (10)

| Documento | Origen |
|---|---|
| Resena de la empresa (actividad a la que se dedica) | 5.1 |
| Organigrama de la empresa (fecha de inicio y termino del servicio) | 5.1 |
| Politica de Seguridad y Salud Ocupacional | 5.1 |
| Libro de control de visitas del asesor en prevencion a la obra | 5.1 |
| Sistema de gestion de SST | 5.1 |
| Procedimiento IPER | 5.1 |
| Procedimiento ante accidentes, incidentes y enfermedad profesional | 5.1 |
| Copia de cartas de conductora acreditado ante SEREMI de Salud e Inspeccion del Trabajo | 5.1 |
| Registro de cambio de los EPP | 5.3 |
| Registro de asistencia del personal (libro de asistencia en digital) | RRHH |

**De cada trabajador** (8)

| Documento | Origen |
|---|---|
| Licencia de conducir acorde a la maquina o vehiculo | 5.4 |
| Curso de manejo a la defensiva | 5.4 |
| Certificado de antecedentes para fines particulares (vigencia 30 dias) | RRHH |
| Pacto de horas extraordinarias | RRHH |
| Licencia de conducir | RRHH |
| Certificado de imposiciones pagadas, por cada trabajador (mensual) | RRHH |
| Liquidaciones de sueldo (mensual) | RRHH |
| Finiquitos legalizados ante ministro de fe / anexo de desvinculacion | RRHH |

**Del vehiculo o maquina** (6)

| Documento | Origen |
|---|---|
| Permiso de circulacion | 5.4 |
| Revision tecnica al dia | 5.4 |
| Seguro obligatorio | 5.4 |
| Registro de ultima mantencion | 5.4 |
| Check list diario de la maquinaria o vehiculo | 5.4 |
| Solicitud de Permiso General (transporte remunerado de pasajeros) | 5.4 |

> El modelo actual **no puede expresarlos**: `entidad_tipo` solo admite
> `EMPRESA` o `TRABAJADOR`, y estos van por maquina. Ver Anexo B.

---

## 3. Requisitos nuestros que sus documentos no piden (23)

No significa que sobren. Seis son **obligacion legal en Chile** y que su
procedimiento no los mencione solo quiere decir que ese procedimiento no los cubre.

### 3.1 Obligacion legal — no conviene quitarlos

| Requisito | Por que |
|---|---|
| `DECL_INCLUSION_LABORAL` — Comunicación electrónica de cumplimiento de la Ley 21.015 de inclusión laboral | Ley 21.015 — obligatorio con 100+ trabajadores |
| `HABILITACION_MIGRATORIA` — Habilitación migratoria para trabajar (trabajador extranjero) | Ley 21.325 de migraciones — condicion para contratar extranjeros |
| `RIHS` — Reglamento Interno de Higiene y Seguridad (RIHS) y comprobante de ingreso web DT/SEREMI | DS 44 / art. 153 CT — obligatorio para toda empresa con 10+ trabajadores |
| `CPHS_DELEGADO_ACTA` — Acta de constitución del Comité Paritario o de elección del Delegado de SST | Ley 16.744 y DS 54 — comite paritario obligatorio con 25+ trabajadores |
| `PROG_VIGILANCIA_SALUD` — Programa de vigilancia ambiental y de la salud por agente de riesgo | DS 594 y protocolos MINSAL por agente de riesgo |
| `EVAL_PSICOSOCIAL` — Informe de evaluación de riesgos psicosociales CEAL-SM/SUSESO y plan de intervención | Protocolo CEAL-SM/SUSESO — obligatorio para todo empleador |

### 3.2 Compliance y garantias — dependen de lo que exija cada mandante

| Requisito | Nivel |
|---|---|
| `HDS_SUSTANCIAS` — Hojas de datos de seguridad (HDS) de sustancias químicas peligrosas | AMPLIADO |
| `PLAN_RESIDUOS_PELIGROSOS` — Plan de manejo de residuos peligrosos aprobado por la SEREMI de Salud | AMPLIADO |
| `VIGENCIA_SOCIEDAD` — Certificado de vigencia de la sociedad, con anotaciones marginales | AMPLIADO |
| `VIGENCIA_PODERES` — Certificado de vigencia de poderes o personería del representante legal | AMPLIADO |
| `ESCRITURA_CONSTITUCION` — Escritura de constitución y sus modificaciones | OPCIONAL |
| `CARPETA_TRIBUTARIA` — Carpeta tributaria electrónica del SII | OPCIONAL |
| `TGR_DEUDA_FISCAL` — Certificado de deuda fiscal de la Tesorería General de la República | OPCIONAL |
| `INFORME_COMERCIAL` — Informe comercial de protestos y morosidades | OPCIONAL |
| `POLIZA_RESP_CIVIL` — Póliza de responsabilidad civil vigente | OPCIONAL |
| `GARANTIA_FIEL_CUMPLIMIENTO` — Boleta de garantía o póliza de fiel cumplimiento del contrato | OPCIONAL |
| `GARANTIA_OBLIG_LABORALES` — Garantía o póliza por obligaciones laborales y previsionales | OPCIONAL |
| `POLIZA_TODO_RIESGO_OBRA` — Póliza todo riesgo de construcción y montaje (CAR/EAR) | AMPLIADO |
| `DJ_CONFLICTO` — Declaración jurada de conflicto de interés | OPCIONAL |
| `MODELO_PREV_DELITOS` — Modelo de prevención de delitos (Ley 20.393) y designación del encargado | OPCIONAL |
| `ADHESION_CODIGO_ETICA` — Carta de adhesión al código de ética o conducta del mandante | OPCIONAL |
| `DJ_BENEFICIARIO_FINAL` — Declaración jurada de socios, beneficiarios finales y empresas relacionadas | OPCIONAL |
| `DPA_DATOS_PERSONALES` — Acuerdo de tratamiento de datos personales (encargado del tratamiento) | AMPLIADO |
---

## 4. Es esto solo de ellos, o lo pedira cualquier mandante?

Cada documento que falta clasificado por su respaldo. Es lo que decide si va al
catalogo global de BERISA o como requisito propio de este cliente.

| Ambito | Cuantos | Que significa | Donde deberia vivir |
|---|---|---|---|
| **LEGAL** | 16 | Lo respalda una norma chilena | Catalogo global, nivel BASE o AMPLIADO |
| **SECTORIAL** | 34 | Practica estandar de construccion y mineria | Catalogo global, nivel OPCIONAL |
| **PROPIO** | 4 | Especifico de Constructora del Mar II | Requisito propio del mandante |

La conclusion practica: **de los 54 documentos que faltan, solo 4 son realmente
suyos**. El resto lo va a pedir cualquier mandante de construccion, y 16 de ellos
los deberia pedir cualquier mandante de cualquier rubro porque los exige la ley.


### 4.1 Respaldados por norma chilena (16)

| Documento | Fundamento |
|---|---|
| Carta gantt de protocolos y guias MINSAL (TMERT, MMC, UV, silice, PREXOR, psicosocial, altas temperaturas) | protocolos MINSAL obligatorios segun agente de riesgo presente |
| Difusion de los protocolos y guias tecnicas del MINSAL | idem — la difusion es parte de la implementacion |
| Difusion de los protocolos y guias tecnicas del MINSAL | idem — la difusion es parte de la implementacion |
| Avances de los protocolos y guias tecnicas del MINSAL | idem |
| Licencia de conducir acorde a la maquina o vehiculo | Ley 18.290 — clase segun el vehiculo |
| Permiso de circulacion | Ley 18.290 — obligatorio para circular |
| Revision tecnica al dia | Ley 18.290 |
| Seguro obligatorio | Ley 18.490 — SOAP |
| Solicitud de Permiso General (transporte remunerado de pasajeros) | DS 212 — solo si transporta personal |
| Certificado de afiliacion a AFP | DL 3.500 — afiliacion previsional obligatoria |
| Certificado de afiliacion de salud (Fonasa / ISAPRE) | Ley 18.469 / DFL 1 — cotizacion de salud obligatoria |
| Pacto de horas extraordinarias | art. 32 CT — el sobretiempo requiere pacto escrito |
| Certificado de imposiciones pagadas, por cada trabajador (mensual) | art. 183-C CT — es el nucleo del derecho de informacion del mandante |
| Liquidaciones de sueldo (mensual) | art. 54 CT — obligatorio entregarlas y conservarlas |
| Registro de asistencia del personal (libro de asistencia en digital) | art. 33 CT y DS 75 — registro obligatorio de jornada |
| Finiquitos legalizados ante ministro de fe / anexo de desvinculacion | art. 177 CT — ratificacion ante ministro de fe |

### 4.2 Practica estandar del rubro (34)

| Documento | Fundamento |
|---|---|
| Organigrama de la empresa (fecha de inicio y termino del servicio) | practica de carpeta de arranque |
| Politica de Seguridad y Salud Ocupacional | ISO 45001 cl. 5.2; no la exige el DS 44 pero la pide todo mandante grande |
| Sistema de gestion de SST | ISO 45001 / practica de mandantes con contratistas permanentes |
| Procedimiento IPER | herencia de OHSAS 18001; el DS 44 remite el metodo a la Guia del ISP |
| Procedimiento ante accidentes, incidentes y enfermedad profesional | estandar; se cruza con la obligacion de investigar del DS 44 |
| Difusiones realizadas al personal | consolidado que guarda la empresa |
| Registro de mantencion de herramientas electricas y maquinarias | practica; se cruza con DS 594 |
| Acuso recibo de entrega del reglamento interno | art. 156 CT obliga a entregarlo; el acuso es la prueba |
| Acuso recibo del uso correcto del bloqueador solar | guia UV del MINSAL; el acuso es practica |
| Difusion matriz de riesgos | acreditar que se informo al trabajador |
| Difusion procedimiento de trabajo seguro (especifico de su labor) | idem |
| Difusion procedimiento de accidente, incidente y enfermedad profesional | idem |
| Difusion programa de prevencion en base a la matriz IPER | idem |
| Difusion sistema de gestion de SST | idem |
| Difusion procedimiento IPER | idem |
| Difusion procedimiento elementos de proteccion personal | idem |
| Difusion protocolo y procedimiento ley Karin | la ley 21.643 si obliga a difundir; el registro es practica |
| Difusion plan de emergencia y plan de gestion del riesgo de desastres | idem |
| Capacitacion uso correcto de los elementos de proteccion personal | practica; se cruza con la obligacion de informar del DS 44 |
| Capacitacion uso correcto de los extintores | DS 594 art. 51 exige personal instruido; el certificado es practica |
| Entrega de difusiones | idem |
| Registro de cambio de los EPP | practica de control de EPP |
| Entrega de charla de 5 minutos | estandar de faena |
| Entrega de ATS (analisis de trabajo seguro) | estandar de construccion y mineria |
| Entrega de check list | estandar de faena |
| Evaluacion cualitativa de su mutualidad | lo emite el organismo administrador |
| Evaluacion cuantitativa de su mutualidad | idem |
| Hoja de visitas de su mutualidad | idem |
| Registro de mantenciones de maquinarias y vehiculos | idem |
| Curso de manejo a la defensiva | estandar de mineria y construccion, no legal |
| Registro de ultima mantencion | practica; el DS 594 exige equipos en buen estado |
| Check list diario de la maquinaria o vehiculo | practica de faena |
| Certificado de antecedentes para fines particulares (vigencia 30 dias) | no lo exige ninguna norma laboral; comun en obra y faena |
| Licencia de conducir | solo si el trabajador conduce |

### 4.3 Especificos de este cliente (4)

| Documento | Fundamento |
|---|---|
| Resena de la empresa (actividad a la que se dedica) | el giro del SII ya lo dice; es formato de su carpeta |
| Libro de control de visitas del asesor en prevencion a la obra | control de gestion suyo sobre el APR del contratista |
| Copia de cartas de conductora acreditado ante SEREMI de Salud e Inspeccion del Trabajo | no se identifica una norma que lo respalde; conviene preguntarles a que se refieren |
| Retiro y ejecucion de los Programas Personalizados de Actividades | el PPA es un instrumento de la mutualidad, no todo mandante lo exige |
---

## 5. Que se agregaria y por que

Las 54 lineas que faltan se dan de alta como **33 requisitos**.
La diferencia son las agrupaciones: varias lineas del PDF son el mismo tramite con
distinto nombre, y darlas de alta por separado llenaria el catalogo de duplicados.

El **nivel** sale del respaldo normativo, no de lo que pida el cliente:
`BASE` obligacion legal de todo empleador, `AMPLIADO` obligacion bajo un supuesto
—tener vehiculos, superar 100 personas—, `OPCIONAL` practica de mercado sin norma
que la exija. Asi el mandante puede exigir lo que quiera, pero la app nunca le dice
que algo es obligacion legal cuando no lo es.

| Nivel | Cuantos |
|---|---|
| BASE — obligacion legal de todo empleador | 5 |
| AMPLIADO — obligacion bajo un supuesto | 7 |
| OPCIONAL — practica de mercado | 21 |


### De cada trabajador (11)

| Codigo | Documento | Nivel | Vigencia | Por que |
|---|---|---|---|---|
| `AFILIACION_PREVISIONAL` | Certificado de afiliacion a AFP y a salud (Fonasa/ISAPRE) | BASE | 365 d | DL 3.500 y DFL 1. Se piden juntos y se obtienen igual; un requisito con dos archivos. |
| `IMPOSICIONES_PAGADAS` | Certificado de imposiciones pagadas por trabajador | BASE | 30 d | art. 183-C CT. Es el documento que sostiene el derecho de informacion del mandante y su defensa ante la responsabilidad subsidiaria. Mensual. |
| `LIQ_SUELDO` | Liquidaciones de sueldo | BASE | 30 d | art. 54 CT. Ademas cierra un hueco existente: SCHEMAS_POR_REQUISITO ya declara LIQ_SUELDO pero el catalogo no lo tenia. |
| `FINIQUITO` | Finiquito ratificado ante ministro de fe o anexo de desvinculacion | BASE | sin vencimiento | art. 177 CT. Sin vencimiento: acredita un hecho puntual. |
| `PACTO_HORAS_EXTRA` | Pacto de horas extraordinarias | AMPLIADO | 365 d | art. 32 CT. Solo aplica si hay sobretiempo, por eso AMPLIADO y no BASE. |
| `CERT_ANTECEDENTES` | Certificado de antecedentes para fines particulares | OPCIONAL | 30 d | Ninguna norma laboral lo exige y pedirlo roza la Ley 19.628 y el art. 2 CT (no discriminacion). Se ofrece porque lo piden en obra, pero declarado como practica. |
| `DIFUSION_TRABAJADOR` | Registro de difusion al trabajador | OPCIONAL | 365 d | AGRUPA 10 LINEAS del PDF: difusion de matriz de riesgos, procedimiento de trabajo seguro, procedimiento de accidentes, programa preventivo, sistema de gestion, procedimiento IPER, procedimiento de EPP, protocolo Karin, plan de emergencia y protocolos MINSAL. Todas son el mismo acto: constancia firmada de que se le comunico un documento. Un requisito con varios archivos. |
| `ACUSO_RECIBO_TRABAJADOR` | Acuso de recibo del trabajador (reglamento interno y bloqueador solar) | OPCIONAL | 365 d | AGRUPA 2 LINEAS. Mismo acto que la difusion con otro nombre. El art. 156 CT si obliga a ENTREGAR el reglamento; el acuso es la prueba. |
| `CAPACITACION_TRABAJADOR` | Capacitacion al trabajador en EPP y extintores | OPCIONAL | 365 d | AGRUPA 2 LINEAS. Distinta del registro de capacitacion de la empresa (CAPACITACION_SST), que es de 8 horas y por empresa. |
| `LICENCIA_CONDUCIR` | Licencia de conducir de la clase que corresponda | AMPLIADO | sin vencimiento | Ley 18.290. AMPLIADO porque solo aplica si el trabajador conduce. Sin vencimiento propio: la vigencia va en el documento. |
| `CURSO_MANEJO_DEFENSIVO` | Curso de manejo a la defensiva | OPCIONAL | 730 d | Estandar de mineria y construccion, no legal. |

### De la empresa (16)

| Codigo | Documento | Nivel | Vigencia | Por que |
|---|---|---|---|---|
| `REGISTRO_ASISTENCIA` | Registro de asistencia del personal | BASE | 30 d | art. 33 CT y DS 75. Obligatorio llevarlo; el mandante lo pide para cruzar jornada con lo facturado. |
| `PROTOCOLOS_MINSAL` | Protocolos y guias tecnicas del MINSAL: carta gantt, difusion y avances | AMPLIADO | 365 d | TMERT, MMC, radiacion UV, silice, PREXOR, psicosocial y altas temperaturas. Obligatorios segun el agente de riesgo presente, por eso AMPLIADO. Sus tres lineas (gantt, difusion, avances) son momentos del mismo paquete. |
| `POLITICA_SSO` | Politica de Seguridad y Salud Ocupacional | OPCIONAL | sin vencimiento | ISO 45001 cl. 5.2. Ninguna norma chilena la exige, pero la pide todo mandante grande. Sin vencimiento. |
| `SISTEMA_GESTION_SST` | Sistema de gestion de SST | OPCIONAL | 365 d | Practica de mandantes con contratistas permanentes. No la exige el DS 44. |
| `PROCEDIMIENTO_IPER` | Procedimiento IPER (metodo de identificacion y evaluacion) | OPCIONAL | 730 d | Distinto de la MIPER: describe COMO se identifica y evalua. Herencia de OHSAS 18001; el DS 44 art. 7 remite el metodo a la Guia Tecnica del ISP, asi que no es exigencia legal. |
| `PROC_ACCIDENTES` | Procedimiento ante accidentes, incidentes y enfermedad profesional | OPCIONAL | 730 d | Se cruza con la obligacion de investigar del DS 44, pero como documento es practica. |
| `ORGANIGRAMA` | Organigrama del servicio con fecha de inicio y termino | OPCIONAL | 365 d | Practica de carpeta de arranque. Identifica quien responde por que. |
| `REGISTRO_DIFUSIONES` | Registro consolidado de difusiones realizadas al personal | OPCIONAL | 365 d | AGRUPA 2 LINEAS (5.1 y 5.3). Es el consolidado que guarda la empresa, distinto del acuso individual. |
| `MANTENCION_EQUIPOS` | Registro de mantencion de herramientas electricas, maquinarias y vehiculos | OPCIONAL | 365 d | AGRUPA 2 LINEAS (5.1 herramientas, 5.3 maquinarias). El DS 594 exige equipos en buen estado; el registro es la evidencia. |
| `REGISTRO_CAMBIO_EPP` | Registro de cambio de EPP | OPCIONAL | 365 d | Complementa EPP_ENTREGA: acredita la reposicion, no solo la entrega inicial. |
| `REGISTROS_OPERATIVOS_OBRA` | Registros operativos de obra: ATS, charla de 5 minutos, check list y programas personalizados | OPCIONAL | 30 d | AGRUPA 4 LINEAS de 5.3. Son evidencia del dia a dia en faena, no de acreditacion de ingreso: se entregan continuamente, no una vez. Conviene decidir si van en la app o quedan fuera de su alcance. |
| `INFORMES_MUTUALIDAD` | Informes de la mutualidad: evaluacion cualitativa, cuantitativa y hoja de visitas | OPCIONAL | 365 d | AGRUPA 3 LINEAS. Los emite el organismo administrador, no el contratista: el contratista solo los reenvia. |
| `RESENA_EMPRESA` | Resena de la empresa | OPCIONAL | sin vencimiento | PROPIO DEL CLIENTE. El giro del SII ya lo dice; es formato de su carpeta. Iria como requisito propio de ellos, no al catalogo global. |
| `LIBRO_VISITAS_APR` | Libro de control de visitas del asesor en prevencion | OPCIONAL | 30 d | PROPIO DEL CLIENTE. Es su control de gestion sobre el APR del contratista. |
| `PPA_MUTUALIDAD` | Retiro y ejecucion de Programas Personalizados de Actividades | OPCIONAL | 365 d | PROPIO DEL CLIENTE. El PPA es un instrumento de la mutualidad; no todo mandante lo exige. |
| `CARTA_CONDUCTORA` | Copia de cartas de conductora acreditado ante SEREMI e Inspeccion | OPCIONAL | 365 d | PROPIO DEL CLIENTE, y SIN FUNDAMENTO IDENTIFICADO: no se encontro norma que lo respalde. Conviene preguntarles a que se refieren antes de darlo de alta. |

### Del vehiculo — requieren modelar una entidad nueva (6)

| Codigo | Documento | Nivel | Vigencia | Por que |
|---|---|---|---|---|
| `PERMISO_CIRCULACION` | Permiso de circulacion del vehiculo | AMPLIADO | 365 d | Ley 18.290. NO SE PUEDE MODELAR HOY: requiere una entidad Vehiculo (ver Anexo B). |
| `REVISION_TECNICA` | Revision tecnica y certificado de gases | AMPLIADO | 365 d | Ley 18.290. NO SE PUEDE MODELAR HOY. |
| `SOAP` | Seguro obligatorio de accidentes personales (SOAP) | AMPLIADO | 365 d | Ley 18.490. NO SE PUEDE MODELAR HOY. |
| `PERMISO_TRANSPORTE_PERSONAL` | Solicitud de Permiso General de transporte remunerado de pasajeros | AMPLIADO | 365 d | DS 212. Solo si el vehiculo transporta personal. NO SE PUEDE MODELAR HOY. |
| `MANTENCION_VEHICULO` | Registro de ultima mantencion del vehiculo | OPCIONAL | 180 d | Practica. NO SE PUEDE MODELAR HOY. |
| `CHECKLIST_VEHICULO` | Check list diario de la maquinaria o vehiculo | OPCIONAL | 1 d | Practica de faena, diario. NO SE PUEDE MODELAR HOY, y su frecuencia tampoco: la vigencia en dias no expresa 'se entrega cada dia'. |

### Las agrupaciones, explicadas

Cinco de los requisitos nuevos juntan varias lineas del PDF. Es donde mas se puede
discrepar, asi que queda dicho cual junta que:

| Requisito | Lineas que junta | Por que es el mismo tramite |
|---|---|---|
| `DIFUSION_TRABAJADOR` | 10 | Todas dicen "difusion de X" y acreditan lo mismo: que al trabajador se le comunico un documento que la empresa ya entrego. Diez requisitos separados obligarian a subir diez PDF con la misma firma |
| `REGISTROS_OPERATIVOS_OBRA` | 4 | ATS, charla de 5 minutos, check list y programas personalizados son evidencia continua de faena, no de ingreso |
| `INFORMES_MUTUALIDAD` | 3 | Los tres los emite el organismo administrador; el contratista solo los reenvia |
| `PROTOCOLOS_MINSAL` | 3 | Carta gantt, difusion y avances son tres momentos del mismo paquete de protocolos |
| `ACUSO_RECIBO_TRABAJADOR`, `CAPACITACION_TRABAJADOR`, `MANTENCION_EQUIPOS`, `REGISTRO_DIFUSIONES`, `AFILIACION_PREVISIONAL` | 2 c/u | Pares que se piden juntos y se obtienen igual |

> **Donde discrepar primero:** `AFILIACION_PREVISIONAL` junta AFP y salud, que son
> dos certificados de dos instituciones distintas. Se agruparon porque siempre se
> piden juntos, pero separarlos es igual de defendible. Y `REGISTROS_OPERATIVOS_OBRA`
> quiza no deberia estar en la app: son registros diarios de faena, no acreditacion.

---

## 6. Que se conserva y por que

Los 23 requisitos que sus documentos no mencionan **no se borran**.
Hay tres razones, y la tercera es tecnica.

### 6.1 Seis son obligacion legal

Que el procedimiento de un cliente no los mencione no significa que no correspondan:
significa que ese procedimiento no los cubre. Si se borran del catalogo global,
**ningun mandante puede volver a exigirlos** sin que BERISA los reponga.

| Requisito | Por que se conserva |
|---|---|
| `DECL_INCLUSION_LABORAL` — Comunicación electrónica de cumplimiento de la Ley 21.015 de inclusión laboral | Obligacion legal. Ley 21.015 para empresas de 100 o mas personas. Un contratista grande la necesita aunque este cliente no la pida. |
| `HABILITACION_MIGRATORIA` — Habilitación migratoria para trabajar (trabajador extranjero) | Obligacion legal. Ley 21.325: sin ella, contratar a un extranjero es una infraccion del contratista que le llega al mandante. |
| `RIHS` — Reglamento Interno de Higiene y Seguridad (RIHS) y comprobante de ingreso web DT/SEREMI | Obligacion legal. DS 44 y art. 153 CT: toda empresa con 10 o mas personas debe tenerlo y registrarlo. Que su procedimiento pida el RIOHS y no el RIHS no lo deroga. |
| `CPHS_DELEGADO_ACTA` — Acta de constitución del Comité Paritario o de elección del Delegado de SST | Obligacion legal. Ley 16.744 y DS 54: comite paritario obligatorio con 25 o mas personas, delegado de SST bajo ese numero. |
| `PROG_VIGILANCIA_SALUD` — Programa de vigilancia ambiental y de la salud por agente de riesgo | Obligacion legal. DS 594 y protocolos MINSAL por agente de riesgo: sin el, la vigilancia de la salud queda sin respaldo. |
| `EVAL_PSICOSOCIAL` — Informe de evaluación de riesgos psicosociales CEAL-SM/SUSESO y plan de intervención | Obligacion legal. Protocolo CEAL-SM/SUSESO, exigible a todo empleador y fiscalizado por la Seremi. |

### 6.2 El resto es lo que piden OTROS mandantes

Polizas, garantias, vigencia de sociedad y poderes, carpeta tributaria, modelo de
prevencion de delitos, declaracion de beneficiario final. Constructora del Mar no los
pide porque su procedimiento es de prevencion de riesgos y de RRHH, no de compliance
contractual. Un mandante de mineria o de energia si los pide, y son justamente los
que diferencian a un catalogo serio de una lista de papeles de obra.

Estan todos en nivel OPCIONAL o AMPLIADO, asi que **no le aparecen a nadie que no los
active**: no molestan a Constructora del Mar por existir.

### 6.3 Borrarlos rompe cosas, en silencio

Se verifico sobre el codigo:

- `reglas_service.py` despacha los validadores **por codigo**, y ante un codigo
  desconocido devuelve `aprobado=True` sin log ni excepcion. Renombrar o borrar un
  codigo con validacion **desactiva ese control y aprueba el documento solo**.
- El seed indexa `CATALOGO_POR_CODIGO[...]` directo: si falta un codigo de la
  plantilla de arranque, **falla al importarse** y el despliegue no carga ni el
  catalogo global.
- Sacar un requisito del catalogo **no borra su fila** de la base: queda huerfana,
  todavia exigida a los contratistas y ya fuera de mantenimiento.


---

# Anexo A · Lineas que no son documentos

6 de las 91 lineas no son papeles que se suban y se revisen.
Aparecen junto a los certificados porque en la carpeta fisica van en la primera hoja.

## A.1 Datos de formulario (4)

| Lo que piden | Origen | Donde vive hoy en la app |
|---|---|---|
| Nombre de la empresa, RUT y giro | 5.1 / RRHH | **Ya existe**: `razon_social`, `rut` y `giro` del contratista |
| N de contrato con Constructora del Mar II SPA | 5.1 | **Ya existe**: `codigo_referencia` del servicio |
| Nombre, telefono y correo del administrador, supervisor y APR | 5.1 | **No existe.** Los usuarios tienen email y cargo, pero no telefono, y no hay forma de marcar quien es el asesor en prevencion de un servicio |
| Datos para confeccionar el F30-1 (direccion, representante legal, nombre y direccion de la obra) | RRHH | Repite el bloque anterior. La direccion de la obra **ya existe** en el centro de trabajo |

> **El unico hueco real es el contacto del APR y del supervisor.** El PDF exige que
> el asesor en prevencion este identificado con nombre, telefono y correo, y que lleve
> un libro de visitas a la obra. Seria un campo, no un requisito documental.

## A.2 Condiciones fisicas de la maquina (2)

- [5.4] Debe poseer alarma de retroceso
- [5.4] Debe poseer baliza

No hay documento que subir: es algo que el prevencionista **verifica mirando el
vehiculo** cuando entra a la obra. Meterlos como requisito obligaria a pedir, por
ejemplo, una foto como evidencia — funcionaria, pero estira el modelo: la norma pide
que la maquina *tenga* la baliza, no que exista un papel.

---

# Anexo B · Lo que el modelo no puede representar hoy

| Caso | Cuantos | Por que | Que haria falta |
|---|---|---|---|
| Documentos del vehiculo o maquina | 6 | `RequisitoDocumental.entidad_tipo` solo admite `EMPRESA` o `TRABAJADOR` | Una entidad `Vehiculo` colgando del contratista, como ya existe `Trabajador` |
| Condiciones fisicas verificables | 2 | Todo requisito se cumple subiendo un archivo que alguien aprueba | Un tipo de requisito de inspeccion, sin archivo |
| Contacto del APR y del supervisor | 1 | No hay telefono en `Usuario` ni rol de APR por servicio | Campos en el contratista o en el servicio |
| Entrega **recurrente** (mensual) | varias | La periodicidad se expresa solo con `vigencia_max_dias`, que no es lo mismo que "se entrega todos los meses" | Una frecuencia explicita en el requisito |

> Nota: de las 12 lineas de §5.4, **cuatro si caben** en el modelo actual —cedula del
> conductor, licencia de conducir, examen ocupacional y curso de manejo a la
> defensiva— porque son del trabajador, no del vehiculo.

