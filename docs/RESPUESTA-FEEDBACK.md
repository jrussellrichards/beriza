# Respuesta al feedback de testers — 25 de agosto de 2026

Análisis de las 6 observaciones de [`feedback_2026_08_25.pdf`](./feedback_2026_08_25.pdf), contrastadas una por una contra el código.

**Los 6 puntos describen algo real.** Ninguno es un malentendido de quien probó. Pero en dos casos lo que piden literalmente destruiría algo que el producto necesita, y hay que darles otra cosa que resuelve el mismo dolor.

---

## Veredicto

| # | Observación | Veredicto | Costo |
|---|---|---|---|
| 1a | Editar servicios | **Aceptar** — ya existe en backend | Bajo (solo frontend) |
| 1b | Eliminar servicios | **Aprobado** — borrado solo si está vacío | Medio |
| 1c | Reactivar un servicio TERMINADO | **Pendiente de decisión** | Bajo |
| 2 | Carga masiva de servicios | **Aceptar**, cuestionar prioridad | Alto |
| 3 | Más datos del contratista | **Aceptar sin reservas** | Medio |
| 4 | Click en trabajador → su ficha | **Aceptar** — mejor costo/beneficio | Bajo (solo frontend) |
| 5 | Contratista pueda eliminar documento | **Aprobado** — reemplazar, no borrar | Medio |
| 6 | Más datos del trabajador | **Aprobado** — el reparo legal queda diferido | Medio |

---

## Decisiones tomadas — 25 de agosto de 2026

Javier revisó el análisis y resolvió:

| Punto | Decisión |
|---|---|
| **#5** reemplazar en vez de borrar | **Aprobado.** Se implementa el reemplazo de entrega. |
| **#1b** eliminar servicios | **Aprobado.** Borrado real solo si el servicio está vacío; archivado en el resto. |
| **#6** datos del trabajador | **Aprobado.** Los campos se agregan ahora. |
| **#1c** reactivar un TERMINADO | **Pendiente.** Ver más abajo. |

### Sobre el reparo legal del punto #6 — diferido, no descartado

Los campos del trabajador se implementan **sin** el control de visibilidad por rol, para no bloquear la entrega.

**Esto queda como deuda explícita, no como algo resuelto.** El razonamiento del punto 6 sigue vigente palabra por palabra: son datos personales de un tercero, y la Ley 21.719 entra en vigencia plena el **1 de diciembre de 2026**. Al momento de tomar esta decisión faltaban poco más de tres meses.

Lo que hay que retomar antes de esa fecha:

1. Decidir **qué campos ve el mandante** y cuáles quedan solo para el contratista, que es el empleador. El domicilio particular y el teléfono personal son los casos claros a revisar.
2. Colgar esa distinción de `usuario_pilar_permisos`, que ya existe.
3. Declarar la finalidad de cada campo — la ley la exige por dato, no por sistema.

Quien retome esto: el trabajo no es agregar los campos (ya están), es decidir quién los ve.


---

## 1a. Editar servicios — ya está construido

**Verificado:** `PATCH /api/v1/servicios/{id}` existe y acepta `nombre`, `codigo_referencia`, `descripcion`, `fecha_termino` y `centro_trabajo_id` (`backend/app/api/servicios.py:195`).

El frontend solo lo llama para asignar centro de trabajo (`frontend/src/features/crear-servicio/asignar-centro-dialog.tsx:46`). No hay formulario de edición.

**Qué hacer:** exponer un formulario sobre un endpoint que ya funciona y ya está probado. Es el cambio de menor riesgo de toda la lista.

**Archivos:** `frontend/src/app/(mandante)/mandante/servicios/page.tsx` y un dialog nuevo en `features/crear-servicio/`.

---

## 1b. Eliminar servicios — el problema sí, el borrado no

**Verificado:** no existe endpoint `DELETE` de servicio. La observación es correcta.

**Por qué no borrado duro:** un servicio acumula acreditaciones, entregas de documentos y eventos. Borrarlo destruye el rastro que hace defendible la acreditación frente a una fiscalización. Ese rastro es la razón de existir del producto.

