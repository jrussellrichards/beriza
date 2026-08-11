"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, ArrowRight } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { api } from "@/shared/lib/api"
import { getSession } from "@/shared/lib/auth"
import type { Perfil } from "@/entities/servicio/types"

/**
 * Los cuatro pasos que un mandante nuevo tiene que dar, en orden, antes de que
 * la plataforma le sirva de algo.
 *
 * Existe porque ese orden es lo único que el cliente no puede deducir solo. Cada
 * pantalla funciona bien por separado y el menú lateral las lista con el mismo
 * peso, en un orden que no es el de uso. Lo que faltaba era la secuencia.
 *
 * Peor todavía: el único texto que orientaba —"Crea uno desde Servicios"— apunta
 * al ÚLTIMO paso, así que quien lo seguía llegaba a un diálogo con el selector de
 * contratista vacío y sin salida. Hacer exactamente lo que la aplicación indica y
 * chocar contra una pared es la peor primera impresión posible.
 *
 * Se muestra sólo mientras quede algo pendiente y desaparece sola: un cliente en
 * régimen no tiene por qué seguir viendo instrucciones de instalación.
 */

interface Paso {
  titulo: string
  detalle: string
  href: string
  hecho: boolean
}

export function PuestaEnMarcha({ tieneServicios }: { tieneServicios: boolean }) {
  const [pasos, setPasos] = useState<Paso[] | null>(null)

  useEffect(() => {
    const mid = getSession()?.mandante_id
    if (!mid) return

    Promise.all([
      api.get<Perfil[]>(`/api/v1/mandantes/${mid}/perfiles`).catch(() => []),
      api.get<unknown[]>("/api/v1/centros-trabajo/").catch(() => []),
      api.get<unknown[]>(`/api/v1/mandantes/${mid}/contratistas`).catch(() => []),
    ]).then(([perfiles, centros, contratistas]) => {
      // Un perfil que no exige nada no cuenta como paso cumplido: deja al
      // contratista figurando en regla sin haber entregado un documento.
      const perfilUtil = perfiles.some(p => (p.requisitos_exigidos ?? 0) > 0)
      setPasos([
        {
          titulo: "Define qué documentos vas a exigir",
          detalle: "Un perfil agrupa las exigencias de un tipo de faena. Puedes partir de una plantilla.",
          href: "/mandante/requisitos",
          hecho: perfilUtil,
        },
        {
          titulo: "Registra dónde se trabaja",
          detalle: "Tus obras, plantas o predios. Cada faena ocurre en uno.",
          href: "/mandante/centros",
          hecho: centros.length > 0,
        },
        {
          titulo: "Invita a tus empresas contratistas",
          detalle: "Reciben un correo y cargan sus documentos por su cuenta.",
          href: "/mandante/contratistas",
          hecho: contratistas.length > 0,
        },
        {
          titulo: "Crea la faena",
          detalle: "Une una empresa, un lugar y un perfil. Ahí empiezan a correr las exigencias.",
          href: "/mandante/servicios",
          hecho: tieneServicios,
        },
      ])
    })
  }, [tieneServicios])

  if (!pasos) return null
  const listos = pasos.filter(p => p.hecho).length
  if (listos === pasos.length) return null

  // El primero sin hacer es el único que se ofrece: dar cuatro caminos a la vez
  // reproduce el problema que esto viene a resolver.
  const siguiente = pasos.find(p => !p.hecho)!

  return (
    <section className="rounded-xl border border-brand-line bg-brand-soft px-5 py-4">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <p className="text-sm font-semibold text-ink">Termina de configurar tu cuenta</p>
        <span className="text-xs text-brand-hover shrink-0">{listos} de {pasos.length}</span>
      </div>

      <ol className="space-y-2.5">
        {pasos.map((p, i) => {
          const esSiguiente = p === siguiente
          return (
            <li key={p.href} className="flex items-start gap-3">
              <span className={cn(
                "mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 text-[10px] font-semibold",
                p.hecho
                  ? "bg-ok-soft border-ok-line text-ok-ink"
                  : esSiguiente
                    ? "bg-surface-inverse border-surface-inverse text-white"
                    : "bg-surface border-line text-ink-subtle",
              )}>
                {p.hecho ? <Check size={11} /> : i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className={cn(
                  "text-sm",
                  p.hecho ? "text-ink-subtle line-through" : "text-ink font-medium",
                )}>
                  {p.titulo}
                </p>
                {esSiguiente && (
                  <p className="text-xs text-brand-hover mt-0.5 leading-relaxed">{p.detalle}</p>
                )}
              </div>

              {esSiguiente && (
                <Link
                  href={p.href}
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-medium bg-surface-inverse text-white px-3 py-1.5 rounded-lg hover:bg-surface-inverse-hover transition-colors"
                >
                  Ir <ArrowRight size={12} />
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
