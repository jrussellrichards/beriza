import { NextRequest, NextResponse } from "next/server"

// Proxy explícito hacia el backend, en vez de next.config.ts `rewrites()`.
// Vercel no reenvía de forma confiable POST/PUT con body a un origen externo vía
// rewrites — en ciertos casos responde un 307 al navegador con la URL real del
// backend (HTTP), lo que el navegador bloquea como mixed content en un sitio HTTPS.
// Un route handler hace el fetch server-side explícitamente, sin ese problema.

export const runtime = "nodejs"

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000"

async function proxy(req: NextRequest) {
  // pathname crudo (no reconstruido desde los segmentos del catch-all) para
  // no perder el slash final — FastAPI distingue /documentos de /documentos/
  // y redirige (307) si no coincide, lo que reexpone la URL del backend.
  const target = `${BACKEND_URL}${req.nextUrl.pathname}${req.nextUrl.search}`

  const headers = new Headers(req.headers)
  headers.delete("host")
  headers.delete("content-length")

  const tieneBody = !["GET", "HEAD"].includes(req.method)

  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers,
    body: tieneBody ? req.body : undefined,
    redirect: "manual",
  }
  if (tieneBody) init.duplex = "half"

  const res = await fetch(target, init)

  const resHeaders = new Headers(res.headers)
  resHeaders.delete("content-encoding")
  resHeaders.delete("content-length")
  resHeaders.delete("transfer-encoding")

  return new NextResponse(res.body, { status: res.status, headers: resHeaders })
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
  proxy as OPTIONS,
}
