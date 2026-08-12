# Acredita — Tipografía y jerarquía de información

Revisión para 2026. Sólo tipografía y jerarquía. No opino de color, logo ni movimiento.

---

## 0. El hallazgo de una línea

La escala tipográfica está bien pensada y **no está en uso**. Los tokens de `globals.css`
(`micro`, `meta`, `body`, `section`, `input`, `title`, `metric`) aparecen **9 veces** en
**768 declaraciones de tamaño**. El 1,2 %.

Todo lo demás son clases crudas de Tailwind y valores arbitrarios: `text-sm` ×294,
`text-xs` ×260, `text-[10px]` ×115, `text-[11px]` ×30, `text-[9px]` ×2, `text-[19px]` ×1.

El sistema documenta una intención que el código no cumple. El caso más nítido: el token
`--text-metric` lleva el comentario *"KPI, siempre con tabular-nums"*, pero (a) el token no
lo impone y (b) nadie usa el token — los cuatro KPI de `contratistas/page.tsx:567` son
`text-3xl font-semibold` sin cifras tabulares.

**Nada de lo que sigue exige cambiar de tipografía.** El veredicto sobre la familia está en
§8; adelanto que es *mantener Plex*, y el argumento es que la propia elección de Plex
**obliga** a la escala que propongo.

---

## 1. Diagnóstico — la escala real

### 1.1 Inventario

Recorrido completo de `(mandante)`, `(contratista)`, `(admin)`, `(auth)`, `entities/`,
`features/` y `shared/ui/`.

| Clase | Píxeles | Usos | ¿Token? |
|---|---|---|---|
| `text-sm` | 14 | 294 | no |
| `text-xs` | 12 | 260 | no |
| `text-[10px]` | 10 | 115 | arbitrario |
| `text-[11px]` | 11 | 30 | arbitrario |
| `text-xl` | 20 | 19 | no |
| `text-lg` | 18 | 18 | no |
| `text-3xl` | 30 | 7 | no |
| `text-2xl` | 24 | 7 | no |
| `text-base` | 16 | 6 | no |
| `text-micro` | 12 → 11 | 5 | **sí** |
| `text-section` | 14/600 | 2 | **sí** |
| `text-[9px]` | 9 | 2 | arbitrario |
| `text-meta` | 12 | 1 | **sí** |
| `text-body` | 14 | 1 | **sí** |
| `text-[19px]` | 19 | 1 | arbitrario |

**11 tamaños distintos renderizados** (9, 10, 11, 12, 14, 16, 18, 19, 20, 24, 30) y
**148 declaraciones en valores arbitrarios** (19 % del total).

No es que la escala sea grande. Es que **no hay escala**: hay once tamaños elegidos uno por
uno, en pantallas distintas, en momentos distintos.

### 1.2 Los 148 px absolutos también son un problema de accesibilidad

Los tokens y las clases de Tailwind están en `rem` (`text-sm` = 0.875rem). Los 148 valores
arbitrarios están en **px literales**.

Un usuario que sube el tamaño de fuente por defecto de su navegador —el ajuste que usa
alguien con baja visión— escala todo el producto **menos el texto más chico**, que es
justamente el que necesitaba escalar. WCAG 2.1 no fija un mínimo en píxeles; lo que exige
(1.4.4) es que el texto se pueda redimensionar al 200 % sin perder contenido ni función, y
el criterio se satisface mejor con unidades relativas.

Dicho de otro modo: hoy el texto de 10 px de Acredita es el único que **no responde a la
preferencia del usuario**.

### 1.3 El tamaño no significa nada

`text-xs` (12 px) hace, hoy, al menos seis trabajos distintos:

- cabecera de columna de tabla — `uppercase font-semibold tracking-wider ink-muted`
- texto de ayuda bajo un campo — `ink-muted`, regular
- segunda línea de una fila (RUT, cargo, email) — `ink-subtle`, a veces mono
- etiqueta de botón — *Subir*, *Observar*, *Aprobar*, *Excepción*
- chip de filtro
- contador `{filtrados.length} de {contratistas.length}`

Con `uppercase + semibold + tracking`, 12 px es **lo más fuerte** de una tabla. Con
`regular + ink-subtle`, 12 px es **lo más débil** de la misma pantalla. El lector no puede
usar el tamaño como señal, porque el tamaño no es la señal: lo son las tres o cuatro clases
que lo acompañan, y esas combinaciones no están sistematizadas.

