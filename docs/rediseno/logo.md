# Acredita — identidad de marca

Encargo: logo e identidad. No trato layout, componentes ni paleta general.

Punto de partida: `C:\Users\ctvas\projects\beriza\frontend\src\shared\ui\logo.tsx`

**Recomendación, por si no se lee lo demás: reemplazar el dibujo, conservar la
tesis.** La barrera no se refina — la probé de tres formas y ninguna se lee como
barrera; la única versión inequívoca comunica *cerrado*. En su lugar, la A de
Acredita dibujada como un pórtico. El razonamiento original sobrevive casi
entero; lo que se cae es la creencia de que una pluma levantada se puede dibujar
en tres trazos. Detalle en la sección 7.

---

## 0. Cómo evalué (para que se pueda repetir)

No juzgué el logo mirando el código. Rendericé el SVG real con `sharp`
(está en `frontend/node_modules`) **a su tamaño en píxeles reales** — 16, 28 y
96 px — y recién después amplié con vecino más cercano para poder mirar el
resultado. Es la única forma honesta de evaluar un favicon: un SVG mirado a
500 px siempre se ve bien.

Banco de pruebas: `…/scratchpad/pruebas.js` (`node pruebas.js <marca>`).
Fondos: blanco y `#0f172a` (el sidebar real). Tintas: `#a6552c` (cobre, la de
marca en claro) y `#93c0ee` (la de marca en oscuro). Los mismos tokens que usa
el componente.

---

## 1. Diagnóstico del logo actual

### El veredicto corto

**El argumento es correcto. El dibujo no lo cumple.** La marca actual no se lee
como una barrera: se lee como una **lámpara de escritorio**.

### Qué se ve realmente

Renderizado a tamaño real, el conjunto base-en-T + poste vertical + diagonal
que sube es la silueta canónica de una lámpara articulada tipo arquitecto. A
96 px es donde peor está: el dibujo tiene resolución suficiente para que el
cerebro complete el objeto, y el objeto que completa es una lámpara. A 28 px es
ambiguo. A 16 px es una mancha con un ramal.

Esto no es un juicio de gusto, es un fallo de denotación. Una barrera se lee
como barrera por dos rasgos que este dibujo eliminó:

1. **El contrapeso / la caseta.** En una barrera real la pluma pivota sobre una
   masa: un cajón, un cuerpo, un contrapeso. Aquí el poste es un palo del mismo
   grosor que la pluma. Sin masa en el pivote no hay barrera, hay un brazo.
2. **El umbral.** Una pluma levantada necesita algo *sobre lo que* estar
   levantada: el camino, la línea de paso, el otro lado. La base en T no es un
   umbral, es un pie. Y un pie convierte el objeto en mobiliario.

