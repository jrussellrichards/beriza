import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sin esto, Next redirige /api/v1/servicios/ -> /api/v1/servicios (308)
  // antes de llegar al route handler de app/api/[...path]/route.ts.
  skipTrailingSlashRedirect: true,
  // El proxy hacia el backend vive en app/api/[...path]/route.ts (route
  // handler), no en rewrites(): Vercel no reenvía de forma confiable POST/PUT
  // con body a un origen externo vía rewrites (cae a un 307 con la URL real
  // del backend, que el navegador bloquea como mixed content en HTTPS).
};

export default nextConfig;
