# Paleta de Acredita — diagnóstico y propuesta 2026

> Todo contraste que aparece acá está **calculado**, no estimado. Los scripts que
> producen cada número están junto a este archivo: `color.py` (conversiones, WCAG,
> APCA, OKLab/OKLCH, simulación de daltonismo Machado 2009, velo por luz ambiente),
> `diag.py` (paleta actual), `opt.py` / `opt3.py` / `opt4.py` / `opt5.py` (búsqueda
> del trío rojo-ámbar-verde), `dark.py` (modo oscuro), `final2.py` (paleta definitiva
> y verificación completa; su salida está en `out.txt`).

---

## 0. Resumen en seis líneas

1. La paleta actual **es Tailwind de fábrica** con nombres nuevos: 17 de los 20 tokens de estado son literales de la escala por defecto de Tailwind v2/v3. Eso es lo que la delata como 2020, no el gusto.
2. Tiene **dos fallas de seguridad medibles**: para un deuteránope, el fondo de "cumple" y el de "bloqueado" difieren en ΔE 0.009 (indistinguibles), y las tintas de "falta algo" y "bloquea hoy" bajan a ΔE 0.023 para un protán (colisión). El umbral práctico es 0.05.
3. El croma está **invertido respecto de la urgencia**: el violeta de `excepcion` (C 0.241) es el color más saturado de toda la app y significa el estado menos urgente.
4. Las ocho familias son en realidad **seis matices**: `espera` y `vacio` comparten tinta exacta; `brand` y `proceso` comparten `-soft` y `-line` exactos.
5. Sí conviene pasar a OKLCH, pero **no por el degradado**: por los estados hover y por poder razonar con una regla en vez de con 24 hex sueltos. Medido: el mismo paso de hover en HSL produce saltos percibidos que varían **70 %** entre familias; en OKLCH varían **3.6 %**.
6. Bajo sol directo **ninguna paleta sobrevive** —ni negro sobre blanco—, pero la actual falla en el orden equivocado: `bloqueo` es la familia con menor ΔY de las ocho.

**Lo que la propuesta consigue, en un número:** la separación del par `ok` / `bloqueo` en el peor de los cuatro tipos de visión pasa de **ΔE 0.039 → 0.133** en la tinta y de **0.009 → 0.032** en el fondo.

---

## 1. Diagnóstico: ¿2026 o 2019?

### 1.1 Lo que la delata: son valores de Tailwind, literales

El comentario en `globals.css` dice que los valores van en hex literal "y no referenciando la paleta de Tailwind". Se protegió la *fragilidad* pero se conservó la *identidad*: los hex **son** los de Tailwind.

| token | valor | es exactamente |
|---|---|---|
| `espera-soft` / `-line` / `-ink` | `#f1f5f9` `#e2e8f0` `#475569` | slate-100 / 200 / 600 |
| `accion-soft` / `-line` / `-ink` | `#fffbeb` `#fde68a` `#92400e` | amber-50 / 200 / 800 |
| `bloqueo-soft` / `-line` / `-ink` | `#fef2f2` `#fecaca` `#b91c1c` | red-50 / 200 / 700 |
| `ok-soft` / `-line` / `-ink` | `#ecfdf5` `#a7f3d0` `#047857` | emerald-50 / 200 / 700 |
| `excepcion-soft` / `-line` / `-ink` | `#f5f3ff` `#ddd6fe` `#6d28d9` | violet-50 / 200 / 700 |
| `vacio-line` / `-ink` | `#cbd5e1` `#475569` | slate-300 / 600 |
| superficies e `ink-*` | `#f8fafc` … `#0f172a` | slate-50 … slate-900 |

De los 20 tokens de estado declarados en `globals.css`, **17 son literales de Tailwind**; los 3 restantes son la familia `proceso`. Fuera de los estados solo hay seis valores propios: `#245b93`, `#1b4877`, `#eff5fb`, `#bbd3ec`, `#93c0ee`, `#a6552c`. Es decir: **la marca es original, los estados son stock.** La receta "`-50` de fondo, `-200` de borde, `-700` de texto" es el patrón de badge de Tailwind UI de 2020. No está mal — está *fechado*, y peor, está *medido* mal.

### 1.2 El croma no tiene jerarquía, y además está invertido

Croma OKLCH de cada tinta, de más gritón a más callado:

| familia | C | significa |
|---|---|---|
| `excepcion` | **0.241** | decisión discrecional del mandante |
| `bloqueo` | 0.190 | incumplimiento vigente, bloquea hoy |
| `accion` | 0.125 | falta algo tuyo, todavía no bloquea |
| `brand` | 0.108 | marca / interacción |
| `ok` | 0.105 | cumple |
| `espera` = `vacio` | 0.037 | nadie tiene que hacer nada |

El pixel más saturado de la aplicación es el que dice *"alguien aprobó una excepción"*. El que dice *"esta persona no puede entrar a la faena"* es 26 % menos saturado. El croma de las tintas va de 0.037 a 0.241 — **factor 6.5**. Eso no es una paleta: son seis paletas puestas una al lado de la otra.

### 1.3 La luminosidad tampoco, y ahí está la falla de seguridad

