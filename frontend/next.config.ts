import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Proxy same-origin hacia el backend: el navegador llama a /api/* en
    // este mismo dominio y Next lo reenvía server-side. Evita CORS y el
    // bloqueo de mixed-content cuando el backend aún no tiene HTTPS.
    // BACKEND_URL se configura en Vercel (producción); en dev apunta al
    // backend local y no interfiere porque el front usa NEXT_PUBLIC_API_URL.
    const backend = process.env.BACKEND_URL ?? "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
