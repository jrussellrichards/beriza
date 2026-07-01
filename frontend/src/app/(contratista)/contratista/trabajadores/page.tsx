"use client"

import { useEffect, useState } from "react"
import { UserPlus, CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { AgregarTrabajadorDialog } from "@/features/agregar-trabajador/agregar-trabajador-dialog"
import { useTrabajadores } from "@/entities/trabajador/use-trabajadores"
import { getSession } from "@/shared/lib/auth"

const MOCK_TRABAJADORES = [
  { id: "t1", nombre_completo: "Pedro Carrasco Méndez", rut: "16.789.012-3", cargo: "Operario", activo: true },
  { id: "t2", nombre_completo: "Ana Salinas Vega", rut: "17.890.123-4", cargo: "Prevencionista", activo: true },
  { id: "t3", nombre_completo: "Luis Contreras Ríos", rut: "18.901.234-5", cargo: "Operario", activo: true },
  { id: "t4", nombre_completo: "Marcela Fuentes Ortiz", rut: "19.012.345-6", cargo: "Técnico", activo: false },
]

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
}

export default function TrabajadoresPage() {
  const [session, setSession] = useState<{ contratista_id: string } | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    const s = getSession()
    if (s) setSession(s)
  }, [])

  const { data: apiTrabajadores, loading, error, refetch } = useTrabajadores(session?.contratista_id ?? "")
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    if (loading) {
      const t = setTimeout(() => setTimedOut(true), 2000)
      return () => clearTimeout(t)
    }
  }, [loading])
  const useMock = timedOut || error
  const trabajadores = useMock ? MOCK_TRABAJADORES : apiTrabajadores
  const isLoading = loading && !timedOut

  const activos = trabajadores.filter(t => t.activo).length

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Trabajadores</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {activos} activo{activos !== 1 ? "s" : ""} de {trabajadores.length} registrado{trabajadores.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <UserPlus size={15} />
            Agregar trabajador
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : trabajadores.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center">
            <UserPlus size={28} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500 mb-4">No hay trabajadores registrados</p>
            <button
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-2 mx-auto bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <UserPlus size={14} />
              Agregar el primero
            </button>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">RUT</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cargo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trabajadores.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {initials(t.nombre_completo)}
                        </div>
                        <span className="font-medium text-slate-900">{t.nombre_completo}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 font-mono text-xs">{t.rut}</td>
                    <td className="px-4 py-3.5 text-slate-500">{t.cargo ?? "—"}</td>
                    <td className="px-4 py-3.5">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 text-xs font-medium",
                        t.activo ? "text-emerald-700" : "text-slate-400"
                      )}>
                        {t.activo
                          ? <CheckCircle2 size={13} className="text-emerald-500" />
                          : <XCircle size={13} className="text-slate-300" />
                        }
                        {t.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
              <p className="text-xs text-slate-400">{trabajadores.length} trabajador{trabajadores.length !== 1 ? "es" : ""}</p>
            </div>
          </div>
        )}
      </div>

      <AgregarTrabajadorDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={refetch}
      />
    </div>
  )
}
