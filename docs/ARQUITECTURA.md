# Acredita — Arquitectura de Documentos y Servicios

> Documento vivo. Se actualiza con cada fase del rediseño de almacenamiento
> de documentos. Última actualización: 2026-07-14 (Fases 1–4 + rediseño
> completo del frontend implementados; pipeline IA pospuesto — el sistema
> opera con revisión manual del mandante).

---

## 1. El problema que resuelve este diseño

El modelo original tenía una sola tabla `documentos` que mezclaba tres conceptos:
el **cumplimiento** de un requisito, el **intento de subida**, y el **archivo físico**
(`archivo_url`, un solo string). Además, la configuración de requisitos era única
por mandante, sin distinguir que un mandante puede contratar a la misma empresa
para servicios distintos con exigencias distintas.

El rediseño separa esos conceptos y agrega la capa **Servicio**.

---

## 2. Modelo conceptual

```
Mandante ──< PerfilRequisitos ──< PerfilRequisitoConfig >── RequisitoDocumental
    │              ▲                                          (catálogo global,
    │              │ referencia                                solo berisa_admin)
    └──< ContratistaMandante ──< Servicio ──< ServicioTrabajador >── Trabajador
                                    │
                            Documento (expediente lógico, único)
                                    │
                            DocumentoVersion (entregas, inmutables)
                                    │
                            ArchivoDocumento (1..N físicos)
                                    +
                            DocumentoEvento (bitácora append-only)
```

### El expediente documental (Fase 3 — implementada)

| Entidad | Qué representa | Regla clave |
|---|---|---|
| `Documento` | El cumplimiento de UN requisito por UNA entidad ante un mandante (y ante un servicio si el requisito es alcance SERVICIO) | Identidad única reforzada por 4 índices únicos parciales + CHECK XOR empresa/trabajador. `estado`/`fecha_vigencia_hasta`/`mensaje_brecha` son snapshot de la versión vigente (solo `documento_service` los escribe). Soft delete (`eliminado_en`) — nunca DELETE físico. |
| `DocumentoVersion` | Cada entrega del contratista | Inmutable al llegar a estado terminal; la corrección es versión N+1. Guarda resultado del análisis, quién subió, quién revisó y la excepción. |
| `ArchivoDocumento` | Archivo físico en storage | 1..N por versión (`max_archivos` del requisito), con `storage_key` única, `hash_sha256` de integridad y `orden` (los archivos se procesan juntos). |
| `DocumentoEvento` | Bitácora de auditoría | Append-only: cada subida y transición con actor (`NULL` = sistema), estados anterior/nuevo y detalle. Nunca UPDATE ni DELETE. |

**Re-entrega**: solo desde OBSERVADO (corrección) o APROBADO (renovación).
Con una entrega ENVIADO/EN_ANALISIS pendiente, el backend rechaza subir otra.

### Revisión manual (mientras el pipeline IA está pospuesto)

`IA_HABILITADA=false` (default) → las entregas quedan **ENVIADO** y el mandante
las resuelve en `/mandante/revision`: **Aprobar** (con fecha de vigencia opcional)
u **Observar** (motivo obligatorio que el contratista ve textual). Cada revisión
queda en la bitácora como `REVISION_MANUAL` con el usuario que la hizo.
Cuando el pipeline IA exista, se activa con `IA_HABILITADA=true` +
`VISION_LLM_API_KEY` — sin tocar código: la máquina de estados soporta ambos caminos.

### Entidades de la capa Servicio (Fase 1 — implementada)

| Entidad | Qué representa | Regla clave |
|---|---|---|
| `PerfilRequisitos` | Plantilla de exigencias del mandante ("Obras civiles", "General") | Nombre único por mandante. Sin override por servicio: si un contrato necesita otra exigencia, se crea otro perfil. |
| `PerfilRequisitoConfig` | Parametrización de un requisito dentro del perfil (vigencia, umbral deuda, obligatoriedad) | Única por (perfil, requisito). `parametros_extra` JSON para reglas futuras sin migración. Sucesora de `MandanteRequisitoConfig` (deprecada). |
| `Servicio` | Contrato/faena concreto mandante↔contratista | Cuelga de `ContratistaMandante` y referencia un perfil del mismo mandante. Estados: ACTIVO → SUSPENDIDO/TERMINADO (TERMINADO es final). |
| `ServicioTrabajador` | Asignación de un trabajador a una faena | La declara el **contratista**. Desasignación es soft (conserva historial). La acreditación por servicio solo evalúa trabajadores asignados activos. |

### El doble eje del catálogo: `entidad_tipo` × `alcance`

