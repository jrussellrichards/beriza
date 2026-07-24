# Rediseño del modelo de documentos — contexto para agentes/devs

> Documento de contexto. Resume la decisión de arquitectura acordada tras un
> debate multi-agente (arquitecto, programador escéptico, ingeniero de
> seguridad, experto de producto). Léelo antes de tocar el dominio de
> documentos. Estado al 2026-07-23: **Fase 0 en PR** (`fase-0-prerequisitos`) y
> **Fase 1 completa** en la rama `fase-1-nucleo` (modelo nuevo en producción de
> código: dominio, API, seed, notificaciones y tarea IA migrados; modelo viejo
> eliminado). El modelo viejo (`documento.py`) ya no existe.

## El problema

Hoy `Documento` (ver `backend/app/models/documento.py`) lleva `mandante_id` y
es dueño de la cadena de versiones/archivos, y `ArchivoDocumento.storage_key`
es `UNIQUE`. Consecuencia: el mismo F30 físico exigido por 2 mandantes = 2
`Documento` = 2 cadenas = 2 subidas del mismo PDF. Es **imposible compartir un
archivo entre mandantes**, y el storage queda particionado por mandante.

## El modelo convergido (objetivo, Fase 1)

Separar "lo que subió el contratista" (sin mandante) de "cómo lo juzgó cada
mandante" (por mandante):

| Entidad | Qué es | Claves |
|---|---|---|
| **Expediente** | Biblioteca del contratista para un requisito | `requisito_id + entidad` (empresa XOR trabajador), **+ `servicio_id` solo si alcance SERVICIO** (NULL si ENTIDAD). **SIN `mandante_id`.** |
| **Entrega** | Una versión subida | `expediente_id`, `numero_version`, `fecha_emision`, **`fecha_vigencia_hasta`** (fuente única de verdad de la vigencia) |
| **Archivo** | El PDF físico | `entrega_id`, `storage_key` (**se mantiene UNIQUE**), `hash_sha256`, `orden` |
| **Acreditación** | La revisión de UN mandante | `mandante_id`, `expediente_id`, `entrega_id` (pin explícito de la versión que revisa), `estado`, `vigencia` se lee de la Entrega |

Reglas clave del modelo:
- **Compartir sin copiar bytes**: N `Acreditación` → 1 `Entrega`. NO se logra
  soltando el `UNIQUE` de `storage_key` (eso fue un error descartado); la
  de-dup de bytes es por `hash_sha256` (ya se calcula, hoy sin usar).
- **`servicio_id` se queda en el Expediente para alcance SERVICIO** (el MIPER
  de Obra Norte y el de Obra Sur son documentos paralelos, no versiones uno del
  otro). Solo se le quita `mandante_id`. Esto refina la propuesta original del
  arquitecto (que lo movía a Acreditación).
- **Vigencia**: `fecha_vigencia_hasta` es un hecho del documento → vive en
  `Entrega`. El *umbral de antigüedad aceptable por mandante* es distinto: ya
  vive en `PerfilRequisitoConfig.vigencia_max_dias` y produce un *estado*, no
  una fecha. `"sin vencimiento"` = flag en `RequisitoDocumental`.
- **Fan-out de renovación**: subir una V2 NO reabre las acreditaciones
  aprobadas de otros mandantes (pin explícito). Se notifica, no se cambia
  estado. Un cron de vencimiento (Fase 2) hace auto-repin a una renovación
  vigente antes de marcar VENCIDO.

## Storage objetivo (Fase 1)

Raíz por **contratista**, sin mandante en la ruta; separado por documentos
globales (`entidad/`) vs. por servicio (`servicio/{id}/`):

```
{empresa_id}/
  entidad/{empresa|trabajador}/{entidad_id}/{REQ}/v{n}/{uuid}.pdf   # F30, examen médico
  servicio/{servicio_id}/{empresa|trabajador}/{entidad_id}/{REQ}/v{n}/{uuid}.pdf   # MIPER
```

Sin datos de producción → la migración es limpia (no hay blobs viejos que
mover; `construir_key` en `archivo_service.py` genera la estructura nueva desde
el primer archivo post-migración).

## Plan por fases

- **Fase 0 — Prerequisitos (EN CURSO):** cerrar bugs vivos que el modelo
  compartido agrava, independientes del rediseño.
  1. Verificación de pertenencia de tenant (autorización a nivel de dato) en
     `documentos.py` y `acreditacion.py` — hoy solo verifican rol, no
     pertenencia; `middleware/tenant.py` estaba sin implementar.
  2. Resolver requisito por `requisito_id`, no por `codigo`, en
     `reglas_service.py` (el `codigo` dejó de ser único global tras los
     requisitos propios por mandante), y bloquear que un requisito propio
     colisione con el catálogo global en `pilares.py`.
- **Fase 1 — Núcleo (LISTA):** las 4 tablas + storage + migración + reescritura
  de dominio (subir_entrega, acreditacion_service, revisar, historial).