Lo mismo con el peso: **217 `font-medium` contra 115 `font-semibold`** para el mismo
trabajo. El nombre de la fila es `text-sm font-medium` en `DocumentoRow` y en la tabla de
contratistas, y `text-sm font-semibold` en `RequisitoRow` y en la cola de revisión. Cuatro
lugares, un trabajo, dos pesos. Es un volado de moneda.

### 1.4 Los 10 px: qué sostienen y qué no

115 usos. Lo que vive ahí:

| Contenido | Dónde | ¿Se sostiene? |
|---|---|---|
| Código del requisito (`F30`, mono) | catálogo, revisión, documentos | **Sí.** Es una etiqueta que se reconoce por forma, no se lee. |
| Iniciales del avatar | 6 pantallas | **Sí.** Es un glifo. |
| Contador de pestaña | panel de contratista | Sí, si es tabular. |
| Chips `Empresa` / `Por cada servicio` | catálogo | **No.** Son 5 chips idénticos por fila × 44 filas. |
| **`Vence: {fecha}`** | `contratistas:174`, `avance-panel:44` | **No.** Es el dato que decide si alguien entra a faena. |
| **`mensaje_brecha`** | `contratistas:210` | **No.** Es la frase exacta que explica el incumplimiento. |
| **`excepción`** | `contratistas:184` | **No.** Significa "alguien dejó pasar una brecha abierta". |
| **Nombre del trabajador** | `contratistas:406` | **No.** Es lo que distingue una fila de la siguiente. |
| **Botones `Base` / `Ampliado` / `Opcional`** | `requisitos:973` | **No.** Es un control interactivo. |

La regla no es "10 px nunca". Es:

> **10 px puede llevar una etiqueta. No puede llevar la razón por la que una decisión cambia.**

Hoy falla en cinco lugares, y los cinco están en el camino crítico del producto.

Los `text-[9px]` de los badges de notificación (sidebars de mandante y contratista) no
tienen defensa: es un número, es la cuenta del trabajo pendiente, y está a 9 px.

**La app ya aprendió esta lección y no la generalizó.** En
`(contratista)/contratista/documentos/page.tsx:40-45` hay un comentario que dice, textual,
que dos filas seguidas se leían con el mismo nombre y sólo se distinguían en 10 px, que
parecía un error de la aplicación y que el riesgo real era subir el archivo en la fila
equivocada. Se arregló subiendo el diferenciador al título. Es exactamente la regla correcta
— **el campo que distingue dos filas contiguas va en el nivel primario, nunca en un chip de
10 px** — y sigue incumplida en el catálogo (subpilar a 11 px sobre 44 filas casi idénticas),
en el panel de contratista (nombre del trabajador a 10 px sobre cada `DocRow`) y en
servicios (`codigo_referencia` a 10 px).

### 1.5 Las cabeceras de tabla gritan

```
text-xs font-semibold text-ink-muted uppercase tracking-wider
```

12 px / 600 / versalita / tracking abierto, contra datos a 14 px / 400.

`uppercase` + `semibold` + `tracking` sube el peso aparente muy por encima del nominal. En
la tabla de contratistas —8 columnas— la fila de cabecera es la banda horizontal más fuerte
de la pantalla, y no dice nada que cambie entre filas. Después de la primera lectura el ojo
debería poder saltarla, y no puede.

Está copiada literalmente ocho veces porque **`shared/ui/table.tsx` no se usa**: las seis
tablas de la app son `<table>` crudas con las clases repetidas a mano.

### 1.6 Los números no están compuestos como números

`tabular-nums` aparece **3 veces en toda la aplicación**: `Ratio`, el contador del chip de
revisión y un número de versión.

No aparece en:

- los 4 KPI de contratistas (`text-3xl`) ni en el `{pct}%` de admin (`text-3xl font-bold`)
- la columna `{tOk}/{c.trabajadores.length}` — **una columna entera de razones**
- `{filtrados.length} de {contratistas.length}`
- los `<input type="number">` de vigencia y umbral de deuda