Cada `RequisitoDocumental` declara **a quién** aplica y **con qué ámbito** vale:

| entidad_tipo | alcance | Ejemplo | Se sube |
|---|---|---|---|
| EMPRESA | ENTIDAD | F30, escritura | Una vez, vale para todos los servicios del mandante |
| EMPRESA | SERVICIO | MIPER de la faena | Por cada servicio |
| TRABAJADOR | ENTIDAD | Carnet, examen médico | Una vez por trabajador |
| TRABAJADOR | SERVICIO | Contrato por obra | Por trabajador y servicio |

El alcance evita que el contratista suba el mismo F30 tres veces para tres servicios.
La asignación de alcances del catálogo MVP vive **explícita** en `scripts/seed.py`
(`ALCANCES`) — es una decisión de negocio, no un default implícito.

El catálogo también declara la validación de entrega **data-driven**:
`max_archivos` y `formatos_permitidos` por requisito (NULL = default global de settings).

### Estado del documento ≠ cumplimiento por servicio (decisión clave)

- **Estado del documento** (1–4, almacenado): ciclo de vida de la entrega.
  Para documentos de alcance ENTIDAD compartidos entre servicios, `reglas_service`
  valida contra la **config más estricta** de los servicios activos que lo exigen.
- **Cumplimiento por servicio** (derivado, nunca almacenado): `acreditacion_service`
  calcula por servicio si cada documento aprobado satisface la config de *ese* perfil.
  Es una función pura sobre datos persistidos — no hay estados cacheados que se
  desincronicen. `ContratistaMandante.estado_acreditacion` pasa a ser un agregado.

---

## 3. Máquina de estados

Fuente única de verdad: [`app/domain/estados.py`](../backend/app/domain/estados.py).
**Prohibido** usar números (`estado=1`) o strings (`"ACTIVO"`) mágicos fuera de ese módulo.

```
EstadoDocumento:  ENVIADO(1) → EN_ANALISIS(2) → APROBADO(4)          ciclo normal
                                     └→ OBSERVADO(3) → ENVIADO(1)    corrección (nueva versión)
                                            └→ APROBADO(4)           excepción manual del mandante
                  APROBADO(4) → ENVIADO(1)                           renovación por vencimiento

EstadoServicio:   ACTIVO ⇄ SUSPENDIDO → TERMINADO (final)
```

Las transiciones se validan en dominio con `validar_transicion()` — nunca en routers.

---

## 4. Capas y responsabilidades (Clean Architecture / SRP)

Las capas solo se comunican hacia abajo. El dominio no importa infraestructura.

| Módulo | Responsabilidad única | No hace |
|---|---|---|
| `api/*.py` (routers) | HTTP: validar request, autorizar rol/tenant, delegar, mapear excepciones de dominio a códigos HTTP | Lógica de negocio, storage, SQL complejo |
| `domain/estados.py` | Enums y máquina de estados | — |
| `domain/servicio_service.py` | Ciclo de vida de servicios/perfiles, asignación de trabajadores. Valida coherencia perfil↔mandante y trabajador↔empresa | HTTP, storage |
| `domain/documento_service.py` | Orquestación de entregas y transiciones de estado | Decisiones de aprobación (eso es reglas_service), boto3/disco |
| `domain/reglas_service.py` | **Todas** las reglas deterministas. El LLM extrae, este módulo decide | Persistir |
| `domain/acreditacion_service.py` | Cumplimiento derivado por servicio/pilar/trabajador | Almacenar cumplimiento |
| `domain/archivo_service.py` (Fase 3) | Validación de archivos contra config del requisito, hash SHA-256, construcción de storage key, subida/descarga | Decidir estados |
| `infrastructure/storage.py` | Bytes ↔ storage (`subir`, `descargar`, `obtener_url_firmada`, `eliminar`). Local en dev, Hetzner S3 en prod | Conocer el dominio |
| `tasks/procesar_documento.py` | Worker Celery del pipeline IA | Reglas de negocio |

---

## 5. Taxonomía de storage (Fase 3)

```
Alcance ENTIDAD:  {mandante_id}/{empresa_id}/entidad/{empresa|trabajador}/{entidad_id}/{codigo_requisito}/v{n}/{uuid}.{ext}
Alcance SERVICIO: {mandante_id}/{empresa_id}/servicio/{servicio_id}/{empresa|trabajador}/{entidad_id}/{codigo_requisito}/v{n}/{uuid}.{ext}
```