| familia | L (OKLCH) de la tinta |
|---|---|
| `proceso` | 0.396 |
| `espera` = `vacio` | 0.446 |
| `brand` | 0.464 |
| `accion` | 0.473 |
| `excepcion` | 0.491 |
| `bloqueo` | **0.505** |
| `ok` | **0.508** |

`ok` y `bloqueo` — el único par del producto que **nunca** puede confundirse — están a 0.003 de luminosidad uno del otro. En el canal que siempre sobrevive (claro/oscuro) son el mismo color. Lo único que los separa es el matiz, que es exactamente lo que falla en el 8 % de los hombres.

### 1.4 Los bordes `-line` no se ven

Contraste de cada `-line` contra su propio `-soft`: `espera` 1.13 · `accion` 1.20 · `ok` 1.22 · `excepcion` 1.27 · `bloqueo` 1.32 · `proceso`/`brand` 1.40 · `vacio` 1.42. Ninguno pasa de 1.42, y contra blanco el máximo es 1.54. Ocupan un token, un nombre y ~200 usos en el código, y aportan una diferencia que en la práctica no se ve.

*(Ojo: esto vale para los `-line` de familia, que sí deberían portar el estado del chip. Los `-line` neutros de tabla y card a 1.2–1.7 están bien así — un divisor decorativo no necesita 3:1, y Linear y Vercel usan exactamente ese rango.)*

### 1.5 Ocho familias que son seis

- `espera-ink` **=** `vacio-ink` **=** `#475569`. Mismo token, dos nombres.
- `brand-soft` **=** `proceso-soft`; `brand-line` **=** `proceso-line`.
- `brand-hover` **=** `proceso-ink` **=** `#1b4877`. Un badge "En Análisis" tiene exactamente el color de un enlace con el mouse encima.
- `proceso` además está casi muerto: tres usos en todo el frontend. Ocupa un matiz completo del vocabulario para eso.

### 1.6 Lo que está bien y hay que conservar

- **La regla semántica.** "El matiz responde *¿quién debe actuar y con qué urgencia?*, no *¿esto es bueno o malo?*" es mejor que la de la mayoría de los design systems, y coincide con la señalética que estos usuarios leen en faena todos los días (NCh 1410 / NCh 1411: rojo = prohibición, amarillo = advertencia, verde = condición segura, azul = acción obligatoria).
- **Prohibir el cobre dentro de la app** porque compite con el ámbar.
- **`ink-subtle` como piso declarado** ("nada más claro lleva texto").
- **El azul acero `#245b93`**: desaturado, no compite con ningún estado, no parece plantilla.
- **Los nombres de los tokens.** `-soft` / `-line` / `-ink` de familia aparecen **496 veces** en el frontend, y el conjunto completo de tokens de color **2 170 veces**. Son buenos nombres. **No hay que renombrarlos.** Se cambian los valores, no la interfaz.

---

## 2. Espacio de color: ¿conviene OKLCH?

Sí, pero conviene ser preciso sobre qué se gana, porque hay una razón muy citada que en este producto **no** aplica.

### 2.1 Lo que se gana de verdad: estados hover consistentes

Hoy no hay tokens de hover derivados; hay un `brand-hover` a mano. Si mañana se quiere "hover = un escalón más oscuro" para todas las familias, en HSL el mismo paso nominal da saltos percibidos distintos. Medido, bajando 7 puntos de luminosidad HSL:

| familia | base → hover | salto real en L de OKLab |
|---|---|---|
| brand | `#1f5a96` → `#194878` | 0.0656 |
| bloqueo | `#90000b` → `#6c0008` | 0.0766 |
| accion | `#995e00` → `#754800` | 0.0919 |
| ok | `#007e67` → `#005a4a` | **0.1116** |

El verde salta **70 % más** que el azul con la misma instrucción. En OKLCH, bajando 0.045 de L:

| familia | base → hover | salto real |
|---|---|---|
| brand | `#1f5a96` → `#0f4d88` | 0.0449 |
| bloqueo | `#90000b` → `#7b0008` | 0.0443 |
| accion | `#995e00` → `#885300` | 0.0441 |
| ok | `#007e67` → `#006f5b` | 0.0457 |

Dispersión: **3.6 % en vez de 70 %**. Eso es la diferencia entre "hover" como regla y "hover" como 8 hex elegidos a ojo.

### 2.2 Lo que se gana: poder razonar con reglas

Con OKLCH la paleta deja de ser 24 hex y pasa a ser tres decisiones por familia (L, C, H) más una escalera compartida. Se puede *auditar*: "el croma tiene que ordenarse con la urgencia" es una consulta, no una impresión. Todo el análisis de daltonismo de la sección 4 solo es posible porque los ejes están separados.

### 2.3 Lo que se gana poco: los degradados

Es el argumento estrella de OKLCH y acá casi no aplica — esta app no tiene degradados, y no debería tenerlos. Igual, medido, de `brand` a `bloqueo`:

| | hex | L |
|---|---|---|
| extremo A | `#1f5a96` | 0.461 |
| punto medio interpolado en sRGB | `#582d50` | **0.367** |
| punto medio interpolado en OKLab | `#69445a` | 0.436 |
| extremo B | `#90000b` | 0.411 |

