import { afterEach, describe, expect, it, vi } from "vitest"

describe("fetchApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("devuelve el JSON de una respuesta correcta", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ value: 1 }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const { fetchApi } = await import("./clientApi")

    await expect(fetchApi<{ value: number }>("/api/test")).resolves.toEqual({ value: 1 })
  })

  it("bloquea nuevas llamadas hasta Retry-After después de un 429", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 429, headers: { "Retry-After": "60" } }))
    vi.stubGlobal("fetch", fetchMock)
    const { ApiRequestError, fetchApi } = await import("./clientApi")

    await expect(fetchApi("/api/snapshots")).rejects.toBeInstanceOf(ApiRequestError)
    await expect(fetchApi("/api/snapshots")).rejects.toMatchObject({ status: 429 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
