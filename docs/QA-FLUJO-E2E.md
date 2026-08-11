# Prueba end-to-end del flujo completo — Acredita

Instrucciones para un agente que va a recorrer la aplicación entera como la
recorrería un cliente real, desde una base de datos vacía.

---

## Por qué existe esta prueba

Todo lo que hoy funciona en el entorno de demostración existe porque lo puso un
seed o una migración: los perfiles los creó una migración, el catálogo lo sembró
un script, los cargos los creó alguien probando a mano. **El camino real —BERISA
da de alta un mandante, ese mandante se configura solo, invita a un contratista,
y el contratista llega hasta tener un documento aprobado— nunca se recorrió
completo contra una base limpia.**

Esa es la diferencia que importa. Los tests automatizados pasan y el código está
bien, y aun así el primer cliente real puede aterrizar en una pantalla vacía
porque el flujo de alta no crea algo que la interfaz da por existente. Ese tipo
de defecto no aparece en una suite de tests: sólo aparece caminando.

Tu trabajo no es confirmar que la aplicación funciona. Es **encontrar dónde se
corta el camino**.

---

## Reglas duras

Estas no son sugerencias. Una corrida anterior de agentes causó daño ejecutando
cosas fuera de su alcance.

**Prohibido, sin excepción:**

1. **No tocar producción.** Nada de SSH al servidor, nada contra
   `docker-compose.prod.yml`, nada contra el host de producción. Esta prueba
   corre exclusivamente contra el entorno local de `docker-compose.yml`.
2. **No ejecutar SQL de escritura.** Ni `DELETE`, ni `UPDATE`, ni `INSERT`, ni
   `TRUNCATE`, ni `DROP`. Consultas `SELECT` para verificar estado: sí, todas las
   que quieras. Si crees que necesitas escribir en la base para avanzar, eso **es
   el hallazgo**: significa que la aplicación no ofrece el camino. Anótalo y sigue.
3. **No borrar archivos.** Nada de `rm -rf`, ni sobre `uploads/`, ni sobre el
   repositorio, ni sobre nada.
4. **No modificar el código.** Esta es una prueba de lectura. Si encuentras un
   bug, lo documentas; no lo arreglas. Arreglar mientras pruebas hace imposible
   saber después qué estaba roto.
5. **No hacer commit, push, ni tocar ramas de git.**
6. **No inventar resultados.** Si no ejecutaste un paso, se reporta como
   `NO_EJECUTADO`. Un hallazgo sin reproducción real vale menos que nada, porque
   consume el tiempo de alguien que va a intentar confirmarlo.

**La única excepción sancionada** es el arranque descrito abajo: crear el primer
`berisa_admin`, porque no existe ninguna otra puerta de entrada a una instalación
vacía.

---

## Preparar el entorno

### 1. Base limpia

```bash
docker compose down -v && docker compose up -d
```

`down -v` elimina el volumen de PostgreSQL, que es lo que garantiza empezar de
cero. Espera a que los contenedores estén arriba antes de seguir.

Los archivos ya subidos **no** se borran: `backend/uploads` es un montaje del
disco, no un volumen. Pueden quedar archivos de corridas anteriores sin ninguna
fila que los referencie; es inofensivo y no es un hallazgo.

### 2. Esquema y catálogo global

```bash
docker compose exec -T backend alembic upgrade head
```

```bash
docker compose exec -T -e SEED_DEMO= backend python scripts/seed.py
```

**El `-e SEED_DEMO=` no es opcional.** Los datos de demostración son opt-in vía
esa variable, pero `docker-compose.yml` la define como `true` para el desarrollo
diario. Sin vaciarla, el seed carga "Codelco (Demo)" y "Constructora Demo SpA" y
la prueba nace inválida: estarías recorriendo otra vez el camino de siempre en
vez del camino del cliente real. Vaciada, el seed carga **sólo el catálogo global**
de pilares y requisitos.

Si en la salida ves cualquier mención a Codelco o a Constructora Demo, detente y
repite el reset.

Verifica el punto de partida:

```bash
docker compose exec -T db psql -U acredita -d acredita -c "select (select count(*) from requisitos_documentales) reqs, (select count(*) from mandantes) mandantes, (select count(*) from usuarios) usuarios;"
```

Lo esperado: 44 requisitos, 0 mandantes, 0 usuarios. Si no da eso, no sigas.

### 3. El primer superadmin

```bash
docker compose exec -T backend python -c "
from sqlalchemy.orm import Session
from app.infrastructure.database import engine
from app.models.usuario import Usuario
from app.core.security import hash_password
with Session(engine) as s:
    s.add(Usuario(email='qa@berisa.cl', nombre='QA', rol='berisa_admin',
                  activo=True, password_hash=hash_password('qa-e2e-2026')))
    s.commit()
print('listo')
"
```

