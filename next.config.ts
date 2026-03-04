import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Permite ser embebido en iframe desde cualquier origen
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
          // Elimina X-Frame-Options para no bloquear el iframe
          {
            key: "X-Frame-Options",
            value: "ALLOWALL",
          },
        ],
      },
    ]
  },
}

export default nextConfig
