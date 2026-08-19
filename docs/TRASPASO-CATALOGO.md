# Traspaso — catálogo de requisitos de Acredita

Estado al **19 de agosto de 2026**, después de mergear y desplegar los PRs #58, #59 y #60.

Este documento es para quien siga el trabajo. Cubre tres cosas: **qué quedó hecho y verificado**, **qué quedó pendiente y por qué**, y **las trampas del repositorio que hicieron que varios bugs llegaran a producción con CI en verde**.

La comparación completa con los documentos oficiales del cliente está en [`COMPARACION-REQUISITOS-CDM.md`](./COMPARACION-REQUISITOS-CDM.md). Este documento no la repite; asume que se leyó.

---

## 1. Dónde quedó el catálogo

**67 requisitos globales** en producción, verificado consultando la base real:

| Nivel | Cantidad |
|---|---|
| BASE | 17 |
| AMPLIADO | 21 |
| OPCIONAL | 29 |

En la tabla hay 69 filas: los 67 globales (`mandante_id IS NULL`) más 2 propios de un mandante.

Los 23 nuevos salieron del cruce con los dos documentos oficiales de Constructora del Mar. Ninguno se activa solo: entran al catálogo global y cada mandante decide en su perfil cuáles exige.

**El catálogo vive en `backend/scripts/seed.py`**, en la lista `CATALOGO`, no en una migración. El seed es idempotente y **corre en cada despliegue a producción** (`ci.yml`, job `deploy-prod`). Consecuencia directa: un error en `seed.py` no rompe un despliegue, los rompe todos, y no se nota en los tests porque pytest nunca ejecuta el seed. Ya pasó dos veces.

---

## 2. La ambigüedad de AMPLIADO — decisión pendiente

`NivelRequisito` define sus tres niveles así:

```
BASE      →  "obligación legal universal de todo empleador"
OPCIONAL  →  "práctica de mercado; ninguna norma la impone al contratista"
AMPLIADO  →  "exigible sólo bajo un supuesto (dotación, exposición, tipo de obra)"
```

**Dos de los tres están definidos en el eje legal, y el tercero en el eje de condicionalidad.** Son ejes distintos. Un requisito que es *condicional* **y** *no exigido por ninguna norma* cae en los dos a la vez, y el enum no dice cuál gana.

Hoy hay tres requisitos exactamente en ese cruce, marcados `AMPLIADO` mientras su propia descripción dice que no son obligación legal:

| Código | Lo que dice su propia descripción |
|---|---|
| `VIGENCIA_SOCIEDAD` | "Práctica de mercado, no obligación legal" |
| `VIGENCIA_PODERES` | "Ninguna norma lo exige" |
| `POLIZA_TODO_RIESGO_OBRA` | "Exigencia contractual, no legal" |

**Por qué importa y no es cosmético.** El nivel es lo que la app le *afirma* al mandante sobre la ley chilena. `AMPLIADO` se lee como "la ley lo exige cuando aplica el supuesto", y para esos tres eso es falso. Del otro lado hay un contratista al que se le exige un documento: la diferencia entre "la ley te obliga" y "el mercado lo espera" es la diferencia entre una exigencia fundada y una inventada. Y si algún día se filtra por "solo lo que la ley exige" (BASE + AMPLIADO), esos tres se cuelan.

**Las dos salidas, y lo que cuesta cada una:**

1. **AMPLIADO significa "condicional y legal".** Entonces esos tres bajan a `OPCIONAL` y el enum queda con un eje único y coherente. Cuesta: se pierde la distinción entre "práctica que aplica siempre" y "práctica que aplica solo a veces" — `POLIZA_TODO_RIESGO_OBRA` no tiene sentido para un servicio de aseo, y como `OPCIONAL` deja de decirlo.
2. **Separar los dos ejes en dos campos** — `nivel` (legal / no legal) y `condicional` (booleano, con el supuesto en texto). Es lo correcto de fondo y cuesta una migración más el frontend que hoy muestra el nivel.

**Recomendación:** la (1) ahora, porque es un cambio de datos en `seed.py` sin migración y arregla la afirmación falsa, que es lo urgente. La (2) cuando se toque el modelo de requisitos por otra razón. **La decisión es de producto, no técnica** — preguntar a Javier antes de moverlo.

El test `tests/test_catalogo.py` sólo exige norma citada a los `BASE` por esta razón; el comentario en el código lo explica.

---

## 3. Lo que quedó pendiente

### 3.1 Cuatro requisitos propios de Constructora del Mar

No van al catálogo global — son de ese cliente. Se crean con `mandante_id` distinto de NULL.

| Código | Documento | Estado |
|---|---|---|
| `RESENA_EMPRESA` | Reseña de la empresa | Listo para crear |
| `LIBRO_VISITAS_APR` | Libro de control de visitas del asesor en prevención | Listo para crear |
| `PPA_MUTUALIDAD` | Programas Personalizados de Actividades de la mutualidad | Listo para crear |
| `CARTA_CONDUCTORA` | "Copia de cartas de conductora acreditado ante SEREMI de Salud e Inspección del Trabajo" | **BLOQUEADO** |

