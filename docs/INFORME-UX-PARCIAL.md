# Informe de UX — primera pasada (parcial)

Revisión hecha contra el entorno local siguiendo `docs/QA-UX-UI.md`.

**Alcance de esta pasada.** Los dos agentes lanzados para hacer la revisión
completa se colgaron por un fallo de infraestructura antes de producir nada, así
que la hice yo directamente y con foco en lo que se puede **medir**:
accesibilidad, comportamiento en pantallas chicas y consistencia del sistema de
color. Los recorridos cualitativos por persona —si un usuario nuevo entiende qué
hacer, si la información está bien jerarquizada, si el vocabulario es el suyo—
quedan pendientes y son la mitad más valiosa del encargo.

Todo lo que sigue está medido en pantalla, no estimado.

Orden sugerido de trabajo, por relación entre daño y esfuerzo:

| # | Hallazgo | Impacto | Esfuerzo |
|---|---|---|---|
| 1 | Columnas inalcanzables en la tabla de contratistas | Alto | Bajo |
| 2 | 41 interruptores sin nombre accesible | Alto | Bajo |
| 3 | BERISA no puede ayudar a quien perdió su contraseña | Alto | Bajo |
| 4 | Objetivos de toque bajo 44 px | Medio | Medio |
| 5 | El panel lateral no cabe en un teléfono | Bajo | Bajo |
| 6 | Dos familias de color al límite de contraste | Bajo | Bajo |

---

## [ALTO] En la tabla de contratistas, las columnas que dicen si la empresa cumple son inalcanzables en pantalla chica

- Usuario: mandante
- Pantalla: `/mandante/contratistas`
- Qué observé: la tabla mide **836 px** y vive en un contenedor con
  `overflow-x: hidden`. A 510 px de ancho, las columnas **LEGAL, HSE,
  COMPLIANCE** y las dos de acciones quedan pasadas del borde derecho. No es que
  se vean apretadas: **no se puede llegar a ellas**, porque el contenedor no deja
  desplazarse. En un teléfono de 375 px se pierde también ACREDITACIÓN.
- Por qué es un problema: esas columnas son la respuesta a la única pregunta que
  el mandante trae a esta pantalla —"¿esta empresa cumple?"—. Lo que queda
  visible es razón social y RUT, es decir, todo menos la respuesta. Y como no hay
  scroll, nada le indica que hay más contenido: la pantalla se ve completa.
- Qué propongo: en móvil abandonar la tabla y pasar a tarjetas apiladas, con el
  estado global arriba y los tres pilares como una fila de puntos con su
  etiqueta. Si se prefiere conservar la tabla, el mínimo indispensable es
  `overflow-x: auto` en el contenedor, para que al menos se pueda desplazar.
- Esfuerzo: medio (tarjetas) · bajo (sólo habilitar el scroll)

## [ALTO] Los 41 interruptores que deciden qué se exige no tienen nombre para un lector de pantalla

- Usuario: mandante
- Pantalla: `/mandante/requisitos`
- Qué observé: de 63 botones de la pantalla, **41 no tienen texto, ni
  `aria-label`, ni `title`**. Son los interruptores que activan cada requisito
  del catálogo. Para alguien que navega con lector de pantalla son 41
  conmutadores idénticos sin identificar. Además **46 elementos interactivos
  miden menos de 24 px** en algún lado: el interruptor es `h-5` (20 px).
- Por qué es un problema: es la pantalla donde el mandante decide qué le va a
  exigir a sus contratistas, y cada interruptor tiene consecuencias legales. Sin
  nombre accesible, esa decisión es intomable para quien no ve la pantalla; y a
  20 px es incómoda para cualquiera con el dedo, incluso sin discapacidad. El
  mínimo de WCAG 2.5.8 es 24 px.
- Qué propongo: `aria-label` con el nombre del requisito en cada interruptor
  —el dato ya está en la fila, es sólo pasarlo— y subir el área de toque a 24 px
  reales sin cambiar el tamaño visual, con padding transparente.
- Esfuerzo: bajo

## [MEDIO] Los objetivos de toque están sistemáticamente por debajo de lo cómodo

- Usuario: todos, sobre todo el contratista
- Pantallas: transversal
- Qué observé, contando en pantalla: en `/contratista/documentos`, **25 de 35**
  elementos interactivos miden menos de 44 px de alto. En `/contratista`, 8 de
  13. En `/mandante/requisitos`, 46 elementos bajo 24 px.
- Por qué es un problema: el usuario típico del portal del contratista está en
  faena, con el teléfono en una mano, a veces con guantes. 44 px es la
  recomendación de Apple y Google justamente para ese escenario; 24 px es el piso
  legal de WCAG, no el objetivo.
- Qué propongo: una revisión de los componentes base —botón, fila de lista, ítem
  de menú— para que en el punto de quiebre móvil tengan 44 px de alto mínimo.
  Corregirlo en el componente lo arregla en todas partes de una vez.
- Esfuerzo: medio

## [BAJO] Dos familias de color quedan justo bajo el mínimo de contraste