Esta es la excepción a la regla 2, y sólo esta. En una instalación real lo hace
`scripts/crear_admin.py`, que pide la clave por terminal interactiva —no
utilizable desde un agente sin TTY—, así que aquí se replica su efecto.

### 4. Direcciones

| Qué | Dónde |
|---|---|
| Frontend | `http://localhost:3001` |
| Backend (API) | `http://localhost:8000` |
| PostgreSQL | `localhost:5434`, usuario y base `acredita` |

### 5. Cómo leer los correos

No hay servidor de correo en local. El cliente de email de desarrollo **imprime
los mensajes en el log del backend**, y ahí viajan los enlaces de invitación y de
recuperación, que vas a necesitar constantemente:

```bash
docker compose logs --tail=80 backend | grep -A 12 "\[EMAIL\]"
```

Para extraer sólo el último enlace de activación:

```bash
docker compose logs backend | grep -o "activar?token=[A-Za-z0-9_-]*" | tail -1
```

Los enlaces del log apuntan a `localhost:3000`; el frontend está en **3001**.
Corrige el puerto al abrirlos en el navegador. *(Que apunten al puerto
equivocado en desarrollo es en sí mismo un hallazgo menor: anótalo.)*

---

## Cómo probar

Recorre el flujo **por la interfaz**, en el navegador, como lo haría una persona.
La API sirve para dos cosas: confirmar que lo que la pantalla dice se guardó de
verdad, y probar las verificaciones negativas del Acto 10. Si la interfaz muestra
una cosa y la base dice otra, eso es un hallazgo de los importantes.

En cada acto, antes de darlo por bueno, pregúntate: **¿un cliente que nunca vio
esta aplicación sabría qué hacer acá?** Una pantalla que funciona pero no dice
qué se espera de ti es un hallazgo de producto, y vale la pena anotarlo aunque
técnicamente nada falle.

---

## Acto 0 — BERISA entra por primera vez

Entra con `qa@berisa.cl` / `qa-e2e-2026`.

- ¿El login lleva al panel de administración?
- El panel de BERISA tiene Inicio, Catálogo, Mandantes y Usuarios. ¿Cargan las
  cuatro sin error, con la base prácticamente vacía?
- En **Catálogo**: ¿están los 44 requisitos, repartidos en 3 pilares y 11
  subpilares? ¿Se ve el nivel de cada uno (BASE / AMPLIADO / OPCIONAL)?
- ¿Se puede agregar un requisito nuevo al catálogo global? Crea uno y comprueba
  que aparece. **Fíjate con qué nivel queda** y si hay forma de elegirlo o
  corregirlo desde la interfaz.

## Acto 1 — BERISA da de alta al primer mandante

Este es el acto más importante de toda la prueba. Es el que nunca se recorrió.

Invita a un mandante (por ejemplo `Minera del Norte SpA`, con un RUT chileno
válido, contacto `mandante.qa@ejemplo.cl`).

- ¿Se creó el mandante y aparece en la lista?
- Saca el enlace de activación del log y ábrelo (recuerda el puerto 3001).
- ¿El formulario de activación pide confirmar razón social y RUT? Debe hacerlo:
  es una invitación de tipo ORGANIZACION.
- Define la contraseña y entra.
- **Aquí está la pregunta central: al entrar por primera vez, ¿el mandante tiene
  con qué trabajar?** Ve a Perfiles. ¿Hay algún perfil creado? ¿La pantalla
  explica qué hacer si no lo hay? ¿Se entiende que sin un perfil no se puede
  crear un servicio?

Documenta con precisión qué ve un mandante recién nacido en cada pantalla del
portal: Inicio, Revisión, Contratistas, Servicios, Centros, Perfiles, Equipo,
Configuración. Una pantalla vacía sin explicación es un hallazgo.

## Acto 2 — El mandante se configura

- Crea un perfil (por ejemplo "Obras civiles").
- Aplica una plantilla (Arranque / Legal completa / Obra física). ¿Cuántos
  requisitos quedan exigidos? ¿El contador de las pestañas Empresa y Personas
  coincide con lo que se ve en la lista?
- Cambia parámetros de un requisito: vigencia máxima, umbral de deuda,
  obligatoriedad. Guarda. **Recarga la página**: ¿se guardó de verdad?
- Prueba el filtro "Mostrar" (Base / Ampliado / Opcional). ¿Filtra la lista sin
  alterar la matriz de cargos?
