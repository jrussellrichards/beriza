# Renovación de diseño — definición

Síntesis de siete revisiones independientes: tecnologías, referentes de mercado,
auditoría visual, paleta, tipografía, movimiento y marca. Los informes completos
están en el scratchpad de la sesión; esto es la decisión.

Todo número citado acá está medido, no estimado.

---

## El diagnóstico

Los siete llegaron por caminos distintos a la misma conclusión, y no es la que
esperaba: **el problema no es que falte un sistema de diseño. Es que el sistema
existe, está bien razonado, y no está enchufado.**

La evidencia se acumuló sola:

| Lo que está decidido | Lo que llega a la pantalla |
|---|---|
| `tailwindcss-animate` en `package.json` | Nunca se registra: no hay `@plugin`. Las clases `animate-in` de **todos** los diálogos no generan CSS |
| `sonner.tsx` construido y funcionando | Cero importaciones de `Toaster`, cero llamadas a `toast()`. La app nunca dice que sí |
| Escala tipográfica en tokens | Se usa en **9 de 768** declaraciones de tamaño (1,2 %) |
| `--text-metric`: "siempre con tabular-nums" | `tabular-nums` aparece **3 veces** en toda la aplicación |
| `weight: ["400","500","600"]` | **13 usos de `font-bold`** (700), que el navegador falsifica engordando trazos |
| Regla semántica de color escrita | 17 de 20 tokens de estado son literales de Tailwind v2/v3 |

La frase con que cerró la auditoría visual lo dice mejor que yo: *se siente como
un producto que alguien pensó con seriedad y después dibujó con prisa.*

Eso cambia la naturaleza del trabajo. No es rediseñar: es **terminar de
conectar lo que ya se decidió**, y corregir tres cosas que sí están mal de raíz.

---

## Lo que NO hay que cambiar

Vale escribirlo, porque una renovación mal entendida destruye lo que funciona.

- **El stack se queda.** Tailwind v4 (el motor Oxide cerró la ventaja de las
  alternativas), Shadcn/Radix (Base UI llegó a 1.0 pero su propio changelog dice
  que no hace falta migrar), Next 16. Los cinco movimientos técnicos propuestos
  suman **+0 KB de bundle y −2 dependencias**.
- **IBM Plex Sans y Mono se quedan.** El argumento original —ni Inter, que es la
  fuente del SaaS genérico, ni Geist, que es la de Vercel— se sostiene en 2026.
  Inter sigue siendo la tipografía número uno de UI, que es exactamente el punto.
- **Ninguna librería de animación.** El único diferencial real de Motion son las
  *layout animations*, y este producto no debería quererlas: cuando un filtro
  reduce 40 documentos a 6, el usuario está contando, no admirando.
- **Modo oscuro no es prioridad**, y menos "para el sol": medido, aguanta 9 433
  lux contra 10 692 del modo claro. Sirve para turno de noche, no para faena.
- **Los textos de estados vacíos y de onboarding no se tocan.** Están bien
  escritos y son de lo mejor que tiene el producto.

---

## Las tres cosas que sí están mal de raíz

### 1. Está calibrado para una oficina y se usa en una portería a pleno sol

El piso de contraste declarado del sistema es explícito:

```css
--color-ink-subtle: #64748b; /* 4.76:1 — PISO. Nada más claro lleva texto. */
```

4,76:1 es AA de interiores. La guía de aplicaciones de campo pide **7:1**. Y los
tamaños reales cuentan lo mismo: **280 usos de texto a 12 px o menos, contra 3 a
16 px.** El cuerpo es 14. Los puntos de toque quedaron en 44 px, que es el
estándar de un dedo desnudo; con guantes la guía pide **60**.

Ninguna paleta sobrevive a 80 000 lux —negro puro sobre blanco puro da 1,52:1—
pero la actual falla en el orden equivocado: `bloqueo`, el estado que dice que
alguien no puede entrar, tiene el peor comportamiento de las ocho familias.

