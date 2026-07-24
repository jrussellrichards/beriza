# Runbook de deploy — Fase 1 (modelo Expediente/Acreditación)

> Checklist para mergear y desplegar Fase 1 con seguridad. El cambio reescribe
> el modelo de documentos; sin datos de producción reales (solo demo), pero la
> migración dropea tablas, así que conviene seguir estos pasos.

## Antes de mergear

1. **CI verde en el PR de Fase 1.** El job `backend-test` corre contra Postgres
   real: `alembic upgrade head` + `seed.py` (×2) + smoke tests. Es la primera
   vez que las migraciones se aplican en Postgres — **no mergear con ese job en
   rojo**. Si falla, casi seguro es algo específico de Postgres que SQLite
   toleró (revisar el log del step de Alembic).
2. **Orden de merge:** primero Fase 0 (`fase-0-prerequisitos`), luego Fase 1
   (`fase-1-nucleo`). Fase 1 está apilada sobre Fase 0.
3. Confirmar que el secret `ENV` de producción no necesita variables nuevas
   (Fase 1 no agrega ninguna).

## Secuencia de deploy

El deploy es automático al mergear a `main` (CI → SSH a Hetzner). El script ya
corre, en orden:

```
docker compose -f docker-compose.prod.yml up --build -d
alembic upgrade head      # aplica: crea expedientes/entregas/archivos/acreditaciones + dropea las 4 viejas
python scripts/seed.py    # recrea datos demo en el modelo nuevo (idempotente)
```

La migración `b8c9d0e1f2a3` **dropea** `documentos / documento_versiones /
archivos_documento / documento_eventos`. Es seguro: solo contienen datos demo.

## Verificación post-deploy (humo manual)

Con las credenciales demo (`admin@berisa.cl`, `mandante@demo.cl`,
`contratista@demo.cl`, todas `demo123`/`admin123`):

- [ ] **Login** funciona para los 3 roles.
- [ ] **Contratista → Documentos**: se ven los requisitos exigidos con su estado;
      subir un PDF a un requisito FALTA lo pasa a "En revisión".
- [ ] **Mandante → Revisión**: aparece la entrega recién subida; aprobar u
      observar cambia el estado.
- [ ] **Contratista → Documentos**: el documento refleja el nuevo estado; el
      **historial** muestra versiones + bitácora; descargar un archivo abre una
      URL firmada.
- [ ] **Descarga cross-tenant bloqueada** (Fase 0): con el token de un
      contratista, pedir `/api/v1/documentos/{id_ajeno}` devuelve 403/404.
- [ ] **Dashboards**: admin `/stats` y mandante reportes/actividad muestran
      números coherentes (no vacíos si hay datos demo).

## Rollback

Si algo sale mal tras el deploy:

1. **Revertir el merge** en `main` (`git revert -m 1 <merge_commit>` y push) →
   el siguiente deploy vuelve al código anterior.
2. **Migración**: `alembic downgrade a7b8c9d0e1f2` recrea las tablas viejas y
   dropea las nuevas; `alembic downgrade f6a7b8c9d0e1` deja el esquema
   pre-Fase-1 por completo. (Sin datos reales que restaurar; el seed repuebla.)
3. Como los datos son demo, un rollback + re-seed deja el sistema consistente.

## Notas de la auto-revisión (no bloqueantes)

- **Historial y versiones compartidas:** el historial de una acreditación
  muestra todas las entregas del expediente (subidas del contratista). Los
  *eventos de revisión* sí están aislados por mandante; las *versiones* (subidas)
  son del contratista y se comparten — es correcto, pero si se quisiera ocultar a
  un mandante las versiones posteriores a la que fijó, sería un ajuste de Fase 2.
- **N+1 en dashboards:** las queries de actividad/reportes acceden a
  `acred.expediente.requisito` sin `joinedload` (lazy). Correcto pero con N+1;
  optimizable si el volumen crece.
- **Pipeline IA:** `procesar_documento` + la tarea Celery se migraron al modelo
  nuevo pero están **dormidos** (IA deshabilitada, `IA_HABILITADA=False`); no se
  ejercitaron end-to-end. Revisar al activar la IA.
