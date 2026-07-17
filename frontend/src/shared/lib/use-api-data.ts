"use client"

import { useEffect, useState } from "react"
import { api } from "./api"

/**
 * Fetch data from an API endpoint.
 * `initial` es solo el valor inicial mientras carga — NUNCA se muestran
 * datos inventados: si la API falla, se expone el error y el valor inicial
 * (típicamente una lista vacía) para que la página muestre un estado honesto.
 */
export function useApiData<T>(
  endpoint: string | null,
  initial: T,
): { data: T; loading: boolean; error: string | null } {
  const [data, setData] = useState<T>(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!endpoint) {
      setLoading(false)
      return
    }
    let cancelado = false
    setLoading(true)
    setError(null)

    api
      .get<T>(endpoint)
      .then((res) => {
        if (!cancelado) {
          setData(res)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelado) {
          setError(e instanceof Error ? e.message : "Error al cargar datos")
          setLoading(false)
        }
      })

    return () => {
      cancelado = true
    }
    // endpoint changes intentionally reset the fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint])

  return { data, loading, error }
}
