import type { Metadata } from "next"
import { Inter, Rajdhani } from "next/font/google"
import Navbar from "@/components/Navbar"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
})

export const metadata: Metadata = {
  title: "SOLOGAE — Plataforma Competitiva & Leaderboard",
  description:
    "Compite en desafíos, asciende en el ranking y forma parte de la comunidad competitiva de SoloGae Challenge - League of Legends.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${inter.variable} ${rajdhani.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <Navbar />
        <div className="sg-app-shell">{children}</div>
      </body>
    </html>
  )
}