En sRGB el medio queda **más oscuro que los dos extremos** (0.367 < 0.411 < 0.461): la franja sucia clásica. En OKLab queda ordenado entre ambos. Real, pero irrelevante para este producto.

### 2.4 Lo que cuesta

- **OKLCH da uniformidad perceptual, no uniformidad de contraste.** Es la trampa. Medido, a igual L 0.550 y C 0.110:

  | matiz | hex | WCAG vs blanco |
  |---|---|---|
  | rojo H 27 | `#a8564e` | 5.11 |
  | violeta H 300 | `#7c61a8` | 5.08 |
  | ámbar H 68 | `#9b641a` | 4.96 |
  | azul H 252 | `#3d74b0` | 4.86 |
  | cian H 232 | `#0a7ca6` | 4.72 |
  | verde H 174 | `#00856d` | **4.59** |

  Un 11 % de diferencia con los mismos números. Quien crea que "misma L ⇒ mismo contraste" va a publicar tokens que no pasan AA. **Hay que medir igual.** Por eso la propuesta trae la tabla de contrastes calculada y no solo la de coordenadas.

- **Recorte de gamut.** Varios valores de la propuesta salen de sRGB en la coordenada nominal y se recortan reduciendo croma. Está manejado en `color.py` (bisección de croma, la misma estrategia de CSS Color 4), pero significa que el C nominal y el C real no siempre coinciden.

- **Coherencia con el motivo original.** El comentario de `globals.css` evita referenciar la paleta de Tailwind para que un minor no mueva dos superficies que deben ser idénticas. Ese motivo se conserva: **hay que seguir escribiendo valores propios**, en OKLCH o en hex, nunca `var(--color-red-700)` de Tailwind.

**Recomendación práctica:** diseñar y auditar en OKLCH; **publicar en hex**. Los `@theme` de Tailwind v4 aceptan `oklch()` sin problema, pero el hex es diffeable, grepeable y no depende de que el pipeline de build resuelva el gamut igual que el navegador. La coordenada OKLCH va en un comentario al lado, que es donde sirve.

---

## 3. Modo oscuro: ¿debería existir?

**Sí, pero no por la razón habitual, y no como la respuesta al sol.**

**A favor:** en minería chilena el turno de noche es estándar (4x4, 7x7). Un teléfono a 600 nits con fondo blanco a las tres de la mañana, en un patio sin iluminación, destruye la adaptación a la oscuridad de quien lo mira — y esa persona después camina por una faena. Eso no es preferencia estética, es un riesgo. Un modo oscuro reduce la luz emitida en un orden de magnitud.

**En contra, y es importante:** el modo oscuro es **peor** bajo luz ambiente, no mejor. Medido, teléfono de 600 nits y 4,5 % de reflectancia:

| | ΔY | ratio nominal | se sostiene 4.5:1 hasta |
|---|---|---|---|
| cuerpo de texto, modo claro | 0.941 | 15.81 | **10 692 lux** |
| cuerpo de texto, modo oscuro | 0.838 | 14.03 | 9 433 lux |

El velo de reflexión se suma a los dos lados; con fondo oscuro hay menos ΔY disponible para empezar. **El modo oscuro es para la noche, no para el sol.** Quien lo proponga como "modo exterior" está equivocado y ahora hay un número que lo dice.

**Y un hallazgo que no esperaba:** el modo oscuro es *estructuralmente más difícil* de hacer seguro para daltónicos que el claro. Un protán pierde luminancia en el rojo, y la pérdida depende de qué tan claro sea el rojo. Medido:

| L nominal del rojo | hex | L que percibe un protán | caída |
|---|---|---|---|
| 0.60 | `#ce5249` | 0.523 | 0.077 |
| 0.68 | `#ea6b60` | 0.604 | 0.076 |
| 0.75 | `#ff8579` | 0.682 | 0.068 |
| 0.80 | `#ffa096` | 0.750 | 0.050 |
| 0.85 | `#ffbab1` | 0.816 | 0.034 |
| 0.90 | `#ffd2cc` | 0.879 | 0.021 |

Un verde-turquesa, en cambio, casi no se mueve (−0.036 a −0.039, constante).

Consecuencia: **en fondo claro el rojo va abajo y la caída de luminancia del protán SUMA separación con el verde. En fondo oscuro el rojo tiene que ir arriba y la caída la RESTA.** Por eso, con el rojo a L 0.80 en oscuro, el par `ok`/`bloqueo` cae a ΔE 0.045 (colisión) y hay que subirlo a L 0.855 para recuperar 0.127. Ese rojo claro (`#ffbcb4`) es más pálido de lo que uno elegiría por gusto; está ahí por medición.

**Recomendación:** tres modos, no dos.

| modo | cuándo | cómo se activa |
|---|---|---|
| `claro` | por defecto, oficina y faena de día | default |
| `oscuro` | turno de noche | `prefers-color-scheme` + interruptor manual |
| `faena` | sol directo | interruptor manual, accesible en un toque (§5) |

---

## 4. Daltonismo: ¿se distinguen aprobado y rechazado sin el tono?

