# Referentes de diseño para Acredita — 2026

**Fecha de trabajo:** 11 de agosto de 2026.
**Alcance:** dirección de arte y referentes. No se modificó código.
**Estado:** completo.

---

## Nota de método — qué vi y qué no

En esta categoría casi todo está tras un login de cliente, así que marco el nivel de evidencia en cada
ficha en vez de escribir con una seguridad que no tengo:

- **[VISTO]** — accedí a la página y describo lo que hay.
- **[VISTO — texto]** — accedí, pero la herramienta me entrega la estructura y los textos, no el render.
  Puedo afirmar arquitectura de información y microcopy; **no puedo afirmar color, sombra ni espaciado.**
- **[LEÍDO]** — descripción de terceros (nota de prensa, centro de ayuda, reseña). No vi la pantalla.
- **[INFERIDO]** — deducción mía.

**Lo que NO pude ver, y conviene tenerlo presente al leer:** ninguna aplicación de la competencia por
dentro. Avetta, ISNetworld, Veriforce, Cognibox, SIGA, SIIRLL-VP y Vigenty exigen credenciales. G2
devuelve 403 a peticiones automatizadas y BusinessWire cortó la conexión dos veces. Todo lo que digo
de ellas viene de centros de ayuda públicos, notas de prensa y reseñas agregadas, y lo señalo caso a
caso. No describo pantallas que no vi.

**Sobre la calidad de las fuentes del frente 3:** buena parte de lo que se publica como "tendencias
2026" son artículos de agencia optimizados para buscadores, sin observación detrás. Los usé sólo para
detectar consenso, y **construí las afirmaciones firmes sobre cinco fuentes primarias fechadas**:
el ensayo de rediseño de Linear (12-mar-2026), el análisis de NN/g sobre iOS 26 (Raluca Budiu,
10-oct-2025), el anuncio de Pantone (4-dic-2025), la boleta de accesibilidad reportada por 9to5Mac
(18-mar-2026) y el comunicado de ISN (23-oct-2025).

---

# Frente 1 — La competencia

## 1.1 El hallazgo que ordena todo lo demás

Antes de las fichas, el dato que más debería influir en este rediseño.

En Chile existe **una industria de intermediarios cuyo negocio es operar estas plataformas en tu
lugar**. Nortec vende como servicio la "Carga de Documentación en WebControl" y el "Seguimiento de
Cambios" de la plataforma, y promete acreditación SICEP en 14 días hábiles
[VISTO — texto: `nortec.app/webcontrol`, 11-ago-2026]. MINPASS abre su sitio con la cifra del problema:
**39 días de promedio nacional de acreditación**, y estima cada día adicional en unos **US$500K** para
una operación grande [VISTO — texto: `minpass.com`, 11-ago-2026].

Un producto cuya interfaz genera un mercado de gente que la use por ti no tiene un problema de
funcionalidad: tiene un problema de diseño, y es un problema tan caro que la gente prefiere pagarlo
que sufrirlo.

Eso fija el listón real de Acredita, que no es verse mejor sino **que el dueño de la contratista chica
lo haga solo, sin contratar a nadie**. Es el criterio con el que juzgo cada referente de aquí en
adelante, y es lo que hace que la mitad de los referentes de moda no apliquen.

## 1.2 Avetta

**[LEÍDO — centro de ayuda público y blog corporativo. No vi la aplicación.]**

- **Estados por color:** semáforo. Verde es literalmente "green means go"; un documento de política
  rechazado —por ejemplo, por omitir normativa obligatoria— empuja el estado a rojo (artículos de
  Compliance en `help.avetta.com`, consultados 11-ago-2026).
