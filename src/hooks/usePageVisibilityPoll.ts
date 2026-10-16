"use client"

import { useEffect, useRef } from "react"

/**
 * Ejecuta `callback` inmediatamente al montar y luego cada `intervalMs`,
 * pero pausa el polling automáticamente cuando la pestaña está oculta
 * (`document.visibilityState === "hidden"`) y refresca al volver a ser visible.
 */
export function usePageVisibilityPoll(
  callback: (signal?: AbortSignal) => void | Promise<void>,
  intervalMs: number,
  enabled = true,
) {
  const savedCallback = useRef(callback)
  savedCallback.current = callback

  useEffect(() => {
    if (!enabled) return

    let abortController = new AbortController()

    const run = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return
      }
      abortController.abort()
      abortController = new AbortController()
      void savedCallback.current(abortController.signal)
    }

    run()

    const id = setInterval(run, intervalMs)

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        run()
      }
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange)
    }

    return () => {
      clearInterval(id)
      abortController.abort()
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange)
      }
    }
  }, [intervalMs, enabled])
}