Método: simulación Machado–Oliveira–Fernandes (2009) a severidad 1.0 aplicada en RGB lineal, más acromatopsia (luminancia pura), y distancia ΔE en OKLab. Umbrales que uso: **>0.10 seguro, 0.05–0.10 justo, <0.05 colisión** para tintas; para fondos claros, **>0.030 / 0.015–0.030 / <0.015**.

### 4.1 Hoy: no se distinguen

| par | normal | protanopia | deuteranopia | tritanopia | acromatopsia |
|---|---|---|---|---|---|
| `ok-ink` / `bloqueo-ink` | 0.278 | 0.137 | **0.084** | 0.303 | **0.039** |
| `accion-ink` / `bloqueo-ink` | 0.089 | **0.023** | **0.038** | 0.085 | **0.022** |
| `ok-soft` / `bloqueo-soft` | 0.056 | 0.021 | **0.009** | 0.037 | **0.012** |
| `espera-ink` / `vacio-ink` | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |

Traducido: **un deuteránope mirando una tabla de filas tintadas ve `#f9f8f5` contra `#f6f5f2`.** Son el mismo blanco roto. Y `accion` contra `bloqueo` colisiona para protanes *y* deuteranes — o sea, "falta un papel" y "no puede entrar hoy" son el mismo color para el 8 % de los hombres.

### 4.2 El matiz sí importa, y mucho más de lo que suele decirse

Puesto un verde y un rojo a la **misma** luminosidad, variando solo el matiz del verde:

| H del verde | hex | ΔE deuteranopia vs rojo |
|---|---|---|
| 140 (verde pasto) | `#357426` | 0.028 |
| 155 | `#007742` | 0.057 |
| 165 (emerald, el actual) | `#007654` | 0.082 |
| 175 | `#007460` | 0.100 |
| 190 | `#00736e` | 0.123 |
| 200 (turquesa) | `#007176` | 0.137 |

Correr el verde hacia el turquesa **casi quintuplica** la separación, porque un verde con componente azul conserva señal en el eje azul-amarillo, que el protán y el deután tienen intacto. El emerald de Tailwind está justo en el borde.

### 4.3 El límite estructural, medido

Barriendo (matiz del verde, L del verde, matiz del ámbar, L del ámbar, L del rojo) con AA 4.5:1 sobre blanco como restricción, el resultado es tajante:

> **Con fondo blanco y AA 4.5:1 no se puede separar por luminosidad a la vez el rojo del verde/ámbar Y el verde del ámbar.** El techo de L del verde y del ámbar está fijado por AA (≈0.53 y ≈0.55); el rojo puede bajar libremente. Hay lugar para *un* escalón de luminosidad, no para dos.

Forzar el orden rojo < ámbar < verde empuja el ámbar a L 0.48, que es **marrón** — exactamente el defecto de `#92400e` hoy — y hunde la separación bajo daltonismo de 0.134 a 0.074.

Por eso la propuesta gasta el escalón donde está el riesgo legal: **el rojo queda 0.10 de L por debajo de los otros dos, y verde y ámbar se separan por matiz en el eje azul-amarillo.** Verde jade H 174 contra ámbar oro H 68.

### 4.4 Resultado de la propuesta

| par (tinta, modo claro) | normal | protan | deután | tritán | acrom |
|---|---|---|---|---|---|
| `ok` / `bloqueo` | 0.284 | 0.247 | **0.133** | 0.288 | 0.151 |
| `accion` / `bloqueo` | 0.166 | 0.186 | **0.122** | 0.118 | 0.137 |
| `ok` / `accion` | 0.174 | 0.103 | 0.111 | 0.209 | *0.014* |

| par (fondo `-soft`, modo claro) | normal | protan | deután | tritán | acrom |
|---|---|---|---|---|---|
| `ok` / `bloqueo` | 0.069 | 0.055 | **0.032** | 0.081 | 0.036 |
| `accion` / `bloqueo` | 0.031 | 0.031 | 0.026 | 0.026 | 0.024 |

**Par crítico `ok`/`bloqueo`, peor caso sobre los cuatro tipos de visión:**

| | tinta | fondo | relleno sólido |
|---|---|---|---|
| actual (claro) | 0.0389 | 0.0090 | 0.0389 |
| **propuesta (claro)** | **0.1334** | **0.0319** | **0.1334** |
| propuesta (oscuro) | 0.1268 | 0.0122 | 0.0035 |

### 4.5 Lo que la paleta NO resuelve, dicho claro

Tres límites que ningún valor hexadecimal arregla, y que hay que cubrir con forma:

1. **`ok` vs `accion` en acromatopsia: ΔE 0.014.** Verde y ámbar tienen casi la misma luminancia y AA no deja separarlos (§4.3). Es la consecuencia elegida: se sacrificó el par de menor daño ("cumple" vs "falta un papel") para salvar el par que manda gente a una faena.
2. **En modo oscuro, los rellenos sólidos `ok`/`bloqueo` colisionan en acromatopsia (0.0035).** El modo oscuro se usa de noche, cuando nadie pelea contra el reflejo del sol, así que el caso acromático pesa menos ahí. Aun así: en oscuro, los estados van con icono sí o sí.
3. **Nada de esto reemplaza al icono y al texto.** La regla que se deriva de los números: **ningún estado se comunica solo con color, nunca.** Cada chip lleva icono con forma distinta (✕ en círculo para bloqueo, ! en triángulo para acción, ✓ para ok — las mismas formas de NCh 1411) más la etiqueta. El color acelera el barrido visual; la forma es la que garantiza.