**Decisión:** subir el piso de contraste a 7:1, el cuerpo a 16 px, el toque a 60
px, y agregar un tercer modo `faena` —superficies a blanco puro, estados en
relleno sólido— que sube el rango útil de 12 000 a 18 400 lux (+53 %).

### 2. El color no puede ser el único canal, y hoy lo es

Para alguien con deuteranopía —el daltonismo más común— `ok-soft` y
`bloqueo-soft` dan **ΔE 0,009**. Se renderizan como `#f9f8f5` contra `#f6f5f2`.
El umbral de colisión es 0,05.

**Aprobado y bloqueado son el mismo color** en un producto donde confundirlos
manda a alguien a una faena.

Y hay un límite estructural: bajo AA 4,5:1 sobre blanco no se puede separar por
luminosidad el rojo del verde/ámbar **y a la vez** el verde del ámbar. Alcanza
para un escalón, no dos. Se gasta donde está la responsabilidad solidaria —el
rojo baja 0,10 de L— y verde y ámbar se separan por matiz en el eje azul-amarillo,
que protanes y deuteranes conservan intacto. Eso lleva el par `ok`/`bloqueo` de
**ΔE 0,039 a 0,133**.

Aun así, `ok` y `accion` colisionan en acromatopsia. Por eso:

**Decisión:** ningún estado se comunica sólo con color. **Icono con forma
distinta, siempre**, tomando las formas de **NCh 1411** — la señalética chilena
de seguridad que estos usuarios ya leen en faena todos los días. No es una
decisión estética: es hablarles en el idioma que ya tienen.

### 3. El peso visual está invertido respecto de la consecuencia

En la bandeja de Revisión, "Aprobar" es verde sólido y "Observar" es un contorno
—5 a 1 de peso visual— en un producto donde **aprobar de más mete gente sin
habilitar a una faena**. Los dos botones, además, no responden al puntero:

```
className={accion === "aprobar" ? "bg-ok-ink hover:bg-ok-ink" : ...}
```

El mismo patrón se repite: se pintan ceros de verde ("ACREDITADAS 0"), la columna
ESTADO del contratista dice "Activo" en verde para las dos faenas donde su propio
Inicio dice "Puedes trabajar en 0 de tus 2", y la paleta semántica se gastó como
taxonomía —verde, ámbar y violeta pintan roles de usuario y planes comerciales,
no estados.

**Decisión:** el color de estado se reserva para estados. Aprobar y observar
tienen el mismo peso visual. Un cero nunca es verde.

---

## Las decisiones de sistema

**Paleta.** Diseñar en OKLCH y publicar en hex —no por degradados, que esta app
no tiene, sino por los hover: el mismo paso en HSL produce saltos percibidos que
varían 70 % entre familias; en OKLCH varían 3,6 %. Con la trampa documentada:
OKLCH da uniformidad perceptual, **no de contraste**; hay que medir igual.
Fusionar `espera` con `vacio` y separar `proceso` de `brand` —hoy comparten los
tres valores, así que un badge "En Análisis" es indistinguible de un elemento de
marca—. Agregar `-solid` y `-on-solid`: hoy 49 usos de `bg-*-ink` llevan blanco
implícito encima que nadie verificó.

**Tipografía.** Siete niveles, dos con escalón responsive. Regla de pesos: 400
dato, 500 etiqueta, 600 identidad, **sin 700**. El veredicto que lo resume:
**Plex o los 10 px, no las dos.** Carbon, el sistema de IBM para producto denso
con esta misma familia, pisa en 12 px; Acredita baja a 9. Subir el piso, no bajar
la fuente.

**Movimiento.** Cuatro duraciones nombradas (toque 80 ms, cambio 160, recorrido
240, salida 120) y tres curvas del set *productive* de Carbon, diseñadas para
tareas repetidas. Bajo `prefers-reduced-motion`, **conservar el tiempo y eliminar
el desplazamiento** en vez del `0.01ms` habitual: apagar todo el movimiento apaga
la señal de causa y efecto, y quien activó esa preferencia pierde la única pista
de que su aprobación surtió efecto.

