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
): { data: T; loading: boolean; error: string | null; refetch: () => void } {
  const [data, setData] = useState<T>(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Se incrementa para volver a pedir los datos tras una accion que los cambia
  // (crear, invitar, aprobar) sin recargar la pagina completa.
  const [recarga, setRecarga] = useState(0)

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
  }, [endpoint, recarga])

  return { data, loading, error, refetch: () => setRecarga((n) => n + 1) }
}
