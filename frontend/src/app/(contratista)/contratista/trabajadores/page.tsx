"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, ChevronDown, ChevronRight, FileSpreadsheet, MapPin, Plus, Search, UserX } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import { AgregarTrabajadorDialog } from "@/features/agregar-trabajador/agregar-trabajador-dialog"
import { CargarNominaDialog } from "@/features/agregar-trabajador/cargar-nomina-dialog"
import { type TrabajadorHabilitacion } from "@/entities/contratista/resumen"

/**
 * Una persona con su habilitación en cada servicio donde está asignada.
 *
 * La habilitación es POR SERVICIO: dos servicios del mismo cliente pueden
 * referenciar perfiles distintos, así que alguien puede estar habilitado en una
 * obra y bloqueado en otra del mismo mandante. Decir solo "cumple / no cumple"
 * escondería justamente el dato que se necesita para mandarlo a la faena.
 */
function TrabajadorCard({ t, onCambio }: { t: TrabajadorHabilitacion; onCambio: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const bloqueados = t.servicios.filter(s => !s.habilitado)
  const sinAsignar = t.servicios.length === 0

  async function alternarActivo() {
    setOcupado(true)
    try {
      await api.patch(`/api/v1/trabajadores/${t.trabajador_id}/${t.activo ? "desactivar" : "reactivar"}`, {})
      onCambio()
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className={cn(
      "bg-surface border rounded-xl overflow-hidden",
      bloqueados.length > 0 ? "border-bloqueo-line" : "border-line",
      !t.activo && "opacity-60"
    )}>
      <button
        onClick={() => setAbierto(!abierto)}
        className="w-full flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-app/70 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-surface-sunken text-ink-muted text-[11px] font-semibold flex items-center justify-center shrink-0">
          {t.nombre_completo.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink">
            {t.nombre_completo}
            {!t.activo && <span className="ml-2 text-[10px] text-ink-subtle">inactivo</span>}
          </p>
          <p className="text-xs text-ink-subtle font-mono">{t.rut}{t.cargo ? ` · ${t.cargo}` : ""}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {sinAsignar ? (
            <span className="text-xs text-ink-subtle">Sin asignar a ningún servicio</span>
          ) : bloqueados.length === 0 ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-ok-ink">
              <CheckCircle2 size={13} />
              Habilitado en {t.servicios.length === 1 ? "su servicio" : `sus ${t.servicios.length} servicios`}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-bloqueo-ink">
              <UserX size={13} />
              No puede ingresar a {bloqueados.length === 1 ? bloqueados[0].servicio_nombre : `${bloqueados.length} servicios`}
            </span>
          )}
          {abierto ? <ChevronDown size={14} className="text-ink-subtle" /> : <ChevronRight size={14} className="text-ink-subtle" />}
        </div>
      </button>

      {abierto && (
        <div className="px-4 pb-4 pt-1 border-t border-line-subtle bg-surface-app/50 space-y-2">
          {sinAsignar ? (
            <p className="text-xs text-ink-muted py-2">
              No está asignado a ningún servicio. Asígnalo desde la pantalla de Servicios.
            </p>
          ) : (
            t.servicios.map(s => (
              <div key={s.servicio_id} className="bg-surface border border-line-subtle rounded-lg px-3 py-2.5">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm text-ink">{s.servicio_nombre}</span>
                  <span className="text-[10px] text-ink-subtle">{s.mandante_razon_social}</span>
                  {/* Dos servicios del mismo cliente pueden llamarse igual en
                      faenas distintas; sin el centro no se sabe a cuál va. */}
                  {s.centro_trabajo_nombre && (
                    <span className="text-[10px] text-ink-muted inline-flex items-center gap-1">
                      <MapPin size={10} className="text-ink-subtle" />
                      {s.centro_trabajo_nombre}
                    </span>
                  )}
                  <span className={cn(
                    "sm:ml-auto text-[11px] font-medium",
                    s.habilitado ? "text-ok-ink" : "text-bloqueo-ink"
                  )}>
                    {s.habilitado ? "Puede ingresar" : "No puede ingresar"}
                  </span>
                </div>
                {!s.habilitado && (
                  <p className="text-[11px] text-ink-muted mt-1">
                    Le falta: {s.faltantes.join(", ")}
                  </p>
                )}
              </div>
            ))
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => window.location.href = "/contratista/documentos"}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-line text-ink-muted hover:bg-surface transition-colors"
            >
              Subir sus documentos
            </button>
            <button
              onClick={alternarActivo}
              disabled={ocupado}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-line text-ink-muted hover:bg-surface disabled:opacity-50 transition-colors"
            >
              {t.activo ? "Desactivar" : "Reactivar"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TrabajadoresPage() {
  const [trabajadores, setTrabajadores] = useState<TrabajadorHabilitacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [soloBloqueados, setSoloBloqueados] = useState(false)
  const [agregando, setAgregando] = useState(false)
  const [cargandoNomina, setCargandoNomina] = useState(false)

  const cargar = useCallback(() => {
    setCargando(true)
    api.get<TrabajadorHabilitacion[]>("/api/v1/trabajadores/mis-trabajadores")
      .then(setTrabajadores)
      .catch(() => setTrabajadores([]))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const visibles = useMemo(() => trabajadores
    .filter(t => !soloBloqueados || t.servicios.some(s => !s.habilitado))
    .filter(t => {
      if (!busqueda) return true
      const q = busqueda.toLowerCase()
      return t.nombre_completo.toLowerCase().includes(q)
        || t.rut.toLowerCase().includes(q)
        || (t.cargo ?? "").toLowerCase().includes(q)
    }), [trabajadores, busqueda, soloBloqueados])

  const bloqueados = trabajadores.filter(t => t.servicios.some(s => !s.habilitado)).length

  return (
    <div className="flex flex-col min-h-screen">
      <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-line bg-surface flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-lg sm:text-xl font-semibold text-ink">Trabajadores</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            {trabajadores.length === 0
              ? "Aún no has registrado trabajadores"
              : bloqueados === 0
                ? "Todos pueden ingresar a los servicios donde están asignados"
                : `${bloqueados} no ${bloqueados === 1 ? "puede" : "pueden"} ingresar a alguno de sus servicios`}
          </p>
        </div>
        {/* La carga masiva va primero y el alta individual queda secundaria:
            partir con la nómina completa es el caso del día 1, y agregar de a
            uno es lo que se hace después, cuando entra alguien nuevo. */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCargandoNomina(true)}
            className="inline-flex items-center justify-center gap-2 bg-surface-inverse text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-surface-inverse-hover transition-colors"
          >
            <FileSpreadsheet size={14} /> Cargar nómina
          </button>
          <button
            onClick={() => setAgregando(true)}
            className="inline-flex items-center justify-center gap-2 border border-line text-ink-secondary text-sm font-medium px-4 py-2 rounded-lg hover:bg-surface-app transition-colors"
          >
            <Plus size={14} /> Agregar uno
          </button>
        </div>
      </div>

      <div className="px-6 sm:px-8 py-4 border-b border-line bg-surface flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o RUT..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-line rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <button
          onClick={() => setSoloBloqueados(!soloBloqueados)}
          className={cn(
            "px-3 py-2 rounded-lg text-xs font-medium border transition-colors",
            soloBloqueados
              ? "border-bloqueo-line bg-bloqueo-soft text-bloqueo-ink"
              : "border-line text-ink-muted hover:bg-surface-app"
          )}
        >
          Solo los bloqueados
        </button>
      </div>

      <div className="flex-1 px-6 sm:px-8 py-6 space-y-2">
        {cargando ? (
          <p className="text-sm text-ink-subtle py-14 text-center">Cargando trabajadores...</p>
        ) : visibles.length === 0 ? (
          <div className="py-14 text-center bg-surface rounded-xl border border-dashed border-line">
            <p className="text-sm text-ink-muted">
              {trabajadores.length === 0 ? "No hay trabajadores registrados" : "Ninguno coincide con el filtro"}
            </p>
          </div>
        ) : (
          visibles.map(t => <TrabajadorCard key={t.trabajador_id} t={t} onCambio={cargar} />)
        )}
      </div>

      <AgregarTrabajadorDialog
        open={agregando}
        onClose={() => setAgregando(false)}
        onSuccess={() => { setAgregando(false); cargar() }}
      />

      {cargandoNomina && (
        <CargarNominaDialog
          onClose={() => setCargandoNomina(false)}
          onCargado={cargar}
        />
      )}
    </div>
  )
}
