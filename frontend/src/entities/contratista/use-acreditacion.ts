"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/shared/lib/api"
import type { EstadoAcreditacion } from "@/shared/types"

export function useAcreditacion(contratistaId: string, mandanteId: string) {
  const [data, setData] = useState<EstadoAcreditacion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!contratistaId || !mandanteId) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<EstadoAcreditacion>(
        `/api/v1/acreditacion/${contratistaId}/mandante/${mandanteId}`
      )
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar acreditación")
    } finally {
      setLoading(false)
    }
  }, [contratistaId, mandanteId])

  useEffect(() => { load() }, [load])

  return { data, loading, error, refetch: load }
}
