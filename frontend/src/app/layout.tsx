import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/**
 * IBM Plex Sans + IBM Plex Mono.
 *
 * Por qué no Geist: es la tipografía de marca de Vercel, y hace que el producto
 * se lea como un template de deploy.
 *
 * Por qué no Inter: es legible pero es *la* fuente del SaaS genérico. Acredita
 * necesita carácter propio.
 *
 * Por qué Plex: herencia industrial-técnica que calza con minería y
 * construcción, letras reconocibles, cifras tabulares reales (`tnum`), set
 * completo de diacríticos del español —incluidas mayúsculas acentuadas— y una
 * monoespaciada hermana, así el RUT y el nombre de archivo pertenecen al mismo
 * sistema en vez de ser dos fuentes pegadas.
 *
 * El peso 500 es indispensable: Arial no lo tenía y por eso toda la jerarquía
 * medium/semibold de la app se venía renderizando como regular/negrita.
 */
const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Acredita — Acreditación de contratistas",
  description:
    "Acredita la documentación de tus empresas contratistas y sabe exactamente quién puede entrar a faena.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // lang="es": la app está íntegramente en español. Con "en" los lectores de
    // pantalla pronuncian el contenido con fonética inglesa.
    //
    // Sin `antialiased`: adelgaza el texto en macOS, y para leer al sol en faena
    // conviene más masa, no menos.
    <html lang="es" className={`${plexSans.variable} ${plexMono.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