**Pero el dolor es real:** un servicio creado por error ensucia la lista para siempre.

**Propuesta:**
- Borrado real **solo** cuando el servicio no tiene trabajadores asignados ni documentos — ahí no hay nada que proteger, es un error de tipeo.
- Archivado (`ARCHIVADO`, o un flag `visible`) para el resto: sale de la lista, conserva el historial.

---

## 1c. Reactivar un servicio TERMINADO

**Verificado:** prohibido a propósito en `backend/app/domain/servicio_service.py`:

> `"Un servicio terminado no puede cambiar de estado."`

La intención es defendible: al terminar se cierran los requisitos de `momento = TERMINO` (finiquitos, F30 final).

**Pero un botón irreversible de un clic, sin deshacer, es un mal diseño.** Nadie confirma nada y no hay vuelta atrás.

### Qué significa en la práctica

*Terminar* es un botón de un clic, **al lado de *Suspender***, y no tiene vuelta atrás nunca. Comprobado en local mientras se probaba el punto #1a: al apretarlo, el servicio quedó sin ningún botón de estado, de forma permanente.

Dos situaciones reales donde eso duele:

1. **Alguien aprieta *Terminar* queriendo *Suspender*.** Están uno junto al otro y la diferencia no está explicada en la interfaz.
2. **Un contrato terminado se reactiva** — se extendió la obra, volvió el contratista a la misma faena.

En ambos casos la única salida hoy es **crear un servicio nuevo desde cero**, y con eso se pierde el historial de acreditación del anterior: quién estaba habilitado, qué documentos se aprobaron y cuándo. Se pierde justo lo que el producto existe para conservar.

**Propuesta:** permitir reactivar dejando registro como evento (`TipoEvento`) de quién lo hizo y cuándo, restringido a `mandante_admin`. El historial no se pierde y el error se puede corregir.

**Estado: pendiente de decisión de producto.**

**Y algo que el feedback no menciona:** `SUSPENDIDO` **ya existe y sí es reversible**. Parte del problema puede ser que la UI no distingue bien "pausar" de "cerrar", y la gente aprieta *Terminar* queriendo pausar. Antes de tocar la regla, mirar si el problema es de etiquetas.

---

## 2. Carga masiva de servicios

**Verificado:** no existe ninguna funcionalidad de importación en el repositorio.

**El hueco es real.** El reparo es de prioridad: **¿cuántos servicios crean de una vez?** Si son 5, un importador CSV es sobreingeniería.

El volumen alto real probablemente sea **trabajadores** — un contratista con 80 personas cargándolas de a una. Ese es el mismo mecanismo.

**Propuesta:** preguntar el volumen antes de construirlo, y si se construye, hacerlo genérico para servir a servicios **y** trabajadores.

---

## 3. Más datos del contratista — el más sólido

**Verificado:** `EmpresaContratista` tiene exactamente tres campos —`rut`, `razon_social`, `giro`—. Nada más.

Lo que piden (mutualidad, número de emergencia, dirección, representante legal y su teléfono) es correcto, y la razón que dan —fiscalización y auditorías— es la correcta.

**Y la mutualidad no es un campo administrativo.** Determina dónde se denuncia un accidente, y el catálogo ya tiene `INFORMES_MUTUALIDAD` y `PPA_MUTUALIDAD` colgando de una mutualidad que el sistema no sabe cuál es. Ese hueco ya existía antes del feedback.

**Cuidado con representante legal:** ya existe `VIGENCIA_PODERES` como requisito documental. El campo y el documento tienen que hablarse, no duplicarse — el campo es el dato operativo, el documento es la prueba.

**Archivos:** `backend/app/models/contratista.py`, migración Alembic, `backend/app/api/schemas.py`, `frontend/src/features/invitar-contratista/invitar-contratista-dialog.tsx`.

---

## 4. Click en el trabajador → su ficha

