# Informe de UX — la mitad cualitativa

Complementa `docs/INFORME-UX-PARCIAL.md`, que cubrió lo medible (contraste,
tamaños, accesibilidad). Esto es lo otro: recorrer la aplicación como cada
usuario, con un objetivo, y juzgar si lo logra.

Todo sale de pantallas que abrí. Cuando cito un texto, es literal.

---

## Lo que más importa: el primer día de un cliente

### [ALTO] La única guía que da la aplicación apunta al paso que va a fallar

- Usuario: mandante nuevo
- Pantalla: `/mandante` → `/mandante/servicios`
- Qué observé: el inicio de un mandante sin nada configurado dice, textual:
  «No tienes servicios activos — **Crea uno desde Servicios** para empezar a
  exigir documentos.» Es la única instrucción de toda la pantalla. Al seguirla,
  el diálogo "Nuevo servicio" pide centro de trabajo, **contratista** y perfil.
  El selector de contratista contiene una sola opción: "Selecciona una
  empresa...". No hay ninguna, y el diálogo no lo explica ni ofrece salida.
- Por qué es un problema: el cliente hace exactamente lo que la aplicación le
  dice y llega a un callejón. Peor que no dar instrucción es dar la equivocada:
  la primera queda como que el producto no funciona, la segunda como que uno no
  entiende.
- Qué propongo: que el estado vacío del inicio nombre el orden real —invitar un
  contratista, definir un perfil, elegir un centro, y recién ahí crear el
  servicio— y que cada selector vacío del diálogo diga qué falta y enlace a
  donde se resuelve. Un `<select>` con una sola opción que no se puede elegir
  debería decir «Todavía no invitaste ninguna empresa · Invitar».

### [ALTO] No hay ningún orden sugerido, y el orden importa

- Usuario: mandante nuevo
- Qué observé: el menú lateral tiene ocho ítems —Inicio, Revisión,
  Contratistas, Servicios, Centros, Perfiles, Equipo, Configuración— todos con
  el mismo peso visual y en un orden que no es el de uso. El orden real de
  puesta en marcha es: **perfil → centro de trabajo → invitar contratista →
  crear servicio**. Nada en la interfaz lo insinúa.
- Por qué es un problema: cada una de esas pantallas funciona bien por separado.
  Lo que falta es la secuencia, y es lo único que el cliente no puede deducir.
  Es la diferencia entre un producto que se explica solo y uno que necesita una
  llamada de capacitación.
- Qué propongo: una lista de puesta en marcha en el inicio, visible sólo
  mientras haya pasos sin completar, con los cuatro pasos, cuál está hecho y un
  enlace al siguiente. Desaparece sola cuando el mandante tiene su primer
  servicio activo. Es la corrección de mayor impacto de todo este informe.

### [MEDIO] Los estados vacíos informan de una búsqueda, no enseñan

- Usuario: todos
- Qué observé: con la cuenta vacía, Contratistas dice «**No se encontraron
  contratistas**» y Servicios «**No se encontraron servicios**». Son mensajes de
  búsqueda sin resultados, no estados iniciales. No dicen qué es un contratista
  en esta plataforma, por qué habría que invitar uno, ni qué pasa después.
- Por qué es un problema: la primera pantalla que ve alguien de cada sección es
  justamente la vacía, y es la mejor oportunidad de explicar el producto. Se está
  gastando en un mensaje de error.
- Qué propongo: distinguir «no hay nada todavía» de «tu filtro no encontró
  nada». El primero explica y ofrece la acción; el segundo sugiere limpiar el
  filtro. El estado vacío de Perfiles ya quedó así y sirve de modelo.

### [MEDIO] Cuatro tarjetas en cero ocupan lo mejor de la pantalla

- Usuario: mandante nuevo
- Qué observé: en Contratistas y en Servicios, con la cuenta recién creada, la
  franja superior son cuatro tarjetas grandes —TOTAL 0, ACREDITADAS 0, EN
  PROCESO 0, BLOQUEADAS 0— y debajo la tabla vacía. La acción real, "Invitar
  contratista", es un botón chico arriba a la derecha.
- Por qué es un problema: el lugar más visible está ocupado por cuatro ceros que
  no dicen nada, y lo único que hay para hacer está en el rincón.
- Qué propongo: mientras el total sea cero, reemplazar la franja de indicadores
  por el estado vacío con su acción principal. Los indicadores aparecen cuando
  hay algo que indicar.

---

## Vocabulario

### Lo que está bien, y conviene proteger

El portal del contratista **ya habla su idioma**, y es un acierto que no hay que
tocar:

- Dice **«clientes»**, no «mandantes». El contratista no piensa en mandantes.
- «Tu biblioteca. Cada documento se sube una vez y vale para todos los clientes
  que lo exijan» explica la promesa del producto en una línea.
- «Se acredita una vez» / «Por cada servicio» traduce `alcance: ENTIDAD |
  SERVICIO` sin obligar a nadie a aprender el modelo de datos.
- Los filtros de estado son «Falta subir», «Observado», «En revisión»,
  «Aprobado», «Vencido». Ninguno es un número ni un enum.

### [MEDIO] Los códigos internos se filtran a la pantalla

- Usuario: contratista y mandante
- Qué observé: bajo el nombre de cada documento aparece su código:
  `SII_SITUACION_TRIBUTARIA`, `CERT_AFILIACION_OA`, `NOMINA_PERSONAL`,
  `QA_REQ_PRUEBA`. Conviven con siglas que sí son del oficio —MIPER, RIHS, F30,
  F30-1— que un prevencionista reconoce al instante.
