# Auditoría visual — Acredita
Revisión pantalla por pantalla para una renovación 2026.
Navegador real sobre `http://localhost:3001`. Viewport de escritorio efectivo: **1254 × 568 CSS px** (DPR 1.25).
Móvil evaluado a 375px reales (la app montada en un iframe de 375px, mismas media queries).
Recorrido: login y recuperación · portal Mandante completo (2 cuentas: con datos y recién creada) · portal Contratista completo · panel BERISA completo · estados de carga, vacío, error y 404.
Estado: **completo**.

---

## 0. El sistema de diseño que ya existe (punto de partida)

Leí `frontend/src/app/globals.css`. Hay que decirlo: **el sistema es bueno donde existe**, y eso cambia el diagnóstico. No estamos ante un producto sin criterio, sino ante uno con criterio incompleto.

**Lo que está resuelto y hay que conservar:**

- **La regla de color es semántica, no decorativa**, y está escrita: el matiz responde "¿quién debe actuar y con qué urgencia?" — neutro/azul/ámbar/rojo/verde/violeta. Que `excepcion` (violeta) sea "no depende de mí" es una decisión de producto real, no una paleta bonita.
- Cada token de texto declara su contraste sobre blanco (`--color-ink-subtle: #64748b; /* 4.76:1 — PISO */`). Hay un piso explícito y se respeta.
- Los estados vienen en tríos `soft` / `line` / `ink`, con `ink` en tono ~700 elegido a propósito "más legible bajo sol directo que los -500". Alguien pensó en la faena.
- `--text-input: 1rem` con la razón anotada: bajo 16px iOS hace zoom al enfocar. Y en `md:` baja a 14px.
- Área táctil mínima de 44px vía `@media (pointer: coarse)`, no vía breakpoint de ancho — el argumento correcto es el dedo, no la pantalla.
- IBM Plex Sans. Elección seria, industrial, y no es Inter. Bien.

**Los cuatro huecos del sistema — de acá salen casi todos los problemas visuales que siguen:**

1. **La escala tipográfica no tiene techo.** Los tokens van `meta 12 → body 14 → section 14/600 → input 16 → title 20 → metric 24`. Todo el producto vive en un rango de 12 a 24px: **una sola octava**. No hay display. La consecuencia se ve en la primera pantalla: un KPI de 24px al lado de un h1 de 20px no se lee como cifra, se lee como texto un poco más grande. Nada puede gritar porque no hay con qué.
2. **No hay lenguaje de elevación.** Cero tokens de sombra y cero tokens de radio. En todo el frontend hay **16 usos de `shadow-*`** (casi todos `shadow-sm` en dropdowns de Radix) contra ~45 archivos de pantalla. Todo es `borde 1px + blanco`. Es la estética de card de 2019: correcta, plana, sin jerarquía de capas. Un slide-over y una tabla van a pesar visualmente lo mismo.
3. **El movimiento no está diseñado.** Existe un solo token, `--ease-salida`, y ninguna duración. De 179 apariciones de `transition/animate` en el código, la abrumadora mayoría es `transition-colors` de hover. No hay entrada de paneles, no hay transición de estado de documento, no hay skeleton→contenido. Todo aparece de golpe.
4. **No hay escala de espaciado propia.** Se usa el default de Tailwind ad-hoc, así que el ritmo vertical lo decide cada pantalla por su cuenta. Se nota (ver §2).

Un quinto punto, más de marca que de sistema: `--color-brand-mark` (cobre `#a6552c`) está **prohibido dentro de la app** por adyacencia con el ámbar de advertencia. La decisión es defendible, pero el efecto neto es que la aplicación no tiene ningún color de marca: es slate + un azul acero. Visualmente **no se distingue de cualquier back-office**.

---

## 1. Login (`/login`)

Pantalla partida: panel izquierdo azul noche `#0f172a` con el discurso, panel derecho casi blanco `#f8fafc` con el formulario.

**Lo que funciona.** La proposición está bien escrita y bien jerarquizada: "Saber exactamente quién puede entrar a faena." a 30px/600 es lo primero que lee el ojo, y es lo correcto. El botón pasa de gris inerte a azul noche sólido cuando el formulario es válido — feedback de estado real, gratis.

**Debilidades:**

- **El panel oscuro está vacío por arriba.** Logo arriba del todo, titular a media altura: entre `y≈100` y `y≈250` hay ~150px de nada, y abajo otros ~180px. El bloque de contenido queda flotando sin anclaje. Se lee como una plantilla a la que le sacaron un módulo, no como una composición.
- **El copyright es ilegible.** `#475569` sobre `#0f172a` mide **2.44:1**, menos de la mitad del mínimo AA. Y dice **"© 2025"** en agosto de 2026: un dato viejo, en un producto cuyo negocio entero es "los documentos vencen". Pésima primera señal.
- **El campo de contraseña finge estar lleno.** El placeholder son ocho puntos `••••••••`. En un teléfono, a contraluz, el usuario ve un campo aparentemente completo. El placeholder de un campo de password no debe simular contenido.
- **`?sesion=expirada` no dibuja nada.** Llegué a `/login?sesion=expirada` y la pantalla es idéntica al login normal: cero banner, cero explicación. El prevencionista al que se le cayó la sesión a mitad de una carga vuelve al login sin saber por qué. Es un estado del sistema sin diseño.
- **El foco es casi invisible.** El anillo de foco del input es un doble borde tenue; sobre fondo casi blanco prácticamente no se ve. Contradice el propio `globals.css`, que define `:focus-visible { outline: 2px solid var(--color-brand) }` — el input lo pisa con su propio estilo.
- **Cero sombras en toda la pantalla** (verificado: `boxShadow` distinto de `none` en 0 elementos). El formulario no está sobre nada, está *en* el fondo.
- Las tres viñetas del panel oscuro son 13px con bullet gris: leen como letra chica de contrato, cuando en realidad son los tres argumentos de venta del producto.

**Qué haría:** anclar el bloque de texto al tercio inferior y llenar el aire superior con evidencia (un fragmento real de estado: "Movimiento de tierras — 2 de 2 no pueden ingresar"), levantar el copyright a `--color-ink-inverse-muted`, corregir el año, vaciar el placeholder de contraseña, diseñar el estado `sesión expirada` como banner ámbar sobre el formulario, y subir las tres viñetas a 14px con separación real.

---

## 2. Portal Mandante

### 2.1 Inicio — "Estado de mis faenas" (`/mandante`)

Tres KPI arriba (uno teñido de rojo), una etiqueta de sección, y una tarjeta de faena.

**Lo que funciona.** La prioridad de negocio está bien elegida: la primera tarjeta es "Personas sin poder ingresar" y es la única teñida (`bloqueo-soft` + `bloqueo-line`). El orden "más expuestas primero" es correcto. El subtítulo "1 de 1 servicios tienen incumplimientos" dice el estado en una línea, sin eufemismos.

**Debilidades:**