**Verificado** en `frontend/src/app/(mandante)/mandante/contratistas/page.tsx:424`: la lista de trabajadores es un `<div>` plano con nombre, RUT y un ícono de estado. **Sin `onClick`.**

**Lo importante: los datos ya están cargados.** `c.trabajadores[].documentos` ya viene en la respuesta y ya se renderiza en la pestaña *Documentos*, agrupado por pilar con la etiqueta "Por trabajador".

No falta backend. No falta modelo. **Falta reorganizar por persona en vez de por pilar.**

Es el arreglo más barato de la lista y el que más reclamo destraba.

**Archivos:** solo `frontend/src/app/(mandante)/mandante/contratistas/page.tsx`.

---

## 5. Que el contratista pueda eliminar un documento — la mecánica no

**Verificado** en `backend/app/domain/documento_service.py:115`. El mensaje del sistema es literalmente lo que describieron:

> "Ya existe una entrega pendiente de revisión. Espere el resultado antes de subir una nueva versión."

**El dolor es real y es peor de lo que ellos plantean:** obliga al mandante a revisar un documento que el contratista ya sabe que está malo. Se pierde tiempo de las dos partes.

**Pero borrar no puede ser la salida.** Este producto existe para poder responder *qué entregó el contratista y cuándo*. Si el contratista puede borrar, quien subió un documento adulterado puede hacerlo desaparecer después. Eso destruye lo único que hace defendible la acreditación.

**La salida que resuelve el mismo dolor: dejarlo *reemplazar*, no borrar.**

La maquinaria ya existe: `numero_version`, `entregas`, deduplicación por hash de contenido. Que suba una versión nueva estando en `ENVIADO`; la anterior queda en el historial marcada como reemplazada y sale sola de la cola del mandante.

**Para el contratista es indistinguible de lo que pidió. Para el sistema, es la diferencia entre tener registro y no tenerlo.**

Opcionalmente, un *retirar* explícito que saque la entrega de la cola de revisión, también como evento y no como borrado.

---

## 6. Más datos del trabajador — con un reparo que el feedback no considera

**Verificado:** `Trabajador` tiene `empresa_id`, `rut`, `nombre_completo`, `cargo`, `activo`. Nada más.

Los campos que piden (fecha de nacimiento, correo, dirección, teléfono, contacto de emergencia) son razonables. **Pero son datos personales de un tercero**, no de la empresa contratante.

**La Ley 21.719 entra en vigencia plena el 1 de diciembre de 2026** — poco más de tres meses — y exige finalidad declarada y minimización por cada dato. *(Confirmar con abogado; la fecha es esa.)*

La distinción que conviene hacer:

| Dato | Justificación |
|---|---|
| `fecha_nacimiento` | Clara: edad para faenas restringidas (Ley 21.015) |
| Contacto de emergencia | Clara: a quién llamar ante un accidente en obra |
| `correo`, `dirección`, `teléfono` | Los necesita **el empleador** (el contratista). Que el **mandante** vea el domicilio particular de un trabajador de otra empresa es harina de otro costal. |

**Propuesta: aceptar los campos, pero decidir quién los ve.** Ya existe la tabla `usuario_pilar_permisos` donde colgar esa distinción.

**Archivos:** `backend/app/models/trabajador.py`, migración Alembic, `backend/app/api/schemas.py`, `frontend/src/features/agregar-trabajador/agregar-trabajador-dialog.tsx`.

---

## Orden de implementación sugerido

Por costo/beneficio, no por número de observación:

1. **#4 ficha del trabajador** — solo frontend, datos ya cargados
2. **#1a editar servicio** — solo frontend, endpoint ya probado
3. **#3 datos del contratista** — modelo + migración, sin decisiones pendientes
4. **#6 datos del trabajador** — igual, más la decisión de visibilidad
5. **#5 reemplazar entrega** — requiere confirmar el enfoque con producto
6. **#1b / #1c servicios** — requieren decisión de producto
7. **#2 carga masiva** — requiere saber el volumen real

Los puntos 1 a 4 no tienen decisiones pendientes y se pueden construir de inmediato.
