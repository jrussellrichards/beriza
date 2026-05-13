# Berisa Compliance 360

Prototipo funcional del módulo de acreditación, cumplimiento, auditoría y aprobación automática de estados de pago para Berisa.

## Qué incluye

- Vista Mandante: tablero ejecutivo, cumplimiento, riesgo y alertas críticas.
- Vista Proveedor: portal autogestionado, checklist documental, documentos pendientes, observados y vencidos.
- Vista Estados de pago: motor de decisión para liberar, condicionar o bloquear pagos.
- Vista Auditoría: bitácora y trazabilidad.
- Vista Administrador: catálogo documental y reglas base.
- Datos demo de proveedores, documentos, contratos, faenas y estados de pago.

## Instalación

Requisitos: Node.js 18 o superior.

```bash
npm install
npm run dev
```

Luego abrir la URL local indicada por Vite.

## Compilar para producción

```bash
npm run build
npm run preview
```

## Nota

Este entregable es un prototipo frontend funcional. Para uso productivo se debe desarrollar backend, base de datos, autenticación, almacenamiento seguro de documentos, motor de reglas persistente, logs inalterables e integraciones con ERP u otros sistemas.
