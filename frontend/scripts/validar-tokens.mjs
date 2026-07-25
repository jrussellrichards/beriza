/**
 * Falla si una clase usa un token de color que NO existe en globals.css.
 *
 * Por qué existe: la migración al sistema de diseño dejó 23 clases `bg-ok-soft0`,
 * `bg-brand-soft0`, `bg-bloqueo-soft0`… Un reemplazo de `emerald-50` hizo match
 * DENTRO de `emerald-500` y dejó el `0` colgando. Tailwind no falla ante una
 * clase desconocida: simplemente no genera nada, así que los puntos de estado,
 * las barras de progreso y varios botones quedaron sin color y nadie lo notó.
 *
 * El guard de colores crudos no las agarraba justamente porque PARECEN
 * semánticas. Este valida lo otro: que el token exista de verdad.
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
const SRC = join(RAIZ, "src")
const CSS = join(SRC, "app", "globals.css")

// Prefijos propios del sistema de diseño. Se ignoran a propósito las utilidades
// nativas de Tailwind (bg-white, text-xs, border-2…): acá solo se validan las
// nuestras, que son las que pueden apuntar a un token inexistente.
const NAMESPACES = [
  "accion", "bloqueo", "brand", "espera", "excepcion", "ink",
  "line", "ok", "proceso", "surface", "vacio",
]
const UTILIDADES = "bg|text|border|ring|divide|fill|stroke|from|via|to|outline|decoration|caret|accent|shadow"

const css = readFileSync(CSS, "utf8")
const tokens = new Set([...css.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map(m => m[1]))

function* archivos(dir) {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) yield* archivos(ruta)
    else if (/\.(tsx?|jsx?)$/.test(nombre)) yield ruta
  }
}

const patron = new RegExp(`\\b(?:${UTILIDADES})-((?:${NAMESPACES.join("|")})(?:-[a-z0-9]+)*)`, "g")
const problemas = []

for (const ruta of archivos(SRC)) {
  const lineas = readFileSync(ruta, "utf8").split("\n")
  lineas.forEach((linea, i) => {
    for (const m of linea.matchAll(patron)) {
      // Se descarta el modificador de opacidad: bg-surface-inverse/40
      const token = m[1].split("/")[0]
      if (!tokens.has(token)) {
        problemas.push({ archivo: relative(RAIZ, ruta), linea: i + 1, clase: m[0], token })
      }
    }
  })
}

if (problemas.length > 0) {
  console.error(`\n${problemas.length} clase(s) apuntan a un token de color que no existe:\n`)
  for (const p of problemas) {
    console.error(`  ${p.archivo}:${p.linea}  ${p.clase}  →  --color-${p.token} no está definido`)
  }
  console.error(`\nDefine el token en src/app/globals.css o corrige la clase.`)
  console.error(`Tailwind NO falla ante una clase desconocida: simplemente no pinta nada.\n`)
  process.exit(1)
}

console.log(`OK: ${tokens.size} tokens definidos, todas las clases del sistema de diseño resuelven`)