- Usuario: todos
- Qué observé, midiendo el contraste real de cada par `-soft` / `-ink`:

  | Familia | Contraste | AA (4.5:1) |
  |---|---|---|
  | brand | 9.43 | pasa |
  | proceso | 8.54 | pasa |
  | espera | 6.92 | pasa |
  | excepcion | 6.48 | pasa |
  | bloqueo | 5.91 | pasa |
  | ok | 5.21 | pasa |
  | accion | 4.84 | pasa, al límite |
  | **vacio** | **4.41** | **no pasa** |

- Por qué es un problema: `vacio` se usa en textos de 10-11 px, que es donde el
  contraste más importa. Es el único que no llega.
- Qué propongo: oscurecer `--color-vacio-ink` hasta pasar 4.5:1, y de paso
  revisar `accion`, que con cualquier ajuste futuro de fondo queda debajo.
- Esfuerzo: bajo
- Nota: **el sistema de color está bien construido.** Seis de ocho familias
  superan holgadamente el mínimo. Esto es afinar un borde, no rehacer nada.

## [BAJO] El panel lateral es más ancho que un teléfono

- Usuario: mandante, BERISA
- Qué observé: el panel deslizante usa `w-96`, es decir **384 px**, sobre
  pantallas de 375 px.
- Por qué es un problema: en el teléfono más común el panel no cabe, y es la
  superficie donde vive el detalle de un contratista y el de un mandante.
- Qué propongo: `w-full sm:w-96`, para que en móvil ocupe la pantalla completa
  —que es el patrón esperado— y conserve los 384 px desde tablet.
- Esfuerzo: bajo

## [ALTO] BERISA no puede ayudar a alguien que perdió su contraseña

- Usuario: BERISA (y, por reflejo, el mandante y el contratista sobre su equipo)
- Pantalla: `/admin/usuarios` → botón "Editar" → diálogo de cuenta
- Qué observé: el diálogo sí permite editar nombre, cargo y rol, quitar acceso,
  devolverlo, y **reenviar la invitación a quien nunca la activó**. Lo que no
  existe por ningún lado es una forma de que un administrador ayude a alguien
  que **ya activó su cuenta y perdió la contraseña**: no hay "enviar enlace de
  recuperación" ni "restablecer clave". El único camino es que la propia persona
  use "¿La olvidaste?" desde el login.
- Por qué es un problema: ese camino depende de que reciba el correo. Si el
  correo rebota, si cambió de trabajo y su casilla ya no existe, si el dominio
  del cliente filtra a Resend, o simplemente si la persona no da con el enlace y
  llama por teléfono, el operador de la plataforma no tiene **ninguna** acción
  que ofrecerle. Hoy la única salida es entrar por SSH al servidor de producción
  y correr un script: eso no es una función de producto, es una emergencia.
  Y es el reclamo más común que recibe cualquier plataforma con cuentas.
- Qué propongo: un botón **"Enviar enlace para restablecer contraseña"** en el
  mismo diálogo, visible sobre cualquier cuenta activa. El mecanismo ya está
  construido —`recuperacion_service.emitir_token` con vencimiento de una hora y
  un solo uso— así que es exponerlo desde el panel: un endpoint que lo emita a
  nombre de otro usuario y devuelva el enlace en la respuesta autenticada, igual
  que ya hace "Reenviar invitación" cuando el correo falla. Que el enlace vuelva
  en pantalla resuelve además el caso del correo que no llega: el administrador
  se lo dicta por teléfono.
- Esfuerzo: bajo — la parte difícil, el ciclo de vida del token, ya existe
- Ojo con no reabrir un agujero: ese endpoint debe respetar la misma regla que
  `/recuperar`, es decir, **no emitir nada para una cuenta desactivada**. Si un
  administrador quiere devolverle el acceso a alguien, para eso está "Devolver
  acceso", que es una decisión distinta y explícita.

---

## Lo que está bien y no hay que tocar

- **No hay desborde horizontal en ninguna pantalla probada.** El layout responde
  bien; los problemas de móvil son de tamaño de objetivo y de una tabla concreta,
  no de maquetación rota. Es una base mucho mejor de la que se suele encontrar.
- **El portal del contratista responde su pregunta en la primera pantalla.** Sin
  hacer scroll se lee "Puedes trabajar en 0 de tus 2 servicios" y debajo la lista
  de pendientes. Es exactamente la jerarquía correcta para ese usuario.
- **En `/contratista/documentos` todos los botones tienen nombre accesible.** El
  problema de los 41 sin nombre está acotado a los interruptores de Perfiles.
- **El sistema de tokens por estado es una buena decisión** y está aplicado con
  consistencia en lo que revisé. Vale la pena defenderlo.

---

## Lo que falta de este encargo

Esta pasada cubrió lo medible. Queda pendiente lo que exige criterio y recorrer
la aplicación como cada persona, que es donde suelen estar los hallazgos de más
valor:

1. **El primer día de un mandante.** Hoy hay que descubrir solo que el orden es
   perfil → centro de trabajo → invitar contratista → crear servicio. La cuenta
   `forestal.qa@ejemplo.cl` existe justamente para evaluar eso.
2. **Si el vocabulario es el del usuario**: expediente, pilar, alcance ENTIDAD,
   mandante.
3. **La jerarquía de información** en las pantallas densas: el catálogo de 44
   requisitos y la matriz de cargos.
4. **Los estados vacíos** de cada pantalla, uno por uno.
5. **Los recorridos del prevencionista**, en ambos lados.
