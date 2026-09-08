"use client"

import { useCallback, useEffect, useState } from "react"
import { Building2, Pencil } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import { getSession } from "@/shared/lib/auth"
import { etiquetaMutualidad } from "@/entities/contratista/mutualidades"
import { FichaEmpresaDialog, type ValoresFicha } from "@/features/empresa/ficha-empresa-dialog"

interface MiEmpresa extends ValoresFicha {
  id: string
  rut: string
}

/**
 * Mi empresa: los datos de fiscalización que el mandante necesita tener a mano
 * —mutualidad, dirección, teléfono de emergencia, representante legal— y que
 * hasta ahora la empresa no tenía dónde registrar por su cuenta.
 *
 * El RUT y la razón social se ven pero el RUT no se edita: es la identidad con
 * la que la empresa existe frente a todos sus mandantes. Lo que falta se marca
 * como faltante en vez de esconderse, porque el hueco es justamente lo que hay
 * que ir a buscar antes de que llegue una fiscalización.
 */
export default function MiEmpresaPage() {
  const [empresa, setEmpresa] = useState<MiEmpresa | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  // Editar la ficha lo hace quien administra la cuenta; el prevencionista la ve.
  const puedeEditar = getSession()?.rol === "contratista_admin"

  const cargar = useCallback(() => {
    setCargando(true)
    api.get<MiEmpresa>("/api/v1/contratistas/mi-empresa")
      .then((e) => { setEmpresa(e); setError(null) })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar los datos"))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const rep = empresa
    ? [empresa.representante_legal_nombre, empresa.representante_legal_rut].filter(Boolean).join(" · ")
    : ""

  const filas: { etiqueta: string; valor: string | null }[] = empresa ? [
    { etiqueta: "Mutualidad", valor: etiquetaMutualidad(empresa.mutualidad) },
    { etiqueta: "Giro", valor: empresa.giro },
    { etiqueta: "Dirección", valor: empresa.direccion },
    { etiqueta: "Teléfono de emergencia", valor: empresa.telefono_emergencia },
    { etiqueta: "Representante legal", valor: rep || null },
    { etiqueta: "Teléfono del representante", valor: empresa.representante_legal_telefono },
  ] : []
  const faltantes = filas.filter(f => !f.valor).length

  return (
    <div className="flex flex-col min-h-screen">
      <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-line bg-surface flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-title sm:text-title font-semibold text-ink">Mi empresa</h1>
          <p className="text-body text-ink-muted mt-0.5">
            {error
              ? "No pudimos cargar los datos"
              : !empresa
                ? "Cargando..."
                : faltantes > 0
                  ? `Faltan ${faltantes} de estos datos para una fiscalización`
                  : "Datos completos"}
          </p>
        </div>
        {puedeEditar && empresa && (
          <button
            onClick={() => setEditando(true)}
            className="inline-flex items-center justify-center gap-2 bg-surface-inverse text-white text-strong font-medium px-4 py-2 rounded-lg hover:bg-surface-inverse-hover transition-colors"
          >
            <Pencil size={14} /> {faltantes > 0 ? "Completar datos" : "Editar datos"}
          </button>
        )}
      </div>

      <div className="flex-1 px-6 sm:px-8 py-6">
        {error && (
          <p className="text-body text-bloqueo-ink bg-bloqueo-soft border border-bloqueo-line px-3 py-2 rounded-lg">{error}</p>
        )}

        {cargando && !empresa ? (
          <p className="text-body text-ink-subtle py-14 text-center">Cargando...</p>
        ) : empresa ? (
          <div className="max-w-2xl space-y-4">
            <div className="bg-surface border border-line rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-line-subtle flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-surface-sunken text-ink-muted flex items-center justify-center shrink-0">
                  <Building2 size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-strong font-semibold text-ink truncate">{empresa.razon_social}</p>
                  <p className="text-meta text-ink-subtle font-mono">{empresa.rut}</p>
                </div>
              </div>
              <dl className="divide-y divide-line-subtle">
                {filas.map(f => (
                  <div key={f.etiqueta} className="flex items-start gap-4 px-5 py-3">
                    <dt className="text-meta text-ink-subtle w-48 shrink-0">{f.etiqueta}</dt>
                    <dd className={cn(
                      "text-body flex-1 min-w-0",
                      f.valor ? "text-ink" : "text-ink-subtle italic",
                    )}>
                      {f.valor ?? "sin registrar"}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            {!puedeEditar && (
              <p className="text-meta text-ink-subtle">
                Solo quien administra la cuenta puede modificar estos datos.
              </p>
            )}
          </div>
        ) : null}
      </div>

      {editando && empresa && (
        <FichaEmpresaDialog
          titulo="Datos de mi empresa"
          valores={empresa}
          onGuardar={async (cambios) => {
            await api.patch("/api/v1/contratistas/mi-empresa", cambios)
            cargar()
          }}
          onClose={() => setEditando(false)}
        />
      )}
    </div>
  )
}
