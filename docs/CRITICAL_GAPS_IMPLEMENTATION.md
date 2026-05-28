# Berisa Platform v3 — Implementación de 7 brechas críticas

Fecha: 2026-04-30

Este documento resume las mejoras incorporadas para alinear Berisa Platform con el plan comercial: anticipación de proyectos, datos cruzados, alertas, BOM, SaaS multi-tenant, privacidad y ROI medible.

## Resumen ejecutivo

La versión v3 transforma la base MVP en una plataforma con arquitectura más cercana a SaaS B2B. Se agregaron capacidades de backend, base de datos, worker, frontend y documentación para cubrir las 7 brechas críticas detectadas.

> Nota de alcance: la versión incorpora los mecanismos técnicos y la estructura de datos. No reemplaza validación legal de fuentes, auditoría de ciberseguridad, calibración técnica del BOM ni pruebas productivas con clientes reales.

## Brechas críticas abordadas

| ID | Brecha crítica | Estado v3 | Implementación |
|---|---|---|---|
| 01 | Ingestión recurrente multi-fuente | Implementada como framework operativo | Tablas `ingestion_sources`, `ingestion_runs`, `source_records`, `project_sources`; servicio `services/ingestion.js`; rutas `/api/ingestion/*`; worker en Docker Compose. |
| 02 | Fuente, licencia y vigencia por dato | Implementada | Cada fuente registra tipo, licencia, estado legal, uso permitido, vigencia, hash de registro y calidad del dato. |
| 06 | Estimación automática BOM | Implementada como motor preliminar trazable | Tablas `bom_assumptions` y `project_bom_estimates`; servicio de cálculo; rutas `/api/bom/*`; supuestos versionables por sector. |
| 12 | Alertas geolocalizadas y por sector | Implementada | Tablas `alert_rules` y `alert_events`; evaluación por sector, país, región, score, inversión, ventana y radio geográfico. |
| 14 | Multi-tenant SaaS | Implementada a nivel base | Tablas `tenants`, `tenant_memberships`, `tenant_limits`; header `X-Berisa-Tenant-ID`; pipeline, ROI y alertas aislados por tenant. |
| 21 | Gobierno de datos personales | Implementada como control base | Solicitudes de titulares, hashes de contacto, redacción lógica, auditoría de privacidad y política API. |
| 29 | Métricas ROI del cliente | Implementada | Eventos ROI, targets comerciales, pipeline ponderado, valor creado, costo mensual y ROI porcentual por tenant. |

## Nuevos endpoints principales

### Ingestión y trazabilidad
- `GET /api/ingestion/sources`
- `GET /api/ingestion/runs`
- `POST /api/ingestion/run`
- `POST /api/ingestion/run-due`
- `GET /api/ingestion/lineage/project/:id`

### BOM
- `GET /api/bom/assumptions`
- `POST /api/bom/assumptions`
- `POST /api/bom/projects/:id/estimate`
- `GET /api/bom/projects/:id/estimates`

### Alertas
- `GET /api/alerts/rules`
- `POST /api/alerts/rules`
- `PATCH /api/alerts/rules/:id`
- `POST /api/alerts/evaluate`
- `GET /api/alerts/events`
- `PATCH /api/alerts/events/:id/read`

### Multi-tenant y administración
- `GET /api/admin/tenants`
- `POST /api/admin/tenants`
- `PATCH /api/admin/users/:id/approve` con asignación a tenant

### Privacidad
- `GET /api/privacy/policy`
- `POST /api/privacy/requests`
- `GET /api/privacy/requests`
- `PATCH /api/privacy/requests/:id`
- `POST /api/privacy/contact-hash`

### ROI
- `GET /api/roi/summary`
- `GET /api/roi/events`
- `POST /api/roi/events`
- `POST /api/roi/targets`

## Cambios de base de datos

Se agregó la migración `002_critical_capabilities.sql`, que incluye tablas para:

- Tenants, membresías y límites por plan.
- Fuentes, ejecuciones de ingesta, registros fuente y lineage de proyecto.
- Supuestos BOM y estimaciones por proyecto.
- Reglas y eventos de alertas.
- Solicitudes de datos personales, hashes redactados y auditoría de privacidad.
- Targets comerciales y eventos ROI.

## Worker

Docker Compose incorpora un servicio `worker` que ejecuta periódicamente:

1. Fuentes de ingestión vencidas.
2. Evaluación de alertas por tenant.

Variable relevante:

```bash
WORKER_INTERVAL_MINUTES=30
```

## Frontend

Se agregaron vistas funcionales para:

- Plan comercial: indicadores de ROI, fuentes, licencias, BOM y alertas.
- Alertas: creación de reglas y lectura de eventos.
- Privacidad: gestión administrativa de solicitudes.
- Dashboard: botón para estimar BOM por proyecto.
- Header: selector de tenant.

## Pendientes antes de producción

1. Validación legal de cada fuente externa y contrato de uso cuando aplique.
2. Calibración de supuestos BOM con históricos reales y revisión técnica.
3. Pruebas de carga, seguridad, pentest y hardening de infraestructura.
4. Integración real con pasarela de pagos si se activa billing automático.
5. Mecanismos de notificación email/webhook para alertas fuera de la aplicación.
6. Observabilidad productiva: métricas, trazas, alertas técnicas y backups probados.
