# Auditoría de implementación — 7 brechas críticas Berisa

| Brecha | Evidencia incorporada | Nivel de cierre | Riesgo residual |
|---|---|---|---|
| Ingestión recurrente multi-fuente | `services/ingestion.js`, `routes/ingestion.js`, worker Docker, tablas de fuentes y runs | Alto para framework MVP | Falta conectar APIs externas reales y validar términos de uso. |
| Fuente/licencia/vigencia por dato | `ingestion_sources`, `source_records`, `project_sources`, endpoint lineage | Alto | Requiere revisión legal y documental de cada fuente. |
| BOM automático | `services/bom.js`, `bom_assumptions`, `project_bom_estimates`, UI de estimación | Medio-alto | Supuestos son preliminares; no sirven como presupuesto contractual. |
| Alertas geolocalizadas/sector | `services/alerts.js`, `alert_rules`, `alert_events`, UI alertas | Alto para in-app | Falta email/webhook productivo. |
| Multi-tenant SaaS | `tenants`, `tenant_memberships`, `tenant_limits`, header tenant, pipeline/ROI/alertas por tenant | Alto para MVP | Falta billing y pruebas de aislamiento exhaustivas. |
| Gobierno de datos personales | `data_subject_requests`, `redacted_contact_hashes`, `privacy_audit_events`, rutas privacy | Medio-alto | Requiere política legal final y procedimientos operacionales. |
| ROI cliente | `roi_events`, `commercial_targets`, `/api/roi/summary`, dashboard plan comercial | Alto para medición base | Falta integración con CRM/ERP para captura automática de ventas reales. |

## Resultado

La versión v3 cubre técnicamente las 7 brechas críticas identificadas y deja la plataforma preparada para una etapa de piloto comercial más robusta. No obstante, la liberación productiva debe quedar condicionada a validación legal, calibración técnica, pruebas de seguridad y pruebas con usuarios reales.
