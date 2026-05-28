# Changelog — Berisa Platform v3

## 2.0.0 — Critical Commercial Capabilities

### Agregado
- Arquitectura multi-tenant: tenants, membresías, límites por plan y selector de tenant.
- Ingestión recurrente multi-fuente con trazabilidad, hashes, vigencia y licencia por fuente.
- Worker de ingestión y evaluación de alertas.
- Motor BOM preliminar basado en supuestos por sector e inversión.
- Alertas comerciales por sector, región, ventana, score, inversión y radio geográfico.
- Gobierno de datos personales: solicitudes, redacción lógica y auditoría de privacidad.
- Métricas ROI: valor creado, costo, pipeline ponderado, targets y eventos comerciales.
- Vista frontend “Plan comercial” para controlar capacidades críticas.
- Endpoints API nuevos para ingestión, BOM, alertas, privacidad y ROI.

### Modificado
- Pipeline aislado por tenant.
- Login y sesión enriquecidos con tenants autorizados.
- Usuarios aprobados quedan asociados a tenant.
- Proyectos incluyen lineage por fuente en detalle.
- Contactos se muestran solo para roles autorizados y tenants con visibilidad habilitada.

### No incluido todavía
- Integración real con APIs externas productivas.
- Pasarela de billing.
- Notificación email/webhook real.
- Pentest, auditoría legal y calibración BOM con históricos reales.
