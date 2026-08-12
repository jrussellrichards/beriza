# Acredita — Stack de front-end para verse actual en 2026

Fecha de trabajo: 2026-08-11. Investigación y recomendación — **no se modificó código**.

**Resumen en una línea:** el stack actual es correcto y no hay que cambiarlo; lo que hay que hacer es **usar lo que ya está pagado** (Tailwind v4, React 19, Next 16) y **cerrar tres agujeros de accesibilidad** que ninguna librería nueva arregla. Los cinco movimientos recomendados suman **+0 KB de bundle y −2 dependencias**.

---

## 0. De dónde se parte (medido, no supuesto)

`frontend/package.json` — 14 dependencias de runtime, ninguna gorda:

| Paquete | Versión | Nota |
|---|---|---|
| next | 16.2.9 | App Router, route groups |
| react / react-dom | 19.2.4 | |
| tailwindcss | ^4 (+ `@tailwindcss/postcss`) | tokens `@theme` en `globals.css` |
| @radix-ui/react-* | dialog, alert-dialog, label, select, separator, slot | **6 primitivas, nada más** |
| lucide-react | ^1.22.0 | |
| sonner | ^2.0.7 | toasts |
| next-themes | ^0.4.6 | instalado, **sin dark mode implementado** |
| class-variance-authority + clsx + tailwind-merge | | |
| tailwindcss-animate | ^1.0.7 | **plugin de v3; no está importado en `globals.css`** |

Lo importante: **no hay deuda de librerías**. No hay Framer Motion, no hay TanStack, no hay date-fns, no hay react-hook-form. Cualquier cosa que se agregue es peso nuevo, y cualquier cosa que se reemplace se reemplaza barato.

### Lo que el código YA hace bien (no tocar)

- `globals.css` es un sistema de diseño real: tokens semánticos por *rol* (`--color-accion-*`, `--color-bloqueo-*`), no por matiz, con el contraste medido y anotado en el comentario de cada token.
- `estado-badge.tsx` usa **doble canal** (color + glifo) para los dos estados críticos, justificado por daltonismo rojo-verde en una base de usuarios masculina de terreno. Esto es mejor que lo que hace el 95% del SaaS.
- `min-height: 44px` bajo `@media (pointer: coarse)` y no bajo breakpoint de ancho. Correcto: manda el dedo, no la pantalla.
- `:focus-visible` global, `font-size: 16px` en inputs bajo `md` para que iOS no haga zoom, `slashed-zero` en mono.
- Sin `antialiased`, argumentado: más masa de texto para leer al sol.

### Lo que falta y se ve en el grep (hallazgos duros)

1. **Cero `prefers-reduced-motion` en todo el repo.** `grep -rn "reduced-motion\|motion-safe\|motion-reduce" src/` → 0 resultados. Y hay un `animate-pulse` **permanente** en el badge `EN_ANALISIS` (`estado-badge.tsx`, `pulse: true`). Una animación infinita sin escape es exactamente el caso que WCAG 2.2.2 (Pause, Stop, Hide) tiene en la mira.
2. **Cero container queries** (`@container`) pese a estar en Tailwind v4 de fábrica. El producto tiene un slide-over de `w-96` sobre contenido — el caso canónico de container query.
3. **Cero `@starting-style`, cero View Transitions, cero Popover API, cero `color-mix()`, cero anchor positioning.**
4. La animación existente es 90% `transition-colors` (bien) + `duration-300` en chevrons de acordeón (largo para un producto denso; 150–200 ms es lo correcto).
5. `tailwindcss-animate` está en `package.json` pero **nunca se carga**. Verificado: no existe `tailwind.config.*`, `postcss.config.mjs` solo tiene `@tailwindcss/postcss`, y `grep -rn "@plugin|@config|@source" src/` da cero. En Tailwind v4 los plugins se cargan con `@plugin "…"` desde el CSS, y esa línea no está. Por lo tanto las clases `animate-in`, `animate-out`, `fade-in-0`, `zoom-in-95`, `slide-in-from-top-[48%]` de `dialog.tsx` y `alert-dialog.tsx` **no generan CSS**: los diálogos aparecen de golpe. Es dependencia muerta *y* animación rota a la vez.
6. `next-themes` instalado sin dark mode. Dependencia muerta hasta que se decida.
7. `shared/ui/table.tsx` es el shadcn stock: `h-12` en header y `p-4` en celda. Para un producto denso donde un mandante revisa 40 documentos seguidos, eso es el doble de alto de lo necesario.

---

---

## 1. CSS: ¿Tailwind v4 es la elección correcta?

**Sí, y no está cerca.** La pregunta interesante no es si cambiar de framework sino cuánto de v4 se está desperdiciando.

### Por qué no moverse a otra cosa