---

## 5. Sol directo: ¿sobrevive la paleta?

**No. Ninguna sobrevive, y conviene decirlo con el número antes de prometer nada.**

Modelo: el reflejo ambiental agrega un velo que se suma a los dos lados del contraste. `Lr = R·E/π`, con R = 4,5 % (vidrio de teléfono con tratamiento antirreflejo) y E la iluminancia. Expresado como fracción del blanco de pantalla, `f = Lr / nits`. La fórmula de WCAG ya asume f = 0,05; basta subirlo.

| escenario | f |
|---|---|
| oficina (supuesto de WCAG) | 0.05 |
| sombra en obra, 10 000 lux, 600 nits | 0.24 |
| cielo abierto, 25 000 lux, 600 nits | 0.60 |
| **mediodía despejado, 80 000 lux, 600 nits** | **1.91** |
| mediodía despejado, 80 000 lux, 1 600 nits (flagship) | 0.72 |

A f = 1.91, el contraste efectivo del par `bloqueo-ink`/`bloqueo-soft` es **1.39**. El de negro puro sobre blanco puro es **1.52**. A esa iluminancia no hay diseño posible: la pantalla es un espejo.

Lo que sí se puede hacer es **subir el techo**. Con velo alto el ratio tiende a `1 + ΔY/f`: manda la **diferencia absoluta de luminancia**, no el ratio nominal. Y ahí la paleta actual falla en el orden equivocado:

| familia | ΔY (soft − ink) |
|---|---|
| `bloqueo` | **0.7976** ← el peor |
| `ok` | 0.8053 |
| `excepcion` | 0.8096 |
| `espera` | 0.8199 |
| `proceso` | 0.8442 |
| `accion` | 0.8644 |
| `vacio` | 0.8650 ← el mejor |

El estado más crítico es el menos legible al sol; el vacío es el más legible.

### Y hay una falla peor: el chip no se ve

| | ΔY | ratio | visible hasta |
|---|---|---|---|
| `bloqueo-soft` contra la página blanca (actual) | 0.090 | 1.09 | **0 lux** |
| `bloqueo-soft` contra la página (propuesta) | 0.185 | 1.21 | 0 lux |
| `bloqueo-solid` contra la página (propuesta) | **0.941** | **9.59** | **17 203 lux @3:1** |

Un tinte pastel sobre blanco **nunca** llega a 3:1 contra la página, ni siquiera bajo techo. Al sol el chip desaparece entero, no solo su texto. El relleno sólido oscuro sí sobrevive, porque su ΔY contra la página es casi 1.

### La respuesta: un tercer modo, `faena`

No es un tema de paleta base sino de un override corto (10 tokens neutros + un `-solid` por familia):

- superficies **todas a `#ffffff`** — cualquier gris cuesta ΔY que no sobra;
- texto a `#000000`;
- **los estados dejan de ser tintes y pasan a relleno sólido oscuro con texto blanco e icono**;
- bordes neutros a `#636363` (6.01:1) en vez de 1.35:1.

Rendimiento medido, teléfono de 600 nits:

| | ΔY | ratio | se sostiene 3:1 hasta |
|---|---|---|---|
| texto del chip bloqueo, **actual** | 0.798 | 5.91 | 12 001 lux |
| texto del chip bloqueo, propuesta claro | 0.756 | 7.90 | 13 334 lux |
| blanco sobre chip sólido, propuesta claro | 0.941 | 9.59 | 17 203 lux |
| **blanco sobre chip sólido, modo faena** | **0.960** | **11.65** | **18 424 lux** |
| cuerpo de texto, modo faena | 1.000 | 21.00 | 20 944 lux |

De 12 000 a 18 400 lux es **+53 % de rango útil**, y a 1 200 nits la cifra sube a 36 848 lux. No llega a los 80 000 del mediodía a pleno — nada llega —, pero cubre la sombra de un contenedor, un día nublado y buena parte de la mañana, que es donde realmente se mira el teléfono.

**Lo que la paleta no puede dar y hay que pedirle al producto:** el brillo de pantalla lo fija el sistema operativo, no el CSS. Lo único que vale la pena es que el interruptor de modo faena esté a un toque y que se recuerde por dispositivo.

---

## 6. La propuesta

### 6.1 Estructura

**Se conservan los nombres existentes.** `-soft`, `-line`, `-ink` de familia aparecen 496 veces; renombrarlos convierte una decisión de color en una refactorización. Cambian los valores. Se agregan dos roles y se colapsan dos familias:

| cambio | qué |
|---|---|
| **se conserva** | `-soft` (fondo), `-line` (borde), `-ink` (texto y punto) |
| **se agrega** | `-solid` (relleno sólido) y `-on-solid` (texto encima). Hoy los componentes usan `bg-*-ink` con blanco implícito encima, en **49 lugares**, sin que nadie haya verificado el contraste. Ahora es explícito y medido. |
| **se colapsa** | `espera` + `vacio` → **`neutro`**. Ya eran el mismo hex. Dejar `espera`/`vacio` como alias evita tocar código. |
| **se separa** | `brand` y `proceso` dejan de compartir hex. `proceso` se corre a H 232 (cian) y `brand` se queda en H 252. Un badge "En Análisis" deja de ser idéntico a un enlace en hover. |

Tres reglas que gobiernan los valores y que se pueden auditar con un script:

1. **La luminosidad codifica la distancia al fondo, y esa distancia codifica la urgencia.** En modo claro `bloqueo` es el más oscuro (L 0.411, al menos 0.10 por debajo de los demás); en modo oscuro es el más claro (L 0.855). Es la misma regla vista desde los dos lados.
2. **El croma se ordena con la urgencia.** `bloqueo` 0.168 > `excepcion` 0.149 > `accion` 0.117 > `brand` 0.115 > `proceso` 0.105 > `ok` 0.101 > `neutro` 0.019. El violeta deja de gritar más fuerte que el rojo.
3. **El matiz codifica la categoría**, y sigue la señalética de faena (NCh 1410).

### 6.2 Modo claro — tabla lista para copiar

| token | hex | OKLCH | contraste verificado |
|---|---|---|---|
| `--color-surface` | `#ffffff` | — | — |
| `--color-surface-app` | `#f8fafd` | 0.984 0.005 258 | — |
| `--color-surface-sunken` | `#f1f3f7` | 0.964 0.006 264 | — |
| `--color-surface-inverse` | `#19202d` | 0.243 0.027 262 | — |
| `--color-surface-inverse-hover` | `#272e3d` | 0.301 0.029 265 | — |
| `--color-ink` | `#171f2d` | 0.238 0.030 261 | 16.53 / blanco · Lc 103.5 |
| `--color-ink-secondary` | `#414856` | 0.401 0.025 264 | 9.19 / blanco |
| `--color-ink-muted` | `#5d636e` | 0.498 0.019 263 | 6.04 / blanco · 5.78 / app |
| `--color-ink-subtle` | `#6c717b` | 0.548 0.017 264 | 4.90 / blanco · **4.41 / sunken** ← piso |
| `--color-ink-inverse` | `#f0f2f4` | 0.960 0.003 248 | 14.55 / inverse |
| `--color-ink-inverse-muted` | `#adb1b9` | 0.760 0.012 264 | 7.60 / inverse |
| `--color-line-subtle` | `#ebedf0` | 0.945 0.005 258 | 1.17 (decorativo) |
| `--color-line` | `#dbdee3` | 0.900 0.008 261 | 1.35 (decorativo) |
| `--color-line-strong` | `#c3c7cf` | 0.828 0.012 264 | 1.69 (decorativo) |
| `--color-brand-hover` | `#064883` | 0.400 0.116 252 | 9.28 / blanco |
| `--color-brand-active` | `#003a6c` | 0.346 0.102 252 | 11.53 / blanco |
| `--color-brand-on-dark` | `#8bbcf3` | 0.781 0.095 252 | 8.23 / inverse |
| `--color-brand-mark` | `#a24d21` | 0.520 0.126 45 | 5.80 / blanco — cobre, **solo fuera de la app** |
| `--color-focus` | `#1a71c4` | 0.545 0.150 252 | 5.00 / blanco (anillo ≥3:1) |

**Familias.** Cada fila verifica: `ink`/`soft` ≥ 4.5, `ink`/blanco ≥ 4.5, `ink`/app ≥ 4.5, `line`/blanco ≥ 3.0, `on-solid`/`solid` ≥ 4.5.

| familia | `-soft` | `-line` | `-ink` | `-solid` | `-on-solid` | ink/soft | ink/blanco | Lc | line/blanco | on/solid |
|---|---|---|---|---|---|---|---|---|---|---|
| `bloqueo` | `#ffe3df` | `#f26a5f` | `#90000b` | `#90000b` | `#ffffff` | 7.90 | 9.59 | 76.7 | 3.00 | 9.59 |
| `accion` | `#ffefde` | `#d28300` | `#995e00` | `#ffaf50` | `#2c1a04` | 4.72 | 5.31 | 67.9 | 3.01 | 9.15 |
| `ok` | `#defcf3` | `#28a78c` | `#007e67` | `#007e67` | `#ffffff` | 4.62 | 5.02 | 68.4 | 3.00 | 5.02 |
| `excepcion` | `#f4efff` | `#a97fed` | `#6f47a7` | `#6f47a7` | `#ffffff` | 5.94 | 6.70 | 74.6 | 3.02 | 6.70 |
| `brand` | `#e8f2ff` | `#5598e2` | `#1f5a96` | `#1f5a96` | `#ffffff` | 6.27 | 7.09 | 75.8 | 3.01 | 7.09 |
| `proceso` | `#e2f5ff` | `#379ecd` | `#0b759d` | `#0b759d` | `#ffffff` | 4.63 | 5.19 | 67.4 | 3.03 | 5.19 |
| `neutro` | `#f1f3f7` | `#8f95a2` | `#5d636e` | `#5d636e` | `#ffffff` | 5.44 | 6.04 | 73.0 | 3.00 | 6.04 |