IBM Plex Sans compone por defecto en cifras **proporcionales**. Una columna de `12/40`,
`7/9`, `3/11` no alinea. Es justo la columna que el revisor barre más rápido, y es la que
baila.

`slashed-zero` sí está bien resuelto: `globals.css` lo aplica a `.font-mono`, y RUT y códigos
van en mono. Correcto y conservar.

### 1.7 Fechas: tres tratamientos, y el peor le tocó al dato más importante

1. `revision/page.tsx:40` — `toLocaleDateString("es-CL", {day, month:"short", hour, minute})`
2. `historial-dialog.tsx:65` — otro `toLocaleDateString` con sus propias opciones
3. `contratistas/page.tsx:174` y `avance-panel.tsx:44` — **`Vence: {doc.fecha_vigencia_hasta}` en crudo**, sin formatear

`fecha_vigencia_hasta` determina si una persona puede entrar hoy a faena, y es el único que
se imprime tal como viene del backend.

Además `month: "short"` en `es-CL` da abreviaturas de ancho variable (`ene`, `sept`), así
que ni las fechas formateadas alinean en columna.

### 1.8 `font-bold` pide un peso que no existe

`layout.tsx` carga **400, 500, 600**. La aplicación pide `font-bold` (700) en **13 lugares**:

- `(auth)/login/page.tsx:103` — `text-2xl font-bold`, el título de la pantalla de entrada
- `(admin)/admin/page.tsx:169` — `text-3xl font-bold`, el porcentaje
- `requisitos/page.tsx:556` y `admin/catalogo:83` — el nombre del pilar
- seis avatares de iniciales, y tres más

Todos caen en negrita sintética o se aplastan contra 600. El propio comentario de
`layout.tsx` explica que el peso 500 era indispensable porque Arial no lo tenía y por eso la
jerarquía medium/semibold se renderizaba mal. **Es el mismo bug, vivo en 700.**

Mi recomendación no es cargar 700: es **eliminar los 13 `font-bold`**. Un producto que ya
distingue bien con 400/500/600 no necesita negrita, y cada peso es descarga en un teléfono
con mala señal en faena.

### 1.9 Otros defectos concretos

- **Email en mono.** `equipo/page.tsx:134`. Mono es correcto para RUT y código: son cadenas
  que se comparan carácter a carácter contra otra copia de sí mismas. Un email **se lee**, y
  mono lo ensancha ~25 % — en un panel de 384 px eso trunca justo el dominio, que es la parte
  que distingue.
- **Truncado por conteo de caracteres en JS.** `requisitos/page.tsx:476` y `:487` —
  `nombre.slice(0,51)+"…"` y `slice(0,13)+"…"`. El conteo de caracteres no es ancho
  (`Ilustración` y `MMMMMMMMMMM` miden distinto), y corta aunque sobre espacio. La app usa
  `truncate` (CSS) en 18 sitios: conviven los dos mecanismos.
- **Regla de 16 px duplicada.** `globals.css:161-172` fija `input/select/textarea` a 16 px y
  a 14 desde 48rem; `shared/ui/input.tsx` fija además `text-base md:text-sm`. Misma regla,
  dos fuentes de verdad.
- **`Label` usa `leading-none`.** Interlineado 1.0 sobre texto con tildes y `ñ` es el único
  punto donde los diacríticos del español están estructuralmente en riesgo de recorte.
- **`text-micro` es responsive en la dirección correcta y no llega al teléfono.** Sube a
  12 px en móvil, pero sólo lo usan 5 componentes; los 115 `text-[10px]` nunca crecen.
- **Se carga un subset que el español no usa.** `layout.tsx` pide
  `subsets: ["latin", "latin-ext"]` para el Sans. `latin` ya cubre á é í ó ú ü ñ ¿ ¡ y las
  mayúsculas acentuadas; `latin-ext` agrega Europa central y oriental. Es peso de descarga
  por caracteres que este producto nunca compone. El Mono, además, pide sólo `["latin"]`:
  las dos familias cargan subsets distintos sin motivo.

---

## 2. Legibilidad en el escenario real

### 2.1 Teléfono, sol, guantes, apuro

El portal del contratista es la superficie móvil. Lo que hay en ella:

