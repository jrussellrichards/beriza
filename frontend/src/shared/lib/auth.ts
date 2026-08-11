"use client"

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("token")
}

export function getSession(): { rol: string; contratista_id: string; mandante_id: string } | null {
  if (typeof window === "undefined") return null
  const token = localStorage.getItem("token")
  if (!token) return null

  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    return {
      rol: payload.rol,
      contratista_id: payload.contratista_id ?? "",
      mandante_id: payload.mandante_id ?? "",
    }
  } catch {
    return null
  }
}

/**
 * ¿Hay sesión utilizable? Falso si no hay token o si ya venció.
 *
 * Se mira `exp` acá y no sólo la presencia del token porque el síntoma que esto
 * corrige es justamente el de la sesión vencida: el backend respondía 401 a todo
 * y las pantallas seguían pintándose enteras, afirmando "No hay trabajadores
 * registrados" o "0 contratistas". Quien volvía al día siguiente no concluía que
 * se le había caído la sesión, sino que la plataforma había perdido sus datos.
 */
export function sesionVigente(): boolean {
  if (typeof window === "undefined") return true   // en SSR no se decide nada
  const token = localStorage.getItem("token")
  if (!token) return false
  try {
    const { exp } = JSON.parse(atob(token.split(".")[1]))
    // Sin `exp` se acepta: el token es válido hasta que el backend diga lo
    // contrario, y de eso se encarga el manejo de 401 en shared/lib/api.ts.
    return !exp || exp * 1000 > Date.now()
  } catch {
    return false
  }
}

/**
 * A qué portal pertenece una sesión.
 *
 * El rol NO alcanza para decidirlo: `prevencionista` existe en las dos
 * organizaciones, así que enrutar sólo por rol mandaba al prevencionista de un
 * mandante al Portal Contratista, donde lo recibía el cartel rojo "El usuario no
 * está asociado a un contratista" y sólo salía escribiendo /mandante a mano.
 *
 * Lo que decide es a quién pertenece la cuenta; el rol sólo distingue a BERISA,
 * que no cuelga de ninguna organización.
 */
export function portalDe(
  rol: string,
  mandanteId?: string | null,
  contratistaId?: string | null,
): string {
  if (rol === "berisa_admin") return "/admin"
  if (contratistaId) return "/contratista"
  if (mandanteId) return "/mandante"
  // Sin ninguna de las dos: mandante_admin por rol, y si no, el portal del
  // contratista, que es donde caía todo el mundo antes.
  return rol === "mandante_admin" ? "/mandante" : "/contratista"
}

export function logout() {
  localStorage.clear()
  window.location.href = "/login"
}