Coordenadas OKLCH: `bloqueo` H 27 · `accion` H 68 · `ok` H 174 · `proceso` H 232 · `brand` H 252 · `neutro` H 264 · `excepcion` H 300.

Nota sobre `accion-solid` `#ffaf50`: es el único relleno claro, con texto oscuro encima (9.15:1). Contra la página blanca mide **1.83**, por debajo de 3:1 — por eso `accion-solid` **debe** ir siempre con `accion-line` (3.01:1) de borde, que es lo que delimita el chip. Es además lo que pide NCh 1410: *"el amarillo se combina con negro"*.

### 6.3 Modo oscuro

| token | hex |
|---|---|
| `--color-surface` | `#1d2026` |
| `--color-surface-app` | `#13151a` |
| `--color-surface-sunken` | `#0c0e12` |
| `--color-ink` | `#eceef0` (14.03 / surface) |
| `--color-ink-secondary` | `#c8cbd0` (10.03) |
| `--color-ink-muted` | `#a5a9b1` (6.92) |
| `--color-ink-subtle` | `#8b9099` (5.09) |
| `--color-line-subtle` / `line` / `line-strong` | `#2b2e34` / `#393d45` / `#51555e` |
| `--color-brand-hover` / `-active` / `-on-dark` | `#92c5ff` / `#b0d5ff` / `#8bbcf3` |
| `--color-brand-mark` / `--color-focus` | `#dc855d` / `#6eb2fe` |

| familia | `-soft` | `-line` | `-ink` | `-solid` | `-on-solid` | ink/soft | ink/surface | line/surface | on/solid |
|---|---|---|---|---|---|---|---|---|---|
| `bloqueo` | `#481a16` | `#bb4039` | `#ffbcb4` | `#cc3430` | `#ffffff` | 9.13 | 10.18 | 3.03 | 5.12 |
| `accion` | `#3e2403` | `#985d00` | `#ef9d32` | `#ffa838` | `#281602` | 6.54 | 7.41 | 3.03 | 9.05 |
| `ok` | `#043329` | `#007862` | `#00a98b` | `#007e67` | `#ffffff` | 4.67 | 5.48 | 3.00 | 5.02 |
| `excepcion` | `#302344` | `#7f55bb` | `#bc99fa` | `#8455c6` | `#ffffff` | 6.26 | 7.05 | 3.05 | 5.13 |
| `brand` | `#142c46` | `#276cb2` | `#79b2f1` | `#2a72bc` | `#ffffff` | 6.39 | 7.34 | 3.01 | 4.96 |
| `proceso` | `#062f41` | `#00729b` | `#77c9f3` | `#0077a1` | `#ffffff` | 7.67 | 8.88 | 3.02 | 5.06 |
| `neutro` | `#282b31` | `#646a76` | `#a5a9b1` | `#6b707b` | `#ffffff` | 6.02 | 6.92 | 3.00 | 4.97 |

Los fondos van a L 0.196–0.243, no a negro puro: en OLED el negro absoluto produce *smearing* al hacer scroll, y con texto muy brillante encima genera halación para quien tiene astigmatismo.

### 6.4 Modo faena — solo overrides

| token | hex |
|---|---|
| `surface`, `surface-app`, `surface-sunken` | `#ffffff` |
| `ink`, `ink-secondary` | `#000000` |
| `ink-muted`, `ink-subtle` | `#3d3d3d` (10.86) |
| `line-subtle` / `line` / `line-strong` | `#868686` / `#636363` / `#2e2e2e` |
| `focus` | `#000000` |

Los estados pierden el tinte: `-soft` pasa a `#ffffff` y `-ink` = `-line` = `-solid` al mismo sólido oscuro, con `-on-solid` blanco.

| familia | sólido | blanco encima | chip vs página | ΔY |
|---|---|---|---|---|
| `bloqueo` | `#780008` | 11.65 | 11.65 | 0.960 |
| `excepcion` | `#5f3298` | 8.76 | 8.76 | 0.930 |
| `brand` | `#004885` | 9.27 | 9.27 | 0.937 |
| `neutro` | `#434852` | 9.18 | 9.18 | 0.936 |
| `accion` | `#804e00` | 6.98 | 6.98 | 0.900 |
| `proceso` | `#006387` | 6.70 | 6.70 | 0.893 |
| `ok` | `#006e5a` | 6.22 | 6.22 | 0.881 |

Separación bajo daltonismo de estos sólidos (peor de los cuatro tipos): `ok`/`bloqueo` **0.129**, `accion`/`bloqueo` **0.105**, `ok`/`accion` 0.029. El último es el límite de §4.5 otra vez: al sol, "cumple" y "falta un papel" se distinguen por el icono, no por el color.

### 6.5 El CSS

El bloque completo, ya generado y verificado, está en `out.txt` (sección 6) — se copia tal cual. El esqueleto:

```css
@theme { /* modo claro: valores de §6.2 */ }

@media (prefers-color-scheme: dark) {
  :root:not([data-tema="claro"]) { /* §6.3 */ }
}
:root[data-tema="oscuro"] { /* §6.3 */ }
:root[data-tema="faena"]  { /* §6.4 */ }
```