**Marca.** El logo actual no se lee como barrera: se lee como **lámpara de
escritorio** —base en T, poste y diagonal es la silueta canónica de una lámpara
de arquitecto—. Evaluado rasterizando a 16, 28 y 96 px reales, no ampliado.

Pero la premisa con que se eligió era falsa: se revisó el marcado de once sitios
de la categoría y **no hay ni un escudo ni un candado**. Y ahí está el hallazgo
que ordena todo: **nadie en la categoría es dueño de un objeto concreto**. Todos
usan logotipo genérico o geometría abstracta. La tesis original valía más de lo
que su autor creía; lo que falla es el portador.

**Decisión:** reemplazar el dibujo, conservar la tesis. La **A de Acredita
dibujada como pórtico** —patas abiertas, dintel plano, travesaño inclinado, un
solo ángulo—. Y BERISA aparece **donde Acredita afirma algo de lo que alguien
puede ser hecho responsable**: login, pie de correo y certificado. En el sidebar,
no. Hoy el endoso ni siquiera aparece: los tres sidebars pasan `subtitulo`, que
lo reemplaza.

---

## El plan

**Fase 1 — Enchufar lo que ya existe.** Registrar el plugin de animación, montar
el `Toaster`, `prefers-reduced-motion`, `tabular-nums` donde el token ya lo
manda, quitar los `font-bold`. Es lo más barato y lo que más cambia la sensación
del producto: hoy nada confirma, nada transiciona, y los números de las tablas no
alinean.

**Fase 2 — Seguridad perceptual.** Paleta nueva en OKLCH, formas de NCh 1411 en
los estados, peso visual corregido en Revisión. Es lo único de esta lista que
puede evitar que alguien entre a una faena sin estar habilitado.

**Fase 3 — Calibrar para faena.** Piso de contraste a 7:1, cuerpo a 16 px, toque
a 60 px, modo `faena`. Y arreglar el móvil donde está roto: la barra inferior del
contratista es `grid-cols-4` con seis destinos.

**Fase 4 — Marca.** Logo nuevo, favicon incluido —hoy es un binario suelto de 25
KB que sobreviviría a cualquier cambio sin que nadie lo note— y la regla de
endoso.

**Fase 5 — Accesibilidad estructural.** Los 7 paneles laterales no tienen
`role="dialog"`, ni foco atrapado, ni cierran con Escape.

---

## Lo que esto vale

Dos datos del análisis de mercado sostienen el presupuesto.

**ISN rediseñó su Scorecard en octubre de 2025 y reportó +90 % de uso de sus
tableros, sin agregar una sola función.** La pantalla de lectura es la más
rentable de rediseñar.

Y el que ordena la estrategia: en Chile existe una industria de intermediarios
cuyo negocio es **operar estas plataformas en tu lugar**. MINPASS abre su sitio
con "39 días de promedio nacional de acreditación" y US$500K por día perdido. Un
producto que genera un mercado de gente que lo use por ti no tiene un problema de
funciones: tiene un problema de diseño.

---

## Lo que queda abierto

- **Sujeto acreditable genérico.** Las plataformas mineras chilenas tratan
  vehículos, maquinaria y subcontratos como acreditables de primera clase. Si
  Acredita apunta a minería, la tabla y el panel de detalle deberían diseñarse
  para eso ahora, no después. Es una decisión de producto, no de diseño.
- **Credencial en vez de expediente.** El referente más fuerte —MINPASS— no
  muestra un expediente: muestra una credencial. Foto, RUT, vigencia, pilares.
  Vale evaluar si esa es la pantalla principal del contratista.
- Ningún competidor pudo inspeccionarse por dentro: todos exigen credenciales.
  Las conclusiones sobre ellos son de sitio público y material comercial, y están
  marcadas como tales en el informe de referentes.
