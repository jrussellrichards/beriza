# Seguridad — Berisa Platform v3

## Controles implementados

- JWT con expiración configurable.
- Hash de contraseñas con bcrypt.
- Rate limiting general y específico para login.
- Helmet, CORS controlado y `x-powered-by` deshabilitado.
- Validación de entradas con Zod.
- Consultas parametrizadas PostgreSQL.
- Usuarios validados por estado y email verificado.
- Roles globales y membresía por tenant.
- Aislamiento de pipeline, alertas y ROI por tenant.
- Auditoría de acciones administrativas y comerciales.
- Gobierno de datos personales con auditoría separada.

## Controles nuevos v3

- Header `X-Berisa-Tenant-ID` validado contra membresías del usuario.
- Límites por plan en `tenant_limits`.
- Contactos visibles solo por rol y plan habilitado.
- Worker separado para ingestión y alertas.
- Trazabilidad de fuentes para reducir riesgo de uso no autorizado.

## Pendientes antes de producción

- MFA o WebAuthn para cuentas administrativas.
- Rotación de secretos y secret manager.
- Logs estructurados y SIEM.
- Pentest y revisión OWASP ASVS.
- Backups cifrados y pruebas de restauración.
- CSP estricta para frontend.
- Protección avanzada contra scraping inverso/exportaciones masivas.
