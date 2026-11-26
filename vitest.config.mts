import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    // Periodo de pruebas por defecto para la suite (no afecta dev/build). Los tests que
    // validan la configuración lo sobrescriben con vi.stubEnv.
    env: {
      NEXT_PUBLIC_EVENT_NAME: "SoloGae 2",
      NEXT_PUBLIC_EVENT_START: "2026-11-23T00:00:00-03:00",
      NEXT_PUBLIC_EVENT_END: "2026-12-01T00:00:00-03:00",
    },
  },
})