Principios:
- La BD guarda **solo la key** — nunca URLs firmadas ni absolutas. URLs firmadas on-demand.
- El storage es **inmutable**: re-subir crea `v{n+1}`; nunca sobrescribir ni borrar
  (evidencia de auditoría). Solo soft-delete en BD; borrado físico solo por política
  de retención explícita.
- Orden de escritura: **storage primero, commit BD después** (un archivo huérfano
  en el bucket es barato; una fila apuntando a un archivo inexistente es un bug visible).
- `hash_sha256` por archivo: integridad, detección de re-subida idéntica, dedupe futura.

---

## 6. API

Prefijo `/api/v1/` siempre. Endpoints de la capa Servicio (Fase 1):

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET/POST | `/mandantes/{id}/perfiles` | mandante_admin, berisa_admin | Perfiles del mandante |
| POST | `/mandantes/{id}/perfiles/{pid}/requisitos` | mandante_admin, berisa_admin | Upsert de config de requisito en el perfil |
| POST | `/servicios/` | mandante_admin, berisa_admin | Crear servicio (valida relación y perfil) |
| GET | `/servicios/` | todos | Filtrado por tenant del JWT |
| GET | `/servicios/{id}` | todos | Con validación de tenant |
| PATCH | `/servicios/{id}/estado` | mandante_admin, berisa_admin | ACTIVO/SUSPENDIDO/TERMINADO |
| GET/POST | `/servicios/{id}/trabajadores` | POST: contratista_admin | Asignación de dotación a la faena |
| DELETE | `/servicios/{id}/trabajadores/{tid}` | contratista_admin | Desasignación soft |
| GET | `/servicios/{id}/avance` | todos (con tenant) | Completitud del servicio: % de avance, documentos por estado y pilar, brechas exactas, dotación al día. **Derivado, nunca almacenado** (`acreditacion_service.obtener_avance_servicio`) |

El listado `GET /servicios/` retorna items enriquecidos (razón social y RUT del
contratista, nombre del perfil, dotación activa) para evitar N+1 desde el frontend.