Un detalle de Tailwind v4: los `@theme` no se re-declaran por selector. Los modos se implementan redefiniendo las mismas `--color-*` en `:root[data-tema=…]`, y `@theme inline` las referencia — que es el patrón que el archivo ya usa para `--acr-micro-size`.

---

## 7. Una línea por familia

| familia | matiz | qué comunica | por qué ese tono y no otro |
|---|---|---|---|
| **`bloqueo`** `#90000b` | rojo H 27 | Incumplimiento vigente: **esta persona no entra hoy**. | Rojo porque es el color de prohibición de NCh 1410 y lo leen todos los días en la faena; a `oklch(0.411 0.168 27)` cae en la familia del rojo de seguridad RAL 3001 (`0.470 0.170 29`), no del rojo web brillante. Va **0.10 de luminosidad por debajo de todos los demás**: ese escalón es lo único que sobrevive al daltonismo, al monocromo y al sol, y por eso se gastó acá y no en otro par. |
| **`accion`** `#995e00` | ámbar-oro H 68 | Falta algo tuyo, **todavía no bloquea**. Tu pila de trabajo. | Ámbar porque es advertencia en NCh 1410. Corrido de H 46 a H 68: el `amber-800` actual (`#92400e`) es literalmente marrón y colisiona con el rojo para protanes (ΔE 0.023). A H 68 la separación sube a 0.186. Su sólido es el único claro con texto oscuro, que es lo que la norma pide para el amarillo. |
| **`ok`** `#007e67` | verde jade H 174 | Cumple. **No hay nada que hacer.** | Verde porque es condición segura en NCh 1410, pero corrido del `emerald` H 166 a jade H 174: un verde con componente azul conserva señal en el eje azul-amarillo, que protanes y deuteranes tienen intacto, y eso sube la separación con el rojo de 0.084 a 0.133. Croma bajo (0.101, el más bajo de los estados) porque "cumple" no debe competir por atención. |
| **`excepcion`** `#6f47a7` | violeta H 300 | Decisión discrecional del mandante. **No depende de ti.** | Violeta porque es el matiz que queda libre en un vocabulario rojo/ámbar/verde y no está en la señalética de faena, así que no arrastra significado equivocado. Croma bajado de **0.241 a 0.149**: hoy es el color más saturado de la app para el estado menos urgente. Ahora queda por debajo del rojo, que es donde corresponde. |
| **`brand`** `#1f5a96` | azul acero H 252 | Interacción e identidad. Cliqueable. | Se conserva el matiz del `#245b93` original: desaturado, "infraestructura" y no "plantilla", y es el único valor propio que ya tenía la paleta. Azul es acción obligatoria en NCh 1410, que es una lectura razonable para "acá se hace clic". Solo se recolocó en la escalera de luminosidad. |
| **`proceso`** `#0b759d` | cian H 232 | El sistema está trabajando. Nadie tiene que hacer nada todavía. | Se separa del azul de marca (20° de matiz) para romper la colisión actual, donde `proceso-ink` **es** `brand-hover` y un badge "En Análisis" es idéntico a un enlace en hover. Cian y no otro matiz porque es lo más cercano al azul que no se confunde con "cliqueable", y queda lejos del verde de `ok` en el eje que importa. |
| **`neutro`** `#5d636e` | gris H 264 | Esperando, archivado, vacío. **Nadie debe actuar.** | Fusiona `espera` y `vacio`, que ya compartían hex. Croma 0.019 — casi acromático, con una traza fría que lo separa del beige de `accion`. Su función es no ser color: cuanto más gris, más fuerte contrasta el resto. Se corre del `slate` de Tailwind (H 248–257, chroma hasta 0.037) a un gris más neutro, que es la mitad de por qué la app dejará de verse como una plantilla. |

---

## 8. Riesgos y qué no hice

- **No toqué código.** `globals.css` está intacto.
- **Las simulaciones de daltonismo son modelos**, no personas. Machado 2009 a severidad 1.0 representa dicromacia completa; las anomalías parciales (protanomalía, deuteranomalía) son más frecuentes y más leves. La propuesta se optimizó contra el caso severo, así que el caso leve queda cubierto por construcción — pero conviene validarlo con un prevencionista daltónico real antes de dar el tema por cerrado.
- **El modelo de sol asume 4,5 % de reflectancia y brillo constante.** Un teléfono con la pantalla rayada o sin tratamiento antirreflejo puede estar en 8–10 %, lo que duplica el velo. Las cifras de lux son el techo optimista.
- **La coordenada nominal de OKLCH y el hex publicado difieren donde hubo recorte de gamut.** Manda el hex; la coordenada es documentación.
- **APCA sigue siendo borrador de WCAG 3.** Lo reporté como segunda opinión (las tintas quedan entre Lc 65 y 79, o sea entre el paso 11 y el 12 de Radix), pero el criterio de aceptación de esta propuesta es WCAG 2.x AA, que es lo exigible hoy.
- **Falta ver los valores en pantalla.** Todo esto es aritmética; la validación final es abrir la app bajo el sol de Santiago con un teléfono de gama media.
