# Acredita — Sistema de movimiento

Documento de diseño de interacción, eje **movimiento**: animaciones, transiciones y
microinteracciones. No trata color, tipografía, marca ni stack.

Revisión de código: `frontend/src/` completo (Next.js 16, React 19, Tailwind v4).
Fecha: agosto 2026.

---

## 0. La tesis

El usuario que gobierna este sistema no es el que abre la app una vez. Es el revisor del mandante
que resuelve cuarenta documentos seguidos, y el prevencionista que sube el mismo tipo de
certificado catorce veces en una mañana.

Para ellos **una animación no es una impresión: es un peaje**. Se paga cada vez.
Una transición de 300 ms que encanta la primera vez cuesta 12 segundos de espera acumulada en
cuarenta repeticiones y —peor— rompe cuarenta veces el ritmo de una tarea que se hace en piloto
automático.

De ahí las tres reglas que gobiernan todo lo que sigue:

1. **El movimiento se gana el lugar explicando causa y efecto, o continuidad. Nada más.**
   Si no responde *"esto pasó porque tú hiciste eso"* o *"esto es lo mismo que mirabas, movido"*,
   sobra.
2. **La duración es presupuesto, no gusto.** Se mide contra la frecuencia: lo que ocurre 40 veces
   al día no puede durar lo mismo que lo que ocurre una vez al mes.
3. **La salida siempre es más rápida que la entrada.** Lo que se va ya cumplió su función.

---

## 1. Diagnóstico: qué se mueve hoy

Cuatro hallazgos duros, todos verificados en código.

### 1.1 Los diálogos no tienen animación — el código está ahí, pero muerto

`frontend/src/shared/ui/dialog.tsx` declara la animación completa de shadcn:

```
data-[state=open]:animate-in data-[state=closed]:animate-out
data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95
data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-top-[48%]
```

`animate-in`, `fade-in-0`, `zoom-in-95` y `slide-in-from-*` **no existen en Tailwind v4 core**.
Vienen del plugin `tailwindcss-animate`, que está en `package.json` pero **nunca se registra**:
`globals.css` solo tiene `@import "tailwindcss"`, no hay ningún `@plugin`, no existe
`tailwind.config.js` (v4 es CSS-first) y `postcss.config.mjs` carga únicamente
`@tailwindcss/postcss`.

**Consecuencia:** todos los diálogos de la aplicación —subir documento, aprobar, observar, invitar
contratista, crear servicio, permisos, historial— aparecen y desaparecen con un corte seco. El
overlay `bg-black/80` (80% de negro, mucho más pesado que el `bg-surface-inverse/40` que usa
`cargar-nomina-dialog.tsx`) también entra de golpe: es un flash negro sobre la pantalla.

Esto no es "poco movimiento": es movimiento roto. El equipo cree que hay una transición.

Del mismo tipo: `--ease-salida: cubic-bezier(0.16, 1, 0.3, 1)` está declarada en `globals.css:146`
y **no la usa ningún componente**. Además el nombre es ambiguo —ahí "salida" significa *ease-out*—
y la curva es un `easeOutExpo`, un frenazo dramático que sirve para **entradas**, no para salidas.

### 1.2 No hay confirmación transitoria en ninguna parte

`frontend/src/shared/ui/sonner.tsx` existe, está bien construido —iconos por tipo, clases mapeadas
a los tokens de color de la app— y **no lo importa nadie**. `<Toaster />` no está montado en
`app/layout.tsx`. `toast()` no se llama en ningún archivo del proyecto.

**Consecuencia:** cuando el revisor aprueba un documento, la única señal de que pasó algo es que la
lista se recarga entera y la tarjeta ya no está. Cuando el contratista sube un archivo, el diálogo
se cierra y listo. La aplicación nunca dice que sí.

Excepción —el instinto correcto, mal generalizado—: en `(mandante)/mandante/requisitos/page.tsx` el
botón Guardar se pone verde con "¡Guardado!" durante 2.5 s vía `setTimeout` (líneas 708-709 y
800-801). Es el único acuse de recibo del producto, está implementado a mano, y solo ahí.

### 1.3 Cada acción destruye y repinta la lista completa

- `(mandante)/mandante/revision/page.tsx` — `cargar()` hace `setLoading(true)` + refetch completo, y
  se llama en `onDone` después de aprobar. La cola de 40 se repinta entera para quitar 1.
- `shared/lib/use-api-data.ts` — `refetch()` incrementa `recarga`, y el efecto vuelve a poner
  `setLoading(true)`. Toda pantalla que use el hook muestra su estado de carga otra vez después de
  cada mutación.
- `(mandante)/mandante/requisitos/page.tsx` — `handlePlantilla()` llama a `cargarRequisitos()`, que
  reemplaza el array `pilares` completo. **21 requisitos cambian de estado y el usuario ve un
  redibujado instantáneo, sin ninguna pista de qué cambió.**

**Consecuencia:** el efecto de una acción es indistinguible de una recarga. No hay causa y efecto:
hay parpadeo.

Contraejemplo interno, y es la pista de que el equipo ya sabe hacerlo bien: `guardarCargos()` en
`requisitos/page.tsx:816` **sí** es optimista —actualiza el estado local al instante y revierte con
`cargarRequisitos()` si el PUT falla—. Ese patrón hay que subirlo a regla general.

### 1.4 El panel lateral empuja el contenido — y se vacía antes de irse

En `(mandante)/mandante/contratistas/page.tsx` (mismo patrón en `servicios`, `requisitos`,
`(contratista)/servicios`, `(admin)/mandantes`, `(admin)/catalogo`, `(admin)/usuarios`):

```tsx
<div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300",
                   seleccionado ? "lg:mr-96" : "")}>
```

El panel en sí está bien resuelto (`fixed`, `transition-transform duration-300`, `translate-x-full`
→ `translate-x-0`). El problema es el contenedor: anima `margin-right` con `transition-all`.