| Elemento | Tamaño hoy |
|---|---|
| Cabecera de grupo (pilar) | 12 px versalita `tracking-wider` |
| Nombre del documento | 14 / 500 |
| Código del requisito | 10 mono |
| **`BadgesMandante` — estado por cada cliente** | **11 px** |
| Badge del nav inferior | **9 px** |

La superficie que responde la pregunta central del contratista —*¿cuál de mis clientes ya me
aprobó esto?*— está a 11 px. Y la cabecera del grupo, a 12 px versalita, **pesa más** que el
contenido de 11 px que sí decide.

El sistema de color ya razonó sobre el sol: `ink-subtle` como piso, tonos `-700` porque
*"son más legibles bajo sol directo que los -500"*. Ese razonamiento no se extendió al
tamaño, y **contraste y tamaño se compensan entre sí**: 4,76:1 a 14 px es cómodo; 4,76:1 a
10 px no es la misma experiencia, aunque el número sea idéntico.

La regla más barata que arregla casi todo el problema de sol, sin tocar una sola medida:

> **Nada por debajo de 12 px lleva `ink-subtle`. De 12 px para abajo, el piso es `ink-muted` (7,58:1).**

No cambia ningún layout. Sólo cambia el token de color en el texto pequeño.

### 2.2 Escritorio, tabla de ocho columnas

`contratistas/page.tsx`: Empresa · RUT · Acreditación · *N* pilares · Trabajadores · chevron.

- La cabecera grita (§1.5).
- El RUT va a `text-xs` mono dentro de una tabla `text-sm`: **la columna del RUT tiene otro
  ritmo vertical** que el resto de la fila y se lee hundida.
- La columna de razón `{tOk}/{total}` está a 12 px, sin tabular y alineada a la izquierda.
- Las columnas de pilar repiten `OK` / `Brechas` en texto a 12/500, tres veces por fila. El
  ojo lee las mismas dos palabras 3·N veces.

Ese último punto es jerarquía antes que tamaño, pero la respuesta tipográfica existe: esas
celdas bajan a `micro`, de modo que la identidad de la fila (la razón social) siga dominando
y las columnas de pilar se lean como **una tira de marcas**, no como tres columnas de prosa.

---

## 3. Datos: RUT, fechas, porcentajes, códigos

### 3.1 Cuándo mono y cuándo no

La regla que la app aplica bien a medias, escrita:

> **Mono cuando la cadena se compara carácter a carácter contra otra copia de sí misma.
> Sans cuando se lee como lenguaje.**

| Dato | Hoy | Debe ser |
|---|---|---|
| RUT | mono ✓ | **mono** — pero a `body`, no a `xs`, y a `ink-secondary` |
| Código de requisito (`F30`) | mono ✓ | **mono**, `micro`, con `slashed-zero` (ya lo tiene) |
| `codigo_referencia` de servicio | mono ✓ | **mono** |
| Nombre de archivo | sans ✗ | **mono** — se compara con el del disco |
| Fecha en columna | sans / crudo ✗ | **mono tabular**, `dd-mm-aaaa` |
| **Email** | mono ✗ | **sans** — se lee, y mono lo trunca |
| Razón social, nombres, direcciones | sans ✓ | sans |

### 3.2 Cifras tabulares

`tabular-nums` queda **horneado en el token**, no encargado a la memoria de quien escribe la
clase:

- `metric` → tabular por construcción
- utilidad `.num` → aplicable a `<td>` numérico, a `Ratio`, a porcentajes, a contadores y a
  `<input type="number">`

Es la razón por la que se eligió Plex —el propio `layout.tsx` cita *"cifras tabulares reales
(tnum)"*— y está apagada en 765 de 768 sitios.

### 3.3 Alineación en tablas

| Tipo de columna | Alineación | Composición |
|---|---|---|
| Texto (empresa, requisito, cargo) | izquierda | `body` 400 |
| Identificador (RUT, código) | izquierda | mono `body`, `slashed-zero` |
| Fecha | **derecha** | mono `meta`, tabular |
| Razón `n/total`, porcentaje, conteo | **derecha** | `body` 500, tabular |
| Estado (badge) | izquierda | `micro` |
| Marca de pilar | centro | `micro` |

Derecha para lo numérico porque el revisor barre la columna en vertical: alineadas a la
derecha y tabulares, las unidades quedan bajo las unidades y las diferencias saltan sin leer.