- **El número no pesa.** "2" se renderiza a 24px (`--text-metric`) contra un h1 de 20px. Cuatro píxeles de diferencia entre "el título de la página" y "la cifra que dice cuánta gente está parada en la puerta". El dato más importante del producto no domina la pantalla. Esto es consecuencia directa del techo de la escala (§0.1).
- **Tarjetas enormes con contenido diminuto.** Cada KPI mide 314 × 115px y contiene tres líneas de texto de 11-24px alineadas arriba a la izquierda. La proporción dato/superficie es pésima: se ven como cajas vacías con una etiqueta.
- **No hay contenedor de ancho máximo.** `main` ocupa 1030px y la tarjeta de faena los usa todos. La línea "Falta de la empresa: Certificado F30 — Antecedentes laborales y previsionales, Certificado F30-1 — …" corre **~180 caracteres de ancho**. La medida cómoda es 65-75. Ese párrafo es literalmente la lista de lo que hay que arreglar, y está tipografiado como para no leerse.
- **Dos tercios de la pantalla en blanco.** El contenido termina en `y≈410` de 568 disponibles y sigue vacío hacia abajo. No es respiración: es una página que no sabe qué hacer con su espacio. En un monitor de escritorio real el efecto empeora.
- **El dato clave de la tarjeta está en la esquina, chico.** "2 de 2 no pueden ingresar" vive a la derecha del título, a ~12px, en rojo. Compite y pierde contra el nombre de la faena a 15px/600 en negro. La jerarquía está invertida respecto de lo que importa.
- **El daltónico no distingue las dos cifras de esa fila.** "2 de 2 no pueden ingresar" (rojo `#b91c1c`) y "1 por revisar" (slate) están a 15px de distancia, mismo tamaño, mismo peso, y **la única diferencia es el matiz**. Bajo deuteranopia el rojo oscuro colapsa a un gris pardo casi idéntico al slate. El ícono de personita ayuda a una y no a la otra.
- **La etiqueta de sección casi no existe.** "Mis faenas · más expuestas primero" a 12px slate-400, pegada a la tarjeta. La escalera de jerarquía es 20 → 12 → 15px: el nivel intermedio es *más chico* que el que contiene.
- **No sé de qué empresa soy administrador.** En toda la pantalla no aparece el nombre del mandante ni el del usuario. La barra lateral dice "Portal Mandante" y nada más: no hay avatar, ni menú de cuenta, ni tenant visible. En un producto multi-tenant donde la misma persona puede operar dos mandantes, eso es desorientación pura.

### 2.2 Estado de carga (skeleton)

Alcancé a capturarlo. Cuatro bloques sólidos `#e2e8f0` con el mismo radio que las tarjetas.

- Los bloques son **más oscuros y más pesados que el contenido que reemplazan**: un skeleton al 100% de opacidad en slate-200 tiene más presencia visual que la tarjeta blanca final. La página se ve *más llena* cargando que cargada.
- La transición skeleton → contenido es un corte seco. Con `--ease-salida` ya definido en el sistema y sin usarse acá, es una oportunidad regalada.
- El bloque grande inferior (1030 × 165px) no anticipa la forma de lo que viene (una tarjeta de 120px): el layout salta.

### 2.3 Revisión de documentos (`/mandante/revision`)

**Esta es la pantalla donde el producto se gana o se pierde**: es donde una persona decide si otra persona entra a una faena. Hoy son dos tarjetas grandes con dos botones.

**Debilidades — y la primera es grave:**

- **El botón verde de "Aprobar" es el elemento más pesado de la pantalla, y "Observar" es un fantasma rosado.** Medido: `Aprobar` = fondo sólido `#047857`, texto blanco. `Observar` = fondo `#fef2f2` con borde `#fecaca` y texto rojo. La relación de peso visual entre ambos es de 5 a 1. En un producto de cumplimiento, donde aprobar de más significa que alguien sin habilitar entra a una mina, **el camino más fácil, más grande y más verde no puede ser "aprobar"**. Los dos botones deberían tener el mismo peso, y el que decide debería tener que elegir, no soltar el clic sobre lo que brilla.
- **Se pide una decisión sin mostrar la evidencia.** El PDF que hay que juzgar es un chip gris de 12px, `contrato-maria.pdf`. No hay miniatura, no hay visor, no hay ni siquiera número de páginas. La tarea real —mirar el documento— es lo más chico de la tarjeta.
- **Ninguno de los dos botones tiene hover.** Verificado en las clases: `hover:bg-ok-ink` sobre `bg-ok-ink` y `hover:bg-bloqueo-soft` sobre `bg-bloqueo-soft`. Son transiciones hacia el mismo color. Los dos controles más consecuentes del producto **no responden al mouse**.
- **Miden distinto:** Aprobar 88×32, Observar 95×34. Lado a lado, con 2px de diferencia de alto, se ve. No hay sistema de tamaños de botón: en el recorrido llevo alturas de 26, 32, 34, 36, 38 y 40px.
- **Los botones de decisión son de 12px.** `text-xs` en la acción principal del producto.
- **Las dos filas son visualmente idénticas.** Mismo título, mismo ícono ámbar de 36px, mismo chip `CONTRATO` en mono de 10px. Lo único que cambia —el nombre del trabajador— va enterrado en medio de una cadena gris de 12px separada por puntos medios: `Constructora QA SpA · Trabajador: María Soto Vargas · Legal / Laboral · 10 ago, 10:18 p. m.`. Cuatro tipos de dato distintos en una sola línea sin distinción. Con 40 documentos en cola esto es una pared.
- **Nada se alinea entre filas.** Al ser tarjetas y no tabla, la fecha de la fila 1 cae en x=735 y la de la fila 2 en x=759. Comparar dos entregas exige leer, no mirar.
- **"Actualizar" arriba a la derecha**: un botón de refresco manual es en sí una confesión, y visualmente es el único control del header, flotando solo.
- Fechas absolutas sin relativo ("10 ago, 10:18 p. m."). Para una cola de trabajo importa más "hace 12 h" o "hace 3 días" — la antigüedad es la urgencia.

**Qué haría:** convertirla en tabla densa con columnas alineadas (contratista / trabajador / requisito / antigüedad), miniatura del PDF a la izquierda de cada fila, panel de visor a la derecha, y un par de botones de igual peso con el verde reservado al estado resultante, no al control.

### 2.4 Diálogo "Observar documento"

- **Aparece de golpe.** `animationName: none`, `animationDuration: 0s`. Cero entrada. Un modal que se materializa sin transición sobre un velo al 80% de negro es un salto brusco de luminancia en pantalla completa.
- **El velo es 80% negro** (`oklab(0 0 0 / 0.8)`) y el diálogo tiene `shadow-lg` muy suave. O sea: la separación la hace toda el velo oscureciendo la app, y nada la hace el diálogo elevándose. Con un velo tan opaco, el usuario pierde por completo el contexto de qué documento está observando salvo por el subtítulo.
- **El anillo de foco choca con la etiqueta de arriba.** El textarea enfocado dibuja `0 0 0 2px white, 0 0 0 4px #245b93`; el espacio con la etiqueta es de 8px, así que quedan 4px y el anillo se lee **como si "Motivo de la observación" estuviera subrayado**. Lo comprobé quitando el foco: el subrayado desaparece. Es un defecto visible.
- **El botón deshabilitado parece roto, no deshabilitado.** "Observar" inactivo es salmón `#c98787` con texto blanco: ~2.6:1 de contraste. No se lee como "todavía no", se lee como un botón mal pintado, e invita a hacer clic.
- **Cuatro radios distintos en un solo diálogo:** contenedor 8px, textarea 6px, botones 6px, chips de la pantalla de atrás 8px, tarjetas 12px. No hay escala de radio.
- El textarea muestra el **agarre de redimensión nativo del navegador** (las rayitas diagonales), sin estilar. En un diálogo por lo demás cuidado, canta.
- La ayuda "El contratista verá este mensaje exacto para corregir su entrega." es excelente copy y está bien puesta. Nada que tocar ahí.

