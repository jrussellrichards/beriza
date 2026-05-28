# Berisa Platform v3 — Remediación de hallazgos críticos y altos

## Alcance

Esta versión aborda los hallazgos de severidad crítica y alta levantados sobre V2, con foco en seguridad, aislamiento SaaS, datos personales, ingestión, deduplicación, alertas externas, BOM, API enterprise y pruebas/CI.

## Cambios implementados

| Hallazgo | Estado V3 | Evidencia técnica |
|---|---|---|
| F-01 Secretos y credenciales demo | Resuelto | `docker-compose.yml` exige variables por `.env`; `backend/scripts/create-env.js` genera secretos fuertes; el frontend no precarga credenciales. |
| F-02 Multi-tenant / RBAC | Resuelto parcialmente para MVP avanzado | Nuevos roles `platform_admin` y `tenant_admin`; rutas admin y privacidad filtradas por tenant salvo plataforma. |
| F-03 Datos personales | Resuelto parcialmente para MVP avanzado | Contactos removidos del dataset seed; `contact_records` normaliza PII cifrada; `projects.contacts` y `source_records.payload` quedan minimizados. |
| F-04 Ingestión productiva | Mejorado | Conectores `file_json` y `http_json` con licencia, backoff, retries, fallas consecutivas y monitoreo básico. Requiere contratos/API reales por fuente antes de producción. |
| F-05 Deduplicación | Mejorado | Servicio `entityResolution` y tabla `canonical_project_links` con reglas determinísticas y fuzzy matching. |
| F-06 Alertas externas | Mejorado | `alert_delivery_events`, delivery por webhook firmado y email vía proveedor HTTP configurable. |
| F-07 BOM comercial | Mejorado | BOM `v2-feature-assisted-rule-based`, variables extraídas de descripción y disclaimer explícito de uso preliminar. |
| F-08 API enterprise | Mejorado | API keys por tenant, scopes, cuotas base por plan y endpoints `/api/v1/projects`. |
| F-09 CI/CD y pruebas | Mejorado | CI con migración, seed, chequeo estático, sintaxis backend y build frontend. |
| F-10 Seguridad frontend | Resuelto parcialmente para MVP avanzado | JWT pasa a cookie HttpOnly/SameSite; CSP activa en backend y Nginx; token storage en navegador eliminado. |

## Riesgos residuales

- No se ejecutó un pentest ni auditoría legal formal.
- Los conectores externos requieren revisión contractual y credenciales reales de cada fuente.
- El BOM sigue siendo preliminar y requiere calibración con históricos reales por tipología.
- El aislamiento multi-tenant debe validarse con pruebas e2e antes de clientes externos.
- La API enterprise requiere rate limiting por API key y portal de autoservicio para producción.

## Validaciones realizadas

- Revisión estática de archivos.
- Chequeo de sintaxis backend con `node --check` sobre rutas, servicios, scripts y middleware.
- Auditoría textual de referencias sensibles: sin hallazgos en el paquete V3.
- Eliminación de archivos de auditoría internos que contenían términos sensibles con conteo cero.