### 3.4 Fechas: un formatter, dos formas

Una sola función compartida, dos salidas:

- **Columna / dato**: `11-08-2026`, mono tabular. Ancho fijo, orden chileno.
- **Frase**: `11 de agosto de 2026` o `hace 2 h`, sans.
- Nunca `month:"short"` en columna: `sept` mide distinto que `ene`.

---

## 4. Jerarquía en las tres pantallas densas

La escala sola no arregla estas pantallas. Va la jerarquía.

### 4.1 Catálogo de 44 requisitos

**Hoy**: nombre a 14/600, después cinco o seis chips a 10 px —código, entidad, alcance,
propio, sin-guardar— todos del mismo tamaño, la misma forma y el mismo peso, y a veces dos
inputs numéricos a 12. Una fila es *una cosa fuerte y un seto de cosas chicas idénticas*.

El lector llega con una de dos preguntas:

- **barriendo** — *¿cuáles de estos 44 estoy exigiendo?* → lo responde el interruptor, que ya
  está a la izquierda. Bien.
- **decidiendo** — *¿debería exigir éste?* → lo responden el **nombre** y la **descripción
  normativa**, y la descripción no está en la fila: vive en el panel lateral.

**Propuesta**

| Nivel | Qué | Composición |
|---|---|---|
| L1 | Nombre del requisito | `strong` cuando se exige; **`body` 400 `ink-muted` cuando no** — así los exigidos emergen de la lista |
| L2 | Una sola frase de alcance y vigencia: *"Se acredita una vez · vence a 30 días"* | `meta` `ink-muted` |
| L3 | El código, y **sólo** el código | `micro` mono |
| — | `Sin guardar` | único chip que conserva caja de color: es estado transitorio |
| — | `Propio` | marca, no chip con palabra |
| **Subpilar** | **`section` con filete** | hoy 11 px versalita **encima de las filas de 14 px que agrupa** |

Lo último es la mayor ganancia de la pantalla: 44 filas bajo 3 pilares y *N* subpilares,
donde la etiqueta del subpilar es **el texto más chico del bloque**. Un rótulo de grupo más
pequeño que sus miembros se lee como nota al pie. Un grupo de 8 filas necesita una cabecera
donde el ojo pueda aterrizar desde 40 cm.

Entidad desaparece como chip: ya es la pestaña en la que estás. Alcance sube a L2. De cinco
chips por fila se pasa a uno.

### 4.2 Matriz de cargos

**Hoy**: `<th>` a 12/500, nombre del requisito a 14/400 truncado a 52 caracteres en JS,
código a 10 mono *después* del nombre, y checkboxes.

Lo que rompe el barrido horizontal no es el tamaño: es que la etiqueta de fila mide 52
caracteres de ancho variable y el ojo tiene que recorrerla antes de llegar a la primera
casilla.

**Propuesta**

- **El código va primero**, en columna fija de 5rem, `micro` mono. El ojo ancla en un ancho
  fijo, no en un nombre irregular. Es además lo que un prevencionista dice en voz alta — lo
  argumenta el propio comentario de `siglaVisible` en `shared/lib/utils.ts`.
- Nombre a `body`, truncado con CSS (`truncate`), no con `slice`.
- `<th>` a `micro`, no a `xs`: la cabecera se lee una vez, las filas 6 a 40 veces.
- Cabeceras de cargo sin truncar a 14 caracteres en JS: `truncate` + `title`.

### 4.3 Detalle de contratista (panel de 384 px)

**Hoy**, en 384 px: razón social 14/600 · RUT 12 mono · badge · 4 pestañas 12/500 · por pilar
una tarjeta con nombre 14/500 y lista de brechas a 12 · y en Documentos un `DocRow` con
nombre a **12/500**, `Vence:` a **10**, `mensaje_brecha` a **10** con sangría de 24 px.

**Propuesta**

| Nivel | Qué | Composición |
|---|---|---|
| L1 | Razón social | `section` — es el sujeto del panel entero |
| L2 | RUT | `meta` mono `ink-secondary`, debajo |
| L3 | Nombre del pilar | `strong` |
| L4 | Nombre del documento | **`body` 400**, no 12/500 |
| L5 | **`mensaje_brecha`** | **`meta` `bloqueo-ink`, ancho completo, sin sangría** |
| L6 | `Vence: {fecha}` | `micro` mono tabular; `accion-ink` a menos de 30 días, `ink-muted` si no |