### 2.5 Contratistas (`/mandante/contratistas`) — la mejor tabla del producto

**Lo que funciona, y hay que decirlo fuerte:** el RUT va en **IBM Plex Mono con `slashed-zero`** (`78.111.222-4`). Es la decisión más fina que vi en toda la aplicación: un identificador de máquina, en tipografía de máquina, con el cero desambiguado. Los headers de columna a 12px/600 con `letter-spacing: 0.6px` en mayúsculas están bien calibrados. Las filas de 56px son densidad correcta. Y los estados de pilar (`• Brechas`, `• OK`) llevan punto **y** palabra: un daltónico los distingue por el texto.

**Debilidades:**

- **Hay dos diseños de tarjeta KPI distintos en el mismo portal.** En Inicio: etiqueta en caja baja de 13px, cifra de 24px (`text-metric`), línea de apoyo abajo. Acá: etiqueta en VERSALES de 11px, cifra de **30px** (`text-3xl` — un valor crudo de Tailwind, **no el token `--text-metric`**), sin línea de apoyo. El sistema define un token de métrica y esta pantalla lo esquiva. Además `text-3xl` no trae `tabular-nums`, que el propio comentario del token exige ("KPI, siempre con tabular-nums"): con cifras de 2-3 dígitos las columnas dejarán de alinear.
- **Se pintan los ceros de color.** "ACREDITADAS **0**" en verde y "EN PROCESO **0**" en ámbar. Un cero verde miente: cero acreditadas es el peor estado posible y se ve como logro. El matiz está codificando la **categoría de la columna**, no el **significado del valor** — que es exactamente lo contrario de la regla escrita en el propio `globals.css`.
- **Las tarjetas KPI y los chips de filtro dicen lo mismo dos veces.** `TOTAL / ACREDITADAS / EN PROCESO / BLOQUEADAS` arriba, y `Todos / Acreditada / En proceso / Bloqueada / Pendiente` justo abajo. Dos controles para la misma taxonomía, y el de arriba —el que ocupa 90px de alto— no se puede clickear. Las tarjetas deberían **ser** el filtro.
- **Dos gramáticas de estado en una misma fila.** "Bloqueada" es una píldora (fondo + borde + ícono); "Brechas" y "OK" son punto+texto sin fondo. Cuatro indicadores de estado en 5 columnas, con dos lenguajes visuales.
- **Una columna con encabezado sin nombre.** La penúltima columna tiene por header un ícono de personitas de 14px y por valor `0/2` en ámbar. En un producto de cumplimiento una columna sin etiqueta es una adivinanza.
- **El chevron de fila es casi invisible**: 14px en slate-300, al borde derecho. Es la única señal de que la fila entera es clickeable.
- **"1 de 1" flota a 1.200px de la barra de búsqueda**, sin ninguna relación visual con ella.
- El azul de marca `#245b93` existe en el sistema y **no se usa en el CTA principal**: "Invitar contratista" es azul noche `#0f172a`, el mismo tono que la barra lateral y que el chip de filtro activo. El navy significa a la vez "acción primaria", "filtro seleccionado" y "cromo de la aplicación".

### 2.6 Panel lateral de contratista (slide-over)

Esta es, con distancia, **la peor pieza visual del producto**.

