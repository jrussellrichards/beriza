// Vacío por defecto: en producción las llamadas van a rutas relativas
// /api/v1/... que el rewrite same-origin de next.config.ts reenvía al
// backend server-side (evita mixed-content, ver next.config.ts). Para
// desarrollo local, define NEXT_PUBLIC_API_URL en frontend/.env.local.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ""

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
