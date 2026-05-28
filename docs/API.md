# API Berisa Platform v3

Base URL local: `/api`

Autenticación: `Authorization: Bearer <jwt>`

Contexto tenant: `X-Berisa-Tenant-ID: <tenant_uuid>`

## Auth
- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/verify-email`
- `GET /auth/me`

## Proyectos
- `GET /projects`
- `GET /projects/facets`
- `GET /projects/summary`
- `GET /projects/:id`

## Pipeline
- `GET /pipeline/summary`
- `GET /pipeline/opportunities`
- `POST /pipeline/opportunities`
- `PATCH /pipeline/opportunities/:id`

## Ingestión y trazabilidad
- `GET /ingestion/sources`
- `GET /ingestion/runs`
- `POST /ingestion/run`
- `POST /ingestion/run-due`
- `GET /ingestion/lineage/project/:id`

## BOM
- `GET /bom/assumptions`
- `POST /bom/assumptions`
- `POST /bom/projects/:id/estimate`
- `GET /bom/projects/:id/estimates`

## Alertas
- `GET /alerts/rules`
- `POST /alerts/rules`
- `PATCH /alerts/rules/:id`
- `POST /alerts/evaluate`
- `GET /alerts/events`
- `PATCH /alerts/events/:id/read`

## Privacidad
- `GET /privacy/policy`
- `POST /privacy/requests`
- `GET /privacy/requests`
- `PATCH /privacy/requests/:id`
- `POST /privacy/contact-hash`

## ROI
- `GET /roi/summary`
- `GET /roi/events`
- `POST /roi/events`
- `POST /roi/targets`

## Administración
- `GET /admin/users`
- `PATCH /admin/users/:id/approve`
- `PATCH /admin/users/:id/block`
- `GET /admin/tenants`
- `POST /admin/tenants`