- En la pestaña **Personas**: pulsa la acción que crea el set sugerido de cargos.
  ¿Aparecen las columnas en la matriz? Marca que un requisito se exija sólo a
  ciertos cargos y verifica que se guarde.
- Crea un **requisito propio** desde el pilar que quieras. ¿Con qué nivel queda?
  ¿Puedes corregirlo desde la interfaz?
- Crea un **centro de trabajo**.
- Crea un **segundo perfil** distinto y comprueba que configurar uno no altera al
  otro.

## Acto 3 — El mandante arma su equipo

- Invita a alguien de su equipo (rol prevencionista). Actívalo desde el enlace del
  log, en otra sesión del navegador o en ventana privada.
- ¿El formulario de activación de un miembro del equipo **no** pide razón social
  ni RUT? No debe pedirlos: no le corresponde editar los datos de la empresa.
- Con ese usuario: ¿ve lo que le toca y no ve lo que no?
- Vuelve como administrador: edita a ese usuario (nombre, rol) y luego
  desactívalo. ¿Deja de poder entrar?
- **Verificación de seguridad importante:** con la cuenta ya desactivada, intenta
  volver a activarla abriendo de nuevo el enlace de activación original. **Debe
  fallar.** Si consigue entrar con una contraseña nueva, es un hallazgo CRÍTICO.
- Intenta desactivarte a ti mismo y desactivar al único administrador. Ambas
  deben ser rechazadas con un mensaje claro.

## Acto 4 — El mandante invita a su contratista

- Invita a una empresa contratista (`Constructora QA SpA`, contacto
  `contratista.qa@ejemplo.cl`).
- ¿Aparece en la lista de contratistas del mandante, con su estado?
- Activa la cuenta desde el enlace del log y entra al portal del contratista.
- ¿Qué ve un contratista recién creado en Inicio, Servicios, Trabajadores,
  Documentos, Equipo y Solicitudes? ¿Entiende qué se le está pidiendo y por quién?

## Acto 5 — El contratista carga su gente

- Agrega un trabajador a mano.
- Descarga la **plantilla de nómina** y usa la carga masiva. ¿Funciona el archivo
  que la propia aplicación entrega? Prueba también un archivo con un RUT inválido
  y otro con un RUT repetido: ¿los errores se explican con claridad y sin dejar
  la carga a medias?
- Desactiva y reactiva un trabajador.
- Invita a alguien al equipo del contratista y actívalo.

## Acto 6 — El servicio

- Como **mandante**, crea un servicio para ese contratista, asociado a un perfil y
  a un centro de trabajo.
- Como **contratista**, ¿aparece el servicio? Asigna trabajadores a la faena.
- Asigna un **cargo** a cada trabajador asignado. Prueba también dejar a uno en
  "Sin cargo" y confirma que persiste al recargar.
- Revisa el panel de avance del servicio. Con cero documentos subidos, ¿qué
  muestra? ¿Se entiende qué falta y a quién se le pide?
- Cambia el estado del servicio (activo / suspendido / terminado) y observa qué
  se habilita y qué se bloquea en cada estado.

## Acto 7 — Documentos

- Como contratista, sube un documento de empresa exigido por el perfil (un PDF
  cualquiera sirve).
- Sube un documento asociado a un trabajador concreto.
- ¿En qué estado queda? Los estados son: 1 Enviado, 2 En Análisis, 3 Observado,
  4 Aprobado.
- ¿Se puede descargar lo subido? ¿El historial del documento muestra los eventos?
- Prueba subir un archivo con una extensión no permitida y uno excesivamente
  grande: ¿el rechazo se explica?
- Revisa el avance del servicio otra vez: ¿se movió?

## Acto 8 — Revisión del mandante

- Como mandante, entra a Revisión. ¿Está el documento pendiente?
- **Obsérvalo** con un motivo. Como contratista: ¿se ve el motivo con claridad?
  Sube la corrección y verifica que el ciclo vuelva a revisión.
- **Apruébalo.** ¿Cambia el avance? ¿Queda registro de quién aprobó y cuándo?
- Prueba la aprobación por excepción y comprueba que quede señalada como tal.
- Si el mandante configuró permisos por pilar, verifica que alguien sin permiso
  sobre un pilar no pueda resolver documentos de ese pilar.

## Acto 9 — El resultado

- Dashboard del mandante: ¿los números coinciden con lo que efectivamente
  cargaste? Cuéntalos a mano y compáralos.
- **Comprueba que un contratista con documentos faltantes no aparezca como
  acreditado.** Si el tablero muestra ACREDITADA a una empresa que no cumple, es
  un hallazgo crítico de negocio, no cosmético.
- Reportes del mandante, y resumen de acreditación del lado del contratista:
  ¿cuentan la misma historia?