`CARTA_CONDUCTORA` está bloqueado a propósito: **no se identificó ninguna norma chilena que lo respalde**, y el nombre no permite deducir qué documento es. Hay que preguntarle al cliente qué entiende por eso antes de modelarlo. Darlo de alta adivinando significaría exigirle a un contratista un documento que nadie sabe qué es.

### 3.2 Seis requisitos de vehículo — bloqueados por el modelo

`PERMISO_CIRCULACION`, `REVISION_TECNICA`, `SOAP`, `PERMISO_TRANSPORTE_PERSONAL`, `MANTENCION_VEHICULO`, `CHECKLIST_VEHICULO`.

`EntidadTipo` sólo tiene `EMPRESA` y `TRABAJADOR`. **No existe entidad `Vehiculo`** en `backend/app/models/`. Un permiso de circulación no es de la empresa (¿de cuál de sus diez camionetas?) ni del trabajador. Colgarlos de `EMPRESA` haría que un contratista con diez vehículos suba un solo permiso y figure cumpliendo.

Requiere: modelo `Vehiculo`, migración, `EntidadTipo.VEHICULO`, asignación de vehículos a un servicio, y que `acreditacion_service` evalúe esa tercera dimensión. No es un requisito más, es una entidad nueva de punta a punta.

`CHECKLIST_VEHICULO` tiene además un problema propio: es diario, y el modelo expresa periodicidad en `vigencia_max_dias`. "Vigencia de 1 día" no significa "se entrega cada día"; hoy no hay forma de decir eso. El campo `momento` (PR #58) resuelve *cuándo empieza a exigirse*, no *cada cuánto se repite*.

### 3.3 Deuda conocida y sin tocar

Ninguna es urgente, todas están verificadas:

- **`_validar_f30`** comprueba `estado_tributario`, que pertenece a `SII_SITUACION_TRIBUTARIA`, no al F30.
- **Sin `CHECK` XOR en `usuarios`**: nada impide una fila con `mandante_id` y `contratista_id` a la vez.
- **Borrar un centro de trabajo** deja `servicios.centro_trabajo_id` en NULL en silencio.
- **Resend sigue en `onboarding@resend.dev`** — sin dominio verificado.
- **El pipeline de IA es un stub**: `app/ia/extractor.py` tiene el cuerpo en `...`. Toda la ruta está detrás de `IA_HABILITADA and VISION_LLM_API_KEY`.
- **Guardar un perfil dispara N POSTs secuenciales**, uno por requisito. No hay endpoint batch.
- **Cambiar de perfil descarta los cambios sin guardar** sin avisar.
- **`/mandante/*` sin sesión** renderiza el shell del portal en vez de redirigir a login.

---

## 4. Trampas del repositorio

Esta sección es la más importante del documento. Cada punto salió de un bug real que llegó a producción **con CI en verde**.

### 4.1 La suite corre en SQLite; producción es PostgreSQL

**17 de los 20 archivos de test hacen `create_engine("sqlite://")` a mano.** CI levanta un PostgreSQL 16 real, pero hasta ahora sólo lo tocaban `alembic upgrade head` y el seed — ningún test.

SQLite es permisivo donde Postgres es estricto. Eso escondió el bug del PR #60: `SELECT DISTINCT` sobre una tabla con columna `json` funciona en SQLite y en Postgres muere con `could not identify an equality operator for type json`.

`tests/test_validar_documento_motor_real.py` es el primer test que corre sobre **el motor que diga `DATABASE_URL`**: SQLite en local, Postgres en CI (crea un esquema propio y lo borra al terminar). **Cualquier test nuevo que toque SQL no trivial debería seguir ese patrón**, no el de los otros 17.

### 4.2 El despacho de validadores falla ABIERTO

En `reglas_service.validar_documento`:

```python
validar_fn = validadores.get(requisito.codigo)
if validar_fn:
    brechas = validar_fn(campos_extraidos)
else:
    brechas = []      # ← código desconocido ⇒ APROBADO, sin log ni excepción
```

Un código mal escrito no da error: **aprueba el documento**. Así estuvo el examen médico, despachado como `"EXAMEN_MEDICO"` cuando el catálogo lo llama `"EXAM_MED"`: todo examen ocupacional se auto-aprobaba, incluido uno que dijera NO APTO y estuviera vencido.

`tests/test_catalogo.py` ahora verifica que todo código que el código de producción nombre exista de verdad — validadores, `SCHEMAS_POR_REQUISITO` y las plantillas del seed. **Si se agrega otro despacho por string, agregarlo a ese test.** Considerar además cambiar el fallo a cerrado (código desconocido ⇒ observado), pero eso cambia comportamiento y hay que decidirlo con producto.

### 4.3 El seed corre en cada despliegue

`ci.yml` lo ejecuta en `deploy-prod`. Un `ImportError` o un campo inexistente en `seed.py` rompe **todos** los despliegues, y pytest no lo agarra porque nunca ejecuta el seed. Antes de tocar `seed.py`, correrlo dos veces contra una base limpia — es lo que hace CI y es la única prueba de idempotencia que existe.

### 4.4 Revisiones de Alembic duplicadas

Ya ocurrió: dos migraciones con el mismo `revision`, CI cayó con "Multiple head revisions". No se detecta en local porque los tests usan `create_all` y nunca ejecutan Alembic. Verificar el id contra los existentes antes de crear una.

### 4.5 UUIDs entre SQLite y Postgres

SQLite guarda los UUID como hex **sin guiones**. Interpolar un UUID en un `NOT IN (...)` como string produce un conjunto vacío y la consulta borra todo. Ya pasó en un script de limpieza de producción. Usar siempre parámetros tipados de SQLAlchemy Core, nunca interpolación de strings.

### 4.6 Búsqueda sensible a acentos

Buscar "poliza" no encuentra "póliza". Donde haya búsqueda de texto, normalizar con NFD **en los dos lados**.

---

## 5. Cómo verificar de verdad

**Un deploy en verde no es una verificación.** Varios de los bugs de arriba pasaron CI. La verificación es consultar producción.

Hay acceso SSH: llave `~/.ssh/hetzner_deploy`, host `root@94.130.227.168`, proyecto en `/root/acredita`.

Para ejecutar Python contra la base real, el script tiene que quedar **dentro de `/app`** — Python pone en `sys.path` el directorio del script, no el working directory, así que desde `/tmp` falla con `No module named 'app'`:

```bash
docker compose -f docker-compose.prod.yml cp /tmp/v.py backend:/app/_v.py
```

Dos advertencias aprendidas a golpes:

- **Los nombres de campo importan.** Verificando el examen médico se usó `apto`/`resultado` cuando el validador espera `resultado_aptitud`, y eso dio un falso "sin brechas" que casi hace reportar que el arreglo no funcionaba. Contrastar siempre contra el schema de `app/ia/schemas.py`.
- **Antes de borrar algo en producción, imprimir exactamente qué se va a borrar y revisarlo.** Esa verificación previa es la que atrapó el bug de UUIDs del punto 4.5, antes de tocar nada.

### La técnica que sí probó los bugs

Para el PR #60 se subió **el test solo, sin el arreglo**, y se dejó que CI se pusiera rojo contra su Postgres:

```
motor bajo prueba: postgres
E   could not identify an equality operator for type json
1 failed, 57 passed
```

Recién después se subió el arreglo: 58 passed. Eso prueba que el test *agarra* el bug, no sólo que pasa. Cuesta un ciclo de CI y vale la pena para cualquier bug que no se pueda reproducir en local.

---

## 6. Los tests que protegen el catálogo

**`backend/tests/test_catalogo.py`** — 7 comprobaciones sobre el catálogo real (los demás tests usan requisitos inventados y por eso no veían nada de esto):

1. sin códigos repetidos
2. todo subpilar referenciado existe
3. `entidad`, `alcance` y `nivel` son valores válidos del dominio
4. todo código despachado en `reglas_service` existe *(encontró el bug del examen médico)*
5. todo código de `SCHEMAS_POR_REQUISITO` existe *(encontró 3 códigos fantasma)*
6. las plantillas del seed sólo nombran requisitos reales
7. todo `BASE` cita su norma

**`backend/tests/test_validar_documento_motor_real.py`** — ejercita `validar_documento` de punta a punta sobre el motor real. Antes de este test, **ninguno llamaba nunca a `validar_documento`**: toda la lógica de decisión de aprobación estaba sin cobertura end-to-end.

**`backend/tests/test_momento_requisito.py`** — el campo `momento` (ARRANQUE / RECURRENTE / TERMINO) del PR #58.

Al 19 de agosto de 2026: **58 tests en verde, 1 skipped.**

---

## 7. Convenciones que conviene no romper

- **Cada `Req(...)` del catálogo lleva su fundamento normativo y una sección `REVISOR:` con qué mirar en el documento.** Los 67 lo tienen. Es lo que hace auditable la exigencia frente a un contratista.
- **`nivel` es un hecho sobre la ley; `es_obligatorio` es lo que exige un mandante.** Mezclarlos obligaría a todos los mandantes al catálogo completo.
- **El LLM extrae, `reglas_service` decide.** Ninguna decisión de aprobación la toma un modelo.
- **El seed no debe crear filas con `es_obligatorio=False`.** Parecen inertes y no lo son: `configs_para_requisito` no filtra por ese campo y `config_mas_estricta` hace `min()` sobre las vigencias, así que una fila apagada con vigencia 30 endurece el perfil de al lado que tenía 90. Ya pasó en producción.
