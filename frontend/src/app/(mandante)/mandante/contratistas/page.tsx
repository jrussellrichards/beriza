"use client"

import { useEffect, useState } from "react"
import {
  Search, Plus, ChevronRight, CheckCircle2,
  AlertCircle, Users, X, FileText, Download,
  Clock, XCircle
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { getSession } from "@/shared/lib/auth"
import { useApiData } from "@/shared/lib/use-api-data"

// ── Tipos ─────────────────────────────────────────────────────────────────────

type EstadoAcreditacion = "ACREDITADA" | "EN_PROCESO" | "BLOQUEADA"
type EstadoPilar = "OK" | "PENDIENTE" | "FALLIDO"
type EstadoDoc = "APROBADO" | "PENDIENTE" | "RECHAZADO" | "VENCIDO"
type PanelTab = "estado" | "documentos" | "trabajadores"

interface Documento {
  nombre: string
  codigo: string
  estado: EstadoDoc
  fecha_subida: string
  fecha_vence: string | null
  entidad: "EMPRESA" | "TRABAJADOR"
  trabajador?: string
}

interface PilarConDocs {
  nombre: string
  estado: EstadoPilar
  brechas: string[]
  documentos: Documento[]
}

interface Trabajador { nombre: string; rut: string; cumple: boolean }

interface Contratista {
  id: string; razon_social: string; rut: string
  estado: EstadoAcreditacion; pilares: PilarConDocs[]
  trabajadores: Trabajador[]; ultima_actualizacion: string
}

// ── API types + transform ─────────────────────────────────────────────────────

type ApiDocEmpresa = {
  requisito_codigo: string; requisito_nombre: string; entidad_tipo: "EMPRESA" | "TRABAJADOR"
  estado: number | null; fecha_vigencia_hasta: string | null; mensaje_brecha: string | null
}
type ApiTrabajador = {
  id: string; nombre: string; rut: string; cargo: string; cumple: boolean
  documentos: ApiDocEmpresa[]
}
type ApiPilar = { codigo: string; nombre: string; cumple: boolean; documentos: ApiDocEmpresa[] }
type ApiContratista = {
  id: string; razon_social: string; rut: string; estado_acreditacion: string
  total_trabajadores: number; pilares: ApiPilar[]; trabajadores: ApiTrabajador[]
}

const CODIGO_PILAR: Record<string, string> = {
  F30: "Legal / Laboral", F30_1: "Legal / Laboral", CONTRATO: "Legal / Laboral",
  EXAM_MED: "HSE — Salud, Seguridad y Medio Ambiente",
  MIPER: "HSE — Salud, Seguridad y Medio Ambiente",
  RIOHS: "HSE — Salud, Seguridad y Medio Ambiente",
  DAS: "HSE — Salud, Seguridad y Medio Ambiente",
  CARPETA_TRIBUTARIA: "Compliance / Tributario",
  VIGENCIA_SOCIEDAD: "Compliance / Tributario",
  DJ_CONFLICTO: "Compliance / Tributario",
}

function mapEstadoDoc(estado: number | null): EstadoDoc {
  if (estado === 4) return "APROBADO"
  if (estado === 3) return "RECHAZADO"
  return "PENDIENTE"
}

function mapContratistas(api: ApiContratista[]): Contratista[] {
  return api.map(c => {
    const pilaresMap: Record<string, PilarConDocs> = {}
    c.pilares.forEach(p => {
      const nombre = p.nombre
      if (!pilaresMap[nombre]) {
        pilaresMap[nombre] = { nombre, estado: p.cumple ? "OK" : "PENDIENTE", brechas: [], documentos: [] }
      }
      p.documentos.forEach(d => {
        if (d.estado === 3) {
          pilaresMap[nombre].estado = "FALLIDO"
          if (d.mensaje_brecha) pilaresMap[nombre].brechas.push(d.mensaje_brecha)
        }
        pilaresMap[nombre].documentos.push({
          nombre: d.requisito_nombre,
          codigo: d.requisito_codigo,
          estado: mapEstadoDoc(d.estado),
          fecha_subida: "—",
          fecha_vence: d.fecha_vigencia_hasta,
          entidad: d.entidad_tipo,
        })
      })
    })
    // Añadir documentos de trabajadores a sus pilares
    c.trabajadores.forEach(t => {
      t.documentos.forEach(d => {
        const nombrePilar = CODIGO_PILAR[d.requisito_codigo]
        if (nombrePilar && pilaresMap[nombrePilar]) {
          if (d.estado === 3) {
            pilaresMap[nombrePilar].estado = "FALLIDO"
            if (d.mensaje_brecha) pilaresMap[nombrePilar].brechas.push(d.mensaje_brecha)
          }
          pilaresMap[nombrePilar].documentos.push({
            nombre: `${d.requisito_nombre} — ${t.nombre}`,
            codigo: d.requisito_codigo,
            estado: mapEstadoDoc(d.estado),
            fecha_subida: "—",
            fecha_vence: d.fecha_vigencia_hasta,
            entidad: "TRABAJADOR",
            trabajador: t.nombre,
          })
        }
      })
    })
    return {
      id: c.id,
      razon_social: c.razon_social,
      rut: c.rut,
      estado: c.estado_acreditacion as EstadoAcreditacion,
      pilares: Object.values(pilaresMap),
      trabajadores: c.trabajadores.map(t => ({ nombre: t.nombre, rut: t.rut, cumple: t.cumple })),
      ultima_actualizacion: "—",
    }
  })
}

// ── Config visual ─────────────────────────────────────────────────────────────

const CONTRATISTAS_DEFAULT: Contratista[] = [
  {
    id: "1", razon_social: "Constructora Vial del Norte S.A.", rut: "76.234.891-2",
    estado: "ACREDITADA", ultima_actualizacion: "17 Jun 2025",
    pilares: [
      {
        nombre: "Legal", estado: "OK", brechas: [],
        documentos: [
          { nombre: "Certificado F30", codigo: "F30", estado: "APROBADO", fecha_subida: "10 Jun 2025", fecha_vence: "10 Jul 2025", entidad: "EMPRESA" },
          { nombre: "Certificado F30-1", codigo: "F30_1", estado: "APROBADO", fecha_subida: "10 Jun 2025", fecha_vence: "10 Jul 2025", entidad: "EMPRESA" },
          { nombre: "Contrato — Jorge Muñoz", codigo: "CONTRATO", estado: "APROBADO", fecha_subida: "05 Jun 2025", fecha_vence: null, entidad: "TRABAJADOR", trabajador: "Jorge Muñoz" },
          { nombre: "Contrato — Ana Salinas", codigo: "CONTRATO", estado: "APROBADO", fecha_subida: "05 Jun 2025", fecha_vence: null, entidad: "TRABAJADOR", trabajador: "Ana Salinas" },
        ],
      },
      {
        nombre: "HSE", estado: "OK", brechas: [],
        documentos: [
          { nombre: "Matriz MIPER", codigo: "MIPER", estado: "APROBADO", fecha_subida: "08 Jun 2025", fecha_vence: "08 Jun 2026", entidad: "EMPRESA" },
          { nombre: "RIOHS", codigo: "RIOHS", estado: "APROBADO", fecha_subida: "08 Jun 2025", fecha_vence: "08 Jun 2026", entidad: "EMPRESA" },
          { nombre: "DAS — Jorge Muñoz", codigo: "DAS", estado: "APROBADO", fecha_subida: "09 Jun 2025", fecha_vence: "08 Sep 2025", entidad: "TRABAJADOR", trabajador: "Jorge Muñoz" },
          { nombre: "Examen médico — Jorge Muñoz", codigo: "EXAMEN_MEDICO", estado: "APROBADO", fecha_subida: "09 Jun 2025", fecha_vence: "09 Dic 2025", entidad: "TRABAJADOR", trabajador: "Jorge Muñoz" },
        ],
      },
      {
        nombre: "Compliance", estado: "OK", brechas: [],
        documentos: [
          { nombre: "Carpeta tributaria", codigo: "CARPETA_TRIBUTARIA", estado: "APROBADO", fecha_subida: "11 Jun 2025", fecha_vence: "11 Sep 2025", entidad: "EMPRESA" },
          { nombre: "Vigencia de sociedad", codigo: "VIGENCIA_SOCIEDAD", estado: "APROBADO", fecha_subida: "11 Jun 2025", fecha_vence: "11 Jun 2026", entidad: "EMPRESA" },
        ],
      },
    ],
    trabajadores: [
      { nombre: "Jorge Muñoz", rut: "12.345.678-9", cumple: true },
      { nombre: "Ana Salinas", rut: "13.456.789-0", cumple: true },
    ],
  },
  {
    id: "2", razon_social: "Servicios Industriales Omega Ltda.", rut: "77.891.234-5",
    estado: "EN_PROCESO", ultima_actualizacion: "19 Jun 2025",
    pilares: [
      {
        nombre: "Legal", estado: "OK", brechas: [],
        documentos: [
          { nombre: "Certificado F30", codigo: "F30", estado: "APROBADO", fecha_subida: "15 Jun 2025", fecha_vence: "15 Jul 2025", entidad: "EMPRESA" },
          { nombre: "Contrato — Juan Rojas", codigo: "CONTRATO", estado: "APROBADO", fecha_subida: "12 Jun 2025", fecha_vence: null, entidad: "TRABAJADOR", trabajador: "Juan Rojas" },
        ],
      },
      {
        nombre: "HSE", estado: "PENDIENTE", brechas: ["Falta examen médico de J. Rojas"],
        documentos: [
          { nombre: "Matriz MIPER", codigo: "MIPER", estado: "APROBADO", fecha_subida: "13 Jun 2025", fecha_vence: "13 Jun 2026", entidad: "EMPRESA" },
          { nombre: "Examen médico — Juan Rojas", codigo: "EXAMEN_MEDICO", estado: "PENDIENTE", fecha_subida: "—", fecha_vence: null, entidad: "TRABAJADOR", trabajador: "Juan Rojas" },
        ],
      },
      {
        nombre: "Compliance", estado: "PENDIENTE", brechas: ["Carpeta tributaria vencida hace 12 días"],
        documentos: [
          { nombre: "Carpeta tributaria", codigo: "CARPETA_TRIBUTARIA", estado: "VENCIDO", fecha_subida: "20 Mar 2025", fecha_vence: "07 Jun 2025", entidad: "EMPRESA" },
          { nombre: "Vigencia de sociedad", codigo: "VIGENCIA_SOCIEDAD", estado: "APROBADO", fecha_subida: "02 Ene 2025", fecha_vence: "02 Ene 2026", entidad: "EMPRESA" },
        ],
      },
    ],
    trabajadores: [
      { nombre: "Juan Rojas", rut: "14.567.890-1", cumple: false },
      { nombre: "Claudia Vega", rut: "15.678.901-2", cumple: true },
    ],
  },
  {
    id: "3", razon_social: "Ingeniería Aplicada Cóndor SpA", rut: "76.012.345-K",
    estado: "BLOQUEADA", ultima_actualizacion: "09 Jun 2025",
    pilares: [
      {
        nombre: "Legal", estado: "FALLIDO", brechas: ["F30-1 con deuda de $4.200.000", "F30 vencido hace 32 días"],
        documentos: [
          { nombre: "Certificado F30", codigo: "F30", estado: "VENCIDO", fecha_subida: "08 May 2025", fecha_vence: "08 Jun 2025", entidad: "EMPRESA" },
          { nombre: "Certificado F30-1", codigo: "F30_1", estado: "RECHAZADO", fecha_subida: "09 Jun 2025", fecha_vence: null, entidad: "EMPRESA" },
        ],
      },
      {
        nombre: "HSE", estado: "FALLIDO", brechas: ["RIOHS no firmado por representante legal"],
        documentos: [
          { nombre: "RIOHS", codigo: "RIOHS", estado: "RECHAZADO", fecha_subida: "07 Jun 2025", fecha_vence: null, entidad: "EMPRESA" },
          { nombre: "Examen médico — Pedro Carrasco", codigo: "EXAMEN_MEDICO", estado: "APROBADO", fecha_subida: "01 Jun 2025", fecha_vence: "01 Dic 2025", entidad: "TRABAJADOR", trabajador: "Pedro Carrasco" },
        ],
      },
      {
        nombre: "Compliance", estado: "OK", brechas: [],
        documentos: [
          { nombre: "Carpeta tributaria", codigo: "CARPETA_TRIBUTARIA", estado: "APROBADO", fecha_subida: "04 Jun 2025", fecha_vence: "04 Sep 2025", entidad: "EMPRESA" },
        ],
      },
    ],
    trabajadores: [{ nombre: "Pedro Carrasco", rut: "16.789.012-3", cumple: false }],
  },
  {
    id: "4", razon_social: "Mantención y Servicios Andinos Ltda.", rut: "96.543.210-3",
    estado: "ACREDITADA", ultima_actualizacion: "21 Jun 2025",
    pilares: [
      { nombre: "Legal", estado: "OK", brechas: [], documentos: [
        { nombre: "Certificado F30", codigo: "F30", estado: "APROBADO", fecha_subida: "18 Jun 2025", fecha_vence: "18 Jul 2025", entidad: "EMPRESA" },
      ]},
      { nombre: "HSE", estado: "OK", brechas: [], documentos: [
        { nombre: "Matriz MIPER", codigo: "MIPER", estado: "APROBADO", fecha_subida: "18 Jun 2025", fecha_vence: "18 Jun 2026", entidad: "EMPRESA" },
      ]},
      { nombre: "Compliance", estado: "OK", brechas: [], documentos: [
        { nombre: "Carpeta tributaria", codigo: "CARPETA_TRIBUTARIA", estado: "APROBADO", fecha_subida: "18 Jun 2025", fecha_vence: "18 Sep 2025", entidad: "EMPRESA" },
      ]},
    ],
    trabajadores: [
      { nombre: "Rosa Fuentes", rut: "17.890.123-4", cumple: true },
      { nombre: "Carlos Díaz", rut: "18.901.234-5", cumple: true },
      { nombre: "Marcela Soto", rut: "19.012.345-6", cumple: true },
    ],
  },
  {
    id: "5", razon_social: "Transportes Patagonia Express S.A.", rut: "78.321.654-7",
    estado: "EN_PROCESO", ultima_actualizacion: "18 Jun 2025",
    pilares: [
      { nombre: "Legal", estado: "OK", brechas: [], documentos: [
        { nombre: "Certificado F30", codigo: "F30", estado: "APROBADO", fecha_subida: "14 Jun 2025", fecha_vence: "14 Jul 2025", entidad: "EMPRESA" },
      ]},
      { nombre: "HSE", estado: "OK", brechas: [], documentos: [
        { nombre: "RIOHS", codigo: "RIOHS", estado: "APROBADO", fecha_subida: "14 Jun 2025", fecha_vence: "14 Jun 2026", entidad: "EMPRESA" },
      ]},
      { nombre: "Compliance", estado: "PENDIENTE", brechas: ["Declaración jurada conflicto de interés pendiente"], documentos: [
        { nombre: "Carpeta tributaria", codigo: "CARPETA_TRIBUTARIA", estado: "APROBADO", fecha_subida: "14 Jun 2025", fecha_vence: "14 Sep 2025", entidad: "EMPRESA" },
        { nombre: "DJ conflicto de interés", codigo: "DJ_CONFLICTO", estado: "PENDIENTE", fecha_subida: "—", fecha_vence: null, entidad: "EMPRESA" },
      ]},
    ],
    trabajadores: [{ nombre: "Tomás Herrera", rut: "20.123.456-7", cumple: true }],
  },
  {
    id: "6", razon_social: "Consultora Horizonte Sur SpA", rut: "76.789.012-1",
    estado: "ACREDITADA", ultima_actualizacion: "20 Jun 2025",
    pilares: [
      { nombre: "Legal", estado: "OK", brechas: [], documentos: [] },
      { nombre: "HSE", estado: "OK", brechas: [], documentos: [] },
      { nombre: "Compliance", estado: "OK", brechas: [], documentos: [] },
    ],
    trabajadores: [{ nombre: "Valentina Pardo", rut: "21.234.567-8", cumple: true }],
  },
  {
    id: "7", razon_social: "Eléctrica Nacional del Pacífico S.A.", rut: "93.456.789-4",
    estado: "BLOQUEADA", ultima_actualizacion: "04 Jun 2025",
    pilares: [
      { nombre: "Legal", estado: "OK", brechas: [], documentos: [
        { nombre: "Certificado F30", codigo: "F30", estado: "APROBADO", fecha_subida: "02 Jun 2025", fecha_vence: "02 Jul 2025", entidad: "EMPRESA" },
      ]},
      { nombre: "HSE", estado: "FALLIDO", brechas: ["3 trabajadores sin examen médico", "EPP no acreditado"], documentos: [
        { nombre: "Examen médico — Luis Castillo", codigo: "EXAMEN_MEDICO", estado: "PENDIENTE", fecha_subida: "—", fecha_vence: null, entidad: "TRABAJADOR", trabajador: "Luis Castillo" },
        { nombre: "Examen médico — Patricia Mora", codigo: "EXAMEN_MEDICO", estado: "PENDIENTE", fecha_subida: "—", fecha_vence: null, entidad: "TRABAJADOR", trabajador: "Patricia Mora" },
      ]},
      { nombre: "Compliance", estado: "FALLIDO", brechas: ["Vigencia sociedad expirada el 01 Jun 2025"], documentos: [
        { nombre: "Vigencia de sociedad", codigo: "VIGENCIA_SOCIEDAD", estado: "VENCIDO", fecha_subida: "01 Jun 2024", fecha_vence: "01 Jun 2025", entidad: "EMPRESA" },
      ]},
    ],
    trabajadores: [
      { nombre: "Luis Castillo", rut: "22.345.678-9", cumple: false },
      { nombre: "Patricia Mora", rut: "23.456.789-0", cumple: false },
      { nombre: "Andrés Reyes", rut: "24.567.890-1", cumple: false },
    ],
  },
]

const ESTADO_CFG = {
  ACREDITADA: { label: "Acreditada", dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  EN_PROCESO:  { label: "En Proceso",  dot: "bg-amber-500",  text: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200"  },
  BLOQUEADA:   { label: "Bloqueada",   dot: "bg-red-500",    text: "text-red-700",    bg: "bg-red-50",    border: "border-red-200"    },
}

const PILAR_CFG = {
  OK:       { dot: "bg-emerald-500", text: "text-emerald-700" },
  PENDIENTE:{ dot: "bg-amber-400",   text: "text-amber-600"   },
  FALLIDO:  { dot: "bg-red-500",     text: "text-red-600"     },
}

const DOC_CFG: Record<EstadoDoc, { label: string; dot: string; text: string; bg: string; border: string }> = {
  APROBADO:  { label: "Aprobado",  dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200"  },
  PENDIENTE: { label: "Pendiente", dot: "bg-slate-400",   text: "text-slate-600",   bg: "bg-slate-100",  border: "border-slate-200"    },
  RECHAZADO: { label: "Rechazado", dot: "bg-red-500",     text: "text-red-700",     bg: "bg-red-50",     border: "border-red-200"      },
  VENCIDO:   { label: "Vencido",   dot: "bg-orange-500",  text: "text-orange-700",  bg: "bg-orange-50",  border: "border-orange-200"   },
}

const PILAR_COLOR: Record<string, string> = {
  "Legal":      "bg-blue-50 text-blue-700 border-blue-200",
  "HSE":        "bg-amber-50 text-amber-700 border-amber-200",
  "Compliance": "bg-purple-50 text-purple-700 border-purple-200",
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
}

function EstadoBadge({ estado }: { estado: EstadoAcreditacion }) {
  const c = ESTADO_CFG[estado]
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", c.bg, c.border, c.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.dot)} />
      {c.label}
    </span>
  )
}

function PilarBadge({ estado }: { estado: EstadoPilar }) {
  const c = PILAR_CFG[estado]
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", c.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.dot)} />
      {estado === "OK" ? "OK" : estado === "PENDIENTE" ? "Pendiente" : "Fallido"}
    </span>
  )
}

function DocEstadoBadge({ estado }: { estado: EstadoDoc }) {
  const c = DOC_CFG[estado]
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border", c.bg, c.border, c.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.dot)} />
      {c.label}
    </span>
  )
}

// ── Panel detalle ─────────────────────────────────────────────────────────────

function DetailPanel({ c, onClose }: { c: Contratista; onClose: () => void }) {
  const [tab, setTab] = useState<PanelTab>("estado")
  const trabajadoresOk = c.trabajadores.filter(t => t.cumple).length
  const totalDocs = c.pilares.flatMap(p => p.documentos).length

  const tabs: { id: PanelTab; label: string; count?: number }[] = [
    { id: "estado", label: "Estado" },
    { id: "documentos", label: "Documentos", count: totalDocs },
    { id: "trabajadores", label: "Trabajadores", count: c.trabajadores.length },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-0 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
              {initials(c.razon_social)}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 leading-tight">{c.razon_social}</p>
              <p className="text-xs text-slate-400 font-mono">{c.rut}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0">
            <X size={16} />
          </button>
        </div>
        <EstadoBadge estado={c.estado} />

        {/* Tabs */}
        <div className="flex gap-0 mt-4 -mb-px">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors",
                tab === t.id
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-medium",
                  tab === t.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-5 py-4">

        {/* Tab: Estado */}
        {tab === "estado" && (
          <div className="space-y-3">
            {c.pilares.map(pilar => (
              <div key={pilar.nombre} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-slate-800">{pilar.nombre}</p>
                  <PilarBadge estado={pilar.estado} />
                </div>
                {pilar.brechas.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {pilar.brechas.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
                        <AlertCircle size={11} className="text-red-400 mt-0.5 shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {c.estado === "BLOQUEADA" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mt-2">
                <p className="text-xs font-semibold text-amber-800 mb-1">Aprobar excepción</p>
                <p className="text-xs text-amber-700 mb-3">
                  Puedes aprobar manualmente esta acreditación con justificación escrita.
                </p>
                <button className="w-full text-xs font-medium text-amber-800 border border-amber-300 bg-white hover:bg-amber-50 px-3 py-2 rounded-md transition-colors">
                  Aprobar excepción justificada
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab: Documentos */}
        {tab === "documentos" && (
          <div className="space-y-5">
            {c.pilares.map(pilar => {
              const docsEmpresa = pilar.documentos.filter(d => d.entidad === "EMPRESA")
              const docsTrabajador = pilar.documentos.filter(d => d.entidad === "TRABAJADOR")
              return (
                <div key={pilar.nombre}>
                  {/* Encabezado pilar */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded border", PILAR_COLOR[pilar.nombre] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
                      {pilar.nombre}
                    </span>
                    <span className="text-[10px] text-slate-400">{pilar.documentos.length} doc{pilar.documentos.length !== 1 ? "s" : ""}</span>
                  </div>

                  <div className="space-y-1.5">
                    {/* Documentos de empresa */}
                    {docsEmpresa.map(doc => (
                      <DocRow key={doc.codigo + doc.nombre} doc={doc} />
                    ))}

                    {/* Documentos de trabajador agrupados */}
                    {docsTrabajador.length > 0 && (
                      <div className="mt-1 ml-2 border-l-2 border-slate-100 pl-3 space-y-1.5">
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1.5">Por trabajador</p>
                        {docsTrabajador.map(doc => (
                          <DocRow key={doc.codigo + doc.trabajador} doc={doc} showTrabajador />
                        ))}
                      </div>
                    )}

                    {pilar.documentos.length === 0 && (
                      <p className="text-xs text-slate-400 italic px-1">Sin documentos cargados</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Tab: Trabajadores */}
        {tab === "trabajadores" && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 mb-3">{trabajadoresOk}/{c.trabajadores.length} trabajadores cumplen todos los requisitos</p>
            {c.trabajadores.map(t => (
              <div key={t.rut} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-800">{t.nombre}</p>
                  <p className="text-xs text-slate-400 font-mono">{t.rut}</p>
                </div>
                {t.cumple
                  ? <CheckCircle2 size={14} className="text-emerald-500" />
                  : <AlertCircle size={14} className="text-red-400" />
                }
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t border-slate-100 shrink-0">
        <p className="text-xs text-slate-400">Actualizado: {c.ultima_actualizacion}</p>
      </div>
    </div>
  )
}

function DocRow({ doc, showTrabajador }: { doc: Documento; showTrabajador?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white border border-slate-100 hover:border-slate-200 transition-colors group">
      <FileText size={13} className="text-slate-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-800 truncate">
          {showTrabajador && doc.trabajador ? doc.trabajador : doc.nombre}
        </p>
        {showTrabajador && doc.trabajador && (
          <p className="text-[10px] text-slate-400">{doc.nombre}</p>
        )}
        {doc.fecha_vence && (
          <p className="text-[10px] text-slate-400">Vence: {doc.fecha_vence}</p>
        )}
      </div>
      <DocEstadoBadge estado={doc.estado} />
      {doc.estado === "APROBADO" && (
        <button className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600">
          <Download size={12} />
        </button>
      )}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function ContratistasPage() {
  const [busqueda, setBusqueda] = useState("")
  const [filtro, setFiltro] = useState<EstadoAcreditacion | "TODOS">("TODOS")
  const [seleccionado, setSeleccionado] = useState<Contratista | null>(null)
  const [endpoint, setEndpoint] = useState<string | null>(null)

  useEffect(() => {
    const s = getSession()
    if (s?.mandante_id) setEndpoint(`/api/v1/mandantes/${s.mandante_id}/contratistas-detalle`)
  }, [])

  const { data: apiData } = useApiData<ApiContratista[]>(endpoint, [])
  const CONTRATISTAS = apiData.length > 0 ? mapContratistas(apiData) : CONTRATISTAS_DEFAULT

  const total = CONTRATISTAS.length
  const filtrados = CONTRATISTAS.filter(c => {
    const matchQ = c.razon_social.toLowerCase().includes(busqueda.toLowerCase()) || c.rut.includes(busqueda)
    const matchE = filtro === "TODOS" || c.estado === filtro
    return matchQ && matchE
  })

  const kpi = {
    acreditadas: CONTRATISTAS.filter(c => c.estado === "ACREDITADA").length,
    enProceso: CONTRATISTAS.filter(c => c.estado === "EN_PROCESO").length,
    bloqueadas: CONTRATISTAS.filter(c => c.estado === "BLOQUEADA").length,
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", seleccionado ? "mr-96" : "")}>

        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Contratistas</h1>
              <p className="text-sm text-slate-500 mt-0.5">Gestiona y monitorea el estado de acreditación</p>
            </div>
            <button className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors">
              <Plus size={15} />
              Invitar contratista
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-8 py-6 space-y-5">

          {/* KPI */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total", value: total, color: "text-slate-900" },
              { label: "Acreditadas", value: kpi.acreditadas, color: "text-emerald-600" },
              { label: "En Proceso", value: kpi.enProceso, color: "text-amber-600" },
              { label: "Bloqueadas", value: kpi.bloqueadas, color: "text-red-600" },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{k.label}</p>
                <p className={cn("text-3xl font-semibold mt-1", k.color)}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar empresa o RUT..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </div>
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
              {(["TODOS", "ACREDITADA", "EN_PROCESO", "BLOQUEADA"] as const).map(e => (
                <button
                  key={e}
                  onClick={() => setFiltro(e)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    filtro === e ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  {e === "TODOS" ? "Todos" : e === "ACREDITADA" ? "Acreditadas" : e === "EN_PROCESO" ? "En Proceso" : "Bloqueadas"}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 ml-auto">{filtrados.length} de {total}</p>
          </div>

          {/* Tabla */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Empresa</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">RUT</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acreditación</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Legal</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">HSE</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Compliance</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <Users size={12} className="inline" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actualizado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map(c => {
                  const tOk = c.trabajadores.filter(t => t.cumple).length
                  const selected = seleccionado?.id === c.id
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSeleccionado(selected ? null : c)}
                      className={cn("cursor-pointer transition-colors", selected ? "bg-slate-50" : "hover:bg-slate-50/70")}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {initials(c.razon_social)}
                          </div>
                          <span className="font-medium text-slate-900 truncate max-w-[180px]">{c.razon_social}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 font-mono text-xs">{c.rut}</td>
                      <td className="px-4 py-3.5"><EstadoBadge estado={c.estado} /></td>
                      {c.pilares.map(p => (
                        <td key={p.nombre} className="px-4 py-3.5"><PilarBadge estado={p.estado} /></td>
                      ))}
                      <td className="px-4 py-3.5">
                        <span className={cn("text-xs font-medium", tOk === c.trabajadores.length ? "text-emerald-600" : "text-amber-600")}>
                          {tOk}/{c.trabajadores.length}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-400">{c.ultima_actualizacion}</td>
                      <td className="px-4 py-3.5">
                        <ChevronRight size={14} className={cn("text-slate-300 transition-transform", selected && "rotate-90 text-slate-500")} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {filtrados.length === 0 && (
              <div className="py-14 text-center">
                <p className="text-sm text-slate-400">No se encontraron contratistas</p>
              </div>
            )}

            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
              <p className="text-xs text-slate-400">Mostrando {filtrados.length} resultado{filtrados.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Panel lateral */}
      <div className={cn(
        "fixed right-0 top-0 h-full w-96 bg-white border-l border-slate-200 shadow-xl z-20 transition-transform duration-300",
        seleccionado ? "translate-x-0" : "translate-x-full"
      )}>
        {seleccionado && <DetailPanel c={seleccionado} onClose={() => setSeleccionado(null)} />}
      </div>
    </div>
  )
}
