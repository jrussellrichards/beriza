# Gobierno de datos — Berisa Platform v3

## Principios

1. Trazabilidad: cada registro debe poder asociarse a una fuente, licencia, hash y vigencia.
2. Minimización: los contactos se exponen solo a roles y planes autorizados.
3. Validación: la información debe revisarse antes de decisiones comerciales relevantes.
4. Derecho de titulares: la plataforma permite registrar, resolver y auditar solicitudes de acceso, rectificación, eliminación u oposición.
5. Separación por cliente: pipeline, alertas y ROI se aíslan por tenant.

## Tablas críticas

- `ingestion_sources`: fuente, tipo, licencia, términos, uso permitido, frecuencia y retención.
- `source_records`: payload original, hash, vigencia, licencia y calidad.
- `project_sources`: vínculo entre proyecto y fuente.
- `data_subject_requests`: solicitudes de titulares.
- `redacted_contact_hashes`: redacción lógica por hash.
- `privacy_audit_events`: auditoría específica de privacidad.

## Controles aplicados

- Contactos visibles solo para `admin` o `commercial` y tenants con `contact_visibility=true`.
- Solicitudes de titulares disponibles vía `/api/privacy/requests`.
- Redacción lógica por hash de contacto.
- Lineage por proyecto disponible en `/api/ingestion/lineage/project/:id`.

## Requisitos antes de producción

- Revisión legal de fuentes y licencias.
- Política de privacidad pública.
- Procedimiento operacional para solicitudes de titulares.
- Acuerdos de tratamiento de datos con clientes enterprise.
- Definición de retención y eliminación por jurisdicción.
