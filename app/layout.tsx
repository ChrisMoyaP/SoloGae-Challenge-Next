import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "SoloGae Challenge",
  description: "Leaderboard del torneo SoloGae Challenge - League of Legends",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <div className="site-layout">
          <div className="site-left">{children}</div>
          <div className="site-right">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/GaeBienvenida.jpg" className="center-img" alt="Bienvenida" />
          </div>
        </div>
      </body>
    </html>
  )
}
