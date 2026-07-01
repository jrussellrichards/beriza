"use client"

import { useEffect, useRef, useState } from "react"
import { api } from "./api"

/**
 * Fetch data from an API endpoint with a 2-second fallback to mock data.
 * If the API responds within 2 seconds, mock data is never shown.
 * If it times out or errors, mock data is used as fallback.
 */
export function useApiData<T>(
  endpoint: string | null,
  fallback: T,
): { data: T; loading: boolean } {
  const [data, setData] = useState<T>(fallback)
  const [loading, setLoading] = useState(true)
  const resolvedRef = useRef(false)

  useEffect(() => {
    if (!endpoint) {
      setLoading(false)
      return
    }

    resolvedRef.current = false

    const timer = setTimeout(() => {
      if (!resolvedRef.current) {
        resolvedRef.current = true
        setData(fallback)
        setLoading(false)
      }
    }, 2000)

    api
      .get<T>(endpoint)
      .then((res) => {
        if (!resolvedRef.current) {
          resolvedRef.current = true
          clearTimeout(timer)
          setData(res)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!resolvedRef.current) {
          resolvedRef.current = true
          clearTimeout(timer)
          setData(fallback)
          setLoading(false)
        }
      })

    return () => {
      resolvedRef.current = true
      clearTimeout(timer)
    }
    // endpoint changes intentionally reset the fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint])

  return { data, loading }
}