- **Al abrirse, la tabla se encoge y todas las columnas saltan.** Medido: el ancho de `table` pasa de ~1.030px a **835px**, y la columna RUT se mueve de x=587 a x=494. El panel es `position: fixed`, pero el contenido además se reajusta. El usuario abre un detalle y la fila que estaba mirando se le mueve debajo del cursor.
- **Hay una barra de scroll horizontal nativa de Windows, con flechitas, dibujada como si fuera parte de la interfaz.** La tira de pestañas mide 379px de contenido en 343px de caja, con `overflow-x: auto`. El resultado es un track gris con `◄` y `►` justo debajo de las pestañas, y la última pestaña ("Servicios") cortada en "Ser". Es el elemento más antiguo que vi en toda la auditoría: no se ve de 2019, se ve de 2009.
- **El panel tiene `shadow-xl` y aun así se ve pegado.** La sombra computada es `0 20px 25px -5px` — desplazamiento **vertical**. En un cajón anclado al borde derecho, una sombra que cae hacia abajo no separa nada del lado que importa, que es el izquierdo. La elevación está declarada y apunta en la dirección equivocada.
- **Las agrupaciones internas son invisibles.** Cada pilar va en una caja `bg-surface-app` (#f8fafc) con borde `line-subtle` (#f1f5f9) **sobre panel blanco**: 1,03:1 de contraste de superficie y un borde que tampoco se ve. Los grupos existen en el DOM y no en la pantalla.
- **A 384px de ancho, el contenido se rompe.** "HSE — Salud, Seguridad y Medio Ambiente" ocupa dos líneas y empuja el contador a partirse en "4 / brechas", desalineado con su propio ícono.
- **La lista de brechas es una pared roja indiferenciada.** Siete ítems, todos con el mismo círculo rojo del mismo tamaño, el mismo texto de 13px, y todos terminando en `: falta subir` — el verbo, que es lo único accionable, va **al final de una frase de dos líneas**. Nada es escaneable. Para el contratista que tiene que arreglar esto, es un párrafo, no una lista de tareas.
- Lo que **sí** funciona: el panel entra con `transition-transform duration-300` — es de las poquísimas transiciones reales del producto, y se nota bien.

### 2.7 Servicios (`/mandante/servicios`)

Mismo molde que Contratistas (4 KPI + barra de filtros + tabla), y eso está bien: la plantilla es consistente.

- **Un `<select>` nativo del sistema operativo en medio de controles diseñados.** "Todos los centros" tiene `appearance: auto`: es el desplegable de Windows, con su flecha y su tipografía, entre un buscador con ícono a la izquierda y unos chips de esquinas de 8px. En esa barra conviven tres estéticas de control y tres alturas: buscador 40px, select 38px, chips 26px.
- **Dos formatos de fecha en el mismo portal.** Acá `2026-08-01` (ISO); en Revisión `10 ago, 10:18 p. m.`. Ninguno de los dos es la convención chilena que espera un prevencionista.
- **La columna ESTADO —la que importa— está al extremo derecho**, a ~1.100px del nombre del servicio. El ojo tiene que cruzar toda la fila para saber si algo anda mal.
- El número de contrato `CTR-QA-0001` en mono de 10px bajo el nombre del servicio: buen uso de la mono, pero el contraste es tan bajo que se pierde.
- "DOTACIÓN 2" es un número desnudo, sin `tabular-nums` y sin unidad.

### 2.8 Centros de trabajo (`/mandante/centros`)

**La pantalla más vacía del producto.** Una tarjeta de 418 × 130px arriba a la izquierda, y 90% del lienzo en blanco. No se lee como "poco contenido", se lee como "algo falló". Una grilla con un solo elemento necesita otro tratamiento: o la tarjeta ocupa el ancho, o es una lista, o hay un módulo que invite a crear el segundo.

- Dentro de la tarjeta hay tres colores de texto (slate, ámbar, azul de marca) todos a 12-13px y el mismo peso: **"Sin encargado asignado" —que es el problema— pesa exactamente lo mismo que "1 servicio en curso" —que es un dato neutro—.** El ámbar no alcanza a compensar la igualdad de tamaño.
- "Editar" es un botón de 55 × 26px con texto de 12px. Visualmente es una mota.
- El subtítulo "1 en operación · 1 sin encargado asignado" mete un problema y un estado normal en la misma frase gris, separados por un punto medio.

### 2.9 Perfiles de exigencias (`/mandante/requisitos`) — la más densa

Es la pantalla con más producto adentro y la que más sufre por falta de sistema.

- **Seis bandas de controles antes del primer contenido.** Título+botones / selector de perfil / "Aplicar plantilla" + tres plantillas / pestañas Empresa-Personas + segmentado Base-Ampliado-Opcional / banner azul informativo / y recién ahí el acordeón. Son ~290px de cromo. En un portátil, la tarea real empieza bajo el pliegue.
- **Tres gramáticas de "elegir" en tres filas consecutivas:** chips navy/outline (perfil), chips outline con contador tras un `·` (plantillas), y un segmentado de tres botones navy/blanco (Mostrar). Los tres hacen lo mismo conceptualmente y ninguno se parece al otro.
- **El banner azul repite lo que ya está en pantalla.** "Perfil **Obras civiles**: 8 requisitos exigidos…" cuando arriba ya está el chip "Obras civiles" seleccionado y la pestaña dice "Empresa 6 de 41". Una banda de ancho completo para decir por tercera vez lo mismo.
- **La paleta semántica se está usando como taxonomía, y eso rompe el idioma del producto.** El pilar Legal lleva punto y banda azules; HSE lleva punto y banda **ámbar**. En el sistema, ámbar significa "falta algo tuyo, todavía no bloquea". Acá significa "HSE". El usuario que aprendió el código de color lo ve contradicho en la misma sesión. Igual con el chip violeta `☆ Propio` (violeta = "decisión discrecional del mandante") y con el badge ámbar "Administrador" en Equipo (un rol). Tres apropiaciones decorativas de colores que tienen significado.
- **La fila de chips tras cada requisito es una sopa.** `MIPER` (mono, ámbar) · `Empresa` (gris) · `Por cada servicio` (gris oscuro) · `☆ Propio` (violeta): cuatro taxonomías distintas con cuatro estilos y sin leyenda.
- **Códigos de base de datos a la vista:** `NOMINA_PERSONAL`, `PROTOCOLO_KARIN`, `DECL_INCLUSION_LABORAL`. Snake_case en mayúsculas junto a etiquetas humanas.
- **El interruptor y su confirmación están a 700px de distancia.** Cada fila tiene un toggle a la izquierda y un círculo (✓ verde / vacío gris) al extremo derecho que dice lo mismo. Dos representaciones del mismo bit, separadas por todo el ancho de la pantalla, y el círculo no tiene encabezado que lo explique.
- **Una fila apagada casi no se distingue de una encendida**: el título sigue en navy semibold a full opacidad, el fondo es idéntico, y lo único que cambia es un toggle de 36px y un círculo de 14px.
- **Los títulos largos corren 800px sin quiebre.** "Protocolo de prevención y procedimiento de investigación de acoso laboral, acoso sexual y violencia en el trabajo (Ley Karin)" son ~120 caracteres en una línea. Es el requisito legalmente más delicado y el más difícil de leer.
- **Los campos numéricos no tienen unidad ni formato.** `Deuda máx. ($) [500000]` — sin separador de miles. En Chile eso es `$500.000`. Además el input de días y el de pesos son visualmente idénticos.
- "Guardar" arriba a la derecha está deshabilitado y es casi invisible (gris pálido sobre gris pálido). Es la única forma de persistir una pantalla llena de toggles.

### 2.10 Equipo (`/mandante/equipo`)

- **El binario más importante de la pantalla es casi invisible.** "Patricia Rojas Soto **sin acceso**": la única señal es una etiqueta gris de 11px y que el nombre esté en gris en vez de navy. En una pantalla de permisos, "tiene acceso / no tiene acceso" tiene que ser lo primero que se vea.
- El encabezado dice "1 persona con acceso" y se listan dos filas sin ninguna separación visual entre el grupo con acceso y el sin acceso. El conteo y la lista se contradicen a la vista.
- **Tres botones outline idénticos en fila: "Revisor | Permisos | Cuenta".** El primero parece ser un rol (un dato) y los otros dos son acciones. Mismo tamaño, mismo borde, mismo peso.
- La primera fila muestra una **empresa** ("Minera del Norte SpA") donde la segunda muestra una **persona**. Los avatares "MD" y "PR" tratan como iguales a dos cosas distintas.
- La alineación vertical difiere entre filas: en la primera el badge va arriba, en la segunda los botones van centrados.
- El badge "Administrador" es ámbar: un rol pintado con el color de "te falta algo".

### 2.11 Configuración (`/mandante/configuracion`)

- **Los campos son blancos sobre `#f8fafc` con un borde de 0,8px `#e2e8f0`.** Eso es 1,03:1 de contraste de superficie y ~1,2:1 de borde. En interior está bien; **en un teléfono a pleno sol, la caja del campo desaparece y queda solo la etiqueta flotando sobre nada.** Es el mismo problema en todos los formularios de la app.
- **Una segunda barra lateral dentro de la página** (Organización / Notificaciones / Seguridad), con una gramática de estado activo distinta a la del sidebar principal: acá es una tarjeta con borde en tres lados, allá es relleno + barra izquierda. Dos niveles de navegación lateral que no se parecen.
- **Esta es la única pantalla con ancho máximo** (`max-w-xl` = 576px) y es el más angosto posible, mientras el resto del producto no tiene ninguno. La disciplina de medida existe en un solo lugar y es la excepción, no la regla.
- **"Guardar cambios" está activo y en navy sólido sin que haya cambios**, mientras en Perfiles el guardar está deshabilitado y pálido. Dos comportamientos de guardado en el mismo portal.
- Íconos decorativos dentro de los campos (edificio, sobre, globo). No aportan y ensucian el inicio de línea del valor.
- "Avisar con [15] días de anticipación" es un buen patrón de input en frase, pero el texto de la frase es más claro que el número, así que la frase se lee al revés.

### 2.12 Error 404

Escribí una ruta que no existe (`/mandante/perfiles`, que en realidad es `/mandante/requisitos`) y caí en **la página 404 por defecto de Next.js: "404 | This page could not be found."**, en inglés, en la tipografía del sistema, centrada en una pantalla en blanco, **sin barra lateral y sin ninguna forma de volver**. Un prevencionista que abre un enlace viejo desde WhatsApp aterriza ahí y queda fuera del producto. El estado de error no existe como diseño.

### 2.13 Navegación: dos vocabularios

El menú lateral de escritorio y la barra inferior de móvil **nombran distinto los mismos destinos**: `Revisión`/`Revisar`, `Contratistas`/`Empresas`. Alguien que aprende el producto en el teléfono y luego lo abre en el computador no encuentra lo que aprendió.

También: en **todo el portal no aparece nunca de qué mandante ni de qué usuario se trata**. No hay avatar, ni menú de cuenta, ni nombre de organización — solo "Portal Mandante" bajo el logo. En un producto multi-tenant es desorientación permanente. (El nombre de la empresa aparece, casualmente, dentro de la lista de Equipo.)

### 2.14 Estados vacíos y de arranque (cuenta `forestal.qa` — mandante recién creado)

**Lo mejor que vi en toda la auditoría está acá.** El Inicio de una cuenta nueva muestra un módulo "Termina de configurar tu cuenta" con cuatro pasos numerados, el paso ya cumplido marcado con un check verde, y un CTA. Y los estados vacíos tienen copy que explica el futuro, no la ausencia: *"Cuando tengas una faena creada, acá vas a ver dónde hay gente sin poder ingresar."*, *"Cuando un contratista suba un documento aparecerá aquí."*. Eso es escritura de producto de buen nivel y no hay que tocarlo.

Lo que sí falla, visualmente:

- **El único botón del onboarding está huérfano.** "Ir →" mide 47px y flota al extremo derecho, a ~1.100px del paso al que pertenece. El ojo tiene que unir "Define qué documentos vas a exigir" (x=315) con un botoncito negro en x=1473.
- **El paso completado va tachado.** Una línea sobre el texto significa "anulado", no "hecho". En una lista de cuatro, el terminado se lee como el descartado.
- **Los pasos tienen alturas distintas** (el 1 mide 40px porque tiene descripción, los otros 22px), así que la lista se ve desflecada en vez de secuenciada. Y "1 de 4" es una etiqueta de 12px en una esquina: no hay barra de progreso.
- **Los estados vacíos son rectángulos de borde punteado.** El punteado significa "zona de arrastre" o "acá falta algo". Sirve para "todavía no configuraste", pero se usa **también para la buena noticia**: "No hay entregas pendientes de revisión" —que quiere decir "estás al día"— se dibuja con la misma caja punteada, el mismo ícono gris de 24px y el mismo texto gris que el estado de cuenta sin configurar. **El producto no distingue visualmente "todo en orden" de "no hay nada".**
- El titular del estado vacío está a 14px, el mismo tamaño que el texto de cuerpo. Un titular de estado vacío tiene que ser un titular.
- Las tres tarjetas KPI muestran 0, 0, 0/0 a tamaño completo. Un tablero cuyo contenido numérico entero es cero debería decir otra cosa.

---

## 3. Portal Contratista

Es el portal del usuario que pierde plata: el dueño de la contratista chica que no entiende qué le falta. Y es donde el problema de color del producto se vuelve grave.

### 3.1 Inicio — "Mi acreditación" (`/contratista`)

- **La jerarquía está exactamente invertida.** El h1 dice "Mi acreditación" (20px, navy) y no informa nada. El subtítulo dice **"Puedes trabajar en 0 de tus 2 servicios"** — la única frase que importa en todo el portal — y está a 14px en gris. Ese subtítulo debería ser lo más grande de la pantalla.
- **Cinco filas de prosa casi idéntica.** Cada pendiente es una frase de 90 a 130 caracteres a 14px, que corre hasta los 1.280px de ancho, con una sub-línea gris de 12px y un botón a la derecha. Cuatro de los cinco botones dicen exactamente lo mismo ("Ver ficha"). Es la lista de tareas del contratista y está escrita como un párrafo.
- **Nada indica por dónde empezar.** Las cinco filas pesan igual. No hay agrupación por faena, no hay orden visible, no hay "esto primero".
- **Ninguna fila tiene superficie de color.** Cinco problemas que bloquean gente, todos sobre blanco. En el portal del mandante, en cambio, la alarma sí venía teñida de rojo. **El que está bloqueado recibe menos alarma visual que el que bloquea.**
- **"Autorizar" es un botón negro sólido y "Rechazar" es un outline blanco.** Es una decisión de privacidad sobre el contrato de un trabajador, y la opción que cede datos es la que brilla. Mismo patrón que Aprobar/Observar en el mandante.
- **El bloque "Mis servicios" repite textualmente las mismas frases rojas** que ya están 400px más arriba, ahora alineadas a la derecha. El resultado es un layout de dos columnas donde **el nombre del servicio se parte en tres líneas en 100px** mientras el estado secundario ocupa 1.020px en una sola línea. La proporción está al revés y, con 900px de blanco entre ambos, el ojo no puede unir el nombre con su estado.
- Tres tipos de ícono (candado ámbar, círculo rojo, persona tachada slate) de 16px sin leyenda. El ícono de la fila que habla de una persona bloqueada es el más apagado de los tres.
- `(irl, ex odi)` en minúsculas acá; `(IRL, ex ODI)` en el panel del mandante. El mismo requisito escrito de dos formas en dos portales.

### 3.2 Mis documentos (`/contratista/documentos`) — **el peor error de color del producto**

La idea de fondo es excelente y hay que conservarla: cada documento muestra **un chip por cada mandante** que lo exige, con el estado ante ese mandante. Eso hace visible la promesa "se sube una vez y sirve para todos". Ahora, la ejecución:

- **"falta subir" y "en revisión" se pintan del mismo color.** Medido: los dos chips usan `#475569` a 11px. Es decir, **"esto depende de ti, no lo has subido" y "esto ya lo mandaste, ahora depende del mandante" son visualmente idénticos.** El propio `globals.css` define `espera` (neutro, nadie tiene que actuar) y `accion` (ámbar, falta algo tuyo) precisamente para separar esos dos casos, y la pantalla los colapsa en uno. Para el dueño de la contratista chica, esta es la diferencia entre "tengo que ir a buscar el papel" y "puedo irme tranquilo". Es el error visual más caro del producto.
- **El único chip con color es el verde de "aprobado".** O sea: lo ya resuelto es lo que resalta, y las siete cosas por hacer son grises. El énfasis cromático apunta al pasado.
- **Siete botones "Subir" negros idénticos, apilados en la columna derecha.** El documento ya aprobado tiene el mismo botón negro que el que falta. La acción no cambia con el estado, así que la pantalla responde "todo, por igual" a la pregunta "¿qué tengo que hacer?".
- El estado —que es lo que importa del chip— es la **última, más chica y más clara** de sus tres partes: `● Nombre del mandante · estado`.
- Los estados van en minúscula acá ("aprobado", "falta subir") y capitalizados en el resto del producto ("Aprobado", "Activo", "Bloqueada").
- **Dos `<select>` nativos del sistema más** ("Cualquier estado", "Todos los clientes") junto a un buscador diseñado y unas pestañas segmentadas. Tercera pantalla con el mismo problema.
- **Los pilares no llevan color acá** (punto gris) y **sí lo llevan** en Perfiles del mandante y en el panel de avance. El mismo objeto, tres tratamientos.
- Un candado gris de 14px sin etiqueta marca los documentos sensibles. Ícono semántico sin leyenda, al tamaño más chico del producto.
- Códigos de máquina (`MIPER`, `RIHS`, `F30_1`) a 10px slate-400: no se leen, pero sí ensucian.
- Las alturas de fila varían entre 82 y 96px según cuántos chips entren. La lista no tiene ritmo.

### 3.3 Diálogo "Subir documento" — la acción central, sin diseñar

- **El 36% del diálogo es texto de referencia legal, abierto por defecto.** "Qué debe contener este documento" trae 581 caracteres a 12px que ocupan 176px de un diálogo de 483px, con `LÍMITE:` y `REVISOR:` en versales dentro del párrafo. Es material para quien revisa, no para quien sube, y es lo más pesado de la caja.
- **El selector de archivo es el control nativo del navegador sin diseñar:** `Seleccionar archivo | Ningún archivo seleccionado`. Es literalmente la acción central del portal del contratista, y es el elemento menos trabajado de toda la aplicación. No hay zona de arrastre, no hay ícono, no hay nombre de archivo formateado, no hay barra de progreso de subida.
- **`accept="application/pdf"` y sin atributo `capture`.** El escenario real de faena es sacarle una foto al certificado con el teléfono, y la interfaz no lo ofrece ni lo insinúa: exige un PDF.
- **El "Subir" deshabilitado es navy al 50% de opacidad con texto blanco encima**, o sea gris con blanco: ~2,9:1. Y en el diálogo de Observar el deshabilitado era salmón con blanco. **Dos tratamientos distintos de "deshabilitado", los dos ilegibles.**
- La jerarquía interna está invertida: el panel de ayuda tiene fondo (`surface-sunken`) y la acción obligatoria es blanco sobre blanco.
- El marcador de despliegue es un triángulo de texto `▼`, no un ícono.

### 3.4 Trabajadores (`/contratista/trabajadores`)

Buena base. El RUT en mono, el avatar con iniciales, y —esto está bien resuelto— **las tarjetas de los bloqueados llevan borde `bloqueo-line` (#fecaca) y las normales `line` (#e2e8f0)**: el estado está en la superficie de la tarjeta, no solo en el texto.

- **Son tarjetas separadas por 14px, no filas de tabla.** Con 5 personas se ve bien; con 200 —una contratista real— es un scroll infinito de cajas flotantes donde ningún RUT, ningún cargo y ningún estado se alinea con el de arriba.
- El estado va alineado a la derecha, así que empieza en una x distinta en cada fila.
- **"Sin asignar a ningún servicio" es gris y "No puede ingresar" es rojo, pero miden y pesan igual.** Y el gris también es un problema (una persona sin asignar es una brecha de configuración) pintado como si fuera normal.
- **El cargo va en monospace** junto al RUT: `12.345.678-5 · Conductor`. Un cargo no es un dato de máquina; en mono parece un código.
- "Solo los bloqueados" es un chip que no se distingue de un botón de acción: no se ve que sea un interruptor.
- Los chevrons son slate-300 de 14px, casi invisibles, y son la única señal de que la tarjeta se abre.

### 3.5 Mis servicios (`/contratista/servicios`) — **una contradicción peligrosa**

En Inicio, este mismo usuario lee "**Puedes trabajar en 0 de tus 2 servicios**". Acá, la columna se llama **ESTADO** y muestra **"● Activo" en verde** para los dos.

Verde es, en el propio sistema, "cumple". Acá significa "el contrato está vigente". **Es el mismo color diciendo dos cosas opuestas al mismo usuario, en dos pantallas del mismo portal**, y la píldora verde es el elemento más brillante de la fila. Un prevencionista que entra directo a esta pantalla concluye que está todo bien.

Además:
- **Texto truncado con puntos suspensivos mientras la columna vecina está vacía**: "Antofagasta, Region de Antof…" cortado con 250px libres al lado.
- Fechas `2026-08-01` en ISO, otra vez.
- El subtítulo promete "su avance" y **no hay ninguna columna de avance** en la tabla; el avance vive escondido dentro del panel.
- Alturas de fila desiguales (62 vs 82px) porque una tiene dos sub-líneas y la otra tres.

### 3.6 Panel de avance del servicio

El módulo mejor pensado del producto: "AVANCE DE ACREDITACIÓN **30%**", barra de progreso, "3 de 10 documentos aprobados", y un bloque de cuatro cifras (Aprobados / Observados / En curso / Faltan). Conceptualmente, esto es lo que el contratista necesita.

- **El color vuelve a seguir la categoría en vez del valor.** "**0** Observados" se pinta en rojo y "**6** Faltan" en negro. El ojo va al cero rojo —que no requiere nada— en vez de al seis, que son seis documentos que faltan. Es el mismo error que los ceros verdes de Contratistas, y acá cuesta más caro.
- **Los nombres de documento se truncan a ~180px y dos filas quedan indistinguibles**: "Contrato de trabajo y sus an…" y "Contrato de trabajo y sus a…". El usuario no puede saber cuál es cuál.
- **`Vence: 2027-08-10`** — la fecha de vencimiento, que es el corazón del negocio, va a 11px en gris, en formato ISO, bajo el nombre truncado. Es de lo más chico y más pálido del panel.
- **Los pilares llevan chip de color acá** (azul Legal, ámbar HSE) y punto gris en Documentos. Tercera variante del mismo objeto.
- La barra de progreso es ámbar de 6px. Es la única barra de progreso del producto y usa el color de "advertencia" para una medida neutra.
- **Al abrirse el panel, la tabla de atrás se rompe**: "2026-08-01" se parte en dos líneas y "Extraccion de aridos" pasa a dos líneas. Abrir un detalle desarma la tabla que estabas leyendo.
- Los estados en las píldoras vuelven a colapsar: "Falta subir" y "En revisión", los dos en gris.

### 3.7 Precisión sobre los chips de estado (medido, no supuesto)

Al inspeccionar el DOM aparece un matiz que corrige lo anterior a favor del producto: **los tres estados sí tienen tratamientos distintos en código**.

| Estado | Tratamiento real |
|---|---|
| `aprobado` | `bg-ok-soft` + `border-ok-line` + `text-ok-ink` (verde) |
| `en revisión` | `bg-espera-soft` + `border-espera-line` (relleno slate) |
| `falta subir` | fondo transparente + **borde punteado** `border-vacio-line` |

La idea —punteado = "hueco por llenar"— es correcta. **El problema es que la diferencia está por debajo del umbral de percepción**: un punteado de 0,8px contra un sólido de 0,8px, y un relleno de `#f1f5f9` contra transparente (1,05:1 de contraste). Mirando la pantalla, buscando la diferencia a propósito, no la vi. Y sobre todo: **el texto de los dos es el mismo `#475569`, y ninguno usa el ámbar de `accion`**, que es el color que el sistema reservó exactamente para "falta algo tuyo". La distinción existe en el código y no llega al ojo — menos aún en un teléfono al sol.

### 3.8 Móvil a 375px — el escenario de faena

Monté la aplicación en un iframe de 375px para ver el layout real de teléfono.

- **La barra de navegación inferior del contratista está rota.** Es `grid grid-cols-4` con **cinco** ítems: "Equipo" cae a una segunda fila, solo, alineado a la izquierda. La barra pasa de 62 a **125px de alto** y come un quinto de la pantalla. En el portal del mandante la barra tiene cuatro ítems y se ve bien — el defecto es exclusivo del contratista, que es justamente el que anda en terreno.
- **Los chips de estado se parten en dos y tres líneas.** `● Áridos del / Sur SpA · en / revisión` — la palabra que dice el estado queda cortada entre dos líneas. Y los chips se apilan uno bajo otro ocupando 160px de ancho con 200px de blanco al lado.
- **Los encabezados de grupo en versales se parten en tres líneas**: "COMPLIANCE — / SOCIETARIO, TRIBUTARIO / Y DE INTEGRIDAD". Las versales largas a 375px son insostenibles.
- **La barra de filtros de "Mis documentos" se convierte en una torre de 250px** (pestañas + buscador + dos `<select>` nativos) antes del primer documento. Con un header de 56px, eso es ~60% de la primera pantalla de un teléfono ocupada en filtros. Y los tres controles tienen anchos distintos (204px, 185px, 185px), así que la columna queda desflecada por la derecha.
- En "Trabajadores" pasa lo mismo: título + subtítulo + dos botones + buscador + filtro = **330px antes del primer trabajador**.
- El avatar se reubica encima del nombre, así que cada trabajador pasa a ocupar ~120px: cinco personas son 600px de scroll.
- El header móvil tiene 56px y contiene solo el logo y un ícono de salir. No hay título de página, no hay volver, no hay identidad de la empresa.

---

## 4. Panel BERISA (admin de plataforma)

### 4.1 Dashboard BERISA (`/admin`)

- **Una cuarta variante de tarjeta KPI.** Ahora con ícono en caja redondeada arriba a la derecha. Contando: Inicio del mandante, Contratistas, Servicios y ésta. Cuatro diseños de KPI en un producto que tiene ocho pantallas de lista.
- **"TASA GLOBAL ACREDITACIÓN 0%" en verde.** El indicador de salud de toda la plataforma vale cero y está pintado de éxito. Al lado, "DOCUMENTOS PROCESADOS 3" en **violeta** — el color que el sistema reservó para "decisión discrecional del mandante".
- **Un donut que dibuja 0%**: un anillo gris completo con "0%" al centro. Un gráfico circular sin datos se lee como cargando o como roto. Y repite exactamente la cifra de la tarjeta KPI que está 250px más arriba: **el mismo número, dos veces, en 600px, una como número y otra como gráfico**.
- **Cuatro barras de progreso completamente vacías** en la lista de mandantes (0/1, 0/2, 0/1, 0/0). Cuatro rectángulos grises que no contienen información y que se leen como skeletons.
- **`Pro` y `BASICO` conviven en la misma columna** con dos capitalizaciones distintas (y `BASICO` sin tilde).
- "Gestionar mandantes ↗" usa la flecha de enlace externo para una navegación interna.
- Los dos paneles inferiores tienen encabezados distintos (uno con acción "Ver todos →", otro sin) y alturas distintas, así que sus bases no alinean.

### 4.2 Actividad reciente

- **Valores crudos de base de datos como texto de interfaz**: "Documento SII_SITUACION_TRIBUTARIA enviado", "Documento MIPER aprobado". SCREAMING_SNAKE_CASE dentro de una frase en español.
- El nombre del mandante se corta a la primera palabra ("Áridos", "Minera") y queda como un apodo.
- **Acá las fechas son relativas** ("Hace 20 horas") mientras en el resto del producto son absolutas. Sumando todo el recorrido llevo **cuatro formatos de fecha**: `2026-08-01`, `10 ago, 10:18 p. m.`, `Hace 20 horas` y `Hoy 05:54`.
- Tres columnas de 150 / 950 / 130px: el evento tiene 900px de margen derecho vacío antes de la hora.

### 4.3 Mandantes (`/admin/mandantes`)

- KPIs sin ícono acá y con ícono en el Dashboard: **dos tratamientos dentro del mismo portal**.
- "ENTERPRISE **0**" en ámbar, "PRO **2**" en azul: planes comerciales pintados con la paleta de estados.
- La columna ACREDITACIÓN muestra cuatro barras vacías más "0% / 0% / 0% / —". Nulo representado como "—" en una fila y como "0%" en las otras.
- El contador "4 mandantes" va abajo a la izquierda de la tarjeta; en el portal del mandante el equivalente ("1 de 1") va arriba a la derecha de la barra de filtros. **Mismo elemento, dos posiciones.**

### 4.4 Catálogo global (`/admin/catalogo`) — el bloque de texto más ilegible

- **Los párrafos de descripción corren los 1.230px completos a 12px**: ~200 caracteres por línea, casi el triple de la medida cómoda. Y dentro de esas líneas hay palabras en versales usadas como sub-títulos (`SUPUESTO:`, `FUNDAMENTO ACOTADO:`, `NOTA:`, `LÍMITE:`, `REVISOR:`) que producen un tartamudeo visual a lo largo de toda la línea. Es el peor bloque de texto de la aplicación.
- **Cinco chips por fila con cinco significados distintos**: código mono, alcance (`Empresa`), frecuencia (`Una vez` / `Por servicio`), nivel (`Base` / `Ampliado` / `Opcional`) y límite (`hasta 2 archivos`). Sin leyenda. Y `Base` va en **rojo** — el nivel más elemental pintado con el color de "bloquea hoy".
- Filas con y sin descripción alternan alturas de 48 a 110px: la lista no tiene ritmo.
- **46 requisitos sin buscador ni filtro.**

### 4.5 Usuarios (`/admin/usuarios`) — el ejemplo más nítido del problema de color

Las cuatro tarjetas KPI son: `TOTAL 10` navy · `ACTIVOS 6` **verde** · `MANDANTE ADMIN 4` **ámbar** · `CONTRATISTAS 3` **violeta**. Y las píldoras de rol repiten lo mismo: "Mandante Admin" en ámbar, "Contratista" en violeta.

Verde, ámbar y violeta son, en el propio sistema, "cumple", "falta algo tuyo" y "decisión discrecional del mandante". Acá son **una paleta categórica para tipos de usuario**. Es la demostración más limpia de la enfermedad: el vocabulario cromático que hace legible el producto se está gastando como decoración de taxonomías.

- Cuarto formato de fecha: "Hoy 05:54".
- **"Editar" es texto pelado al extremo derecho**, sin botón ni ícono, mientras todas las demás acciones del producto son botones.
- Otra vez empresas listadas como personas, con avatar de iniciales ("Cementos QA SpA", "Constructora QA SpA").
- Y otra vez los chips de filtro duplican las categorías de las tarjetas KPI.

### 4.6 Estados de carga y de transición — tres patrones distintos, uno inaceptable

1. **Skeleton** de bloques sólidos (Inicio del mandante).
2. **Texto pelado**: "Cargando catálogo…" centrado en una tarjeta vacía — y al mismo tiempo el subtítulo de la página afirma "**0 requisitos en 0 pilares**", un dato falso presentado como hecho mientras carga. Dos afirmaciones contradictorias en pantalla a la vez.
3. **Nada.** Al navegar a `/admin/usuarios` la pantalla quedó **completamente en blanco durante segundos: sin barra lateral, sin encabezado, sin nada**, solo el gris `#f8fafc`. Toda la aplicación desaparece. De los tres, éste es el que hay que matar primero: durante la transición el usuario no tiene ni siquiera navegación a la que volver.

---

## 5. Estados transversales

### 5.1 Error de credenciales — está diseñado, y se mueve solo

Entré con una clave mala y sí hay un estado: banda rosada con punto y "Credenciales incorrectas". Bien.

- **Pero al aparecer empuja todo el formulario 30px hacia arriba.** Comparando capturas, "Iniciar sesión" salta de y=224 a y=194. No hay espacio reservado ni transición: el formulario da un brinco justo cuando el usuario está mirando el campo de contraseña.
- El error es genérico y **no marca ningún campo**: la contraseña no queda en rojo, no hay vínculo visual entre el mensaje y el campo que falló.

### 5.2 `?sesion=expirada` — confirmado dos veces

Llegué a esta URL dos veces, una de ellas **generada por la propia aplicación** al expirar el token. En ninguna se dibuja nada: la pantalla es idéntica al login normal. El producto sabe por qué te echó y no te lo dice.

### 5.3 Hover — imperceptible donde más importa

La fila de la tabla de Contratistas usa `hover:bg-surface-app/70`: `#f8fafc` al 70% sobre blanco, o sea **1,02:1 de cambio**. Puse el cursor encima y amplié la zona: no se ve nada. Una fila entera clickeable cuyo único indicio es un chevron slate-300 de 14px, y cuyo hover no existe visualmente.

Y ya está dicho: **"Aprobar" y "Observar" tienen `hover:` hacia su propio color** — no responden al mouse en absoluto.

### 5.4 "Actualizar" sin acuse

Hice clic en el botón "Actualizar" de Revisión: no hay spinner, no hay toast, no hay parpadeo de la lista, no cambia nada. El usuario no puede saber si pasó algo. Un botón de refresco manual que no acusa recibo es peor que no tenerlo.

### 5.5 Recuperar contraseña (`/recuperar`) — otro producto

- **No comparte layout con el login.** El login es una pantalla partida con panel oscuro; ésta es un formulario centrado y desnudo sobre gris plano, sin tarjeta, sin borde, sin sombra. Dos pantallas del mismo flujo de autenticación con dos sistemas visuales distintos.
- **Acá el logo es cobre** (`brand-mark` #a6552c) y en el login es azul claro. Es el único lugar donde vi color de marca real en toda la aplicación, y aparece en una pantalla a la que casi nadie llega.
- "Te enviamos un enlace para elegir una nueva" está en pasado antes de haber enviado nada.
- Botón deshabilitado gris pálido, otra vez.

### 5.6 Móvil del mandante — la navegación se parte en dos idiomas

- **El header móvil tiene cinco íconos de 24×24px sin etiqueta.** Verificado: son `Centros`, `Perfiles`, `Equipo`, `Configuración` y `Cerrar sesión`. Cuatro de los ocho destinos del portal viven ahí, como glifos mudos de 24px en un header de 48px. Y son `<a>`, que el propio `globals.css` excluye a propósito de la regla de 44px táctiles. **Un prevencionista con guantes tiene que acertarle a un ícono de 24px sin etiqueta para llegar a Perfiles.**
- La otra mitad de la navegación es la barra inferior, con **etiquetas distintas a las del escritorio** ("Revisar", "Empresas"). Dos zonas de navegación, dos tratamientos, dos vocabularios.
- "Revisión de documentos" se parte en dos líneas porque el botón "Actualizar" —secundario— le quita 110px al título.
- Las filas de Revisión quedan tapadas por la barra inferior: los botones "Observar"/"Aprobar" asoman por encima del borde.
- Lo que **sí** mejora en móvil: la tarjeta KPI roja de "Personas sin poder ingresar" a ancho completo funciona mucho mejor que en escritorio. Es la prueba de que el problema de esa tarjeta en escritorio es de proporción, no de diseño.

---

## 6. Cierre

### 6.1 La pantalla peor

**El panel lateral de detalle de contratista** (`/mandante/contratistas` → abrir una fila). Concentra todos los defectos a la vez y agrega uno propio: al abrirse **encoge la tabla y mueve todas las columnas** que el usuario estaba leyendo; tiene una **barra de scroll horizontal nativa de Windows, con flechitas, dibujada como si fuera interfaz**, y con la última pestaña cortada en "Ser"; su `shadow-xl` apunta hacia abajo y por lo tanto no lo separa del contenido por el único lado que importa; sus agrupaciones internas son cajas de 1,03:1 de contraste, o sea invisibles; a 384px el contenido se rompe y parte "4 brechas" en dos líneas; y la lista de incumplimientos es una pared de siete líneas rojas idénticas donde el verbo accionable (`: falta subir`) va al final de cada frase.

Segunda peor, y por poco: **el diálogo "Subir documento"** del contratista, donde la acción central del producto es el selector de archivos nativo del navegador debajo de 581 caracteres de texto legal.

### 6.2 La pantalla mejor

**La tabla de Contratistas** (`/mandante/contratistas`), de la línea de encabezados hacia abajo. Filas de 56px —densidad correcta—, encabezados a 12px/600 con `letter-spacing: 0.6px`, el RUT en **IBM Plex Mono con `slashed-zero`**, y estados de pilar con punto **y** palabra para que un daltónico los lea. Ampliada, esa tabla se ve de 2026. Lo que la rodea (las cuatro tarjetas KPI con ceros de colores, los chips que duplican esas tarjetas, el hover invisible) es lo que la arrastra.

Mención aparte: **el estado de arranque de la cuenta nueva** (`forestal.qa`) y **los textos de los estados vacíos** son lo mejor escrito del producto y no hay que tocarlos, solo vestirlos.

### 6.3 Los cinco cambios visuales de mayor impacto

**1. Devolverle a la paleta su significado, y aplicarla donde importa.**
El sistema ya define que el matiz responde "¿quién debe actuar y con qué urgencia?". Hoy verde, ámbar y violeta se gastan como colores de categoría: roles de usuario, planes comerciales, nombres de pilar, ceros de KPI. Y donde el color sí decide algo —"falta subir" contra "en revisión" en el portal del contratista— no se usa: los dos son grises indistinguibles. Dos reglas duras: **(a)** un estado colorea el *valor*, nunca la *categoría* (se acabaron los ceros verdes y el 0% verde del panel BERISA); **(b)** todo lo que depende del usuario que mira va en ámbar `accion`, sin excepción. Las taxonomías (rol, plan, pilar) pasan a una escala neutra de grises con ícono.

**2. Estirar la escala tipográfica por arriba y usar el techo para la cifra que decide.**
Hoy el producto entero vive entre 12 y 24px. Agregar `--text-display` (40-48px, tabular, tracking cerrado) y usarlo para lo que un usuario tiene que ver desde la puerta: el **2** de "Personas sin poder ingresar", el **0 de 2 servicios** del contratista, el **30%** de avance. Y subir la frase de estado —hoy subtítulo gris de 14px— por encima del título de la página, que no dice nada.

**3. Convertir "Revisión" y "Mis documentos" en tablas alineadas, y equilibrar el par de decisión.**
Las dos pantallas donde el producto se juega el negocio son hoy listas de tarjetas con metadatos en cadenas separadas por puntos medios y nada alineado entre filas. Pasarlas a tabla densa con columnas fijas (contratista / trabajador / requisito / antigüedad / estado), con miniatura del PDF a la izquierda y visor a la derecha. Y en Revisión, **quitarle el peso al verde**: "Aprobar" y "Observar" con el mismo peso visual, verde reservado al estado resultante y no al botón que lo produce.

**4. Construir el lenguaje de capas y de movimiento que no existe.**
Tokens de sombra (con sombras **direccionales**: un cajón anclado a la derecha necesita `-x`, no `+y`), una escala de radio de tres pasos, una escala de espaciado, y tokens de duración junto al `--ease-salida` que ya está definido y casi no se usa. Con eso: entrada del modal, transición skeleton→contenido, y —lo más urgente— **matar la pantalla completamente en blanco de las transiciones de ruta**: el marco (barra lateral + encabezado) nunca debe desaparecer. También sube el contraste de superficies: hoy los campos de formulario son blancos sobre `#f8fafc` con borde de 1,2:1 y desaparecen al sol.

**5. Rehacer el móvil como si fuera el escenario principal, porque lo es.**
Arreglar la barra inferior de cinco ítems en `grid-cols-4` del contratista. Reemplazar los cinco íconos mudos de 24px del header del mandante por un menú con etiquetas y objetivos de 44px. Unificar el vocabulario de navegación entre escritorio y teléfono. Colapsar las torres de filtros de 250-330px en un solo control. Y en el diálogo de subida: zona de arrastre diseñada, **cámara habilitada** (`accept="image/*,application/pdf"` con `capture`), ayuda legal colapsada por defecto.

### 6.4 Qué se siente hoy al usarla

Se siente como un producto que alguien pensó con seriedad y después dibujó con prisa: las decisiones difíciles —qué significa cada color, qué dice cada frase vacía, por qué el RUT va en monoespaciada— están tomadas y bien tomadas, pero en pantalla todo llega igual de plano, igual de gris y igual de urgente, así que el usuario termina leyendo texto donde debería estar mirando.


