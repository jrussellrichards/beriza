"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/shared/lib/api"
import type { Trabajador } from "@/shared/types"

export function useTrabajadores(empresaId: string) {
  const [data, setData] = useState<Trabajador[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<Trabajador[]>(`/api/v1/trabajadores/empresa/${empresaId}`)
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar trabajadores")
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  useEffect(() => { load() }, [load])

  return { data, loading, error, refetch: load }
}
