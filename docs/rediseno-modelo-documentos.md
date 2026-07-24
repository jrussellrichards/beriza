# Rediseño del modelo de documentos — contexto para agentes/devs

> Documento de contexto. Resume la decisión de arquitectura acordada tras un
> debate multi-agente (arquitecto, programador escéptico, ingeniero de
> seguridad, experto de producto). Léelo antes de tocar el dominio de
> documentos. Estado al 2026-07-23: **Fase 0 en curso** (rama
> `fase-0-prerequisitos`).

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
- **Fase 1 — Núcleo:** las 4 tablas + storage + migración + reescritura de
  dominio (subir_entrega, acreditacion_service, revisar, historial).
- **Fase 2 — Reutilización + vigencia:** auto-generar Acreditación al exigirse
  un requisito; fecha única en Entrega; cron de vencimiento (Celery **beat**
  nuevo, no existe hoy) con auto-repin; alertas 30/15/7/1.
- **Fase 3 — Sensibilidad:** flag en `RequisitoDocumental`; documentos con
  contenido de negocio piden autorización del contratista antes de compartirse.
- **Fase 4 — Subcontratistas (ortogonal):** tabla `ServicioSubcontratista`;
  `Acreditacion.mandante_id` = mandante real (Ley 20.123). **Decisión abierta:**
  revisión delegada completa vs. vista agregada.

## Decisiones de producto

- **A (aceptada):** cron con auto-repin a renovación vigente antes de VENCIDO.
- **B (aceptada):** flag de sensibilidad para gatear el compartir.
- **C (pendiente):** alcance de subcontratistas.