| Alternativa | Qué ofrece | Por qué no acá |
|---|---|---|
| **UnoCSS** | ~8 KB gzip de salida, motor atómico más rápido; `preset-icons` con 200k+ iconos de Iconify sin dependencia JS | Tailwind v4 ya reescribió el motor en Rust (Oxide): builds 3-5x más rápidos que v3, bajo 500 ms en proyectos medianos. La ventaja de UnoCSS se evaporó. Su único diferencial real hoy es el preset de iconos, y eso se resuelve con un sprite SVG propio. Migrar = reescribir todo `globals.css`. |
| **Panda CSS / vanilla-extract / StyleX** | CSS-in-JS de tiempo de build, cero runtime, tokens tipados, compatible con RSC | Es la elección correcta para *design systems* que se publican como paquete y necesitan garantizar cobertura de dark mode en cientos de componentes. Acredita tiene 74 archivos y un solo consumidor. El tipado de tokens que Panda vende ya lo da acá el `Record<EstadoDoc, Estilo>` de `estado-badge.tsx`, que rompe el build si el backend agrega un estado. |
| **CSS Modules puro** | Cero dependencias | Perdés el sistema de tokens `@theme`, las variantes de estado (`data-[state=...]`), y el ecosistema de shadcn. |

Consenso 2026 según [PkgPulse (2026)](https://www.pkgpulse.com/guides/tailwind-v4-vs-unocss-vs-pandacss-2026): *"Most projects: Tailwind v4 — largest ecosystem, best component library support, CSS-first config"*. Panda gana solo cuando hay que garantizar dark mode en una librería grande.

**Veredicto: quedarse. Costo de migrar: alto. Ganancia: cero.**

### Lo que v4 ya trae y acá no se usa

Tailwind v4 se construyó sobre cascade layers, `@property`, `color-mix()`, `oklch()`, container queries y `@starting-style` ([Tailwind CSS v4.0, tailwindcss.com](https://tailwindcss.com/blog/tailwindcss-v4)). Ninguno aparece en el repo.

#### a) Container queries — la de mayor retorno acá

`@container` convierte cualquier elemento en contenedor de consulta, y los descendientes responden con `@sm:*`, `@md:*`. Hay contenedores nombrados: `@container/panel` + `@lg/panel:*`.

**Por qué importa en Acredita, concretamente:** el slide-over de `w-96` aparece en 7 páginas (`(mandante)/contratistas`, `requisitos`, `servicios`, `(admin)/catalogo`, `mandantes`, `usuarios`, `(contratista)/servicios`). Hoy el contenido de ese panel usa breakpoints de *viewport*, así que en un escritorio ancho el panel de 384 px recibe estilos de "pantalla grande" y se rompe. Con `@container` el panel se estiliza según **su propio ancho**, que es lo que corresponde. Lo mismo para las tarjetas de pilar (`entities/contratista/pilar-card.tsx`), que viven a veces en grilla de 3 y a veces a ancho completo.

- Costo de bundle: **0 bytes**. Es CSS.
- Costo de migración: bajo, incremental, componente por componente.
- Riesgo: nulo, soporte universal.

#### b) `color-mix()` — para el estado hover/pressed sin inventar tokens

Hoy cada estado necesitaría 3 tokens (`soft`, `line`, `ink`) más variantes hover. `color-mix(in oklab, var(--color-bloqueo-ink) 8%, white)` deriva el fondo del mismo matiz en vez de fijarlo a mano. **Cuidado:** el comentario de `globals.css` dice explícitamente que los valores van en hex literal para no depender de la paleta de Tailwind, porque v4 puede ajustar sus OKLCH en un minor. Ese razonamiento **sigue siendo válido y no lo contradigo**: `color-mix()` acá debe mezclar *tokens propios*, nunca `--color-red-500` de Tailwind. Mezclando tokens propios el riesgo desaparece y se gana consistencia.

#### c) OKLCH — sí para *derivar*, no para *reemplazar*

La paleta actual está en hex con el contraste medido y anotado token por token. Reescribirla a OKLCH no mejora nada visible y **arriesga romper mediciones de contraste que hoy están justificadas por escrito** (el comentario de `--color-accion-ink` cuenta que el valor anterior pasaba AA por 4.84 y se subió a 6.84). Lo correcto: mantener los valores medidos, y usar OKLCH solo donde se generen tonos nuevos (hover, focus ring, franjas de tabla), porque su uniformidad perceptual hace que un `+10% lightness` se vea igual de fuerte en ámbar que en azul. Soporte OKLCH >96% global a comienzos de 2026.

#### d) `@starting-style` — animación de entrada sin JS

Permite transiciones de entrada y salida sin JavaScript, incluso para elementos que entran desde `display:none`. Es el reemplazo directo de `tailwindcss-animate` (que en este repo está instalado pero **no importado**, o sea: los `animate-in`/`animate-out` de `dialog.tsx` y `alert-dialog.tsx` no están haciendo nada).

- Costo de bundle: **0**. Y **elimina** una dependencia.

---

## 2. APIs nativas que ya maduraron (y qué dependencia borran)

Datos de soporte a agosto de 2026:

| API | Estado | Fuente |
|---|---|---|
| **Popover API** | Estable en los 4 motores; spec finalizada. Chrome/Edge desde 2023, Safari 17.4, Firefox 125. ~88% global | [MDN Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API), [Smashing (mar-2026)](https://www.smashingmagazine.com/2026/03/getting-started-popover-api/) |
| **CSS Anchor Positioning** | **Baseline 2026.** Chrome 125+, Safari 26 (18.2+ parcial), **Firefox 147 (13-ene-2026)**. ~91% | [OddBird (oct-2025)](https://www.oddbird.net/2025/10/13/anchor-position-area-update/), [MDN position-anchor](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position-anchor) |
| **View Transitions — mismo documento** | **Baseline newly available.** Chrome 111+, Safari 18+, **Firefox 144**. 90.2% global | [caniuse](https://caniuse.com/view-transitions), [web.dev](https://web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available) |
| **View Transitions — cross-document (MPA)** | **NO baseline.** Chrome y Safari 18.2+ sí; **Firefox todavía no** | [CSS-Tricks](https://css-tricks.com/cross-document-view-transitions-part-1/) |
| **Scroll-driven animations** | **NO baseline.** Chrome 115+ (jul-2023), Safari 26 (sep-2025). **Firefox 152 (jun-2026) sigue detrás de flag** (`layout.css.scroll-driven-animations.enabled`); es prioridad Interop 2026. ~84% | [MDN animation-timeline](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-timeline) |

### Qué hacer con cada una en Acredita

**Popover API + anchor positioning → sí, y borran Floating UI antes de que entre.**
El producto todavía no tiene tooltips, menús contextuales ni dropdowns de filtro, pero un dashboard denso los va a necesitar. La ruta vieja era instalar `@floating-ui/react` (~10-15 KB) o `@radix-ui/react-popover` + `react-tooltip`. Hoy `popover="auto"` + `position-anchor` + `position-area` da: capa superior sin `z-index` de guerra, cierre con Esc, *light dismiss* al hacer click fuera, y manejo de Tab — todo gratis y con semántica que la tecnología asistiva reconoce.
- **Costo: 0 KB.** **Ganancia: se evita una dependencia futura entera.**
- **Riesgo:** `@position-try` (el volteo automático cuando no cabe) necesita Safari 18.4+. Mitigación: `@supports` + fallback a posición fija. El modo de falla es "el tooltip queda abajo en vez de arriba", no "la app se rompe".

**View Transitions mismo-documento → sí, con una regla estricta.**
El caso de uso legítimo acá es **uno solo**: cuando el mandante abre el slide-over de detalle desde una fila de tabla, que la fila y el panel compartan `view-transition-name` para que se lea "esta fila se expandió", no "apareció una capa". Eso reduce carga cognitiva real en alguien que revisa 40 documentos seguidos. Para transiciones de página completa: **no**, es el camino directo a que se sienta lento.
- **Costo: 0 KB.** Firefox 144+ lo tiene; abajo de eso el cambio es instantáneo, que es un fallback aceptable.

**Scroll-driven animations → NO por ahora.**
Firefox estable sigue con la flag apagada a junio de 2026. Y más importante: el caso de uso (barras de progreso de scroll, reveals) es decorativo. En un producto donde el usuario está buscando qué documento le falta, animar al scrollear es ruido. Volver a mirarlo cuando Firefox la habilite, y aun así probablemente no usarla.

**Otras que sí valen y cuestan 0:**
- `field-sizing: content` en textareas de observación de brechas — el campo crece con el texto sin `useState` ni medición.
- `text-wrap: balance` en títulos de card y `text-wrap: pretty` en los mensajes de brecha — elimina la palabra huérfana en la última línea. Un mensaje de brecha mal cortado se lee peor bajo sol.
- `:has()` — permite estilar la fila completa según el estado del badge que contiene, sin pasar props de estado hacia arriba.
- `content-visibility: auto` en filas de tabla fuera de pantalla — mejora el scroll en listas largas sin virtualización.

---

## 3. Componentes: ¿sigue siendo Shadcn/Radix?

### El hecho que cambia la respuesta

**Base UI llegó a v1.0 estable el 11-dic-2025.** La construyeron los creadores de Radix, Floating UI y Material UI; hoy va en 1.6.0 con 6M+ descargas semanales ([npm @base-ui/react](https://www.npmjs.com/package/@base-ui/react), [greatfrontend, 2026](https://www.greatfrontend.com/blog/top-headless-ui-libraries-for-react-in-2026)).

Y en **julio de 2026 shadcn/ui hizo de Base UI el default para proyectos nuevos** ([changelog oficial](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)). Cito textual del changelog: *"Radix is not being deprecated"* y *"You do not need to migrate."* Radix se sigue eligiendo con `shadcn init -b radix`, y todo componente nuevo sale para ambas librerías salvo que solo exista en Base UI.

El contexto de fondo: el desarrollo de Radix se desaceleró tras la adquisición de Modulz por WorkOS; varios de los ingenieros originales se fueron a MUI a empezar Base UI con hoja limpia. **Base UI es hoy la capa de primitivas con mantenimiento más activo.**

### Qué significa para Acredita

Acá se usan **6 primitivas de Radix**: dialog, alert-dialog, label, select, separator, slot. Eso es casi nada. Y de esas, tres son triviales:

- `separator` → un `<hr>` con `role="separator"`. Cero razón para una dependencia.
- `label` → `<label htmlFor>`. Cero razón.
- `slot` → útil, pero es un patrón de ~30 líneas.
- `dialog` / `alert-dialog` → **hoy se pueden hacer con `<dialog>` nativo**, que trae foco atrapado, Esc, backdrop e inerte del resto de la página sin JS. La `::backdrop` se anima con `@starting-style`.
- `select` → **la única que vale de verdad.** Un select accesible con teclado, typeahead, colisión y virtualización es difícil. Esta se queda.

**Recomendación: no migrar a Base UI por ahora, y a la vez reducir Radix de 6 a 1-2 paquetes.** Migrar tiene el costo de tocar 74 archivos para ganar mantenimiento que hoy no se necesita (dialog y select de Radix no tienen bugs abiertos que afecten a este producto). Pero **sí** conviene: si mañana hace falta un combobox, un popover o un menú, tomarlo de Base UI y no de Radix, porque ahí está el mantenimiento. Los dos conviven sin problema en el mismo proyecto.

### Tablas densas — acá está el hueco real

`shared/ui/table.tsx` es el shadcn stock sin tocar: `h-12` en header, `p-4` en celda, `text-sm` fijo. Para el caso de uso (un mandante revisando 40 documentos, un contratista viendo su nómina completa) eso es un desperdicio de pantalla enorme y contradice el propio CLAUDE.md, que pide densidad estilo Linear.

Opciones para tabla con orden, filtro y agrupación:

| Opción | Peso | Veredicto |
|---|---|---|
| **@tanstack/react-table** | ~15 KB gzip | Headless: da la lógica (sort, filter, paginación, agrupación), la UI la ponés vos — así el badge de doble canal y los tokens propios se conservan intactos. Es la combinación más usada en React en 2026 junto a shadcn. |
| **@tanstack/react-virtual** | ~4 KB gzip | Solo si alguna lista supera ~500 filas. Antes de eso, `content-visibility: auto` alcanza y cuesta 0. |
| **AG Grid** | **330 KB gzip** (`ag-grid-community`) | **No.** 22x el peso de TanStack, estética propia que pelearía con el sistema de diseño, y licencia enterprise para lo bueno. |
| **MUI Data Grid / Mantine Table** | — | **No.** Arrastran un framework de UI entero, justo lo que CLAUDE.md prohíbe ("no usar Tremor ni MUI"). |

**Costo real de TanStack Table: ~15 KB gzip.** Se justifica solo cuando aparezca la primera tabla que necesite ordenar por columna. Hoy, si las tablas son estáticas, **el arreglo de mayor retorno es puramente CSS**: bajar `h-12`→`h-8`, `p-4`→`px-3 py-1.5`, y agregar `font-variant-numeric: tabular-nums` en columnas de fecha y RUT. Eso son ~15 filas visibles más por pantalla, a costo cero de bundle.

---

### Hallazgo grave encontrado en el camino: los slide-over no son accesibles

Los paneles laterales de las 7 páginas son `<div className="fixed right-0 top-0 h-full w-full sm:w-96 ... transition-transform duration-300">`. Grep de `Escape|keydown|aria-modal|role="dialog"|inert|focus()` en esas páginas: **cero resultados**.

Es decir: el panel no atrapa el foco, no cierra con Esc, no se anuncia como diálogo, y el contenido de atrás sigue siendo tabulable por debajo del panel. Para un usuario de teclado —el mandante que revisa 40 documentos seguidos, según el propio comentario de `globals.css`— eso significa que al abrir el detalle el foco se queda en la tabla de atrás y Tab lo pasea por debajo de una capa que no ve.

**Esto no se arregla con una librería nueva: se arregla con `<dialog>` nativo.** `showModal()` da foco atrapado, Esc, `::backdrop` e inerte del resto de la página, todo del navegador. Un `<dialog>` posicionado a la derecha con `margin-inline-start: auto; height: 100%` es exactamente el slide-over que ya existe, pero accesible. Costo: 0 KB, y es el arreglo de mayor impacto real del documento.

---

## 4. Animación y movimiento

### El estado actual, medido

- 90% de la animación del repo es `transition-colors` en hovers. Eso está bien y no se toca.
- Chevrons de acordeón y paneles con `duration-300`. Demasiado lento para un producto denso; 150–200 ms es el rango correcto para cambios de estado de UI.
- `dialog.tsx` y `alert-dialog.tsx` usan clases `animate-in`, `fade-in-0`, `zoom-in-95`, `slide-in-from-top-[48%]`, que vienen de `tailwindcss-animate` — **un plugin de Tailwind v3 que no está importado en `globals.css`**. En v4 los plugins se cargan con `@plugin`. Como no está, esas clases no generan CSS: los diálogos aparecen de golpe y la dependencia está en `package.json` sin hacer nada.
- **Un `animate-pulse` infinito** en el badge `EN_ANALISIS` (`estado-badge.tsx`, `pulse: true`), sin ningún escape.

### ¿Hace falta una librería de animación? No.

Los números de Motion (ex Framer Motion), de su [propia documentación](https://motion.dev/docs/react-reduce-bundle-size):

| Configuración | Peso |
|---|---|
| Componente `motion` completo, sin optimizar | **34 kB** |
| `m` + `LazyMotion` (render inicial) | just under **4.6 kB** |
| `useAnimate` mini | 2.3 kB |
| `useAnimate` híbrido | 17 kB |
| feature pack `domAnimation` | +15 kB |
| feature pack `domMax` | +25 kB |

O sea: la versión "liviana" son 4.6 kB iniciales **más 15 kB en cuanto querés que anime algo de verdad**. Y esas cifras son con Rollup; la propia doc advierte que Webpack tree-shakea peor.

Lo único que Motion hace y CSS no puede es la **animación de layout** (`layout` prop): cuando un filtro saca elementos de una lista y los que quedan se reacomodan suavemente ([LogRocket, 2026](https://blog.logrocket.com/best-react-animation-libraries/)). Ese es su diferencial real.

**Y ese caso, acá, no lo quiero animar.** Cuando un contratista filtra por "Observado" y la lista se reduce de 40 a 6, lo que necesita es ver los 6 **ya**. Un reflow animado de 300 ms es tiempo en el que la información está en tránsito y no se puede leer. En un producto donde el usuario está contando cuántos documentos le faltan, la instantaneidad es la característica.

**Recomendación: cero librerías de animación. El presupuesto de animación de este producto es CSS.**

Lo que se usa en su lugar, todo a 0 KB:

1. **`@starting-style` (variante `starting:` en Tailwind v4) + `transition-discrete`** para entradas/salidas de diálogos, panel lateral y popovers. `transition-discrete` retrasa el flip de `display`/`hidden` hasta que termina la animación, que es justo lo que `tailwindcss-animate` intentaba resolver con JS. → **Reemplaza y elimina `tailwindcss-animate`.**
2. **React `<ViewTransition>`** (importado de `react`, no de una librería). Según la [guía oficial de Next.js (docs v16.3, actualizado 2026-08-07)](https://nextjs.org/docs/app/guides/view-transitions): *"View transitions work in the App Router with no configuration."* No hace falta flag ni instalar `react@canary`. El patrón útil acá es el **shared element morph**: la fila de la tabla y el panel de detalle con el mismo `name`, para que se lea "esta fila se expandió". La misma doc advierte que sin soporte del navegador *"your application works normally; the transitions do not animate"* — degradación limpia.
3. **`transition-colors` / `transition-transform`** para lo demás, con duraciones bajadas de 300 ms a 150–200 ms.

Dos detalles de la doc de Next que valen oro en un producto denso:

```css
/* La capa de view-transition captura los clicks mientras corre.
   Sin esto, un click durante la transición se pierde. */
::view-transition { pointer-events: none; }
```

Y la advertencia explícita: *"keep transitions short and avoid naming elements the user clicks rapidly"* — que en Acredita significa: nunca poner `view-transition-name` en una fila de una tabla que el revisor recorre a toda velocidad.

### `prefers-reduced-motion`: el agujero más grande del front-end actual

Cero ocurrencias en todo el repo. Dos problemas concretos, con norma:

**a) WCAG 2.2.2 (Pause, Stop, Hide) — nivel A.** El `animate-pulse` del badge `EN_ANALISIS` es una animación **infinita** sin control para detenerla. El movimiento puede provocar mareo, náusea y desorientación en personas con disfunción vestibular ([web.dev, Animation and motion](https://web.dev/learn/accessibility/motion)). Además, este badge puede estar en 40 filas simultáneas durante la carga masiva de una nómina: 40 puntos latiendo en pantalla.

**b) WCAG 2.3.3 (Animation from Interactions) — nivel AAA.** Toda animación disparada por interacción debe poder desactivarse salvo que sea esencial. WCAG ofrece tres caminos y el más barato es respetar la media query del sistema operativo.

Receta mínima para `globals.css` (0 KB, ~12 líneas):

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  /* View transitions se apagan por separado: no las alcanza el selector universal */
  ::view-transition-old(*), ::view-transition-new(*), ::view-transition-group(*) {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
  }
}
```

**Nota fina sobre el `pulse` azul.** El comentario de `estado-badge.tsx` argumenta que *"el azul solo se permite como estado si está en movimiento: significa 'el sistema está trabajando'. Un badge azul quieto es un bug."* El razonamiento es bueno, pero acopla **significado** a **movimiento**, y con `prefers-reduced-motion: reduce` el movimiento desaparece y el significado se cae. La forma correcta de mantener la intención sin romper accesibilidad: bajo reduced-motion el badge conserva su distinción por otra vía (el glifo, o el texto "En análisis", que ya está siempre presente). O sea: el movimiento debe ser **refuerzo**, nunca el único portador. Es el mismo principio de doble canal que el archivo ya aplica bien para el daltonismo — solo falta extenderlo al eje de movimiento.

---

## 5. Tipografía: respuesta al argumento de IBM Plex

El argumento escrito en `layout.tsx` es de los mejores del repo. Lo evalúo pieza por pieza.

**"No Inter porque es *la* fuente del SaaS genérico" → el argumento se fortaleció.**
Las revisiones de 2026 confirman el diagnóstico en vez de refutarlo: Inter sigue siendo *"the #1 UI typeface of 2026"*, usada por Linear, Vercel y Figma ([MadeGood Designs, 2026](https://madegooddesigns.com/inter-font/)). Justamente eso: elegirla hoy es elegir parecerse a todos. **Se mantiene.**

**"No Geist porque hace que el producto se lea como un template de deploy" → se mantiene, y con un matiz más.**
Los roundups de 2026 describen Geist como fuente *"tuned for density... a natural fit for dashboards, developer tools"* ([MadeGood Designs, 2026](https://madegooddesigns.com/best-sans-serif-fonts/)). El punto que agregaría: no es solo marca de Vercel, es que está afinada para **desarrolladores**. El usuario de Acredita es un prevencionista con casco, no alguien que lee logs. **Se mantiene.**

**"Plex por herencia industrial-técnica" → se mantiene.**
Los mismos roundups de 2026 la describen como *"a perfect blend of 'machine' and 'human'"*. Es exactamente el registro que pide minería y construcción.

### Lo que sí hay que actualizar: la implementación, no la elección

`IBM_Plex_Sans({ weight: ["400", "500", "600"] })` carga **tres instancias estáticas**. IBM viene publicando versiones variables de la familia Plex — Plex Mono Variable v1.0 el **21-abr-2026**, Plex Serif Variable el **16-dic-2025**, con eje de peso de 100 a 700 ([IBM/plex releases](https://github.com/IBM/plex/releases)).

Si la variable de **Plex Sans** ya está servida por Google Fonts, quitar el array `weight` entrega el rango 100–700 completo en un archivo en vez de tres, y habilita pesos intermedios (un 550 para headers de tabla, por ejemplo).

**Advertencia honesta: no pude confirmarlo.** El fetch de la ficha de Google Fonts no devolvió los ejes, y existe un issue histórico en `google/fonts` (#2407) pidiendo *"IBM Plex Sans Var Roman/Italic"*, lo que sugiere que la variable pudo no estar servida ahí durante mucho tiempo. **Hay que verificarlo antes de tocar nada.** Si Google Fonts no la sirve como variable, la alternativa es auto-hospedarla vía Fontsource, que sí publica builds variables — a costa de perder la optimización automática de `next/font/google`.

Esto es un ajuste de bytes, no un cambio de identidad. Prioridad baja.

### El hueco tipográfico real: `tabular-nums` casi no se usa

El comentario del token dice *"`--text-metric` … KPI, **siempre** con tabular-nums"*, pero eso es un comentario, no una regla: el token no lo aplica. `grep -rn "tabular"` devuelve **5 usos en todo el repo** (`revision/page.tsx`, `badges-mandante.tsx`, `ratio.tsx`). Todas las columnas de fecha de vencimiento, RUT, montos de deuda y contadores de documentos están renderizando con cifras proporcionales, así que los dígitos no se alinean verticalmente entre filas.

En una tabla de vencimientos eso destruye la capacidad de escanear la columna de un golpe, que es literalmente para lo que existe la pantalla. **Arreglo: agregar `font-variant-numeric: tabular-nums` dentro del propio token `--text-metric` y a las celdas numéricas de `table.tsx`.** Costo: 0 KB, dos líneas. La fuente ya trae las cifras tabulares — solo no se están pidiendo.

---

## 6. Qué NO adoptar (y por qué)

| No adoptar | Por qué, específicamente para este producto |
|---|---|
| **Glassmorphism / "Liquid Glass"** | Los efectos de vidrio *"can cause frame drops on lower-end devices"* ([925studios/orbix, 2026](https://www.orbix.studio/blogs/bento-grid-dashboard-design-aesthetics)). El teléfono del prevencionista en faena no es un flagship. Y peor: reduce el contraste por diseño, en un producto cuyo `globals.css` documenta el contraste token por token y cuyo `layout.tsx` quita `antialiased` para tener **más** masa de texto bajo sol. Es incompatible con el requisito central. |
| **Bento grids** | Es un patrón de *landing page*, no de herramienta de trabajo. Además *"dark mode bento grids often fail contrast requirements, with light gray text on dark gray tiles frequently falling below 4.5:1"*. |
| **Dark mode como prioridad** (hoy `next-themes` está instalado sin usar) | *"Light mode remains legible in any lighting condition, and sunlight doesn't wash it out"*; en exteriores una pantalla oscura se lava con la luz ambiente. Y con astigmatismo —~1 de cada 3 adultos según la American Academy of Ophthalmology— el texto claro sobre fondo oscuro produce halos; el estudio de Piepenbrock et al. (2013) midió lectura más rápida y precisa en polaridad positiva ([NN/g, Dark Mode vs. Light Mode](https://www.nngroup.com/articles/dark-mode/)). Para faena a pleno sol, **light mode es la decisión técnica correcta**, no la perezosa. Dark mode se ofrece después, como opción ([WebAIM, abr-2025](https://www.boia.org/blog/what-to-know-about-the-css-prefers-reduced-motion-feature) recomienda dar elección, no forzar) — pero no es prioridad, y hasta entonces `next-themes` es una dependencia muerta que conviene sacar. |
| **Scroll-driven animations** | A **Firefox 152 (jun-2026) sigue detrás de flag** en estable; ~84% global, no es Baseline. Pero aunque lo fuera: su caso de uso es decorativo, y acá el usuario está buscando qué le falta, no admirando la página. |
| **View Transitions cross-document (MPA)** | Chrome y Safari 18.2+ sí, **Firefox todavía no**. Y de todos modos la app es SPA con App Router: la variante same-document, que sí es Baseline, cubre el 100% de lo que hace falta. |
| **Motion / Framer Motion** | 34 kB sin optimizar, 4.6 kB + 15 kB de feature pack en la variante liviana, para animar cosas que CSS ya hace. Su diferencial (layout animations) es algo que acá **no se quiere**. |
| **AG Grid** | 330 kB gzip contra 15 kB de TanStack Table. 22x el peso, estética propia que pelearía con el sistema de tokens, y lo bueno está tras licencia enterprise. |
| **MUI Data Grid, Mantine React Table, Tremor** | Arrastran un framework de UI entero. Ya prohibidos por CLAUDE.md, y con razón. |
| **Migrar Tailwind → Panda / UnoCSS / StyleX** | Reescribir todo `globals.css` —donde vive el razonamiento de contraste medido de la app— para ganar tipado de tokens que acá ya lo da el `Record<EstadoDoc, Estilo>`. Riesgo alto, ganancia cero. |
| **Migración completa Radix → Base UI ahora** | El propio changelog de shadcn dice *"You do not need to migrate."* Tocar 74 archivos para arreglar algo que no está roto. Base UI se adopta **hacia adelante**, en componentes nuevos. |
| **Layouts "adaptativos con IA" por rol/usuario** | Es el trend dominante de dashboards 2026, y acá es un riesgo legal. La responsabilidad del mandante ante la ley es solidaria; si dos personas ven layouts distintos y una no vio el bloqueo, el producto es la causa. **Predecible le gana a adaptativo** cuando hay consecuencia jurídica. |
| **Cambiar de librería de iconos** | `lucide-react` **ya está en la lista de `optimizePackageImports` por defecto de Next.js** ([docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports)). No hace falta configurar nada ni migrar a nada. Única regla: nunca `import * as Icons from 'lucide-react'`. |
| **Más densidad "porque denso = pro"** | *"The 2020-era approach of equating dashboard value with density —more widgets, filters, charts— now reads as unfinished thinking in 2026"*, y el exceso de interactividad sube el tiempo hasta el insight un 35%. La densidad que vale acá es **densidad de filas de tabla**, no de widgets. Progressive disclosure: lo mínimo para la próxima decisión, el resto en el panel. |

---

## 7. Movimientos concretos, priorizados

### 1. Slide-over sobre `<dialog>` nativo + `@starting-style`, y borrar `tailwindcss-animate`
**Qué gana el usuario:** los 7 paneles laterales pasan a tener foco atrapado, cierre con Esc y el fondo inerte — hoy no tienen nada de eso, y el mandante que navega con teclado se pierde detrás del panel. De paso, los diálogos vuelven a animar (hoy sus clases `animate-in` no generan CSS porque el plugin nunca se importó).
**Qué cuesta:** −1 dependencia, **+0 KB**. Tocar 7 páginas y 2 componentes de `shared/ui`. Riesgo bajo: `<dialog>` tiene soporte universal y el fallback de `@starting-style` es "aparece sin animar".

### 2. `prefers-reduced-motion` global + desacoplar el `pulse` del significado
**Qué gana el usuario:** quien tiene sensibilidad vestibular deja de recibir 40 puntos latiendo durante una carga de nómina. Cierra WCAG 2.2.2 (nivel A, no opcional) y 2.3.3.
**Qué cuesta:** ~12 líneas de CSS, **0 KB**. Lo único que exige pensar es mantener la distinción de `EN_ANALISIS` sin movimiento — se resuelve con el glifo, que ya existe.

### 3. Densidad de tabla + `tabular-nums` en el token
**Qué gana el usuario:** ~15 filas visibles más por pantalla, y las columnas de fecha de vencimiento y RUT alineadas verticalmente para poder escanearlas de un golpe. Hoy hay `tabular-nums` en 5 lugares de todo el repo pese a que el token dice "siempre". Para el contratista que quiere saber qué le falta, esto es directamente menos scroll y menos error de lectura.
**Qué cuesta:** editar `shared/ui/table.tsx` y dos tokens de `globals.css`. **0 KB.** Riesgo: cero. Es el mejor retorno por línea del documento.

### 4. Container queries en el panel lateral y las tarjetas de pilar
**Qué gana el usuario:** el panel de 384 px deja de recibir estilos pensados para pantallas anchas. Se ve bien en el teléfono a una mano y en el escritorio del mandante sin bifurcar componentes.
**Qué cuesta:** **0 KB** (ya está en Tailwind v4). Migración incremental, componente por componente, sin big bang. Riesgo nulo.

### 5. Un solo shared-element morph: fila de tabla → panel de detalle
**Qué gana el usuario:** al abrir el detalle se lee "esta fila se expandió" en vez de "apareció una capa encima". Reduce la re-orientación en alguien que abre y cierra el panel 40 veces seguidas.
**Qué cuesta:** **0 KB** — `<ViewTransition>` viene de `react` y funciona en App Router sin configuración. **Este es el único de los cinco que es opcional**, y solo tiene sentido después del #1 y el #2. Dos reglas no negociables: `::view-transition { pointer-events: none; }` para no perder clicks, y nada de `view-transition-name` en filas que el revisor recorre rápido.

### Lo que explícitamente NO está en la lista
TanStack Table (~15 kB) queda en espera hasta que aparezca la primera tabla que **necesite** ordenar por columna. Base UI queda como destino de componentes **nuevos**, no como migración. Y el cambio de fuente no ocurre: el argumento de IBM Plex escrito en `layout.tsx` resiste la evidencia de 2026 en sus tres patas; lo único a revisar ahí es si Google Fonts ya sirve la variable de Plex Sans, que es un ahorro de bytes y no una decisión de diseño.

---

## Fuentes (con fecha)

**Primarias / documentación oficial**
- [Tailwind CSS v4.3 — Scrollbars, new colors, and more](https://tailwindcss.com/blog/tailwindcss-v4-3) — 8-may-2026
- [Tailwind CSS v4.0](https://tailwindcss.com/blog/tailwindcss-v4) — 22-ene-2025
- [shadcn/ui — Base UI as the Default](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default) — jul-2026
- [Next.js — Designing view transitions](https://nextjs.org/docs/app/guides/view-transitions) — docs v16.3, actualizado 7-ago-2026
- [Next.js — optimizePackageImports](https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports) — docs v16.3, actualizado 19-dic-2025
- [Motion — Reduce bundle size](https://motion.dev/docs/react-reduce-bundle-size) — doc oficial
- [IBM/plex releases](https://github.com/IBM/plex/releases) — Plex Mono Variable v1.0, 21-abr-2026; Plex Serif Variable, 16-dic-2025
- [npm @base-ui/react](https://www.npmjs.com/package/@base-ui/react) — v1.0 estable 11-dic-2025; 1.6.0 a mediados de 2026

**Soporte de navegador**
- [caniuse — View Transitions](https://caniuse.com/view-transitions) — 90.2% global
- [web.dev — Same-document view transitions are now Baseline](https://web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available)
- [CSS-Tricks — Cross-Document View Transitions: The Gotchas](https://css-tricks.com/cross-document-view-transitions-part-1/)
- [OddBird — Anchor Positioning Updates](https://www.oddbird.net/2025/10/13/anchor-position-area-update/) — 13-oct-2025
- [MDN — position-anchor](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position-anchor)
- [MDN — Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) · [Smashing — Getting Started With The Popover API](https://www.smashingmagazine.com/2026/03/getting-started-popover-api/) — mar-2026
- [MDN — animation-timeline](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-timeline) — scroll-driven, Firefox 152 aún tras flag
- [MDN — @starting-style](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@starting-style) · [Tailwind — transition-behavior](https://tailwindcss.com/docs/transition-behavior)

**Accesibilidad**
- [web.dev — Animation and motion](https://web.dev/learn/accessibility/motion)
- [AAArdvark — WCAG 2.3.3 Animation from Interactions](https://aaardvarkaccessibility.com/wcag-plain-english/2-3-3-animation-from-interactions/)
- [NN/g — Dark Mode vs. Light Mode: Which Is Better?](https://www.nngroup.com/articles/dark-mode/) — incluye Piepenbrock et al. 2013
- [Bureau of Internet Accessibility — prefers-reduced-motion](https://www.boia.org/blog/what-to-know-about-the-css-prefers-reduced-motion-feature)
- [Pope Tech — Design accessible animation and movement](https://blog.pope.tech/2025/12/08/design-accessible-animation-and-movement/) — 8-dic-2025

**Comparativas y estado del ecosistema (2026)**
- [PkgPulse — Tailwind v4 vs UnoCSS vs PandaCSS](https://www.pkgpulse.com/guides/tailwind-v4-vs-unocss-vs-pandacss-2026) — 2026
- [PkgPulse — TanStack Table vs AG Grid vs react-data-grid](https://www.pkgpulse.com/guides/tanstack-table-vs-ag-grid-vs-react-data-grid-2026) — 2026
- [greatfrontend — Top Headless UI libraries for React in 2026](https://www.greatfrontend.com/blog/top-headless-ui-libraries-for-react-in-2026)
- [ShadcnDeck — Radix vs Base UI en 2026](https://www.shadcndeck.com/blog/radix-vs-base-ui)
- [LogRocket — Comparing the best React animation libraries for 2026](https://blog.logrocket.com/best-react-animation-libraries/)
- [DAR Design — B2B Dashboard Information Architecture in 2026](https://dardesign.io/blog/b2b-dashboard-information-architecture-2026)
- [Orbix — Bento Grid Dashboard Design: Complete Guide 2026](https://www.orbix.studio/blogs/bento-grid-dashboard-design-aesthetics)
- [MadeGood Designs — Inter Font: por qué es la tipografía UI #1 de 2026](https://madegooddesigns.com/inter-font/) · [Best Sans-Serif Fonts of 2026](https://madegooddesigns.com/best-sans-serif-fonts/)

---

**Estado: COMPLETO.**