Endpoints del expediente (Fase 3):

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/documentos/` | contratista | Entrega multipart: 1..N `archivos` + `servicio_id` si el requisito es alcance SERVICIO. Crea versión N+1. |
| GET | `/documentos/pendientes-revision` | mandante | Cola de revisión manual (estado Enviado) con contexto y archivos |
| POST | `/documentos/{id}/revisar` | mandante_admin | Aprobar (fecha vigencia opcional) u observar (motivo obligatorio) |
| POST | `/documentos/{id}/aprobar-excepcion` | mandante_admin | Excepción sobre un documento observado |
| GET | `/documentos/{id}/historial` | todos | Versiones + bitácora de eventos |
| GET | `/documentos/{id}/archivos/{aid}/url-descarga` | todos | URL firmada por archivo |

### Frontend — mapa completo (rediseñado contra el modelo de dominio)

Reglas del frontend: consume la evaluación derivada del backend (nunca duplica
lógica de negocio), habla el idioma del dominio (perfil, servicio, expediente),
y **ningún control visible existe sin persistir** — los botones falsos y los
datos mock fueron eliminados.

| Ruta | Portal | Qué hace |
|---|---|---|
| `/mandante` | Mandante | Dashboard: KPIs, pilares (evaluación por perfiles), alertas, actividad |
| `/mandante/revision` | Mandante | Cola de revisión manual: aprobar (con vigencia) / observar (con motivo) |
| `/mandante/contratistas` | Mandante | Tabla con columnas de pilares derivadas de datos, invitación de contratistas (dialog real), panel con pestañas Estado/Documentos/Trabajadores/Servicios y **excepción justificada por documento observado** |
| `/mandante/servicios` | Mandante | Crear servicio (contratista + perfil), estados, panel de avance |
| `/mandante/requisitos` | Mandante | **Perfiles de exigencias**: selector + crear perfil + activar/parametrizar requisitos con guardado real; indicador de alcance por requisito |
| `/mandante/reportes` | Mandante | KPIs reales + evolución mensual calculada desde `documento_eventos` (exportación PDF marcada "próximamente" — no simulada) |
| `/mandante/configuracion` | Mandante | Datos de organización con `PATCH /mandantes/{id}` real; secciones sin backend marcadas "en desarrollo" |
| `/contratista` | Contratista | Mi Acreditación (incluye estado PENDIENTE sin servicios activos) |
| `/contratista/servicios` | Contratista | Faenas con avance + gestión de dotación |
| `/contratista/documentos` | Contratista | **Solo lo exigido por sus servicios activos** (endpoint `exigencias`), items separados por servicio, subida multi-archivo con servicio pre-seleccionado, historial de versiones |
| `/contratista/trabajadores` | Contratista | Roster + chips de servicios asignados por trabajador |
| `/admin/catalogo` | BERISA | Catálogo global con escritura real: crear/editar/eliminar requisitos con `alcance` y `max_archivos`; eliminación bloqueada (409) si perfiles o expedientes lo referencian |

Endpoints clave agregados en el rediseño:
- `GET /acreditacion/{cid}/mandante/{mid}/exigencias` — items de `evaluar_relacion` para la página de documentos del contratista.
- `POST /mandantes/{id}/invitar-contratista` ahora permite `mandante_admin` (sobre su propio mandante).
- `PATCH /mandantes/{id}` — datos de organización.
- `POST/PATCH/DELETE /pilares/...` — escritura del catálogo (solo berisa_admin).
- Eliminados: `GET /documentos/.../agrupados` (iteraba todo el catálogo) y `POST /mandantes/{id}/requisitos` (duplicaba al de perfiles).

Simplificación consciente: el portal del contratista asume UN mandante por
sesión (resuelto en el JWT). El modelo de datos soporta multi-mandante; cuando
exista el caso real se agrega un selector — está aislado en `getSession()`.

Componentes compartidos: `entities/servicio/*` (tipos + panel de avance),
`entities/documento/historial-dialog.tsx`, `features/*` (dialogs de subida,
invitación, crear servicio/perfil).

---

## 7. Roadmap de fases

- [x] **Fase 1 — Capa Servicio** (migración `c3d4e5f6a7b8`):
  enums de dominio, `storage.descargar()` (corrige bug del pipeline que trataba
  la URL firmada como bytes), 4 tablas nuevas con backfill (perfil "General" por
  mandante, servicio "General" por relación, trabajadores asignados),
  `alcance`/`max_archivos`/`formatos_permitidos` en el catálogo,
  `servicio_service` + router, seed actualizado.
- [x] **Fase 2 — Frontend servicios + avance**: endpoint derivado
  `GET /servicios/{id}/avance`, página de servicios del mandante (crear,
  cambiar estado, panel de avance con brechas por documento y dotación),
  página de servicios del contratista (avance + gestión de dotación).
- [x] **Fase 3 — Expediente documental + revisión manual** (migración `d4e5f6a7b8c9`):
  `documento_versiones`, `archivos_documento` (N archivos por entrega),
  `documento_eventos` (bitácora append-only), `servicio_id` + constraints únicos
  parciales + CHECK XOR en `documentos`, `archivo_service` (validación data-driven,
  hash SHA-256, taxonomía de keys), task Celery por versión, endpoints de subida
  multi-archivo / revisión / historial / descarga por archivo, página
  `/mandante/revision`, subida real desde `/contratista/documentos`
  (multi-archivo + selector de servicio), y eliminación de todos los datos mock
  del frontend. El pipeline IA queda pospuesto tras el flag `IA_HABILITADA`.
- [x] **Fase 4 — Evaluación unificada en perfiles/servicios** (migración `e5f6a7b8c9d0`):
  `config_mas_estricta()` + `configs_para_requisito()` en reglas_service (la
  validación usa la config MÁS ESTRICTA entre los servicios activos del
  contratista); `evaluar_relacion()` en acreditacion_service como única fuente
  de evaluación — la usan el endpoint de acreditación, `recalcular_estado_global`
  (que ahora también corre tras revisión manual y excepción, y retorna PENDIENTE
  sin servicios activos), el dashboard del mandante, contratistas-detalle y
  reportes; `GET/POST /mandantes/{id}/requisitos` lee/escribe el perfil
  ("General" por defecto, `perfil_id` opcional); la cola de revisión incluye
  documentos En Análisis atascados; historial de versiones y bitácora visible
  en la UI del contratista; **eliminada `MandanteRequisitoConfig`** (tabla,
  modelo y seed).

### Constraints previstos para Fase 3 (referencia)

- `documentos`: CHECK `(empresa_id IS NULL) != (trabajador_id IS NULL)`;
  4 índices únicos parciales (`WHERE eliminado_en IS NULL`):
  requisito×servicio×empresa, requisito×servicio×trabajador,
  requisito×mandante×empresa (servicio NULL), requisito×mandante×trabajador (servicio NULL).
- `documento_versiones`: UNIQUE (documento_id, numero_version); inmutables.
- `archivos_documento`: UNIQUE storage_key; UNIQUE (version, orden).
- `documento_eventos`: append-only — nunca UPDATE ni DELETE.
