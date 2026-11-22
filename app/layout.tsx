import type { Metadata } from "next"
import { Inter, Rajdhani } from "next/font/google"
import Navbar from "@/components/Navbar"
import AppQueryProvider from "@/components/AppQueryProvider"
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
  title: "SOLOGAE",
  description:
    "Compite en SoloGae Challenge - Escala y supera a Diego en cantidad de juegos.",
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
        <AppQueryProvider>
          <Navbar />
          <div className="sg-app-shell">{children}</div>
        </AppQueryProvider>
      </body>
    </html>
  )
}