- `margin` es propiedad de **layout**. Durante 300 ms el navegador recalcula layout y repinta la
  tabla entera —que puede tener 200 filas— en cada frame, en el hilo principal.
- `transition-all` obliga además a vigilar todas las propiedades, no solo la que cambia.
- Es la interacción más frecuente del mandante: abrir la ficha de un contratista.

Y hay un defecto visible a simple vista: el contenido del panel está condicionado
(`{seleccionado && <DetailPanel/>}`) mientras el contenedor anima con clases. Al cerrar,
`seleccionado` pasa a `null`, **el panel se vacía instantáneamente** y luego se desliza hacia fuera
una caja blanca vacía durante 300 ms. Rompe la continuidad exactamente donde la transición existe
para preservarla.

### 1.5 Inventario del resto

| Qué | Dónde | Veredicto |
|---|---|---|
| `transition-colors` en hover de botones, filas, chips, nav | ~40 archivos | Correcto. Es el único movimiento sano que hay hoy. Falta fijarle duración y curva (usa el default del navegador: 150 ms `ease`). |
| `animate-pulse` en el punto del badge `EN_ANALISIS` | `shared/ui/estado-badge.tsx:165` | Intención correcta —el sistema declara que un azul quieto es un bug— e implementación a revisar: ciclo de 2 s, opacidad 1→0.5 sobre un punto de 6 px (casi invisible), infinito, sin corte por `prefers-reduced-motion`. |
| `animate-pulse` en skeletons | `shared/ui/skeleton.tsx` y skeleton local en `(contratista)/contratista/page.tsx:10` | Aceptable, pero hay dos implementaciones distintas (`bg-surface-sunken` vs `bg-line`) y la mayoría de pantallas ni siquiera usa skeleton: muestran el texto "Cargando…". |
| `animate-spin` (Loader2) | `entities/servicio/avance-panel.tsx:86` | Único spinner del producto. Sin texto, sin retardo de aparición. |
| Barra de progreso de acreditación | `avance-panel.tsx:103` | `transition-all` sobre `width` — layout otra vez, y sin duración explícita. |
| `window.confirm()` en acciones destructivas | `requisitos/page.tsx:675` y `:790`, `admin/catalogo:202`, `equipo/cuenta-dialog:88` | Modal nativo del navegador. Es el freno más fuerte del producto para su acción más peligrosa (reemplazar 21 requisitos) y no lo controlamos: ni estilo, ni foco, ni movimiento. Y `shared/ui/alert-dialog.tsx` ya existe sin usarse ahí. |
| Banner "Invitación enviada" | `contratistas/page.tsx:542` | Aparece de golpe en el header empujando todo hacia abajo, y a los 5000 ms desaparece de golpe empujándolo de vuelta. Dos saltos de layout. |
| Cambio de sección (sidebar → página) | Todos los layouts | Sin transición. Pantalla en blanco y contenido nuevo. |

---

## 2. Los momentos, ordenados por frecuencia

Priorizados por veces/día por usuario, que es el único orden que importa cuando el costo se paga
por repetición.

### Nivel A — decenas de veces al día

**A1. Aprobar u observar un documento** (`revision/page.tsx`)
Hoy: se abre un diálogo sin animación, se confirma, el diálogo se cierra sin animación, la lista
entera se recarga con "Cargando entregas…" y la tarjeta ya no está. El revisor no ve *su* tarjeta
irse: ve la lista rehacerse.
Falta: que la tarjeta que él resolvió **salga**, y que la cola se cierre sobre el hueco. Es el
momento donde el movimiento vale más en todo el producto.

**A2. Abrir y cerrar la ficha lateral** (contratistas, servicios, requisitos, admin)
Hoy: el panel entra bien, la página se reacomoda con un animado de layout caro, y al cerrar el
panel se vacía antes de salir.

**A3. Filtrar la cola por pilar / buscar / cambiar de pestaña**
(chips de `revision`, filtros de `contratistas`, pestañas Empresa/Trabajador de `requisitos`)
Hoy: la lista se reemplaza al instante. Con 44 requisitos y dos pestañas, cambiar de pestaña es un
corte total sin ninguna relación entre lo que había y lo que hay.

**A4. Un estado cambia de color** (badge Enviado → En análisis → Aprobado)
Hoy: cambio instantáneo. Cuando llega por refetch, el usuario ni se entera de que cambió.

### Nivel B — varias veces al día

**B1. Subir un documento** (`subir-documento-dialog.tsx`)
Hoy: el botón dice "Subiendo…" y nada más. `api.upload` usa `fetch` con `FormData`, que **no expone
progreso de subida**. Un PDF de 20 MB desde una faena con señal mala es un botón inerte durante un
minuto, sin porcentaje, sin cancelar y sin forma de saber si sigue vivo.

**B2. Marcar requisitos y guardar el perfil** (`requisitos/page.tsx:693`)
Hoy: `handleGuardar()` recorre los requisitos sucios con `for … await`: **un POST secuencial por
requisito**. 21 cambios son 21 viajes de ida y vuelta en serie, con el botón en "Guardando…" sin
contador de avance. El `(N)` de sucios desaparece de golpe al terminar.

**B3. Resolver un pendiente desde el inicio del contratista** (`pendiente-row.tsx`)
Hoy: Autorizar/Rechazar → `onResuelto()` → recarga completa de la home. La fila desaparece dentro
de un repintado general.

### Nivel C — algunas veces por semana, o en el arranque

**C1. Aplicar una plantilla que reemplaza 21 requisitos** (`requisitos/page.tsx:774`)
Hoy: `window.confirm()` nativo, POST, refetch completo, y el botón Guardar parpadea verde 2.5 s. La
acción de mayor consecuencia del producto —cambia lo que se le exige a todos los contratistas de
ese perfil— se resuelve visualmente igual que cualquier otra.