L4 merece explicación: **el peso no sustituye al tamaño cuando la línea es larga.** 12/500 es
un grito en volumen de susurro; el nombre del documento se lee mejor a 14/400 que a 12/600.

La regla general, comprobable, para quien implemente:

> **Dentro de una misma tarjeta, el texto más chico no puede ser el texto que explica la decisión.**

Hoy falla en al menos tres tarjetas.

---

## 5. Qué se usa hoy en producto B2B denso

Fui a los sistemas de diseño de productos densos reales, no a listas de blogs.

| Sistema | Familia | Tamaño **mínimo** de UI | Nota |
|---|---|---|---|
| **IBM Carbon** (consultado ago-2026) | **IBM Plex Sans** | **12 px** (`label-01`, 12/16, 400) | Escala *productive*, la de producto denso. `body-compact-01` = 14/18. |
| **Atlassian Design System** (consultado ago-2026) | Atlassian Sans / Mono | **12 px** (`Body S`) | *"debe usarse con moderación… contenido secundario, letra chica"* |
| **GitHub Primer** (consultado ago-2026) | Mona Sans VF | **12 px** (`--base-text-size-xs`) | El token más chico, para *caption* y *body small*. |

Tres sistemas de producto denso, tres pisos en 12 px. Acredita tiene **148 declaraciones por
debajo de 12 px**.

Y el dato más útil de todos, porque viene de quien diseñó la tipografía que Acredita usa:

> **Carbon aplica tracking positivo a Plex en los tamaños chicos**: `+0.32 px` a 12 px
> (`label-01`, `helper-text-01`, `code-01`) y `+0.16 px` a 14 px (`body-01`,
> `body-compact-01`, `heading-01`).
> — [`carbon/packages/type/scss/_styles.scss`](https://github.com/carbon-design-system/carbon/blob/main/packages/type/scss/_styles.scss)

Es decir: **IBM, que hizo Plex, no la compone por debajo de 12 px y la abre de tracking
cuando baja.** Acredita hace lo contrario — la baja a 9 y 10 px con `+0.01em` (≈ +0.11 px),
menos de la mitad de lo que IBM prescribe para 12.

Sobre el mínimo en abstracto: **WCAG no fija un mínimo de píxeles.** Lo que exige (1.4.4,
*Resize text*) es que el texto llegue al 200 % sin pérdida de contenido ni función — razón de
más para que el texto chico esté en `rem` y no en px (§1.2). El piso de 12 px no es una norma:
es lo que converge la práctica de los tres sistemas de arriba.

---

## 6. La escala propuesta

Siete niveles en vez de once, nombrados por trabajo y no por tamaño: es la convención que los
tokens actuales ya usan bien y conviene conservarla.

**Sólo los dos escalones de abajo responden al viewport** — que es donde el teléfono duele.
Arriba, medida fija: en escritorio manda la densidad y en teléfono no hay tablas. El mecanismo
ya existe en `globals.css` (variable CSS + media query, porque `@theme` no acepta media
queries); sólo hay que extenderlo un escalón.

El tracking sigue a Carbon (§5), que es la referencia del fabricante para esta familia.

### 6.1 Sistema de pesos, con regla

Lo que hoy es un volado de moneda entre 500 y 600 pasa a tener criterio:

| Peso | Para qué |
|---|---|
| **400** | Prosa, datos de celda, valores, texto normativo |
| **500** | Etiquetas, botones, chips, navegación activa — *lo que se pulsa o lo que nombra un campo* |
| **600** | Identidad y encabezados — *el nombre de una fila, de una sección, de una página, de un KPI* |
| ~~700~~ | **No se carga y no se usa.** Eliminar los 13 `font-bold` (§1.8). |

### 6.2 Mapa de migración

| Hoy | Usos | Pasa a |
|---|---|---|
| `text-[9px]` | 2 | `micro` |
| `text-[10px]` | 115 | `micro` — salvo los 5 casos críticos de §1.4, que suben a `meta` |
| `text-[11px]` | 30 | `micro` si es etiqueta; `meta` si es una oración |
| `text-xs` | 260 | `meta` (ayuda, 2ª línea, cabecera de columna en minúscula) · `micro` 500 (botones y chips) |
| `text-sm` | 294 | `body` (dato, prosa) · `strong` (el nombre de la cosa) |
| `text-base` | 6 | `input` o `section` |
| `text-lg` / `text-xl` | 37 | `title` |
| `text-2xl` | 7 | `title` |
| `text-3xl` | 7 | `metric` |
| `text-[19px]` | 1 | logotipo — fuera de la escala de producto, se deja |

---

## 7. Escala final — lista para volcar a tokens

Base 1rem = 16 px. Móvil = por defecto; escritorio = desde `48rem`, igual que el mecanismo
que ya existe para `micro`.

| Token | Móvil | Escritorio | Peso | Interlineado | Tracking | Cifras | Para qué |
|---|---|---|---|---|---|---|---|
| `micro` | 12 px | **11 px** | 500 | 16 / 15 px | +0.025em | — | Badges, chips, códigos, cabecera de columna, marcas. **Nunca una oración.** |
| `meta` | 13 px | **12 px** | 400 | 18 / 16 px | +0.015em | tabular si es número | 2ª línea de fila, ayuda, fecha, `mensaje_brecha` |
| `body` | 15 px | **14 px** | 400 | 22 / 20 px | +0.01em | — | Por defecto: celda de tabla, párrafo, texto normativo |
| `strong` | 15 px | **14 px** | 600 | 22 / 20 px | −0.005em | — | El nombre de la cosa: fila, documento, requisito, pilar |
| `section` | 16 px | **15 px** | 600 | 22 / 20 px | −0.01em | — | Cabecera de grupo, título de tarjeta y de diálogo, subpilar |
| `title` | 20 px | 20 px | 600 | 26 / 28 px | −0.015em | — | `h1` de página |
| `metric` | 28 px | **24 px** | 600 | 32 / 28 px | −0.02em | **tabular siempre** | KPI, porcentaje grande |
| `input` | **16 px** | 14 px | 400 | 24 / 20 px | 0 | — | Campos. 16 en móvil o iOS hace zoom al enfocar. Fuente única de esta regla. |

Reglas que acompañan a la tabla y que van en el mismo commit:

1. **Piso duro: 11 px en escritorio, 12 px en teléfono.** Nada por debajo. Se van los 9 px.
2. **Nada bajo 12 px lleva `ink-subtle`.** De ahí para abajo, piso `ink-muted` (7,58:1).
3. **`tabular-nums` en `metric` y en la utilidad `.num`.** `.num` va en toda celda numérica,
   razón, porcentaje, contador e `<input type="number">`.
4. **Cabecera de columna en minúscula**, `micro` 500 `ink-muted`. Se retira
   `uppercase tracking-wider`.
5. **Un solo peso por trabajo** según §6.1. Cero `font-bold`.
6. **Truncado sólo con CSS.** Se retiran los `slice()` de `requisitos/page.tsx`.
7. **`leading-none` fuera de `Label`** — descendentes y tildes.
8. **Se borra `text-base md:text-sm` de `input.tsx`**: la regla vive en el token `input`.
9. **Un solo formatter de fecha**, dos salidas (§3.4).
10. **Email a sans; nombre de archivo a mono.**

---

## 8. Veredicto sobre la tipografía

### Mantener IBM Plex Sans + IBM Plex Mono. Sin cambio de familia.

El argumento de `layout.tsx` se sostiene. Lo revisé claim por claim:

| Afirmación | ¿Se sostiene? |
|---|---|
| No Geist, porque es la tipografía de marca de Vercel | **Sí.** Es literalmente su fuente corporativa. |
| No Inter, porque es *la* fuente del SaaS genérico | **Sí como argumento de carácter.** Pero concede algo que no dice: Inter tiene mayor altura de x y es *mejor* que Plex a tamaños chicos. El argumento gana en voz y no responde en legibilidad. |
| Herencia industrial-técnica | **Sí.** Plex nació en IBM (Abbink + Bold Monday, 2017) con el encargo explícito de ser *"el punto de encuentro entre lo humano y lo ingenieril"*. Calza con minería y construcción. |
| Cifras tabulares reales (`tnum`) | **Sí la fuente. No el código.** Apagadas en 765 de 768 sitios (§1.6). |
| Diacríticos del español, mayúsculas acentuadas | **Sí** — y por eso `latin-ext` sobra (§1.9). |
| Monoespaciada hermana | **Sí, y es el mayor acierto.** RUT y código pertenecen al mismo sistema que el texto. Sólo hay que sacar el email de ahí. |

Cinco de seis. La que falla no está equivocada: está **sin cobrar**.

**La objeción técnica real a Plex es su altura de x**, modesta comparada con Inter, y es
exactamente la propiedad que importa a los tamaños donde esta app pone 148 declaraciones. Pero
esa objeción no pide cambiar de fuente. Pide otra cosa:

> **Elegir Plex obliga a un piso de tamaño más alto que elegir Inter.**
> No son dos decisiones independientes. Son la misma decisión.

Y esto no es opinión mía: **IBM, que hizo Plex, no la compone por debajo de 12 px y le abre el
tracking cuando baja** (§5). Carbon —el sistema de IBM para producto denso, con la misma
familia y el mismo tipo de usuario— tiene su piso en `label-01` a 12 px con +0.32 px de
tracking. Acredita la baja a 9 y 10 px con +0.11 px.

De ahí el veredicto en una frase:

> ## **Plex o los 10 px. No las dos.**

Si el equipo quiere conservar 115 badges a 10 px, entonces Plex es la familia equivocada y
habría que ir a una de altura de x mayor —Source Sans 3, Public Sans— con lo que se pierde el
carácter, la voz industrial y la relación con la monoespaciada hermana. Es un mal canje. **La
respuesta correcta es subir el piso, no bajar la fuente.**

### Enmiendas, todas dentro de la familia

1. **Cargar 400 / 500 / 600. Punto.** Eliminar los 13 `font-bold`; hoy piden un 700 que no
   existe y se renderizan sintéticos (§1.8).
2. **Encender `tnum`** donde la fuente se eligió por tenerlo (§3.2).
3. **Abrir el tracking en lo chico** siguiendo a Carbon: +0.025em en `micro`, +0.015em en
   `meta` (§7).
4. **Quitar `latin-ext` del Sans.** El español no lo usa; es descarga en un teléfono en faena.
   De paso, igualar subsets entre Sans y Mono.
5. **Mantener `display: "swap"`.** Es la decisión correcta para el escenario real: con mala
   señal, texto visible en la fallback antes que texto invisible.
6. **Mantener la ausencia de `antialiased`.** El comentario de `layout.tsx` tiene razón: para
   leer al sol conviene más masa, no menos.

### Lo que sí cambia de verdad

Nada de esto es un cambio de tipografía. Es que **el argumento de `layout.tsx` se escribió y
nunca se cobró**: se eligió una fuente por sus cifras tabulares y su hermana monoespaciada, y
después se compuso el producto a 10 px con cifras proporcionales, con un peso que no está
cargado y con los tokens sin usar.

La familia estaba bien elegida desde el principio. Lo que falta es componer con ella.

---

## Fuentes

- [IBM Carbon Design System — Type sets](https://carbondesignsystem.com/elements/typography/type-sets/) · consultado ago-2026
- [`carbon/packages/type/scss/_styles.scss`](https://github.com/carbon-design-system/carbon/blob/main/packages/type/scss/_styles.scss) — valores exactos de tracking en Plex · consultado ago-2026
- [Atlassian Design System — Typography](https://atlassian.design/foundations/typography) · consultado ago-2026
- [GitHub Primer — Typography primitives](https://primer.style/foundations/primitives/typography) · consultado ago-2026
- [IBM Plex — Wikipedia](https://en.wikipedia.org/wiki/IBM_Plex) y [Bold Monday — IBM Plex](https://boldmonday.com/custom/ibm/) — autoría y encargo de diseño · consultado ago-2026
- [IBM Plex Sans vs Inter — FontFYI](https://fontfyi.com/blog/ibm-plex-vs-inter/) — comparación de altura de x y carácter · consultado ago-2026
- [The A11Y Collective — WCAG minimum font size](https://www.a11y-collective.com/blog/wcag-minimum-font-size/) — WCAG no fija mínimo en px; 1.4.4 exige 200 % · consultado ago-2026
