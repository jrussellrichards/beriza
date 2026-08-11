// Vacío por defecto: en producción las llamadas van a rutas relativas
// /api/v1/... que el rewrite same-origin de next.config.ts reenvía al
// backend server-side (evita mixed-content, ver next.config.ts). Para
// desarrollo local, define NEXT_PUBLIC_API_URL en frontend/.env.local.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ""

// Rutas donde un 401 significa "credenciales incorrectas", no "sesión vencida".
const ES_RUTA_DE_ACCESO = /\/usuarios\/(login|activar|recuperar|restablecer|invitacion)/

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  const isFormData = init?.body instanceof FormData

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })

  // Sesión caída a mitad de uso. Sin esto cada pantalla trataba el 401 como un
  // error cualquiera y mostraba su estado vacío —"No hay trabajadores
  // registrados"—, que le miente al usuario sobre sus propios datos.
  //
  // Se excluyen las rutas donde un 401 es una respuesta legítima y no una sesión
  // vencida: en el login significa "credenciales incorrectas", y redirigir ahí
  // recargaría la pantalla en la que ya estás, perdiendo el mensaje de error.
  if (res.status === 401 && typeof window !== "undefined" && !ES_RUTA_DE_ACCESO.test(path)) {
    localStorage.clear()
    window.location.href = "/login?sesion=expirada"
    // La promesa no se resuelve nunca: la navegación ya está en curso y lo que
    // se quiere evitar es que la pantalla alcance a pintar su estado vacío.
    return new Promise<T>(() => {})
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail ?? "Error desconocido")
  }

  if (res.status === 204) return undefined as T

  const texto = await res.text()
  return (texto ? JSON.parse(texto) : undefined) as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, form: FormData) =>
    request<T>(path, { method: "POST", body: form, headers: {} }),
  // Descarga un archivo y dispara el "Guardar como" del navegador. No sirve un
  // <a href> directo: el endpoint exige el header Authorization, que un enlace
  // no manda —devolvería 401 y el usuario bajaría un archivo con el error.
  descargar: async (path: string, nombreArchivo: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    const res = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(error.detail ?? "No se pudo descargar el archivo")
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = nombreArchivo
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
}
