"use client"

import { useEffect, useState } from "react"
import {
  CheckCircle2, Clock, XCircle, AlertCircle,
  ChevronDown, ChevronRight, Users, Upload, Plus,
  FileText, Building2
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { getSession } from "@/shared/lib/auth"
import { useAcreditacion } from "@/entities/contratista/use-acreditacion"
import { SubirDocumentoDialog } from "@/features/subir-documento/subir-documento-dialog"
import type { EstadoPilar, EstadoTrabajador } from "@/shared/types"

// ── Config visual ────────────────────────────────────────────────────────────

const ESTADO_CONFIG = {
  ACREDITADA: {
    label: "Acreditada",
    icon: CheckCircle2,
    iconColor: "text-emerald-500",
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    badgeBg: "bg-emerald-50 border-emerald-200",
  },
  EN_PROCESO: {
    label: "En Proceso",
    icon: Clock,
    iconColor: "text-amber-500",
    border: "border-amber-200",
    bg: "bg-amber-50",
    dot: "bg-amber-500",
    text: "text-amber-700",
    badgeBg: "bg-amber-50 border-amber-200",
  },
  BLOQUEADA: {
    label: "Bloqueada",
    icon: XCircle,
    iconColor: "text-red-500",
    border: "border-red-200",
    bg: "bg-red-50",
    dot: "bg-red-500",
    text: "text-red-700",
    badgeBg: "bg-red-50 border-red-200",
  },
}

// ── Componentes pequeños ─────────────────────────────────────────────────────

function EstadoTag({ estado }: { estado: keyof typeof ESTADO_CONFIG }) {
  const c = ESTADO_CONFIG[estado]
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", c.badgeBg, c.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.dot)} />
      {c.label}
    </span>
  )
}

function PilarCard({ pilar, onSubir }: { pilar: EstadoPilar; onSubir?: () => void }) {
  const cumple = pilar.cumple
  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-3",
      cumple ? "bg-white border-slate-200" : "bg-white border-red-200"
    )}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">{pilar.pilar_nombre}</p>
        {cumple
          ? <CheckCircle2 size={16} className="text-emerald-500" />
          : <AlertCircle size={16} className="text-red-400" />
        }
      </div>

      {!cumple && pilar.brechas.length > 0 && (
        <ul className="space-y-1.5">
          {pilar.brechas.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
              <span className="w-1 h-1 rounded-full bg-red-400 mt-1.5 shrink-0" />
              {b}
            </li>
          ))}
        </ul>
      )}

      {onSubir && (
        <button
          onClick={onSubir}
          className={cn(
            "w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border text-xs font-medium transition-colors",
            cumple
              ? "border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              : "border-slate-200 text-slate-600 hover:bg-slate-50"
          )}
        >
          <Upload size={12} />
          {cumple ? "Actualizar documento" : "Subir documento"}
        </button>
      )}
    </div>
  )
}

function TrabajadorRow({
  trabajador,
  mandanteId,
  onRefetch,
}: {
  trabajador: EstadoTrabajador
  mandanteId: string
  onRefetch: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pilarSeleccionado, setPilarSeleccionado] = useState("")

  return (
    <div className={cn("rounded-xl border overflow-hidden transition-colors", expanded ? "border-slate-300" : "border-slate-200")}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50/70 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
            {trabajador.nombre.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-slate-900">{trabajador.nombre}</p>
            <p className="text-xs text-slate-400 font-mono">{trabajador.rut}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <EstadoTag estado={trabajador.cumple ? "ACREDITADA" : "EN_PROCESO"} />
          {expanded
            ? <ChevronDown size={14} className="text-slate-400" />
            : <ChevronRight size={14} className="text-slate-400" />
          }
        </div>
      </button>

      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 pb-4 pt-2 bg-slate-50/50 border-t border-slate-100">
          {trabajador.pilares.map(pilar => (
            <PilarCard
              key={pilar.pilar_codigo}
              pilar={pilar}
              onSubir={!pilar.cumple ? () => { setPilarSeleccionado(pilar.pilar_nombre); setDialogOpen(true) } : undefined}
            />
          ))}
        </div>
      )}

      <SubirDocumentoDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={onRefetch}
        requisitoId=""
        requisitoNombre={pilarSeleccionado}
        entidadTipo="trabajador"
        entidadId={trabajador.trabajador_id}
        mandanteId={mandanteId}
      />
    </div>
  )
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-slate-200 rounded-lg", className)} />
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 rounded-xl" />
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  )
}

// ── Mock data para preview sin backend ───────────────────────────────────────

