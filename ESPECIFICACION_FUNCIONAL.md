# Berisa Compliance 360 — Especificación funcional resumida

## Propósito
Plataforma SaaS para acreditar, controlar y auditar proveedores, contratistas y subcontratistas, permitiendo carga documental autogestionada, validación automática, cálculo de riesgo, trazabilidad y liberación, retención o bloqueo de estados de pago según reglas normativas y contractuales.

## Roles
- Mandante: controla proveedores, documentos, contratos, riesgos y pagos.
- Proveedor: carga y mantiene documentación vigente.
- Auditor: revisa evidencia, versiones, hallazgos y decisiones.
- Administrador Berisa: configura mandantes, reglas, catálogos y seguridad.

## Submódulos
1. Registro y clasificación de proveedores.
2. Matriz documental inteligente.
3. Portal autogestionado del proveedor.
4. Motor de validación documental.
5. Motor de cumplimiento y riesgo.
6. Motor de estados de pago.
7. Auditoría y trazabilidad.
8. Administración SaaS.

## Motor de pago
Un estado de pago puede ser:
- Liberado automático.
- Liberado condicionado.
- Retenido parcial.
- Bloqueado.
- En revisión.
- Rechazado.

Reglas críticas incluidas en el prototipo:
- F30-1 faltante, vencido u observado bloquea pago cuando aplica.
- Documento crítico vencido u observado bloquea pago.
- Hallazgo crítico abierto bloquea pago.
- Observación no crítica genera condición, no bloqueo.

## Siguiente desarrollo recomendado
- Backend API.
- PostgreSQL.
- Autenticación OAuth2/OIDC + MFA.
- Almacenamiento documental cifrado.
- Motor de reglas persistente.
- Auditoría append-only.
- Integración ERP / finanzas.