- Por qué es un problema: mezclar ambas cosas enseña a ignorar la etiqueta
  entera, y con ella se pierden las siglas que sí valían. `NOMINA_PERSONAL` en
  mayúsculas con guión bajo es una llave de base de datos.
- Qué propongo: mostrar el código sólo cuando es un nombre real del oficio (F30,
  MIPER, RIHS, DAS). Para el resto, ocultarlo o dejarlo en el detalle. Se puede
  resolver con un campo "sigla" en el catálogo, distinto del `codigo` técnico.

---

## El contratista

### [ALTO] La instrucción que evita un rechazo está escondida

- Usuario: contratista
- Pantalla: diálogo "Subir documento"
- Qué observé: el diálogo muestra el nombre del documento, «Archivos (hasta 2)»
  y «Máximo 20 MB por archivo. PDF.». Y un desplegable cerrado titulado **«Qué
  debe contener este documento»**. Es un `<details>` que arranca colapsado.
- Por qué es un problema: ese texto es la instrucción de trabajo —qué tiene que
  decir el documento para que se lo aprueben— y es exactamente lo que evita el
  ciclo de subir, esperar, que lo observen y volver a subir. Para el contratista
  ese ciclo es tiempo con gente sin poder entrar a faena. Está a un clic que
  nadie tiene motivo para dar, porque el título no promete nada urgente.
- Qué propongo: abierto por defecto. Si ocupa mucho, mostrar las dos primeras
  líneas y un «ver más». El costo de leerlo de más es un párrafo; el de no leerlo
  es un rechazo.

### [MEDIO] Dos documentos distintos se leen como el mismo repetido

- Usuario: contratista
- Pantalla: `/contratista/documentos`
- Qué observé: aparecen dos filas seguidas con el título idéntico «Matriz de
  Identificación de Peligros y Evaluación de Riesgos (MIPER) y mapa de riesgos».
  Lo único que las distingue es una línea menor: una dice «Carguio de aridos QA»
  y la otra «Movimiento de tierras QA». Son el mismo requisito exigido por dos
  faenas distintas, y cada una necesita su propio archivo.
- Por qué es un problema: leyendo rápido parece un error de la aplicación, y el
  riesgo real es subir el archivo en la fila equivocada.
- Qué propongo: cuando un requisito es por faena, que la faena vaya en el título
  y no debajo: «MIPER — Carguio de áridos». El dato que distingue tiene que estar
  donde el ojo compara.

---

## El mandante en operación

### [ALTO] Un perfil que no exige nada no avisa

- Usuario: mandante
- Pantalla: `/mandante/requisitos`
- Qué observé: el perfil "Cosecha forestal" muestra «**0 requisitos exigidos**»
  y las pestañas dicen «Empresa 0 de 40» y «Personas 0 de 6». La pantalla lo
  informa con total neutralidad, igual que informaría 12.
- Por qué es un problema: un perfil sin requisitos significa que **cualquier
  contratista que lo use aparece cumpliendo**, sin haber entregado un solo
  documento. Es el estado más peligroso que puede tener este producto, y se
  parece a cualquier otro. Un mandante que crea el perfil y se distrae antes de
  activar requisitos queda con una faena que dice "en regla" sin serlo.
- Qué propongo: un aviso explícito mientras el perfil tenga cero exigencias, y
  una advertencia al asignarlo a un servicio. La aplicación no debería dejar
  crear un servicio con un perfil vacío sin decirlo en voz alta.

### [MEDIO] Las plantillas no dicen qué traen antes de apretarlas

- Usuario: mandante
- Qué observé: tres botones —«Arranque», «Legal completa», «Obra fisica»— y
  debajo, en letra chica, «Reemplaza lo exigido en este perfil; conserva
  vigencias ya configuradas». No hay forma de saber qué activa cada una sin
  aplicarla.
- Por qué es un problema: es una acción destructiva —reemplaza— sobre la
  configuración que define qué se le exige a los contratistas, y se toma a
  ciegas. El nombre no alcanza: «Arranque» puede ser 8 requisitos o 30.
- Qué propongo: que cada botón diga cuántos requisitos activa («Arranque · 8»),
  y que al pulsarlo confirme mostrando qué se agrega y qué se quita. El dato ya
  existe: `GET /mandantes/plantillas` devuelve el conteo.
- Nota menor: «Obra fisica» va sin tilde. Debería decir «Obra física».

---

## Lo que está bien y no hay que tocar

- **El portal del contratista responde su pregunta en la primera pantalla**:
  «Puedes trabajar en 0 de tus 2 servicios» y debajo los pendientes. Es la
  jerarquía correcta para ese usuario.
- **El estado por cliente en cada documento**: «Minera del Norte · aprobado /
  Áridos del Sur · en revisión». Muestra la realidad multi-cliente sin obligar a
  entenderla de antemano.
- **El vocabulario del contratista**, ya comentado.
- **Los subtítulos de sección explican de qué se trata** en vez de repetir el
  título: «Contratos y faenas con sus exigencias documentales», «Define qué
  documentos exiges por tipo de servicio».
- **La agrupación por pilar con contador al día** («1/4 al día») da lectura
  rápida sin abrir nada.

---

## Si sólo se pudieran hacer tres cosas

1. **La lista de puesta en marcha del mandante nuevo.** Es lo único que el
   cliente no puede deducir solo, y hoy la aplicación lo manda al paso
   equivocado. Sin esto, cada alta necesita una llamada.
2. **Abrir por defecto "Qué debe contener este documento".** Un párrafo visible
   contra un ciclo de rechazo, en la pantalla del usuario que más apurado está.
3. **Avisar cuando un perfil no exige nada.** Es el único hallazgo de este
   informe que puede hacer que alguien entre a faena sin estar acreditado, que
   es precisamente lo que el producto existe para impedir.
