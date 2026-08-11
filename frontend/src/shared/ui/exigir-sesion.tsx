"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { sesionVigente } from "@/shared/lib/auth"

/**
 * Puerta de los tres portales: sin sesión no se pinta nada, se va al login.
 *
 * Sin esto, `/contratista`, `/mandante` y `/admin` se renderizaban completos
 * —sidebar, cabecera, botones— para cualquiera que llegara sin token o con la
 * sesión vencida, y sus estados vacíos afirmaban cosas falsas: "No hay
 * trabajadores registrados", "Aún no tienes servicios contratados", "0
 * contratistas". No había filtración, porque el backend rechazaba cada llamada
 * con 401; el daño era de confianza. Un contratista que volvía al día siguiente
 * concluía que la plataforma le había perdido la información.
 *
 * Devuelve null mientras decide, en vez de pintar y luego redirigir: el parpadeo
 * de un portal ajeno es exactamente lo que se quiere evitar.
 */
export function ExigirSesion({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState(false)

  useEffect(() => {
    if (sesionVigente()) {
      setAutorizado(true)
      return
    }
    localStorage.clear()
    // `replace` y no `push`: el botón Atrás no debe devolver a una pantalla que
    // ya se decidió que no puede verse.
    router.replace("/login?sesion=expirada")
  }, [router])

  if (!autorizado) return null
  return <>{children}</>
}