const MOCK_DATA = {
  contratista_id: "demo",
  mandante_id: "demo",
  estado_global: "EN_PROCESO" as const,
  pilares_empresa: [
    { pilar_codigo: "LEGAL", pilar_nombre: "Legal / Laboral", cumple: true, brechas: [] },
    { pilar_codigo: "HSE", pilar_nombre: "HSE", cumple: false, brechas: ["RIOHS no firmado por representante legal", "Falta certificado MIPER vigente"] },
    { pilar_codigo: "COMPLIANCE", pilar_nombre: "Compliance", cumple: false, brechas: ["Carpeta tributaria vencida hace 12 días"] },
  ],
  trabajadores: [
    {
      trabajador_id: "t1",
      nombre: "Pedro Carrasco Méndez",
      rut: "16.789.012-3",
      cumple: true,
      pilares: [
        { pilar_codigo: "HSE", pilar_nombre: "HSE", cumple: true, brechas: [] },
      ],
    },
    {
      trabajador_id: "t2",
      nombre: "Ana Salinas Vega",
      rut: "17.890.123-4",
      cumple: false,
      pilares: [
        { pilar_codigo: "HSE", pilar_nombre: "HSE", cumple: false, brechas: ["Examen médico vencido hace 45 días", "DAS pendiente de firma"] },
      ],
    },
  ],
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function DashboardContratistaPage() {
  const [session, setSession] = useState<{ contratista_id: string; mandante_id: string } | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pilarSeleccionado, setPilarSeleccionado] = useState("")
  const [useMock, setUseMock] = useState(false)

  useEffect(() => {
    const s = getSession()
    if (s) setSession(s)
  }, [])

  const { data: apiData, loading, error, refetch } = useAcreditacion(
    session?.contratista_id ?? "",
    session?.mandante_id ?? ""
  )
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    if (loading) {
      const t = setTimeout(() => setTimedOut(true), 2000)
      return () => clearTimeout(t)
    }
  }, [loading])

  useEffect(() => {
    if (error || timedOut) setUseMock(true)
  }, [error, timedOut])

  const data = useMock ? MOCK_DATA : apiData

  if (!session || (loading && !timedOut)) return <LoadingState />
  if (!data && !useMock) return <LoadingState />

  const cfg = ESTADO_CONFIG[data.estado_global]
  const Icon = cfg.icon
  const empresaCumple = data.pilares_empresa.every(p => p.cumple)
  const trabajadoresOk = data.trabajadores.filter(t => t.cumple).length

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Mi Acreditación</h1>
          <p className="text-sm text-slate-500 mt-0.5">Estado de cumplimiento ante el mandante</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-6">

        {/* Banner estado global */}
        <div className={cn("rounded-xl border p-5 flex items-center gap-4", cfg.bg, cfg.border)}>
          <Icon size={36} className={cfg.iconColor} />
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <p className="text-base font-semibold text-slate-900">Estado global de acreditación</p>
              <EstadoTag estado={data.estado_global} />
            </div>
            <p className="text-sm text-slate-500">
              {data.estado_global === "ACREDITADA"
                ? "Tu empresa cumple todos los requisitos exigidos. Los trabajadores pueden ingresar a la faena."
                : data.estado_global === "BLOQUEADA"
                  ? "Hay brechas críticas que impiden el acceso a la obra. Corrígelas lo antes posible."
                  : "Hay documentos pendientes o en revisión. El acceso está condicionado."
              }
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-400 mb-1">Trabajadores OK</p>
            <p className={cn("text-2xl font-semibold", trabajadoresOk === data.trabajadores.length ? "text-emerald-600" : "text-amber-600")}>
              {trabajadoresOk}/{data.trabajadores.length}
            </p>
          </div>
        </div>

        {/* Pilares empresa */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={15} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Pilares — Empresa</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {data.pilares_empresa.map(pilar => (
              <PilarCard
                key={pilar.pilar_codigo}
                pilar={pilar}
                onSubir={() => { setPilarSeleccionado(pilar.pilar_nombre); setDialogOpen(true) }}
              />
            ))}
          </div>
        </section>

        {/* Divider */}
        <div className="border-t border-slate-100" />

        {/* Trabajadores */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Trabajadores ({data.trabajadores.length})
              </h2>
            </div>
            <button
              onClick={() => window.location.href = "/contratista/trabajadores"}
              className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              Ver todos →
            </button>
          </div>

          {data.trabajadores.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
              <Users size={28} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 mb-3">No hay trabajadores registrados</p>
              <button
                onClick={() => window.location.href = "/contratista/trabajadores"}
                className="flex items-center gap-2 mx-auto bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <Plus size={14} />
                Agregar trabajador
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {data.trabajadores.map(t => (
                <TrabajadorRow
                  key={t.trabajador_id}
                  trabajador={t}
                  mandanteId={data.mandante_id}
                  onRefetch={refetch}
                />
              ))}
            </div>
          )}
        </section>

      </div>

      <SubirDocumentoDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={refetch}
        requisitoId=""
        requisitoNombre={pilarSeleccionado}
        entidadTipo="empresa"
        entidadId={session?.contratista_id ?? ""}
        mandanteId={session?.mandante_id ?? ""}
      />
    </div>
  )
}