- **Fase 2 — Reutilización + vigencia (LISTA):** ver detalle abajo.
- **Fase 3 — Sensibilidad (LISTA, adelantada a Fase 2):** el flag `sensible` era
  prerequisito de la reutilización — sin él, reutilizar habría compartido
  documentos de negocio con un mandante nuevo sin consentimiento. Se implementó
  junto con R1–R3 de Fase 2.
- **Fase 4 — Subcontratistas (ortogonal):** tabla `ServicioSubcontratista`;
  `Acreditacion.mandante_id` = mandante real (Ley 20.123). **Decisión abierta:**
  revisión delegada completa vs. vista agregada.

## Fase 2 — qué se implementó

Rama `fase-2-reutilizacion-vigencia`. Dos verticales, por incrementos verificados.

### Vigencia y vencimientos

- `RequisitoDocumental.sin_vencimiento`: requisitos que no caducan (escritura de
  la sociedad) quedan fuera del cron y de las alertas.
- Estado `VENCIDO = 5`. Transiciones: `APROBADO → VENCIDO` (cron),
  `VENCIDO → ENVIADO` (renovación o auto-repin).
- `vencimiento_service.procesar_vencimientos`: por cada Acreditación APROBADA
  cuya entrega fijada expiró, si el expediente tiene una entrega posterior
  vigente hace **auto-repin** a ella (`RENOVACION_AUTO` → ENVIADO); si no,
  marca `VENCIDO`. Idempotente.
- `alertas_de_vencimiento`: digest al contratista a 30/15/7/1 días.
- Celery **beat** nuevo (servicio `beat` en `docker-compose.prod.yml`), diario 07:00.

### Reutilización entre mandantes

Un F30 vigente vale para todos los mandantes: el contratista no lo sube N veces.

- `RequisitoDocumental.sensible`: gatea el compartir automático.
- `reutilizacion_service.reconciliar_reutilizacion(db, contratista, mandante)`:
  por cada requisito **de alcance ENTIDAD** que el mandante exige y el
  contratista ya tiene resuelto, crea la Acreditación faltante:
  - genérico → `ENVIADO` anclado a la entrega vigente. **Nunca pre-aprobado**:
    cada mandante lo revisa con su propia config (su `vigencia_max_dias` puede
    ser más estricto).
  - sensible → `PENDIENTE_AUTORIZACION = 6`, **sin** `entrega_id` — el archivo
    no se comparte hasta que el contratista autorice.
- Los requisitos de alcance SERVICIO no se reutilizan entre mandantes: son
  específicos de la faena (un MIPER por obra).
- **Tres triggers**, todos best-effort con `logger.exception` (lo que ya se
  confirmó —la entrega, el servicio, la config— no se pierde si falla la
  propagación):
  1. `crear_servicio` — un mandante nuevo hereda lo que el contratista ya tiene.
  2. `subir_entrega` (solo alcance ENTIDAD) — el documento recién subido se
     propaga al resto de los mandantes del contratista. **Sin este trigger la
     promesa "se sube una vez" no se cumple:** un F30 subido para Codelco nunca
     llegaría a Falabella, que ya tiene servicio y lo exige igual.
  3. `configurar_requisito_perfil` — si un mandante empieza a exigir algo que
     sus contratistas ya tienen resuelto, se les aplica en vez de pedirlo.
- La propagación **no mueve acreditaciones existentes**: un mandante anclado a
  la v1 sigue en la v1 hasta que su vigencia expire (ahí actúa el auto-repin del
  cron). El pin explícito de Fase 1 se respeta.
- **Bandeja:** `/api/v1/reutilizacion/solicitudes` + `/contratista/solicitudes`.
  Autorizar ancla la entrega vigente y pasa a ENVIADO. Rechazar descarta la
  acreditación y **el rechazo es durable**: `reconciliar_reutilizacion` no
  vuelve a proponer un expediente que ya tuvo acreditación con ese mandante
  (por eso el chequeo de existencia no filtra `eliminado_en`).
- Aislamiento: los endpoints responden **404, no 403**, si la acreditación no es
  del contratista del usuario — un 403 confirmaría que existe.

Tests: `backend/tests/test_vencimiento.py` y `test_reutilizacion.py`, ambos en
el job `backend-test` de CI que gatea el deploy.

## Decisiones de producto

- **A (aceptada):** cron con auto-repin a renovación vigente antes de VENCIDO.
- **B (aceptada):** flag de sensibilidad para gatear el compartir.
- **C (pendiente):** alcance de subcontratistas.
- **D (aceptada):** reutilización **automática** para genéricos (sin fricción) y
  **con autorización explícita** para sensibles. Se descartó pedir autorización
  siempre: convertía cada mandante nuevo en una fila de aprobaciones para el
  contratista, que es justo el trabajo manual que el rediseño elimina.
