import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ddragon.leagueoflegends.com",
      },
      {
        protocol: "https",
        hostname: "raw.communitydragon.org",
      },
      {
        protocol: "https",
        hostname: "static-cdn.jtvnw.net",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Permite ser embebido en iframe (ej. extensibilidad Twitch / overlays)
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
        ],
      },
    ]
  },
}

export default nextConfig
