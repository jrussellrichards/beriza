"use client"

import { useEffect } from "react"

/**
 * Las solicitudes de acceso se resuelven en Inicio, dentro de la bandeja
 * unificada de pendientes. Tener una pantalla por cada tipo de acción no
 * escalaba: ya hay cuatro tipos y todos compiten por la misma atención.
 *
 * Se conserva la ruta para no romper enlaces guardados o correos antiguos.
 */
export default function SolicitudesRedirect() {
  useEffect(() => { window.location.replace("/contratista") }, [])
  return (
    <div className="p-8">
      <p className="text-sm text-ink-muted">Ahora tus solicitudes están en Inicio. Redirigiendo...</p>
    </div>
  )
}