**C2. Cargar una nómina de 200 personas** (`cargar-nomina-dialog.tsx`)
Hoy: botón "Cargando…", y al terminar el diálogo cambia entero a la vista de reporte de golpe. El
reporte está muy bien pensado (cargados / ya estaban / con error, con la fila exacta de cada error)
y aparece sin ninguna transición que lo relacione con lo que había antes.

**C3. Invitar a un contratista** — banner que empuja el layout dos veces.

**C4. Entrar a la app / cambiar de sección** — sin transición.

---

## 3. El sistema

Cuatro duraciones, tres curvas, dos distancias, tres tiempos de permanencia. Nada más. Cualquier
valor que no salga de esta tabla es un bug.

### 3.1 Duraciones

| Token | Valor | Qué significa | Dónde |
|---|---|---|---|
| `--acr-dur-toque` | **80 ms** | *"El control te oyó."* Respuesta bajo el dedo o el cursor. | hover, active, focus, check, chip, tab |
| `--acr-dur-cambio` | **160 ms** | *"Esto cambió donde está."* **El default de la app** (~80% de los usos). | badge que cambia de estado, contador, barra de progreso, diálogo que entra, contenido que se sustituye |
| `--acr-dur-recorrido` | **240 ms** | *"Esto atravesó distancia."* Lo único que puede pasar de 200 ms. | panel lateral, fila que sale de una lista y lista que se cierra sobre el hueco, toast |
| `--acr-dur-sale` | **120 ms** | *"Esto ya no está."* La salida es la mitad de la entrada. | diálogo que se cierra, overlay, toast que se va |

Por qué estos números, y no otros:

- **80 ms** queda bajo el umbral de 0.1 s en el que el usuario percibe la respuesta como
  instantánea ([Nielsen, *Response Times: The 3 Important Limits*, 1993, actualizado 2014](https://www.nngroup.com/articles/response-times-3-important-limits/)).
  El movimiento existe —evita el parpadeo de un cambio duro cuando el mouse barre 40 filas— pero no
  se percibe como animación.
- **160 ms** es la banda donde una transición se lee como causal sin sentirse lenta. Está entre el
  `short.3` de eBay (167 ms) y el `short4` de Material 3 (200 ms), y por debajo de ambos defaults
  de diálogo.
- **240 ms** es el techo. Material 3 usa 300 ms (`medium2`) para transiciones de contenedor, pero
  M3 optimiza para expresividad en consumo; aquí el mismo panel se abre 40 veces al día. 240 ms
  conserva la legibilidad del recorrido y devuelve 60 ms por interacción.
- **120 ms de salida**: es la asimetría clásica —entrada desacelerada y larga, salida acelerada y
  corta— porque al entrar el usuario necesita *encontrar* el elemento y al salir ya no le interesa.

### 3.2 Curvas

Se adopta el set **productive** de IBM Carbon, verificado en
[`packages/motion/src/tokens.ts`](https://github.com/carbon-design-system/carbon/blob/main/packages/motion/src/tokens.ts).
Carbon separa explícitamente *productive* (interfaces de tarea, uso repetido) de *expressive*
(momentos de marca). Acredita es productive de punta a punta.

| Token | Valor | Cuándo |
|---|---|---|
| `--acr-ease` | `cubic-bezier(0.2, 0, 0.38, 0.9)` | **Default.** Algo que ya está en pantalla cambia: color, tamaño, posición dentro de la vista. |
| `--acr-ease-entra` | `cubic-bezier(0, 0, 0.38, 0.9)` | Algo aparece. Arranca a velocidad máxima y frena: llega antes de lo que parece. |
| `--acr-ease-sale` | `cubic-bezier(0.2, 0, 1, 0.9)` | Algo desaparece. Acelera y se va: libera la atención rápido. |

**Nunca** `linear` (delata la máquina), **nunca** `ease-in-out` del navegador (arranca lento: hace
que todo se sienta pesado), **nunca** rebote / overshoot / spring. Un rebote en un producto donde
"aprobado" significa que una persona puede entrar a una faena es tono equivocado, y a la
cuadragésima repetición es ruido.

El token existente `--ease-salida` se retira: no lo usa nadie, su nombre confunde *ease-out* con
*transición de salida*, y su curva (`easeOutExpo`) es demasiado expresiva para este producto.

### 3.3 Distancias

| Token | Valor | Qué |
|---|---|---|
| `--acr-mov-corto` | **6 px** | Desplazamiento de acompañamiento. Un diálogo, un toast o una fila no "vuelan": se asientan. |
| `--acr-mov-panel` | **100%** | El panel lateral viaja su propio ancho. Es la única traslación grande permitida. |

6 px, y no el `slide-in-from-top-[48%]` + `zoom-95` que trae shadcn por defecto: media pantalla de
recorrido más un escalado es una entrada de presentación de producto, no de una herramienta que se
abre 40 veces al día.

### 3.4 Tiempos de permanencia

Números distintos de las duraciones: no describen cuánto dura un movimiento, sino cuánto se espera
o cuánto se queda algo.

| Token | Valor | Regla |
|---|---|---|
| `--acr-espera-antes-de-spinner` | **400 ms** | **Antes de 400 ms no se muestra ningún indicador de carga.** Un spinner que aparece y desaparece en 150 ms es un parpadeo, y se lee como error. |
| `--acr-marca-vida` | **900 ms** | Cuánto dura el resaltado que señala "esta fila acaba de cambiar" antes de desvanecerse. |
| `--acr-toast-vida` | **4000 ms** | Vida de una confirmación. Los errores **no caducan**: se quedan hasta que el usuario los cierre. |

Regla acompañante: **una vez mostrado, un indicador de carga se queda al menos 400 ms**. Si no, en
una red rápida se ve un flash y en una lenta no, y el mismo botón se comporta distinto cada vez.

### 3.5 Cómo se asigna

Un árbol de decisión, para que nadie tenga que elegir:

```
¿El usuario tiene el dedo/cursor encima ahora mismo?     → toque      (80 ms,  --acr-ease)
¿Algo cambia sin moverse de su sitio?                    → cambio     (160 ms, --acr-ease)
¿Algo entra a la pantalla?                               → cambio     (160 ms, --acr-ease-entra)
¿Algo entra o sale recorriendo distancia real?           → recorrido  (240 ms, entra/sale)
¿Algo sale de la pantalla?                               → sale       (120 ms, --acr-ease-sale)
Ninguna de las anteriores                                → no se anima
```

---

## 4. Qué comunica cada movimiento

Cuatro verbos. Cada animación del producto tiene que ser uno de ellos, y si no es ninguno, no va.

| Verbo | Comunica | Forma |
|---|---|---|
| **Sale** | *Causa y efecto.* "Resolviste esto, y por eso se fue." | Opacidad → 0, `translateX` +16 px, y el hueco se cierra. |
| **Entra** | *Causa y efecto.* "Esto es nuevo, y llegó porque hiciste algo." | Opacidad 0 → 1, `translateY` 6 px → 0. |
| **Continúa** | *Continuidad.* "Es lo mismo que mirabas, movido." | Traslación del elemento real, sin fundido: si se funde, deja de ser el mismo objeto. |
| **Late** | *Proceso.* "El sistema está trabajando ahora." | Ciclo de opacidad, y **solo** mientras el trabajo ocurre de verdad. |

### 4.1 Especificaciones por momento

#### A1 — Aprobar u observar un documento (el momento más importante)

1. **Clic en Aprobar.** El botón responde en `toque`. El diálogo entra: opacidad 0→1 +
   `translateY(6px → 0)`, `cambio` + `--acr-ease-entra`. El overlay pasa a `bg-ink/25` —no `/80`—
   en `cambio`. Sin `zoom`.
2. **Confirmar.** El botón se bloquea al instante (sin animación) y el diálogo **sale en 120 ms**
   con `--acr-ease-sale`. **No espera la respuesta del servidor.**
3. **La tarjeta sale, optimista.** Ya visible detrás del diálogo que se fue: opacidad 1→0 +
   `translateX(0 → 16px)`, y la cola se cierra sobre el hueco. `recorrido` + `--acr-ease-sale`.
   Las tarjetas de abajo subiendo es lo que comunica *"la cola avanzó"* — es la mitad del valor de
   toda esta especificación.
4. **El contador del chip baja en 1.** Se reemplaza el número. Sin count-up.
5. **Toast de confirmación**, `recorrido` para entrar, `--acr-toast-vida`, con acción **Deshacer**
   si el backend lo permite.
6. **Si el servidor falla**, la tarjeta **vuelve**: entra con `--acr-ease-entra` en `recorrido`,
   con un borde izquierdo rojo de 3 px que se queda, más un toast de error persistente con
   *Reintentar*.

Lo que hace que 40 documentos se sientan como 40 pulsaciones y no como 40 recargas es el paso 2-3:
**la pantalla nunca espera a la red**.

Implementación recomendada para el cierre del hueco: **View Transitions API**
(`document.startViewTransition()`), con `view-transition-name` en cada tarjeta. Es exactamente el
caso para el que se diseñó, corre fuera del hilo principal y degrada solo: donde no está soportada
el DOM se actualiza al instante, que es el comportamiento de hoy. Same-document está soportado en
Chrome 111+, Firefox 133+ y Safari 18+
([MDN, View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)).
La alternativa sin API nueva es FLIP: medir posiciones, aplicar `transform`, soltar. En ambos casos
hay que medirlo en un teléfono de gama baja antes de darlo por bueno: la API captura la página
entera si no se acota con nombres, y en una tabla larga eso se nota.

#### A2 — Panel lateral

- **El panel** conserva su `transition-transform` pero baja a `recorrido` (240 ms) con
  `--acr-ease-entra` al abrir y `--acr-ease-sale` al cerrar.
- **El contenido de la página deja de moverse.** Se elimina el `transition-all` sobre `mr-96`. Dos
  opciones, ambas mejores que animar `margin`: (a) el panel se superpone —ya es `fixed`, y en
  `<lg` ya ocupa el ancho completo—, o (b) si se quiere conservar el empuje en escritorio ancho,
  se hace con `transform: translateX()` sobre el contenedor, que es composited, en vez de `margin`.
  La opción (a) es la recomendada: menos trabajo y sin reflow.
- **El contenido del panel se desmonta al terminar la transición, no al empezar.** Hoy la caja se
  vacía y luego sale vacía. Se arregla manteniendo el último `seleccionado` mientras dura la
  salida.
- La fila de origen queda con su estado seleccionado marcado durante todo el tiempo que el panel
  esté abierto: es el ancla de continuidad entre la lista y la ficha.

#### A3 — Filtrar y cambiar de pestaña

Una sola transición, y de las baratas: el contenedor de resultados hace un **cross-fade de
opacidad 1 → 0.4 → 1 en `cambio`**, sin movimiento. La lista no se desliza ni se escalona.

- No hay stagger. Nunca. (Ver §7.)
- El scroll **no vuelve arriba** si el filtro es un subconjunto del anterior.
- El chip activo cambia en `toque`.
- Si filtrar es local (lo es: `visibles = pendientes.filter(...)`), **no se muestra ningún
  indicador de carga**. Filtrar es instantáneo y debe verse instantáneo.

El fundido parcial hasta 0.4 en vez de 0 es deliberado: dice "esta lista se rehizo" sin borrar la
pantalla, y con 44 filas es un solo cambio de opacidad sobre un contenedor, no 44 animaciones.

#### A4 — Un estado cambia de color

- El cambio de color del badge se transiciona en `cambio` con `transition-colors` (**nunca**
  `transition-all`). El punto y el texto viajan juntos.
- Si el cambio llega **por refetch** y no por una acción directa del usuario, el badge recibe
  además la **marca de cambio**: fondo `--color-proceso-soft` que se desvanece a transparente en
  `--acr-marca-vida`. Es la única forma de que el usuario note que algo se movió mientras miraba
  otra cosa.
- El badge `EN_ANALISIS` conserva su latido, pero reescrito: **1.8 s**, opacidad 1 → 0.55, solo el
  punto, nunca el fondo ni el texto, y **cortado bajo `prefers-reduced-motion`** (donde el estado
  ya lo comunican la palabra "En análisis" y el color). El `animate-pulse` de Tailwind —2 s, sobre
  cualquier cosa a la que se lo pegues— no sirve como token semántico.

#### B3 / C3 — Confirmaciones que hoy empujan el layout

El banner "Invitación enviada" y cualquier otra confirmación efímera **salen del flujo del
documento** y pasan al toast. Un elemento que aparece dentro del layout, lo empuja, y a los 5 s lo
empuja de vuelta, produce dos saltos de contenido por cada acción exitosa.

Regla general: **una confirmación transitoria nunca cambia el tamaño de nada.**

---

## 5. Feedback de acciones lentas

El marco es el de Nielsen: bajo 0.1 s no hace falta feedback; hasta 1 s el usuario mantiene el hilo;
pasados 10 s hace falta indicador de avance **y** posibilidad de interrumpir
([NN/g, 1993 / 2014](https://www.nngroup.com/articles/response-times-3-important-limits/)).

### La escala, en cuatro peldaños

| Duración esperada | Qué se muestra | Ejemplo en Acredita |
|---|---|---|
| **< 400 ms** | **Nada.** El control se bloquea, no cambia de aspecto. | filtrar, marcar un check, abrir un panel |
| **400 ms – 2 s** | El control se convierte en su propio indicador: mismo tamaño, mismo sitio, spinner + verbo en gerundio. Nunca overlay. | aprobar, autorizar, guardar un requisito suelto |
| **2 s – 10 s** | Indicador determinado si hay número real; indeterminado con texto honesto si no. La pantalla sigue viva y se puede navegar. | aplicar plantilla, cargar nómina, guardar 21 requisitos |
| **> 10 s** | Progreso real, tiempo o cantidad restante, y **cancelar**. | subir un archivo grande desde faena |

### B1 — Subir un documento (el caso crítico)

Hoy es imposible dar buen feedback porque `api.upload` usa `fetch`, que **no expone progreso de
subida**. Esto es un cambio de infraestructura, no de CSS: hay que pasar el upload a
`XMLHttpRequest` para poder escuchar `upload.onprogress`, y quedarse con su `abort()` para el
botón de cancelar.

Con eso, la secuencia:

1. **0–400 ms:** el botón queda deshabilitado y nada más.
2. **Fase 1, "Subiendo".** Barra **determinada**, ancho por `transform: scaleX()` —no por `width`—
   en `cambio` con `--acr-ease`, más `12,4 MB de 20 MB` en cifras tabulares. Botón **Cancelar**.
3. **Fase 2, "Procesando".** Cuando el navegador terminó de enviar pero el servidor todavía
   clasifica y extrae con IA, la barra pasa a **indeterminada** y el texto cambia a "Procesando el
   documento". La barra **no sigue avanzando sola**: un progreso inventado es una mentira que el
   usuario detecta cuando se queda en 97% treinta segundos.
4. **Cierre.** El diálogo sale en `sale`. El requisito en la lista de atrás **cambia de estado a la
   vista**: el badge pasa de "Falta subir" a "En revisión" con la marca de cambio de
   `--acr-marca-vida`. Ese es el acuse de recibo real, más útil que cualquier toast: le muestra el
   efecto en su propia lista.
5. **Si falla:** el diálogo **no se cierra**. Conserva los archivos elegidos, muestra el error donde
   ya está el bloque de error, y el botón vuelve a decir "Subir". Nunca hacer que el contratista
   vuelva a elegir el archivo.

Peso de la evidencia: 20 MB por archivo permitidos, red de faena. Este es el único punto del
producto donde el indicador de progreso es obligatorio y donde cancelar es obligatorio.

### C2 — Cargar una nómina de 200 personas

El servidor procesa el archivo entero en un POST: no hay progreso real que mostrar y **no hay que
fabricarlo**.

- Indicador indeterminado, con texto que dice qué se está haciendo y da una expectativa honesta:
  *"Leyendo 200 filas — suele tardar unos segundos."*
- **La transición al reporte es un cambio de altura, no un salto.** El diálogo interpola su altura
  desde la vista de carga a la del reporte en `recorrido`, y el contenido nuevo entra con
  `cambio` + `--acr-ease-entra`. Se logra sin animar `height` usando `grid-template-rows: 0fr →
  1fr` o midiendo con `ResizeObserver`.
- **Los tres números del reporte no cuentan hacia arriba.** Aparecen escritos. (Ver §7.)
- La lista de filas con error entra con el mismo `cambio`, en bloque, sin escalonar.

### B2 / C1 — Guardar 21 requisitos, aplicar una plantilla

Dos problemas distintos:

**El guardado secuencial.** `for (const r of requisitos) await api.post(...)` son 21 viajes en
serie. Lo correcto es un endpoint de lote; mientras tanto, el botón debe mostrar avance real
—`Guardando 7 de 21`— porque el dato ya existe en el bucle. Un contador que avanza convierte una
espera opaca en una espera con final visible. Es el cambio más barato de esta sección.

**Aplicar la plantilla.** Es la acción de mayor consecuencia del producto y hoy se confirma con un
`window.confirm()` nativo.

1. El `window.confirm` se reemplaza por el `AlertDialog` que ya existe en
   `shared/ui/alert-dialog.tsx`, con las mismas transiciones que un diálogo normal. El texto que ya
   se escribió —cuántos documentos, qué contiene, cuántos reemplaza— es bueno; solo hay que sacarlo
   del modal del navegador.
2. Al aplicarse, los requisitos que **cambiaron** —y solo esos— reciben la **marca de cambio**:
   fondo `--color-proceso-soft` desvaneciéndose en `--acr-marca-vida`. Sin stagger: todos a la vez.
   Es la única respuesta posible a *"¿qué me acaba de cambiar?"*.
3. Un toast persistente resume: *"Perfil Obra física: 21 documentos exigidos (14 activados, 3
   desactivados)"* — el backend ya devuelve esos tres números y hoy terminan en un `console.info`.
4. Si el toast puede llevar **Deshacer**, esta es la acción del producto donde más lo vale.

---

## 6. Accesibilidad y costo

### 6.1 `prefers-reduced-motion`

La respuesta habitual —poner todo en `0.01ms`— es la equivocada aquí, y por una razón de producto:
si se apaga el movimiento del todo, se apaga con él la señal de causa y efecto, y quien activó
reduced-motion pierde la única pista de que la aprobación surtió efecto. WCAG 2.3.3 pide *reducir o
reemplazar* el movimiento no esencial, no eliminar toda animación; los fundidos de opacidad y las
duraciones cortas siguen siendo alternativas seguras
([MDN, `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)).

La regla, entonces: **se conserva el tiempo, se elimina el desplazamiento.**

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --acr-mov-corto: 0px;      /* nada se desplaza */
    --acr-dur-recorrido: 160ms; /* el recorrido pasa a ser un fundido */
    --acr-dur-toque: 0ms;
  }
  /* El panel deja de deslizar: aparece con opacidad, en su sitio. */
  /* Todo latido y todo giro se detienen. */
  .acr-late, .animate-pulse, .animate-spin { animation: none; }
}
```

Bajo reduced-motion, en concreto:

- El panel lateral **no desliza**: aparece en su posición final con un fundido de `cambio`.
- La tarjeta aprobada **no se va hacia la derecha**: se funde. El hueco se cierra igual, porque
  cerrar el hueco es información, no decoración.
- El latido de `EN_ANALISIS` se detiene y el skeleton deja de pulsar (queda gris fijo). El estado
  lo comunican la palabra y el color, que ya cumplen AA.
- El spinner deja de girar y se sustituye por texto: *"Subiendo… 40%"*.

### 6.2 Costo, en un teléfono de gama baja con señal mala

INP (*Interaction to Next Paint*) sustituyó a FID como Core Web Vital en marzo de 2024, con umbral
de "bueno" en **200 ms**, y mide el ciclo completo de cada interacción, incluida la presentación
([web.dev, *Optimize INP*](https://web.dev/articles/optimize-inp)). Una animación que corre en el
hilo principal infla directamente esa métrica.

Reglas duras:

1. **Solo se animan `transform` y `opacity`.** Son las únicas propiedades que el compositor maneja
   sin recalcular layout ni repintar. `width`, `height`, `margin`, `top`, `left` no se animan
   jamás: se sustituyen por `transform`.
   → Hoy se violan en dos sitios muy transitados: el `mr-96` del panel y el `width` de la barra de
   progreso.
2. **`transition-all` queda prohibido.** Se enumeran las propiedades. Hay 22 usos hoy en 18
   archivos; cada uno es una invitación a animar una propiedad de layout sin querer.
3. **`will-change` se pone al empezar la interacción y se quita al terminarla.** Cada capa promovida
   consume memoria proporcional a su superficie en píxeles; dejarla puesta en 200 filas es peor que
   no ponerla.
4. **Nunca se anima `box-shadow`, `filter`, `blur` ni `backdrop-filter`.** Son las más caras del
   catálogo en GPU móvil. El panel puede tener `shadow-xl` fijo; lo que no puede es animarlo.
5. **Techo de elementos animándose a la vez: dos**, más el reflow de la lista. Si algo necesita
   animar 44 filas por separado, el diseño está mal, no la implementación.
6. **Se gatea el hover.** Hoy `transition-colors` está en todos los `hover:` sin condición. En
   táctil el `:hover` se queda pegado después del toque: la fila que el prevencionista tocó queda
   resaltada indefinidamente. Va dentro de `@media (hover: hover)`, igual que `globals.css` ya hace
   bien con `@media (pointer: coarse)` para las áreas de toque.
7. **La animación no compite con la red.** Al volver una respuesta, primero se pinta el dato y
   después se anima; nunca al revés.
8. **Presupuesto total del producto: ninguna interacción del nivel A puede costar más de 240 ms de
   animación.** Si dos animaciones se encadenan y suman más, se solapan o se corta una.

### 6.3 Lo que no se puede olvidar

- El foco (`:focus-visible`) ya está bien resuelto en `globals.css` y **no se anima**: aparece en el
  frame en que llega. Quien navega con teclado —el revisor de 40 documentos— necesita el anillo
  antes de que el ojo llegue, no 80 ms después.
- Toda animación que anuncie un cambio de estado necesita su equivalente para lector de pantalla:
  el toast va en un `aria-live="polite"`, y los errores en `assertive`. Un movimiento que solo se
  ve no comunicó nada a quien no lo ve.
- Las áreas de toque de 44 px que ya define `globals.css` no se reducen durante ninguna animación.

---

## 7. Qué NO animar, nunca

La parte que más se ignora, y la que más daño hace en un producto que se usa muchas veces al día.

1. **Números que cambian.** El KPI "47 contratistas", el contador del chip, los tres números del
   reporte de nómina. Nada de count-up. Un número que sube desde cero es ilegible durante toda la
   animación, y en un producto donde el número *es* el dato —cuántos pueden entrar a faena— eso
   convierte información en espectáculo.
2. **La entrada escalonada de filas (stagger).** 200 trabajadores × 30 ms de retardo son 6 segundos
   hasta que se puede leer la última fila. El stagger es aceptable en 5 elementos que se ven una
   vez; aquí no se ve una vez y no son 5.
3. **Los mensajes de error.** Aparecen en el frame en que existen. Un error que se desvanece hacia
   dentro llega tarde a un ojo que ya está buscando qué salió mal, y si aparece *moviéndose* se lee
   como decoración.
4. **Propiedades de layout:** `width`, `height`, `margin`, `padding`, `top`, `left`, `flex`, `gap`.
   Sin excepción. Se sustituyen por `transform`.
5. **El anillo de foco.** Instantáneo, siempre.
6. **Contenido al hacer scroll** (scroll-reveal, parallax, fade-in-on-scroll). En una tabla de 200
   filas es una animación por fila disparada por el gesto más frecuente que existe.
7. **Cualquier bucle infinito que no represente trabajo ocurriendo ahora mismo.** El latido de
   `EN_ANALISIS` es legítimo porque hay un worker procesando. Un icono que respira porque queda
   bonito es un consumo de batería y de atención permanente.
8. **La barra de progreso hacia atrás.** Si el porcentaje baja porque llegó un dato nuevo, se salta
   al valor correcto sin transición. Ver un progreso retroceder destruye la confianza en el número.
9. **Los cambios que el usuario no provocó y que no le exigen nada.** Un refetch en segundo plano
   que reordena la lista bajo el cursor mientras el revisor está a punto de hacer clic es peor que
   un dato desactualizado. Si la cola cambió, se avisa con un aviso quieto —*"3 entregas nuevas ·
   Actualizar"*— y se mueve cuando él lo pida.
10. **Los estados vacíos.** "No hay entregas pendientes de revisión" no se anima. Es la buena
    noticia y tiene que estar ahí, no llegar.
11. **La transición entre secciones del sidebar.** Cambiar de Revisión a Contratistas es navegación,
    no un efecto. Lo que sí hay que resolver es que no haya un blanco intermedio; eso se arregla con
    skeletons y `loading.tsx`, no con una transición de página.
12. **Rebotes, overshoots, springs y cualquier curva con `cubic-bezier` fuera del rango 0–1.** Aquí
    "aprobado" significa que una persona puede entrar a una faena.
13. **El overlay de un diálogo a `bg-black/80`.** No es una animación, pero es el mismo error de
    calibración: baja a `bg-ink/25` y se funde en `cambio`.

---

## 8. Cierre

### 8.1 Tokens, listos para copiar

Van en `globals.css` dentro de `@theme`, junto al resto del sistema. Reemplazan a `--ease-salida`,
que se elimina.

```css
@theme {
  /* ── Movimiento ─────────────────────────────────────────────────────────
     Cuatro duraciones, tres curvas, dos distancias. Cualquier valor fuera de
     esta tabla es un bug.

     El producto se usa por repetición: un revisor resuelve 40 documentos
     seguidos. Por eso la escala es corta y la salida siempre más rápida que la
     entrada — lo que se va ya cumplió su función.

     Curvas: set "productive" de IBM Carbon, diseñado para interfaces de tarea
     y uso repetido, no para momentos de marca.                              */

  --acr-dur-toque: 80ms;      /* respuesta bajo el dedo: hover, focus, check  */
  --acr-dur-cambio: 160ms;    /* algo cambia en su sitio — DEFAULT            */
  --acr-dur-recorrido: 240ms; /* algo atraviesa distancia — TECHO             */
  --acr-dur-sale: 120ms;      /* algo se va                                   */

  --acr-ease: cubic-bezier(0.2, 0, 0.38, 0.9);        /* default              */
  --acr-ease-entra: cubic-bezier(0, 0, 0.38, 0.9);    /* aparece: frena       */
  --acr-ease-sale: cubic-bezier(0.2, 0, 1, 0.9);      /* desaparece: acelera  */

  --acr-mov-corto: 6px;  /* asentarse, no volar */
  --acr-mov-panel: 100%; /* única traslación grande permitida */

  /* Permanencias — no son duraciones de animación */
  --acr-espera-antes-de-spinner: 400ms; /* antes de esto no se muestra nada */
  --acr-marca-vida: 900ms;              /* resaltado de "esto acaba de cambiar" */
  --acr-toast-vida: 4000ms;             /* los errores NO caducan */
}

@media (prefers-reduced-motion: reduce) {
  :root {
    /* Se conserva el tiempo —la causa y efecto sobrevive— y se elimina el
       desplazamiento, que es lo que dispara el malestar vestibular. */
    --acr-mov-corto: 0px;
    --acr-mov-panel: 0%;
    --acr-dur-recorrido: 160ms;
    --acr-dur-toque: 0ms;
  }
}
```

**Nota de implementación en Tailwind v4.** Los `--acr-dur-*` y `--acr-mov-*` quedan como variables
CSS puras y se consumen en valores arbitrarios: `duration-[--acr-dur-cambio]`,
`translate-x-[--acr-mov-corto]`. Las curvas, en cambio, conviene declararlas en el **namespace
`--ease-*`** que v4 sí reconoce, para que genere las utilidades directamente —es lo que ya hacía
`--ease-salida`—:

```css
@theme {
  --ease-acr: cubic-bezier(0.2, 0, 0.38, 0.9);        /* → ease-acr        */
  --ease-acr-entra: cubic-bezier(0, 0, 0.38, 0.9);    /* → ease-acr-entra  */
  --ease-acr-sale: cubic-bezier(0.2, 0, 1, 0.9);      /* → ease-acr-sale   */
}
```

Lo mismo con el namespace `--animate-*` si se prefiere a `@utility`. Y el detalle que dispara todo
esto: **hay que registrar el plugin de animación**, hoy instalado pero nunca cargado. En v4 se hace
en CSS, no en config — `@plugin "tailwindcss-animate";` en `globals.css`, o mejor `tw-animate-css`,
que es el sucesor pensado para v4. Sin esa línea, las clases del §1.1 seguirán sin existir.

Y el `@utility` que evita que alguien vuelva a escribir `transition-all`:

```css
/* Latido de "el sistema está trabajando". Único bucle infinito permitido. */
@keyframes acr-late {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.55; }
}
@utility acr-late {
  animation: acr-late 1.8s var(--acr-ease) infinite;
}

/* Marca de "esto acaba de cambiar". Se aplica y se quita. */
@keyframes acr-marca {
  from { background-color: var(--color-proceso-soft); }
  to   { background-color: transparent; }
}
@utility acr-marca {
  animation: acr-marca var(--acr-marca-vida) var(--acr-ease-sale) 1;
}

@media (prefers-reduced-motion: reduce) {
  .acr-late, .animate-pulse, .animate-spin { animation: none; }
}
```

### 8.2 Los cinco momentos donde el movimiento cambia más la percepción del producto

Ordenados por impacto, no por esfuerzo.

1. **La tarjeta aprobada sale de la cola, y la cola se cierra sobre el hueco — sin esperar a la
   red.** (`revision/page.tsx`) Es la diferencia entre 40 pulsaciones y 40 recargas. Hoy la lista
   entera se destruye y se repinta con "Cargando entregas…" para quitar una tarjeta. Ningún otro
   cambio de este documento se nota tanto.

2. **La aplicación empieza a decir que sí.** Montar `<Toaster />` —ya existe, ya está estilado, no
   lo importa nadie— y darle un acuse de recibo a cada acción. Hoy el producto nunca confirma nada,
   y esa ausencia es la que hace que el usuario dude si su clic funcionó.

3. **Los diálogos empiezan a existir.** Registrar el plugin de animación o escribir las cuatro
   líneas de CSS a mano. Hoy los diez componentes que usan `DialogContent` entran y salen con un
   corte seco más un flash de overlay negro al 80%, y el código dice lo contrario. Es la reparación
   con mejor relación esfuerzo/resultado del documento.

4. **La marca de cambio después de aplicar una plantilla.** Los 21 requisitos que cambiaron se
   resaltan y se apagan en 900 ms. Es la única respuesta posible a *"¿qué me acaba de cambiar?"* en
   la acción de mayor consecuencia del producto, y hoy esa respuesta no existe.

5. **La subida de archivo deja de ser un botón inerte.** Progreso real durante la subida, honesto
   ("Procesando", indeterminado) durante el trabajo del servidor, y cancelable. Requiere cambiar
   `api.upload` de `fetch` a `XHR`. Es el único punto del producto donde el usuario está en faena,
   con mala señal, esperando un minuto sin saber si algo sigue vivo.

### 8.3 La lista de lo que no se anima nunca

Para pegar en la revisión de código:

- Números que cambian — nada de count-up
- Filas escalonadas al entrar (stagger)
- Mensajes de error
- `width`, `height`, `margin`, `padding`, `top`, `left`, `flex`, `gap` — solo `transform` y `opacity`
- `transition-all`
- El anillo de foco
- `box-shadow`, `filter`, `blur`, `backdrop-filter`
- Contenido al hacer scroll (reveal, parallax)
- Bucles infinitos que no representen trabajo ocurriendo ahora mismo
- La barra de progreso hacia atrás
- Cambios que el usuario no provocó y que no le exigen nada
- Estados vacíos
- La transición entre secciones del sidebar
- Rebotes, overshoots, springs, `cubic-bezier` fuera de 0–1
- Hover en `pointer: coarse`

---

## Fuentes

- Jakob Nielsen, [*Response Times: The 3 Important Limits*](https://www.nngroup.com/articles/response-times-3-important-limits/) — Nielsen Norman Group, 1993, actualizado 2014. Umbrales de 0,1 s / 1 s / 10 s; progreso y cancelación obligatorios pasados los 10 s.
- IBM Carbon Design System, [`packages/motion/src/tokens.ts`](https://github.com/carbon-design-system/carbon/blob/main/packages/motion/src/tokens.ts) — código fuente, consultado agosto 2026. Curvas *productive* (`standard` 0.2/0/0.38/0.9, `entrance` 0/0/0.38/0.9, `exit` 0.2/0/1/0.9) frente a *expressive*.
- Material Design 3, [*Easing and duration — tokens & specs*](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs) — Google. Escala `short`/`medium`/`long`/`extra-long` (short2 100 ms, short4 200 ms, medium2 300 ms) y `emphasized` `cubic-bezier(0.2, 0, 0, 1)`. Referencia de contraste: sus duraciones son las de un producto de consumo.
- eBay Playbook, [*Motion tokens*](https://playbook.ebay.com/design-system/tokens/motion-tokens) — consultado agosto 2026. Escala de un marketplace de uso repetido: `instant` 17 ms, `short.2` 83 ms, `short.3` 167 ms, `medium.1` 250 ms; curvas `quick.enter` / `quick.exit` separadas.
- MDN Web Docs, [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) — disparadores vestibulares; escalar y desplazar objetos grandes es lo que hay que reemplazar, no toda animación. Concuerda con WCAG 2.3.3 *Animation from Interactions* (AAA).
- web.dev, [*Optimize Interaction to Next Paint*](https://web.dev/articles/optimize-inp) — Google. INP sustituyó a FID como Core Web Vital en marzo de 2024, umbral "bueno" en 200 ms; `transform` y `opacity` no provocan layout, `width`/`height`/`top` sí; `will-change` se aplica solo mientras dura la animación por su coste en memoria.
- MDN Web Docs, [*View Transition API*](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) — same-document soportado en Chrome 111+, Firefox 133+, Safari 18+; cross-document en Chromium 126+ y Safari 18.2+, Firefox pendiente a agosto de 2026.
