// Organismos administradores de la Ley 16.744. Espejo del enum Mutualidad del
// backend: la lista es cerrada porque en Chile lo es —tres mutualidades
// privadas mas el ISL, que es el administrador estatal para quien no esta
// afiliado a ninguna—.
//
// Se guarda el codigo y se muestra el nombre completo: nadie reconoce
// "MUTUAL_CCHC" en un selector, y nadie quiere filtrar por cuatro grafias
// distintas de "Asociacion Chilena de Seguridad".

export const MUTUALIDADES = [
  { valor: "ACHS", etiqueta: "ACHS — Asociación Chilena de Seguridad" },
  { valor: "MUTUAL_CCHC", etiqueta: "Mutual de Seguridad CChC" },
  { valor: "IST", etiqueta: "IST — Instituto de Seguridad del Trabajo" },
  { valor: "ISL", etiqueta: "ISL — Instituto de Seguridad Laboral" },
] as const

/** Nombre para mostrar. Devuelve el código si llega uno que no conocemos, en
 *  vez de dejar la celda vacía y perder el dato que sí está guardado. */
export function etiquetaMutualidad(valor: string | null): string | null {
  if (!valor) return null
  return MUTUALIDADES.find(m => m.valor === valor)?.etiqueta ?? valor
}
