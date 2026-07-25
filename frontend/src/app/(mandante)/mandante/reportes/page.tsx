"use client"

import { useEffect } from "react"

/**
 * Reportes dejó de ser una sección.
 *
 * Su única acción propia —exportar a PDF/Excel— estaba deshabilitada con un
 * "próximamente", y sus gráficos duplicaban el estado que ahora vive en Inicio.
 * Una pestaña que promete algo que no funciona erosiona la confianza en el resto
 * del producto.
 *
 * Se conserva la ruta para no romper enlaces guardados. Cuando la exportación de
 * evidencia de fiscalización exista de verdad, tendrá su propio lugar.
 */
export default function ReportesRedirect() {
  useEffect(() => { window.location.replace("/mandante") }, [])
  return (
    <div className="p-8">
      <p className="text-sm text-ink-muted">El estado de tus faenas está ahora en Inicio. Redirigiendo...</p>
    </div>
  )
}