- **Avetta Mobile** es lo más útil de esta ficha (blog de Avetta, *"Real-time supplier compliance —
  anywhere"*; la página fecha "6 de octubre" sin año, así que no puedo datarla con precisión). Tres
  decisiones que copiaría casi tal cual:
  1. **La app móvil es de sólo lectura.** No intenta ser la aplicación completa en chico. En terreno se
     consulta, no se carga.
  2. **Tres pantallas y nada más:** buscar proveedor o sitio, ver el estado de cumplimiento de un
     vistazo con indicador visual, y abrir el detalle de la brecha que está bloqueando el trabajo.
  3. **"One app, two lanes":** la app enruta sola según el permiso del usuario en lugar de ofrecerle un
     selector de modo. Nadie elige "soy mandante" al abrir.
- **El problema que declara resolver es exactamente el de Acredita:** cuadrillas esperando en portería
  mientras alguien confirma si están habilitadas, y trabajos que no parten porque la información de
  cumplimiento no está donde se toma la decisión.
- **Lo que le critican:** la interfaz "podría ser más simple, con navegación más clara y menos pasos";
  no es intuitiva en el primer uso; y —el dato que importa— **la dificultad se concentra en los
  proveedores chicos** (síntesis de reseñas de G2 y Software Advice, 2026, vía buscador; no pude abrir
  G2 directamente).

**Qué tomar:** la app móvil de sólo lectura, la reducción a tres pantallas, y el enrutado automático
por rol. Los tres encajan con el prevencionista con guantes.
**Qué no tomar:** el semáforo verde/rojo como único portador de significado (ver 3.4 y 5.2), y la
arquitectura de navegación completa, que es justamente lo que le critican.

## 1.3 ISNetworld (ISN)

**[LEÍDO — nota de prensa y reseñas. La URL en `isnetworld.com` devuelve 404 hoy; el titular y las
cifras provienen del resumen indexado del comunicado de BusinessWire del **23-oct-2025**, *"ISN
Enhances Scorecard Design for Improved User Experience"*. No pude abrir el cuerpo completo.]**

- Rediseñaron el **Scorecard** con "diseño visual modernizado" para mejorar claridad y navegación.
- La cifra que reportan: **+90% de uso** de los tableros de analítica y scorecard tras el rediseño.
- **Esa cifra es el argumento comercial del rediseño de Acredita, y conviene usarla tal cual.** No es
  que la gente no quisiera esos datos: es que no los encontraba. Rediseñar la capa de lectura —sin
  agregar una sola función— casi dobló el uso de lo que ya existía.
- **Lo que le critican:** "clunky"; mucha funcionalidad que se traduce en complejidad; y un patrón que
  aparece repetido en reseñas de 2025–2026: **para moverse hay que llamar a soporte.**

**Qué tomar:** la tesis, que es la que ordena la prioridad del trabajo. La pantalla de resultado —el
scorecard, o en Acredita el estado de acreditación por pilar— **es la pantalla más rentable de
rediseñar, por encima de cualquier formulario.** Es donde se decide si el producto se entiende.
**Qué no tomar:** nada visual. No vi el resultado y no voy a recomendar a ciegas.

## 1.4 Veriforce / Cognibox

**[LEÍDO — reseñas agregadas y fichas de producto. No vi la aplicación.]**

- Tablero configurable por cliente contratante, con estado de riesgo del contratista **según el modelo
  de puntuación propio de cada mandante**. Estructuralmente es lo mismo que `MandanteRequisitoConfig`:
  cada mandante define su propia vara. Confirma que la arquitectura de Acredita va bien encaminada, y
  que no es una complicación gratuita: es como funciona la categoría.
- **Lo que le critican, y es el dato duro:** curva de aprendizaje de **2 a 4 semanas** para personal
  administrativo, y **satisfacción móvil sistemáticamente menor que la de escritorio**.

**Qué tomar:** la confirmación de que la configuración por mandante es la estructura correcta.
**Qué no tomar:** el modelo mental completo. Dos a cuatro semanas de aprendizaje para un administrativo
—en un rubro con la rotación del rubro— es la definición del fracaso para el usuario de Acredita.

## 1.5 SICEP — el incumbente chileno

**[VISTO — texto: `sistemasicep.cl/pub/inscripcion`, 11-ago-2026. Estructura y textos reales. No
juzgo su aspecto visual porque no lo vi renderizado.]**

La pantalla pública de inscripción tiene tres patrones que Acredita **debe** copiar, y no por
gentileza con el incumbente sino porque ya son la expectativa del mercado chileno:

- **Pasos numerados y visibles arriba:** "1. Inscripción — 2. Pago — 3. Confirmación". El usuario sabe
  siempre dónde está y cuánto falta.
- **Autocompletado desde el SII por RUT.** La sección 1.1 se titula por la fuente del dato y llega ya
  poblada con RUT, "Razón Social", "Inicio de actividades" y "Actividades Económicas vigentes" con
  código, glosa y categoría SII. El usuario no tipea lo que el Estado ya sabe.
- **Agrupación en bloques numerados** (1.1 datos del SII / 1.2 datos adicionales / 1.3 contacto del
  representante), con obligatorios marcados.
- **Vocabulario del dominio chileno, no de formulario genérico:** "Mutualidad de la Empresa", "Nombre de
  fantasía", "Dirección Casa Matriz" con región, teléfono con selector de código de área.

**Qué tomar — es lo más accionable de todo el frente 1:**
1. **Precargar por RUT.** En Chile es expectativa establecida, no un lujo. Pedirle a una contratista que
   escriba su razón social a mano ya se lee como producto de segunda categoría.
2. **Vocabulario local exacto:** mutualidad, razón social, nombre de fantasía, faena, centro de trabajo.
   El producto debe sonar escrito por alguien que estuvo en una faena.
3. **Pasos numerados** en todo flujo largo.

**Qué no tomar:** la mezcla de recorridos. SICEP funde el alta con el pago y el contrato de
incorporación en el mismo flujo. En Acredita, cobrar y acreditar no deben compartir pantalla.

## 1.6 El resto del mercado chileno de faena

**[LEÍDO — sitios de producto y buscador. No entré a ninguna.]**

La competencia real de Acredita no es Avetta. Son estos — y varios son portales propios del mandante,
lo que cambia el análisis competitivo:

| Producto | Quién | Nota |
|---|---|---|
| **SIGA** | Antofagasta Minerals | Acredita empresas, personas **y vehículos** |
| **SIIRLL-VP** | Codelco, Vicepresidencia de Proyectos | Trabajadores, vehículos, maquinaria y **subcontratos** |
| **acreditacionpelambres.cl** / **acreditacioncentinela.cl** | Portales por faena | Confirman que hoy **cada faena tiene el suyo** |
| **Vigenty** | Chile | "Control documental de contratistas" |
| **Mine Pass** / **MINPASS** | Chile | Los dos más nuevos y los más ambiciosos |
| **SICAM (Sattel)** | Chile | Hardware + software de control de acceso |

Dos consecuencias de diseño, y las dos son fuertes:

1. **El contratista está acreditado en varias plataformas a la vez.** No compite por su atención con
   Netflix: compite con otras cuatro pantallas del mismo trámite, hechas por otros. La que se entienda
   sola gana, y el estándar contra el que se compara es bajísimo. Es una oportunidad enorme.
2. **Vehículos, maquinaria y subcontratos son ciudadanos de primera clase** en los sistemas serios de
   minería. Acredita hoy modela empresa y trabajador. Si el destino es minería, la tabla y el panel de
   detalle deben diseñarse desde ahora para un **"sujeto acreditable" genérico** —persona, vehículo,
   máquina, subcontrato— o habrá que rehacer la interfaz completa. Esto es arquitectura de información,
   no estilo, y es más barato decidirlo ahora.

## 1.7 MINPASS — el referente más cercano, y el mejor planteado

**[VISTO — texto: `minpass.com`, 11-ago-2026. Estructura y textos; no el render.]**

Es el competidor cuyo planteamiento conceptual me parece más correcto, y conviene mirarlo de cerca.

- **La metáfora es una credencial, no un expediente.** Muestran una credencial digital de muestra —
  "Juan Pérez M."— con RUT, empresa contratista, **vigencia y fecha de expiración**, y una **banda de
  datos legible por máquina en formato pasaporte**.
- **Los pilares son pestañas sobre la credencial:** Salud, Seguridad, Formación, Contrato, Competencias
  técnicas. Es exactamente el concepto de "pilar" de Acredita, resuelto como pestañas de un documento de
  identidad en vez de como tarjetas sueltas en un tablero.
- **Un panel por rol:** trabajador (perfil propio con "alertas automáticas de vencimientos"),
  contratista ("panel único para gestionar" a todos sus trabajadores), minera (visibilidad de toda la
  cadena).
- Abren con el costo del problema en días y dólares, no con adjetivos sobre el software.

**Qué tomar:**
- **La credencial como objeto central del producto.** Un trabajador acreditado debería tener una *cosa*
  que mostrar: foto, vigencia, código legible por máquina. Es infinitamente más comprensible que
  cualquier tablero para el usuario final, y es lo que la realidad de la portería pide. Acredita ya
  emite un certificado; la diferencia es tratarlo como el centro del producto y no como una salida PDF.
- **Vigencia y expiración como dato de primer nivel**, no como columna secundaria. Acredita ya tiene
  `fecha_vigencia_hasta` en el modelo desde el inicio (buena decisión); en la interfaz debe aparecer
  igual de temprano.
- Encabezar con el costo del problema en días, no con promesas de eficiencia.

**Qué no tomar:** el énfasis en cifras de ahorro dentro de la aplicación. Un prevencionista necesita
saber si Juan entra hoy, no cuánto ahorra la minera al año.

## 1.8 Síntesis del frente 1

Todas las críticas a los incumbentes convergen en **el mismo defecto, y no es fealdad gráfica**:

> Curva de aprendizaje larga · hay que llamar a soporte para navegar · el chico la sufre más ·
> lo móvil es peor que lo de escritorio.

Es un fallo de **arquitectura de información, estados vacíos y jerarquía** — no de estilo. Ninguno de
esos cuatro problemas se arregla cambiando sombras.

Y eso encaja de manera incómoda con el informe interno `docs/INFORME-UX-CUALITATIVO.md`, que ya detectó
en Acredita exactamente el mismo síndrome: ocho ítems de menú con idéntico peso visual y sin orden
sugerido; estados vacíos que informan de una búsqueda sin resultados en vez de enseñar el producto; y
un estado vacío que manda al usuario a un diálogo sin salida.

**Acredita está a tiempo de no cometer el error de la categoría, pero hoy lo está cometiendo.** Un
rediseño que cambie radios y sombras y deje los ocho ítems planos habrá pintado la pared equivocada.

---

# Frente 2 — B2B denso con buen diseño

## 2.1 Linear — y por qué es una trampa

Empiezo por acá porque el encargo advierte sobre esto y la advertencia es correcta.

**[VISTO — texto: `linear.app/now/behind-the-latest-design-refresh`, fechado **12 de marzo de 2026**.]**
Es fuente primaria, reciente, y describe con precisión hacia dónde se mueve el gusto B2B en 2026:

- **La barra lateral se atenuó a propósito:** más apagada, iconos más chicos, texto inactivo mudo, para
  que "el área de contenido principal —donde la gente trabaja— tenga precedencia".
- **Menos iconos y más chicos.** Quitaron "tratamientos visuales innecesarios como los fondos de color
  en los iconos de equipo".
- **Los bordes se suavizaron, no se eliminaron.** La razón es textual: los bordes y separadores "ayudan
  a clarificar la relación entre elementos". Bajaron el contraste y redondearon; no borraron.
- **La paleta se movió de grises fríos azulados hacia grises más cálidos**, buscando menos saturación
  sin perder nitidez.
- El principio que gobierna todo: **"no todos los elementos de la interfaz deben cargar el mismo peso
  visual"**.

**Qué tomar — tres cosas concretas, y ninguna es la estética:**

1. **El principio de peso visual desigual.** Acredita tiene hoy el defecto opuesto, documentado en su
   propio informe: ocho ítems de menú idénticos. Éste es el aporte real de Linear a este proyecto.
2. **Grises cálidos.** Acredita usa `#f8fafc`, `#0f172a` y toda la rampa slate: grises **fríos
   azulados**, exactamente de lo que Linear se está yendo. Es un cambio de unas pocas líneas de tokens
   con efecto desproporcionado sobre qué tan actual se ve. Ver 3.2.
3. **Estructura por borde de 1px de bajo contraste, no por sombra.** Acredita ya lo hace
   (`--color-line: #e2e8f0`, y un comentario que dice que los bordes no portan significado). Eso está
   bien resuelto y hay que defenderlo del impulso de "modernizar" con sombras.

**Dónde Linear NO aplica a Acredita — y esto hay que decirlo fuerte, porque es el error probable:**

- **La barra lateral atenuada es correcta para Linear y peligrosa para Acredita.** Linear atenúa la
  navegación porque su usuario lleva dos años dentro y ya sabe dónde está todo: para él la navegación es
  mobiliario. El usuario de Acredita entra tres veces al día, con guantes, y **su problema declarado es
  que no sabe en qué orden hacer las cosas.** Atenuar la navegación en Acredita agrava el hallazgo ALTO
  del informe interno. Acredita necesita **jerarquía dentro del menú** —unos ítems más fuertes que
  otros, con un orden de puesta en marcha visible— no un menú uniformemente apagado.
- **La densidad de Linear está calibrada para seis a ocho horas de pantalla continua.** Una reseña lo
  dice sin rodeos: la densidad de Linear sirve a gente que vive en un rastreador de incidencias seis
  horas al día (LogRocket, sobre "Linear design"). Acredita tiene sesiones de dos minutos. La
  consecuencia práctica es **misma densidad de información, menor densidad física**: las filas de
  Acredita deben ser más altas que las de Linear y los blancos de toque más grandes, **sin mostrar
  menos datos por fila.** Son dos ejes distintos y se confunden todo el tiempo.
- **Los atajos de teclado y la paleta de comandos no aplican.** No hay teclado en la faena. Todo lo que
  Linear resuelve con `Cmd+K`, Acredita tiene que resolverlo con algo visible y tocable.
- **El tema oscuro por defecto no aplica.** Una pantalla de teléfono al sol de Calama con interfaz
  oscura es ilegible: en exteriores, fondo claro con texto oscuro gana. Acredita debe optimizar para
  **claro, alto brillo, exteriores**, que es justo lo contrario del gusto dominante en herramientas de
  desarrollo.

## 2.2 Stripe

**[LEÍDO — documentación de soporte, changelog y análisis de terceros. No tengo cuenta.]**

- **Disciplina métrica:** cuatro tarjetas de KPI sobre el pliegue y nada más compitiendo por la
  atención (análisis de terceros, 2026).
- **Workbench** reemplazó el antiguo panel de desarrolladores para cuentas nuevas en agosto de 2024:
  consolidó salud de la integración, exploración de API, errores e inspección de objetos **en un solo
  lugar en vez de repartirlos por secciones**.
- **La advertencia:** en agosto de 2025 circularon reportes de comerciantes con el panel de Stripe
  consumiendo 100% de CPU y más de 5 GB de RAM en una carga, y tiempos de carga sobre 30 segundos
  (hilo de Hacker News y reporte asociado en GitHub). No lo verifiqué de primera mano.

**Qué tomar:** la disciplina de cuatro KPI y basta. Y sobre todo la idea de Workbench: **consolidar lo
que el usuario necesita para resolver un problema en una superficie**, en vez de repartirlo.
**Qué no tomar:** el peso. Acredita se usa con red de faena y teléfonos modestos. Un panel que necesita
5 GB de RAM es inservible acá; el rendimiento es una decisión de diseño, no de ingeniería, y hay que
tratarlo como restricción de arte.

## 2.3 Ramp y Mercury

**[LEÍDO — análisis de terceros. No vi las aplicaciones. Las cifras que siguen vienen de fuentes
secundarias de calidad media; las cito porque el patrón es coherente, no como dato duro.]**

- Los paneles fintech fuertes **abren con un número confiable**, no con una parrilla de widgets.
- Se reporta que el rediseño del flujo de gastos de Ramp (2024) logró **33% menos tiempo de revisión y
  50% más rapidez en reembolsos — por jerarquía, no por estética.**
- La distinción útil: **la densidad se calibra por rol.** Alta para equipos de finanzas (Ramp, Brex),
  mínima para fundadores (Mercury). No hay una densidad correcta: hay una por usuario.
- El detalle que sí importa mucho acá: **los números bien compuestos en una tabla comunican más rápido
  que casi cualquier visualización.** Cifras alineadas a la derecha, tipografía tabular, misma cantidad
  de decimales.

**Qué tomar:**
- **Densidad por rol, no por producto.** Acredita tiene cuatro roles con necesidades opuestas: el
  `mandante_admin` en escritorio quiere la parrilla completa; el `prevencionista` en terreno quiere una
  respuesta. Hoy la aplicación tiende a darles la misma pantalla. Ésta es probablemente la decisión
  estructural más importante del rediseño después de la jerarquía del menú.
- **Un número confiable arriba.** Para el mandante: *cuántas personas no pueden entrar mañana*. Para el
  contratista: *cuántos documentos dependen de mí ahora*. Uno, grande, y todo lo demás debajo. Acredita
  hoy pone cuatro tarjetas de KPI —y el informe interno ya observó que en cuenta nueva son cuatro ceros
  ocupando el mejor lugar de la pantalla.
- **Números tabulares.** Acredita ya lo tiene escrito en sus tokens (`--text-metric`, "siempre con
  tabular-nums"). Bien.

**Qué no tomar:** el tono de "coach". Ramp muestra dinero ahorrado para convertir una herramienta
financiera en un entrenador. Acredita no debe felicitar a nadie: la métrica equivalente sería
"trabajadores habilitados", y celebrarla es peligroso en un producto donde el falso positivo hace
entrar gente sin habilitar a una faena. **Acá el producto informa, no anima.**

## 2.4 Attio

**[LEÍDO — reseñas y análisis de sistema de diseño. No vi la aplicación.]**

- Invierte fuerte en **densidad, edición en línea y teclado**, con la tabla como centro del producto:
  vistas tipo planilla sobre un modelo relacional real.
- Rejillas limpias, etiquetas de alto contraste, y una paleta de verdes y teales que busca sentirse
  "viva" frente al software empresarial tradicional.

**Qué tomar:** una sola idea, pero buena — **la tabla es el producto**. En Acredita, la lista de
trabajadores con su estado por pilar no es una vista secundaria del expediente: es la pantalla
principal, y merece el mejor trabajo de diseño del proyecto.

**Qué no tomar, y es importante:**
- **La edición en línea tipo planilla.** En Acredita los estados no los edita una persona: los decide
  `reglas_service.py`. Una celda que parece editable en un producto donde el LLM extrae y las reglas
  deciden es una mentira de interfaz, y en un producto con responsabilidad solidaria las mentiras de
  interfaz se pagan caro.
- **La paleta "viva".** Attio usa verdes y teales de marca. Acredita **no puede** hacerlo: verde ya
  significa "cumple" en su vocabulario de estados. El comentario en sus propios tokens sobre el cobre
  —"PROHIBIDO dentro de la app: es adyacente al ámbar y competiría con advertencia"— es exactamente el
  razonamiento correcto, y hay que aplicárselo también a cualquier verde de marca.

## 2.5 Retool y Height

**[Evidencia insuficiente. No encontré fuentes primarias recientes con sustancia sobre su dirección de
arte, y no voy a rellenar con generalidades.]**

Lo único que anoto, y con reservas: Retool es el referente de "interfaz generada sobre datos", y su
estética es deliberadamente neutra porque debe absorber los datos de cualquiera. Es un mal referente
para Acredita, que tiene un dominio muy específico y debería *verse* de ese dominio. Un producto de
faena que se ve como una herramienta genérica de tablas desperdicia su principal ventaja de confianza.

---

# Frente 3 — Qué se ve moderno en 2026 y qué se ve viejo

Separo lo que tiene evidencia primaria de lo que es consenso blando, y marco explícitamente **moda
pasajera** frente a **mejora real**.

## 3.1 Lo que ya se ve viejo — con evidencia

| Rasgo | Por qué se ve viejo | Evidencia |
|---|---|---|
| **Grises fríos azulados** (la rampa slate por defecto) | Es la firma de 2021–2024. Linear se movió a grises cálidos en 2026 | Linear, 12-mar-2026 [primaria] |
| **Sombras difusas para separar tarjetas** | Reemplazadas por bordes de 1px de bajo contraste | Linear, 12-mar-2026 [primaria] |
| **Iconos grandes con fondo de color** | Linear los eliminó por ruido visual | Linear, 12-mar-2026 [primaria] |
| **Negro puro en tema oscuro** | Se busca "casi negro con temperatura" | consenso 2026 [secundaria] |
| **Glassmorphism de desenfoque pesado** (versión 2021) | Sobrevive sólo como capa muy sutil en superposiciones | consenso 2026 [secundaria] |
| **Radios grandes uniformes** (todo a 16–24px) | El radio debe escalar con el elemento, no ser un token único | consenso; coherente con Linear |
| **Cuatro tarjetas de KPI genéricas arriba** | Reemplazado por un número que importa | patrón fintech [secundaria] |

## 3.2 El cambio de temperatura: la mejora real más barata

Dos fuentes independientes y fechadas apuntan a lo mismo:

- **Linear** (12-mar-2026): de grises fríos azulados a **grises más cálidos**, menos saturados, sin
  perder nitidez.
- **Pantone** nombró **PANTONE 11-4201 Cloud Dancer**, un blanco roto, Color del Año 2026 (anunciado el
  **4 de diciembre de 2025**). Es **la primera vez que Pantone elige un blanco**, y lo justifican como
  contrapeso a un entorno sobreestimulado.

Es la señal más clara de hacia dónde va el gusto: **menos saturación, blancos con temperatura, calma.**

**Aplicado a Acredita, con nombre y apellido:** su superficie de aplicación es `#f8fafc` y su tinta
`#0f172a` — slate, azulado. Mover la rampa neutra a un gris cálido (familia stone/zinc cálido) mientras
se conserva **exactamente** la lógica semántica de color que ya tienen documentada es probablemente **el
cambio de mayor efecto por unidad de esfuerzo de todo el rediseño**. Es un puñado de tokens.

Con una precaución importante: el ámbar de acción (`#fffbeb` / `#92400e`) se apoya hoy sobre un neutro
frío que lo hace destacar por contraste de temperatura. Sobre un neutro cálido, **el ámbar pierde
separación**. Habrá que reverificar los estados sobre la nueva base, no sólo los contrastes de texto.

## 3.3 Moda pasajera — no seguir

- **Liquid Glass de Apple** (junio 2025) es el caso de estudio de qué no hacer en un producto de
  cumplimiento. La evidencia es contundente y fechada:
  - **NN/g** (Raluca Budiu, **10-oct-2025**): iOS 26 apiñó y encogió los blancos de toque, violando la
    guía de siempre de **al menos 0,4 cm entre objetivos y áreas de toque de 1 cm × 1 cm**; barras de
    pestañas que colapsan; texto sobre texto que resulta ilegible; iconos que se funden con el fondo.
  - **9to5Mac** (**18-mar-2026**): Liquid Glass **bajó las notas de Apple** en una boleta de
    accesibilidad visual; el impacto negativo se concentró en usuarios de baja visión.
  - Apple terminó introduciendo una variante "Tinted" porque la opción Clear resultaba ilegible en la
    práctica, y administradores de flotas corporativas y educativas advirtieron **riesgo de legibilidad
    y de cumplimiento**.
- **Interfaces "generadas por IA" y resúmenes automáticos en el tablero.** Avetta anuncia resúmenes de
  insight generados por IA para 2026. En Acredita hay una regla del propio proyecto que lo zanja: *las
  decisiones de aprobación nunca las toma un LLM.* Un resumen generado sobre una pantalla que decide si
  entra gente a una faena confunde la frontera que el producto se comprometió a mantener nítida. **La IA
  extrae; la interfaz muestra la regla que decidió.**
- **Gradientes de marca y efectos de brillo.** Venden en la página de inicio; en la aplicación compiten
  con los estados y no aportan.

## 3.4 Mejoras reales — sí seguir

1. **Peso visual desigual y jerarquía explícita** (Linear). Aplica con la corrección de 2.1.
2. **Bordes suaves en vez de sombras.** Estructura sin ruido, y además rinde mejor en teléfonos
   modestos.
3. **Temperatura cálida en los neutros.**
4. **Un número que importa, en vez de una parrilla de KPI.**
5. **Números tabulares y alineación de cifras.**
6. **Color con significado asignado y documentado**, no color decorativo. Acredita ya lo tiene, y es su
   mejor activo de diseño (ver 4).
7. **El color nunca solo.** Punto de color + texto, que es lo que Acredita ya especifica. Es
   simultáneamente accesible y más legible bajo sol que un badge sólido.

---

# 4. Diagnóstico de Acredita — dónde está parada realmente

Leí `frontend/src/app/globals.css` antes de opinar, y el diagnóstico obvio ("esto se ve de 2010") es
falso. Conviene decirlo porque cambia la recomendación entera.

**Lo que ya está bien, y hay que defenderlo de un rediseño entusiasta:**

- **La regla de asignación de color está escrita en el propio archivo** y es mejor que la de casi toda
  la competencia: el matiz responde "¿quién debe actuar, y con qué urgencia?", no "¿esto es bueno o
  malo?". Neutro = nadie actúa; azul = el sistema trabaja; ámbar = falta algo tuyo pero no bloquea;
  rojo = bloquea hoy; verde = cumple; violeta = decisión discrecional del mandante. **Eso es diseño de
  producto de verdad**, y no lo vi en ningún competidor.
- **Cada token de color trae su contraste medido en el comentario.** Hay tokens corregidos
  explícitamente por quedar bajo AA (el ámbar subido a 6.84; el `vacio-ink` subido a 7.2).
- **Los estados usan tonos -700 en vez de -500 con una justificación explícita: "más legibles bajo sol
  directo".** Alguien ya pensó en la faena.
- `--text-input` en 16px con la razón anotada: bajo 16px iOS hace zoom al enfocar.
- Escala tipográfica con peso, interlineado y tracking por token; `micro` responsive porque 12px es el
  piso real en teléfono.
- Valores en hex literal en vez de referenciar la paleta de Tailwind, para que un minor de v4 no mueva
  dos superficies que deben ser idénticas.

**Las tres brechas reales, en orden de importancia:**

1. **Jerarquía y secuencia** — el hallazgo del informe interno. Ocho ítems planos, sin orden de puesta
   en marcha, con estados vacíos que no enseñan. Ningún token arregla esto.
2. **El contexto de faena no está en los números, sólo en los comentarios.** Y acá está el hallazgo
   técnico más filoso de todo este trabajo:

   > El piso de contraste declarado es `--color-ink-subtle: #64748b /* 4.76:1 — PISO. Nada más claro
   > lleva texto. */`. Eso es **AA de interiores**. La guía para trabajo de campo bajo sol recomienda
   > **mínimo 7:1**, por encima del estándar de accesibilidad, precisamente por la visibilidad en
   > exteriores. Y el cuerpo por defecto es 14px, con `micro` a 11px en escritorio, contra 16–18px
   > recomendado para exteriores.

   Dicho de otro modo: **el sistema de color está calibrado para una oficina y el producto se usa en una
   portería a pleno sol.** Subir el piso de 4.76:1 a ~7:1 y el cuerpo de 14 a 16px en las vistas de
   terreno es un cambio pequeño en código y grande en resultado.
3. **No hay una credencial.** El producto emite un certificado como salida, no como objeto central. Es
   la diferencia entre MINPASS y un archivador.

**Y el punto de toque.** La guía de aplicaciones de campo con guantes es explícita: 44×44 px es
insuficiente; se recomiendan **60×60 px como mínimo** y **72×72 px para acciones primarias**, y evitar
gestos —pellizcar para acercar, multitáctil— porque el toque falso en entorno industrial es un riesgo.
Esto no es negociable en las vistas de terreno de Acredita y no aparece hoy en los tokens.

---

# 5. Cierre

## 5.1 Los tres referentes que más le sirven a Acredita

**1. MINPASS — por el concepto, y es el más importante.**
Es el único referente que resuelve el problema con la metáfora correcta: **una credencial, no un
expediente**. Una persona con foto, RUT, empresa, vigencia, pestañas por pilar y una banda legible por
máquina. Eso lo entiende un prevencionista con guantes en tres segundos; una tabla de cumplimiento
documental, no. Además está en el mismo mercado, con el mismo vocabulario y el mismo problema de
negocio medido en días. Acredita tiene el modelo de datos para hacerlo —los pilares, la vigencia, el
certificado— y le falta la decisión de diseño de poner la credencial al centro.
*Lo que no le tomo: el discurso de ahorro dentro de la aplicación.*

**2. Avetta Mobile — por la disciplina de recorte.**
Tres pantallas, sólo lectura, enrutado automático por rol. Es la mejor respuesta que encontré a "el
usuario abre esto tres veces al día con guantes". La decisión valiente no es qué poner en el móvil,
sino **qué dejar afuera**: en terreno se consulta, no se carga. Y "one app, two lanes" resuelve
elegantemente los cuatro roles de Acredita sin un selector de modo.
*Lo que no le tomo: la navegación de escritorio, que es justo lo que le critican.*

**3. Linear (marzo 2026) — por el principio, no por la piel.**
Vale por una sola frase —"no todos los elementos de la interfaz deben cargar el mismo peso visual"— y
por la dirección de temperatura del color. **Con la inversión explícita de una de sus decisiones:**
Linear atenúa la navegación porque su usuario ya sabe dónde está; Acredita debe **reforzar** la
jerarquía del menú porque el suyo no lo sabe, y ése es su hallazgo ALTO documentado. Tomar de Linear la
gramática visual —bordes suaves, grises cálidos, menos iconos, radio proporcional— y rechazar su
densidad, su tema oscuro, sus atajos de teclado y su barra lateral apagada.

**Menciones:** SICEP por la precarga desde el SII por RUT y los pasos numerados, que son expectativa de
mercado en Chile; e ISN por la única cifra que justifica presupuestariamente este trabajo — **+90% de
uso** por rediseñar la pantalla de lectura sin agregar una función.

## 5.2 Cómo debería verse Acredita en 2026 — para que alguien pueda dibujarla

**Párrafo uno — la aplicación en escritorio.**
Fondo de un blanco cálido, casi el Cloud Dancer de Pantone, no el `#f8fafc` azulado de hoy; toda la
rampa neutra corrida hacia el gris cálido, con la tinta principal un carbón cálido en vez de un slate
frío. Nada de sombras: la estructura la dan bordes de 1px de bajo contraste, y las tarjetas son
rectángulos de radio modesto —6 a 8px, escalando con el elemento, no 16px en todo. La barra lateral
sigue siendo oscura, pero **jerarquizada por dentro**: los tres o cuatro destinos que importan hoy, en
peso pleno; el resto, mudos y abajo; y mientras el mandante no termine su puesta en marcha, arriba de
todo una lista de cuatro pasos numerados —perfil, centro de trabajo, invitar contratista, servicio— que
desaparece sola al completarse. El centro de la pantalla es **una tabla, y la tabla es el producto**:
filas altas y respirables aunque densas en datos, una fila por trabajador o por sujeto acreditable
—porque mañana serán también vehículos, máquinas y subcontratos—, con el nombre en peso semibold, el
RUT en tipografía tabular, y el estado por pilar como una hilera de puntos de color con su etiqueta al
lado, nunca color solo, nunca un badge sólido de color fuerte. Sobre la tabla, **un solo número grande**
— "14 personas no pueden entrar mañana"— y no cuatro tarjetas de KPI en cero. Al hacer clic, un panel
lateral entra desde la derecha con el detalle: arriba, la brecha exacta en lenguaje humano y la regla
que la produjo; abajo, el documento y su vigencia. El ámbar y el rojo son los únicos colores saturados
en pantalla, y por eso se ven a un metro de distancia.

**Párrafo dos — el teléfono en la faena, que es donde se gana o se pierde.**
Otra aplicación, no la misma encogida. Tres pantallas y ninguna más: buscar, estado, brecha. Fondo
claro de alto brillo —jamás tema oscuro, porque se usa al sol—, contraste mínimo de 7:1 y no el 4.5:1 de
interiores, cuerpo de 16 a 18px, y **blancos de toque de 60px, 72px en la acción principal**, con
separación generosa entre ellos y cero gestos: sólo toques. La pantalla que importa es **la credencial**:
una tarjeta vertical con la foto del trabajador, su nombre, su RUT, la empresa contratista, una franja
de estado que ocupa el ancho completo y dice en palabras "Habilitado hasta el 14 de octubre" o "No
habilitado — falta examen de altura física", las cinco pestañas de pilar debajo, y un código legible por
máquina abajo para la portería. Sólo lectura: en terreno nadie sube un PDF con guantes. La aplicación
enruta sola según el rol —el prevencionista no elige "modo contratista"— y funciona sin señal, porque en
la faena no hay. Si alguien la mira de reojo desde dos metros y a pleno sol y sabe si esa persona entra
o no entra, el rediseño funcionó. Todo lo demás es decoración.

---

## Fuentes

**Primarias, fechadas**
- Linear — *A calmer interface for a product in motion*, 12-mar-2026 — https://linear.app/now/behind-the-latest-design-refresh
- Nielsen Norman Group — Raluca Budiu, *Liquid Glass Is Cracked, and Usability Suffers in iOS 26*, 10-oct-2025 — https://www.nngroup.com/articles/liquid-glass/
- Pantone — *Color of the Year 2026: PANTONE 11-4201 Cloud Dancer*, anunciado 4-dic-2025 — https://www.pantone.com/color-of-the-year/2026
- 9to5Mac — *Liquid Glass pushes Apple's grades down in accessibility report card*, 18-mar-2026 — https://9to5mac.com/2026/03/18/liquid-glass-and-long-standing-bugs-push-apples-grades-down-in-visual-accessibility-report-card/
- BusinessWire — *ISN Enhances Scorecard Design for Improved User Experience*, 23-oct-2025 (cuerpo no accesible; resumen indexado) — https://secure.businesswire.com/news/home/20251023760739/en/ISN-Enhances-Scorecard-Design-for-Improved-User-Experience

**Producto, consultadas 11-ago-2026**
- MINPASS — https://minpass.com/
- SICEP, inscripción pública — https://sistemasicep.cl/pub/inscripcion
- Nortec / WebControl — https://www.nortec.app/webcontrol/
- Avetta — *Real-time supplier compliance—anywhere* (sin año en la página) — https://www.avetta.com/blog/real-time-supplier-compliance-anywhere
- Avetta, centro de ayuda — https://help.avetta.com/
- Codelco, portal de acreditación VP — https://www.codelco.com/proveedores/portal-de-acreditacion-para-las-empresas-contratistas-de-vicepresidencia
- Acreditación Los Pelambres — https://www.acreditacionpelambres.cl/ · Acreditación Centinela — https://www.acreditacioncentinela.cl/
- Vigenty — https://www.vigenty.cl/control-documental · Mine Pass — https://mine-pass.com/ · SICAM (Sattel) — http://www.sattelchile.cl/en/productos/sicam-control-de-acceso/

**Secundarias — reseñas y análisis (calidad media; usadas para detectar consenso)**
- G2, reseñas de ISNetworld / Avetta / Veriforce (403 a acceso automatizado; citadas vía resumen de buscador) — https://www.g2.com/products/isnetworld/reviews
- Software Advice — https://www.softwareadvice.com/scm/isnetworld-profile/reviews/
- Subcontractor Audit — *Veriforce Contractor Management Software Reviews [2026]* — https://subcontractoraudit.com/blog/veriforce-contractor-management-software-reviews
- LogRocket — *Linear design: the SaaS design trend that's boring and bettering UI* — https://blog.logrocket.com/ux-design/linear-design/
- AlterSquare — *Mobile-First Design for Construction Management Software* — https://altersquare.io/mobile-first-design-for-construction-management-software-field-usability-guide/
- Masterly — *Fintech Dashboard Design: Patterns & Real Examples (2026)* — https://www.themasterly.com/blog/fintech-dashboard-design-guide

**Interna**
- `C:\Users\ctvas\projects\beriza\frontend\src\app\globals.css`
- `C:\Users\ctvas\projects\beriza\docs\INFORME-UX-CUALITATIVO.md`
