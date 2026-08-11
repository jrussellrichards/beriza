import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * La sigla de un requisito, sólo cuando es un nombre del oficio.
 *
 * En el catálogo conviven dos cosas bajo el mismo campo `codigo`: siglas que un
 * prevencionista reconoce al instante —F30, F30_1, MIPER, RIHS, DAS, IRL_ODI— y
 * llaves técnicas como NOMINA_PERSONAL o SII_SITUACION_TRIBUTARIA. Mostrar las
 * dos mezcladas enseña a ignorar la etiqueta entera, y con ella se pierden las
 * que sí valían.
 *
 * El corte por largo es una heurística, no una verdad: las siglas reales del
 * rubro son cortas porque la gente las dice en voz alta. Si algún día el
 * catálogo distingue "sigla" de "código", esto se reemplaza por ese campo.
 */
export function siglaVisible(codigo: string | null | undefined): string | null {
  if (!codigo) return null
  return codigo.length <= 8 ? codigo : null
}