El comentario del archivo previó bien el riesgo contrario ("sin la base se lee
como un visto o una flecha") pero resolvió con una base que introduce un riesgo
peor: la base en T centrada bajo el poste es, literalmente, una base de lámpara.

### Problemas de ejecución, además del de lectura

- **El ángulo de la pluma es el peor posible para el antialiasing.** 30 de
  avance por 12 de subida son ~21,8°. Una diagonal tan tendida se rasteriza como
  una rampa larga y difusa, sin borde nítido, en cualquier tamaño chico. A 16 px
  la pluma no es una línea: es un degradado.
- **El grosor es de otra época.** 3,2 sobre 48 es 6,7 % de la caja. Las marcas
  de 2026 —o son geometría sólida, o son trazos ≥10 %. Un dibujo de línea fina y
  abierta se lee como ícono de librería (Lucide, Feather), no como logo. Y el
  producto ya usa Lucide en toda la interfaz: **el logo es indistinguible de los
  íconos de navegación que tiene al lado**. Eso es lo que más lo envejece.
- **Está descentrado.** Con trazo 3,2 y remates redondos, la tinta ocupa
  x 3,4–42,6 e y 6,4–42,6 en una caja de 48. Sobra aire abajo-derecha y falta
  arriba. En el lockup del sidebar el símbolo cuelga hacia la izquierda respecto
  del texto.
- **No es contenible.** Un dibujo de línea abierta sin caja se rompe cuando el
  sistema operativo lo enmascara: ícono PWA, avatar redondo en Slack, tile de
  Windows, remitente en Gmail. En 2026 una marca de producto tiene que
  sobrevivir a que le recorten las esquinas, y esta no tiene qué recortar.

### En claro vs. en oscuro

Aquí sí está bien resuelto y hay que conservarlo: el cobre `#a6552c` sobre
blanco y el azul `#93c0ee` sobre el sidebar tienen ambos contraste de sobra
(5,31:1 y 9,36:1). El cambio de tinta por contexto es una decisión correcta y
la propuesta la mantiene. Lo que falla es la forma, no el color.

### ¿Se ve de 2026?

No. Se ve de 2019-2021: la estética de "logo = ícono de línea de 24px con
`stroke-linecap: round`". Fue la convención de la era Stripe/Feather. Ya no lo
es: la corrección de rumbo de los últimos años va hacia marcas de **masa** —
sólidas, contenidas, con densidad óptica— precisamente porque el logo hoy vive
en superficies chicas y enmascaradas (favicon, avatar, ícono de app, chip de
notificación) donde una línea fina desaparece.

---

## 2. Qué hace la categoría

Investigué el mercado chileno y el internacional. **La premisa del comentario
original está desactualizada, y esto cambia la conclusión.**

### Lo que verifiqué (marcado con lo que efectivamente vi)

Chile, capa SaaS moderna:

| Producto | Qué encontré |
|---|---|
| Clodi (`clodi.cl`) | Logo servido como `/logo-clodi-text.svg`. Bajé el SVG: 7 paths, todos `fill="white"`, viewBox `215 37 403 120`. Son **puras letras** más dos formas redondeadas al final. Logotipo sin símbolo. |
| Valídate (`validate.cl`) | `assets/logo-validate.svg`, logotipo "Valídate". En la página, ícono `tick-icon.svg` — **el visto como recurso gráfico**. |
| Vigenty (`vigenty.cl`) | Logotipo; el texto extraído sale como "Vvigenty", que es la firma típica de un símbolo "V" pegado al logotipo. |
| PreveSafe (`prevesafe.cl`) | `assets/img/prevesafe.png`. Un PNG. En 2026. |
| Acreditación Contratistas (`acreditacioncontratistas.cl`) | `img/logo/logo.svg`, logotipo. **Sin escudo ni candado** en el marcado. |
| SubContrataLey (`subcontrataley.cl`) | `SubContrata-Transparente.png`. En el pie, insignias **ISO 9001 e ISO 45001** apiladas como prueba de confianza. |
| Portal contratistas Polpaico | No tiene marca propia: deriva a dos plataformas de terceros, "Asem" y "Oval" (`logo-asem.png`, `Logo-Oval.png`). |

Internacional:

| Producto | Qué encontré |
|---|---|
| Avetta | `avetta-logo-new.svg`. Bajé el SVG: viewBox `0 0 196 30`, 11 paths, colores declarados `#0B8968` (verde azulado oscuro), `#07F48E` (verde brillante) y blanco. Es **símbolo + logotipo**: formas triangulares superpuestas a la izquierda del nombre. El archivo se llama "new": es un rediseño reciente. |
| Veriforce | `veriforce-dark.svg`, alt "Veriforce". **Logotipo solo**, sin símbolo. |
| Highwire | `Highwire_Glyph_3d99dbb832.svg` — sirven un **glifo suelto**, sin logotipo, en la cabecera. |
| ISN / ISNetworld | La cabecera sirve `25th Anniversary - Final-07 (1).png` como logo. Un PNG conmemorativo de aniversario ocupando el lugar del logo. |

### Qué significa esto

**El cliché de la categoría ya no es el escudo.** El comentario del archivo
peleó la guerra anterior. Revisando la capa que de verdad compite hoy, no
encontré escudos ni candados en ninguno de los ocho sitios que miré. Lo que sí
encontré, y en todos:

1. **Logotipo genérico en una sans neutra, sin símbolo.** Veriforce, Clodi,
   Valídate, Acreditación Contratistas. Es la respuesta por defecto de la
   categoría.
2. **Geometría abstracta sin referente** cuando sí hay símbolo. Los triángulos
   de Avetta, el glifo de Highwire. No significan nada; son textura.
3. **El visto** como recurso gráfico suelto (Valídate).
4. **Insignias prestadas** en vez de identidad propia: ISO 9001/45001 apiladas,
   aniversarios, logos de terceros.

Es decir: **el riesgo real de Acredita en 2026 no es parecerse a un escudo. Es
ser invisible** — un logotipo más en una sans más, o un triángulo más.

Y de ahí sale el hallazgo que ordena todo lo demás:

> **Nadie en esta categoría es dueño de un objeto concreto.** Todos son letras o
> abstracción. La tesis original —tomar el objeto real del negocio y ponerlo en
> la marca— no solo sigue siendo válida: vale **más** de lo que su autor creía,
> porque el terreno está vacío.

Eso separa el destino de la tesis del destino del dibujo, y es la razón de la
recomendación que cierra este documento.

---

## 3. Intenté salvar la barrera. No se puede.

Antes de proponer otra cosa le di a la tesis original las mejores tres
oportunidades que se me ocurrieron, y las rendericé todas a tamaño real.

**Intento 1 — barrera con masa.** El diagnóstico decía que faltaban el
contrapeso y el umbral. Se los puse: umbral como barra pesada de lado a lado,
caseta como bloque redondeado de 10×16, pluma más empinada (25°) y con cuerpo.

Resultado: **una engrapadora.** O una perforadora, o una silla de playa. La
caseta y la pluma se funden en una sola masa doblada y el umbral se lee como un
escritorio. Peor que el original, porque ahora tiene suficiente materia para que
el cerebro se comprometa con un objeto equivocado.

**Intento 2 — el pórtico.** Dos patas verticales, dintel plano, y la barra
levantada cruzando el vano. Este sí se lee como un portal.

Y aquí está el hallazgo que cierra el asunto: **una barra que cruza el vano se
lee como cerrado, no como abierto.** Una diagonal atravesando una abertura es
el signo universal de "no". El pórtico con la barra inclinada comunica lo
contrario exacto de lo que el producto quiere decir. La semántica que el
comentario original perseguía —"la pluma está levantada, puedes entrar"— no solo
es difícil de dibujar: **las composiciones que sí son legibles la invierten.**

**Intento 3 — el ápice abierto.** Abrir el vano arriba en vez de al medio, para
que el hueco sea el paso.

Resultado: una **H**. Con las patas menos abiertas, una A rota. El ápice abierto
destruye la letra sin construir el portal.

### Lo que esto significa

La tesis "la barrera es el objeto real del negocio" es **buena estrategia de
marca y mala instrucción de dibujo**. Es verdadera sobre el producto y no es
representable a 16 px:

- Lo que hace que una barrera se lea como barrera en el mundo real son **las
  franjas rojas y blancas**. Son el rasgo distintivo, no la silueta. Y las
  franjas mueren a 16 px y no sobreviven a una tinta.
- Sin franjas, la silueta *pluma + poste + base* pertenece a una familia de
  objetos enorme: lámpara, grúa, engrapadora, brazo de tocadiscos, señal de
  tránsito. La barrera pierde ese desempate.
- Y la única versión inequívoca —el portal con la barra cruzando— dice "cerrado".

No se rescata. Hay que reemplazar el dibujo.

---

## 4. La propuesta: la A construida como un pórtico

Una sola dirección. No tres opciones equivalentes.

**El símbolo es la A de Acredita, dibujada —no compuesta— como una estructura de
acceso: dos patas abiertas, un dintel plano arriba en vez de vértice, y el
travesaño inclinado, subiendo hacia la derecha.**

### Por qué esto y no otra cosa

**Responde al razonamiento original en vez de ignorarlo.** El comentario tenía
razón en dos cosas y me quedo con ambas: (1) el escudo miente sobre lo que el
producto puede prometer, y (2) el objeto de este negocio es un paso controlado.
Lo que cambia es el portador. La tesis del pórtico sigue ahí —en la construcción
de la letra: el dintel es el dintel, las patas son los postes, el travesaño
inclinado es la pluma a media subida— pero deja de cargar el peso de la
denotación, que es lo que no aguantaba.

Sobre el escudo, además, corrijo el argumento con datos: **el escudo ya no es el
cliché de esta categoría** (sección 2, ocho sitios revisados, cero escudos). El
cliché de 2026 es el logotipo genérico y el triángulo abstracto. Contra eso, la
defensa no es tener un ícono más significativo: es tener una **letra propia**.

**Ataca el problema real del nombre.** "Acredita" es un verbo genérico y además
es el nombre de la categoría entera —Codelco llama a lo suyo "portal de
acreditación"—. Es como llamar "Contactos" a un CRM. El comentario detectó esto
correctamente pero lo resolvió pegándole "de BERISA", y eso no funciona
(sección 5). Un nombre genérico se vuelve nombre propio por **tipografía**, no
por atribución. Una A dibujada, con rasgos que no existen en ninguna fuente, es
exactamente eso.

**Es la única que sobrevivió a los píxeles.** De siete dibujos probados a 16, 28
y 96 px en claro y oscuro —el actual, dos rescates de la barrera, tres variantes
de ápice abierto y esta—, es el único que a 16 px sigue siendo una forma
reconocible con el contrapunzón abierto, y el único que a 96 px no se convierte
en otro objeto.

**Degrada bien.** A 16 px la inclinación del travesaño casi desaparece y la
marca se lee simplemente como una A sólida. Eso no es un fracaso: a ese tamaño
el trabajo es *reconocer una silueta familiar*, no leer un concepto. El rasgo
distintivo cobra a 28 px y hacia arriba.

**Rompe con los íconos de la interfaz.** Hoy el logo es un dibujo de línea fina
sentado al lado de íconos Lucide de línea fina: es uno más de la fila. Una
letra sólida es de otra categoría visual y se separa sola.

### Lo que cuesta, dicho de frente

Un monograma "A" para un producto llamado Acredita es la jugada más previsible
disponible, y a 16 px es una A en negrita como cualquier otra. Ese es el precio
real. Lo pago porque la alternativa —seguir intentando denotar— produce
engrapadoras y señales de "no pasar", y porque el terreno de la categoría no se
gana con significado sino con reconocibilidad.

### Geometría exacta

Caja de 48×48. Todo con `stroke-linecap="round"`, sin relleno.

```svg
<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-linecap="round">
  <!-- pata izquierda -->
  <path d="M11 39 L19.5 12"     stroke-width="7"/>
  <!-- pata derecha -->
  <path d="M37 39 L28.5 12"     stroke-width="7"/>
  <!-- dintel: ápice plano, no vértice -->
  <path d="M19.5 12 H28.5"      stroke-width="7"/>
  <!-- travesaño inclinado -->
  <path d="M14.56 27.7 L31.74 22.3" stroke-width="6"/>
</svg>
```

**La regla de construcción es un solo ángulo.** Las patas se abren 17,47°
respecto de la vertical (8,5 de corrimiento sobre 27 de alto). El travesaño sube
17,45° respecto de la horizontal (5,4 sobre 17,18). Son el mismo ángulo. Esa es
toda la lógica del dibujo y es lo que hace que la inclinación se lea como
decidida y no como un error de imprenta — probé 0°, 8°, 16° y 26°: a 8° parece
un defecto de renderizado, a 26° el contrapunzón se cierra en el extremo
derecho, y 17° es donde se lee como intención.

Los extremos del travesaño están calculados sobre el eje de cada pata, así que
si se cambia el grosor no hay que recalcular nada: siguen aterrizando en el
centro de la pata.

**Caja de tinta** (corte normal, grosor 7 con remates redondos): x de 7,5 a
40,5; y de 8,5 a 42,5. Centrada horizontalmente en 24. Verticalmente el centro
de tinta cae en 25,5 — 1,5 bajo el centro geométrico, que es correcto para una
forma triangular. En el lockup, alinear por esta caja y no por el `viewBox`.

### Cortes por tamaño óptico

El componente actual ya varía el grosor por tamaño; hay que mantener esa idea y
recalibrarla. Tres cortes, no una fórmula continua:

| Corte | Uso | Patas y dintel | Travesaño |
|---|---|---|---|
| Micro | ≤ 20 px — cabecera móvil, chips | 8,5 | 7,2 |
| Normal | 21–40 px — sidebar (28), lockups | 7 | 6 |
| Display | > 40 px — login, certificado, marketing | 6,2 | 5,4 |

Verificado a 96 px: el corte micro se ve tosco y el display se ve elegante, que
es exactamente el reparto que se busca. Usar el corte equivocado se nota.

### Variante en teja (fondo propio)

Para superficies que no controlamos —ícono PWA, avatar de Slack, remitente de
Gmail, tile de Windows, favicon sobre pestaña oscura— la marca necesita traer su
propio fondo:

```svg
<svg viewBox="0 0 48 48">
  <mask id="acredita-calado" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
    <rect width="48" height="48" fill="#fff"/>
    <g transform="translate(24,24) scale(0.86) translate(-24,-24)"
       fill="none" stroke="#000" stroke-linecap="round">
      <path d="M11 39 L19.5 12"     stroke-width="9.5"/>
      <path d="M37 39 L28.5 12"     stroke-width="9.5"/>
      <path d="M19.5 12 H28.5"      stroke-width="9.5"/>
      <path d="M14.56 27.7 L31.74 22.3" stroke-width="8"/>
    </g>
  </mask>
  <rect width="48" height="48" rx="10.5" fill="currentColor" mask="url(#acredita-calado)"/>
</svg>
```

Dos detalles que probé y que no son opcionales:

- **La A de la teja es un corte aparte, más gruesa y más grande** (escala 0,86,
  grosores 9,5/8). Con los grosores normales el calado a 16 px se convierte en un
  rasguño blanco casi invisible. Con estos, aguanta.
- **El `id` de la máscara tiene que ser único por instancia.** En React, `useId()`.
  Dos tejas en la misma página con el mismo id y una se rompe.

---

## 5. El nombre: Acredita y BERISA

### El problema actual no es la jerarquía, es la contradicción

El comentario del archivo argumenta que "de BERISA" es lo que convierte un verbo
genérico en nombre propio. Pero el componente acepta un prop `subtitulo` que
*reemplaza* "de BERISA", y **los tres sidebars lo usan**: "Portal Mandante",
"Portal Contratista", etc. Resultado: el endoso que se declaró indispensable no
aparece en ninguna pantalla de uso diario. El código ya decidió lo contrario de
lo que dice el comentario.

Y hay un problema más de fondo: **BERISA no tiene equity que prestar.** Busqué la
empresa y no encontré presencia pública. Un nombre desconocido no vuelve propio
a un nombre genérico; solo agrega una palabra. Lo que sí vuelve propio a
"Acredita" es la tipografía.

### La decisión

**Marca endosada, con una regla funcional de dónde aparece:**

> BERISA aparece donde Acredita afirma algo de lo que alguien puede ser hecho
> responsable. En ninguna otra parte.

No es una regla estética; es la misma lógica del producto. La responsabilidad
del mandante es solidaria, y un certificado sin entidad emisora no vale nada.
Donde hay una afirmación con consecuencias, tiene que haber alguien firmando.

| Superficie | BERISA | Por qué |
|---|---|---|
| Login, activar cuenta, restablecer | Sí | Primer contacto: "¿a quién le estoy entregando esto?" |
| Sidebar, uso diario | **No** | Ya entró. El slot vale más como "Portal Mandante". El código ya lo hace bien. |
| Correos transaccionales | Sí, en el pie | El correo sale del dominio a la bandeja de alguien que no nos conoce |
| **Certificado de acreditación** | Sí, y con peso comparable | Es el único artefacto donde BERISA es el *emisor*, no un endoso |
| Contratos, facturas | BERISA es la parte; Acredita es el producto | |

### Tratamiento tipográfico

Fuera el "de BERISA" en 10 px gris claro bajo el nombre. En el sidebar oscuro
con `ink-inverse-muted` es prácticamente invisible, y como subtítulo compite con
la información que de verdad sirve ahí.

- **BERISA en versalitas/mayúsculas**, IBM Plex Sans 500, tracking +0,08em, en
  `ink-subtle`. Mayúsculas porque "BERISA" ya se escribe como sigla; "de BERISA"
  en minúsculas mezcla registros y se lee como una nota al pie.
- Separado del lockup por una línea de 1 px o por espacio en blanco generoso —
  **no apilado directamente bajo el nombre**. Debe leerse como una firma, no como
  un descriptor.
- En el certificado: `Emitido por BERISA` con el nombre en versalitas, junto al
  folio y la fecha. Ahí sí puede ir en el mismo peso visual que Acredita.

### El logotipo

**IBM Plex Sans SemiBold (600), tracking −0,02em.** No hay que dibujar un
logotipo a medida: la app ya está en Plex por una razón argumentada y buena
(herencia industrial-técnica, cifras tabulares, diacríticos del español), y que
el logotipo sea la misma fuente hace que la marca y la interfaz sean un solo
sistema en vez de dos cosas pegadas.

Un ajuste sobre lo actual: el lockup usa 19 px `font-medium` (500), que es el
mismo peso que la interfaz. **El logotipo debe ir un escalón más pesado (600)**
para que no se lea como un texto más de la pantalla.

**Paso 2, cuando haya alguien con oficio tipográfico disponible:** sustituir la A
inicial de "Acredita" por la A del símbolo, con la inclinación del travesaño
reducida a ~8° para no perturbar la línea de lectura. Eso vuelve el logotipo
proprietario a costo casi cero y cierra el sistema: el símbolo *es* la primera
letra del nombre. No lo pongo en el paso 1 porque una sustitución mal ajustada a
Plex SemiBold se ve amateur, y es peor que no hacerla.

*(No pude renderizar el logotipo con Plex real: la fuente llega por
`next/font/google` y no está instalada en el sistema, así que las pruebas
tipográficas de este documento usan una sustituta. Las medidas de arriba son
especificación, no observación.)*

---

## 6. Sistema mínimo

Cinco superficies. Para cada una, qué se usa y por qué esa y no otra.

**Favicon (16 px).** Teja, corte micro, cobre `#a6552c`. **No la A suelta.** Una
A cobre sobre una pestaña de navegador en tema oscuro casi no contrasta, y el
favicon no puede negociar con el tema del navegador de forma confiable. La teja
trae su propio fondo y resuelve los dos temas con un solo archivo. Verificado a
16 px: la teja con corte normal se convierte en un rasguño; con corte micro
(escala 0,86, grosores 9,5/8) aguanta.

*Pendiente que hoy nadie está mirando:* `frontend/src/app/favicon.ico` es un
archivo binario independiente de `logo.tsx`. Cambiar el componente no lo toca. Si
no se reemplaza a mano, la marca nueva convive con el favicon viejo
indefinidamente.

**Sidebar oscuro (28 px).** A suelta, corte normal, `#93c0ee` sobre `#0f172a`
(9,36:1). Sin teja: sobre una superficie de marca que ya controlamos, la teja
agrega una caja que compite con la caja del sidebar. La regla general: **teja
solo donde no controlamos el fondo.**

El cambio de tinta por contexto —cobre en claro, azul en oscuro— es de lo poco
que hay que conservar tal cual del componente actual. Está bien resuelto y con
contraste medido.

**Correo.** Teja a 40 px, más el logotipo al lado. Los clientes de correo
recortan, comprimen y a veces bloquean imágenes: la teja sobrevive al recorte
circular de los avatares y la firma con BERISA va en el pie, en texto, para que
siga estando aunque las imágenes no carguen. **Nada de PNG con transparencia
para el fondo**: se ve sucio sobre el modo oscuro de Gmail. Teja opaca.

**Certificado de acreditación impreso.** Corte display, **una sola tinta,
negro**. Este es el entregable que se imprime, se fotocopia, se escanea y a veces
se manda por fax a la oficina de una faena. Requisitos que de aquí salen:

- Nada de degradados, ni de dos colores, ni de la teja: en fotocopia una teja
  cobre se vuelve un cuadrado gris sucio y la A calada se cierra. La A suelta en
  negro sobrevive a todo eso.
- Tamaño mínimo de impresión 12 mm de alto. Bajo eso el contrapunzón se cierra
  con la ganancia de punto del tóner.
- Acredita arriba como marca del sistema; **BERISA identificado como emisor**,
  con folio y fecha. El certificado es el momento en que la marca deja de ser
  software y pasa a ser una afirmación con consecuencias.

**Área de resguardo y mínimos.** Espacio libre alrededor de la marca = la mitad
del ancho de la caja de tinta (16,5 unidades de las 48). Tamaño mínimo en
pantalla: 16 px para la teja, 20 px para la A suelta — bajo 20 px la A suelta
pierde el contrapunzón contra fondos claros.

**Lo que la marca nunca hace:** no se inclina, no se le cambia el ángulo del
travesaño, no se rellena con degradado, no se pone dentro de un círculo (la teja
es rectangular con esquinas de 10,5 y así se queda), no se usa el cobre sobre
fondo oscuro ni el azul sobre fondo claro.

---

## 7. Recomendación

**Reemplazar el dibujo. Conservar la tesis.**

No es "mantener y refinar". Lo probé: la barrera no se refina, porque el problema
no es el trazo ni el encuadre ni el grosor. Es que el objeto no es representable
a este tamaño sin sus franjas, y que la única composición inequívoca —el vano
cruzado por una barra— comunica *cerrado*, que es lo contrario de lo que el
producto quiere decir. Dos intentos de rescate produjeron una engrapadora y una
señal de "no pasar".

Tampoco es "empezar de cero". El razonamiento del comentario original era en su
mayor parte correcto y sobrevive entero:

- Rechazar el escudo: **correcto**, y ahora con mejor fundamento del que tenía
  —no porque el escudo esté sobreusado en la categoría (no lo está), sino porque
  promete protección legal que el producto no da.
- El pórtico como objeto del negocio: **correcto**, y pasa a la construcción de
  la letra.
- Que el nombre necesita algo que lo vuelva propio: **correcto**. Solo que lo
  que lo vuelve propio es la tipografía, no "de BERISA".
- Sobrevivir a 16 px como criterio de diseño: **correcto**, y es el criterio con
  el que se eligió esta propuesta contra otras cinco.

Lo único que se cae es la creencia de que una barrera con la pluma levantada
puede dibujarse en tres trazos. No se puede, y el dato nuevo que lo decide es de
2026, no de cuando se escribió ese comentario: **la categoría entera es
logotipos genéricos y triángulos abstractos, y ahí no se gana con un ícono más
significativo sino con una letra que sea inconfundiblemente tuya.**

### Orden de trabajo

1. Redibujar `LogoAcredita` con la geometría de la sección 4, con los tres
   cortes ópticos.
2. Agregar la variante en teja, con `useId()` para la máscara.
3. Reemplazar `frontend/src/app/favicon.ico` — no se actualiza solo.
4. Logotipo a Plex SemiBold 600, tracking −0,02em.
5. Sacar "de BERISA" del lockup del sidebar; ponerlo en login, pie de correos y
   certificado, en versalitas, según la regla de la sección 5.
6. Después, y solo con oficio tipográfico disponible: la A del logotipo.

---

## Anexo — evidencia

Renders a tamaño real, en
`…\scratchpad\` (`node pruebas.js hoja <marca>` / `node pruebas.js comparar <px> <zoom> <lista>`):

| Archivo | Qué muestra | Veredicto |
|---|---|---|
| `hoja-actual.png` | La marca vigente a 16/28/96 | Lámpara de escritorio |
| `hoja-barrera.png` | Barrera con contrapeso y umbral | Engrapadora |
| `hoja-portico.png` | Pórtico con barra cruzando el vano | Legible, pero dice "cerrado" |
| `hoja-a2.png`, `hoja-a5.png` | Ápice abierto | Se convierte en H |
| `hoja-a4.png` | Ápice abierto + travesaño inclinado | Se convierte en N |
| `cmp-96-aT0_aT8_aT16_aT26.png` | Barrido de inclinación 0/8/16/26° | 17° es el punto |
| `hoja-aFinal.png` | **La propuesta**, 16/28/96, claro y oscuro | Aguanta los tres |
| `cmp-96-aMicro_aNorm_aDisplay.png` | Los tres cortes ópticos a 96 px | Se justifica tener tres |
| `cmp-16-teja_tejaMicro_aNorm.png` | Teja normal vs. micro vs. A suelta a 16 px | La teja necesita corte propio |
| `hoja-aNegro.png` | Una tinta, negro sobre blanco | Sirve para el certificado |

Fuentes de la sección 2 (todas verificadas leyendo el marcado o el archivo SVG,
no de memoria): [Clodi](https://clodi.cl/), [Valídate](https://www.validate.cl/),
[Vigenty](https://www.vigenty.cl/control-documental),
[PreveSafe](https://www.prevesafe.cl/contratistas),
[Acreditación Contratistas](https://acreditacioncontratistas.cl/),
[SubContrataLey](https://www.subcontrataley.cl/),
[Polpaico contratistas](https://www.polpaico.cl/contratistas/),
[Avetta](https://www.avetta.com/), [Veriforce](https://veriforce.com/),
[Highwire](https://www.highwire.com/), [ISNetworld](https://www.isnetworld.com/),
[Codelco — portal de acreditación](https://www.codelco.com/proveedores/portal-de-acreditacion-para-las-empresas-contratistas-de-vicepresidencia).
