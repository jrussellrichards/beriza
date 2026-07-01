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

export function logout() {
  localStorage.clear()
  window.location.href = "/login"
}