## Acto 10 — Aislamiento entre clientes

Esta parte se prueba por API, y es la que protege el negocio entero.

Crea un **segundo mandante** completo (Acto 1 abreviado) y consigue su token de
sesión. Con el token del mandante B, intenta operar sobre el `mandante_id` del
mandante A:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  "http://localhost:8000/api/v1/mandantes/<ID_DE_A>/dashboard" \
  -H "Authorization: Bearer <TOKEN_DE_B>"
```

Repite contra `/contratistas`, `/requisitos`, `/perfiles`, `/configuracion`,
`/reportes` y `/contratistas-detalle`, y también con escrituras: `POST
/perfiles`, `POST /invitar-contratista`, `POST /invitar-usuario`.

**Todas deben responder 403.** Cualquier 200 es un hallazgo CRÍTICO: significa que
un cliente lee o modifica los datos de otro.

Prueba también:
- Un contratista pidiendo rutas de mandante.
- Un usuario del contratista A consultando el servicio del contratista B.
- Cualquier rol autenticado pidiendo `/servicios/{id}/trabajadores` de una faena
  ajena — ahí viajan RUT y nombres completos de personas.

## Acto 11 — Recuperación de contraseña

- Desde el login, usa "¿La olvidaste?" con el correo del contratista.
- Saca el enlace del log, restablece la contraseña y comprueba que entras con
  sesión ya iniciada.
- Intenta reusar el mismo enlace: debe fallar.
- Pide el enlace dos veces seguidas: sólo el último debe servir.
- **Verificación de seguridad:** con una cuenta que un administrador haya
  desactivado, pide recuperación. No debe llegar enlace ni existir forma de
  volver a entrar. Si una cuenta revocada recupera acceso por esta vía, es un
  hallazgo CRÍTICO.

## Acto 12 — Reutilización entre mandantes

Es una de las promesas centrales del producto: un documento se sube una vez y
sirve para todos los mandantes que lo exijan.

- Haz que el contratista trabaje también para el segundo mandante.
- ¿Puede reutilizar un documento ya aprobado, sin volver a subirlo?
- Prueba el circuito de solicitud de reutilización: autorizar y rechazar.
- Prueba un expediente marcado como **sensible**: ¿el segundo mandante queda
  correctamente excluido de verlo sin autorización explícita?

---

## Cómo reportar

Entrega un archivo `hallazgos.md` con esta estructura por hallazgo:

```
### [CRÍTICO|ALTO|MEDIO|BAJO] Título en una línea

- Acto: 7
- Actor: contratista
- Dónde: pantalla o endpoint concreto
- Pasos: 1. … 2. … 3. …
- Esperado: …
- Obtenido: …
- Evidencia: código de estado, texto del error, o lo que la base devuelve
- Ejecutado de verdad: sí | no
```

Criterio de severidad:

| Nivel | Qué significa |
|---|---|
| **CRÍTICO** | Un cliente ve o modifica datos de otro; alguien recupera acceso revocado; el sistema declara acreditado a quien no cumple |
| **ALTO** | Un paso del flujo no se puede completar por la interfaz; se pierden datos; un rol hace algo que no le corresponde |
| **MEDIO** | Funciona pero muestra información equivocada o inconsistente entre pantallas |
| **BAJO** | Cosmética, texto confuso, estado vacío sin explicación |

Al final, además de la lista, responde estas cuatro preguntas en prosa:

1. ¿Se pudo completar el camino entero, de base vacía a documento aprobado, sin
   tocar nunca la base de datos a mano? Si no, ¿dónde exactamente se cortó?
2. ¿En qué momentos un cliente real se habría quedado sin saber qué hacer?
3. ¿Qué funcionalidad **existe en la API pero no tiene forma de usarse** desde la
   interfaz?
4. ¿Qué probaste y quedó bien? Esto importa tanto como lo que falló: sin ello no
   se sabe qué quedó cubierto y qué no.

---

## Qué no es un hallazgo

Para no gastar tiempo de nadie:

- Que no haya análisis con inteligencia artificial de los documentos. No está
  implementado y es sabido; los documentos se revisan a mano.
- Advertencias de HMR o de websockets en la consola del navegador: el frontend
  corre en un contenedor sin volumen montado.
- Que el correo se imprima en el log en vez de enviarse: es el comportamiento
  esperado en desarrollo.
- Que los enlaces del log apunten al puerto 3000: anótalo una vez como hallazgo
  BAJO y sigue; no lo repitas en cada acto.
- Sugerencias de rediseño visual. Lo que sí interesa es cuando la pantalla no
  permite terminar una tarea o dice algo que no es cierto.
