# Portales — criterio de diseño

> Documento de contexto. Explica **por qué** cada portal tiene las vistas que
> tiene. Léelo antes de agregar o mover una pestaña. Estado al 2026-07-24.

## El principio

Las vistas se derivan de **las preguntas recurrentes del rol**, no de las tablas
de la base de datos. La versión anterior tenía pestañas llamadas Servicios,
Trabajadores y Documentos —los nombres de las tablas— y por eso no contestaba
preguntas que cruzaban dos de ellas.

## La unidad operativa es el SERVICIO, no el mandante

Es la decisión de arquitectura más importante de los dos portales.

Un trabajador puede estar **habilitado en una faena y bloqueado en otra del
mismo cliente**. Dos mecanismos lo causan:

1. Cada `Servicio` referencia su propio `PerfilRequisitos`. Codelco puede exigir
   examen de altura en Obra Norte y no en Obra Sur.
2. Los requisitos de alcance SERVICIO son por faena por definición (el MIPER de
   Obra Norte no sirve para Obra Sur).

Cualquier vista que agregue por mandante —"Codelco: BLOQUEADA"— dice *que* hay un
problema sin decir *dónde*. `obtener_avance_servicio` calcula por servicio;
úsalo.

**Excepción deliberada:** el DOCUMENTO sigue siendo transversal a las faenas.
La faena es la unidad de *evaluación*; el documento, la de *gestión*. Por eso
"Mis documentos" no se agrupa por servicio.

## Portal del contratista — 4 vistas

Su trabajo no es administrar papeles: es **no quedar bloqueado**.

| Vista | Pregunta | Endpoint clave |
|---|---|---|
| **Inicio** | ¿puedo trabajar? ¿qué hago ahora? | `/acreditacion/mis-pendientes` |
| **Documentos** | ¿dónde está? ¿qué me falta? | `/documentos/mis-documentos` |
| **Trabajadores** | ¿puede entrar Pedro a esta faena? | `/trabajadores/mis-trabajadores` |
| **Servicios** | ¿qué me exige cada uno? | `/servicios/` + `/{id}/avance` |

**Solicitudes dejó de ser una vista.** Era una pantalla para *un* tipo de acción,
y ya hay cuatro (autorización, observado, por vencer, trabajador incompleto). Se
absorbió en la bandeja unificada de Inicio, ordenada por urgencia. Si aparece un
quinto tipo, va ahí y no en una pestaña nueva.

## Portal del mandante — 6 vistas

Su trabajo no es administrar contratistas: es **no cargar con responsabilidad
legal** por lo que pasa en su faena (Ley 20.123).

| Vista | Pregunta | Endpoint clave |
|---|---|---|
| **Inicio** | ¿dónde estoy expuesto? | `/acreditacion/mi-riesgo` |
| **Revisión** | ¿qué tengo que revisar? | `/documentos/pendientes-revision` |
| **Contratistas** | ¿quién cumple? | `/mandantes/{id}/contratistas-detalle` |
| **Servicios** | ¿quién trabaja ahí y puede entrar? | `/servicios/{id}/avance` |
| **Perfiles** | ¿qué le exijo a quién? | `/mandantes/{id}/requisitos` |
| **Configuración** | mi cuenta | `/mandantes/{id}/configuracion` |

**Reportes se retiró.** Su única acción propia —exportar a PDF/Excel— estaba
deshabilitada con un "próximamente" y sus gráficos duplicaban Inicio. Una
pestaña que promete algo que no funciona erosiona la confianza en el resto del
producto. Cuando exista la exportación de evidencia de fiscalización —que sí
tiene valor legal— tendrá su lugar.

## Reglas de redacción de la interfaz

**Enunciar la consecuencia, no el estado técnico.** "No podrá ingresar a la
faena", no "documento faltante". "Puede ingresar / No puede ingresar", no "al
día". El usuario no viene a administrar registros.

**Nunca afirmar lo que no se pudo verificar.** Si la carga falla, no se muestra
"Estás al día" ni "todo en regla": se advierte que puede haber algo pendiente.
Una falsa tranquilidad en este producto significa alguien entrando a una faena
sin cumplir.

**El vacío tranquiliza.** Cero pendientes se dice explícitamente ("Estás al
día"), no se esconde la sección. Es la información que el usuario más quiere.

**Mostrar un dato solo cuando explica una diferencia.** El número de versión en
los badges por mandante aparece únicamente si los mandantes difieren; si todos
miran la misma versión, es ruido.

## Responsive

Ambos portales: barra lateral en escritorio (`md:`), barra inferior en teléfono.
El prevencionista que sube un examen médico está **en la obra con el teléfono**,
no en un escritorio — era el problema de usabilidad más grande del portal.

No usar `h-screen` con `overflow-hidden` en las páginas: rompe el scroll en
móvil. El layout ya reserva espacio para la cabecera y la barra inferior fijas
(`pt-14 pb-20 md:pt-0 md:pb-0`); cada página maneja su padding horizontal con
`px-6 sm:px-8`.

## Vocabulario

`Servicio.tipo` es **OBRA | FAENA | SERVICIO**, lo elige el mandante al crear y
el portal del contratista muestra esa palabra. No son intercambiables en el
rubro: una obra se construye y termina, una faena es un sitio de trabajo
continuo, un servicio es una prestación que puede no tener sitio fijo. Se
descartó un rótulo por mandante porque un mismo cliente tiene faenas mineras *y*
contrata servicios de transporte.
