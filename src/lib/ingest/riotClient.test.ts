import { describe, it, expect, vi } from "vitest"
import { DeadlineReachedError, createRiotClient } from "./riotClient"

function setup(responses: Response[], deadlineOffset = 60_000) {
  let clock = 0
  const sleeps: number[] = []
  const fetchImpl = vi.fn(async () => responses.shift() ?? new Response("[]", { status: 200 }))
  const client = createRiotClient({
    deadlineMs: deadlineOffset,
    minIntervalMs: 1300,
    now: () => clock,
    sleep: async (ms) => { sleeps.push(ms); clock += ms },
    fetchImpl: fetchImpl as unknown as typeof fetch,
    state: { lastRequestAt: -10_000 },
  })
  return { client, sleeps, fetchImpl }
}

describe("createRiotClient", () => {
  it("espacia las llamadas según el intervalo mínimo", async () => {
    const { client, sleeps } = setup([])
    await client.get("u1")
    await client.get("u2")
    expect(sleeps).toEqual([1300])
  })

  it("respeta Retry-After en 429 y reintenta", async () => {
    const { client, sleeps, fetchImpl } = setup([
      new Response("", { status: 429, headers: { "Retry-After": "7" } }),
      new Response("[]", { status: 200 }),
    ])
    const res = await client.get("u")
    expect(res.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(sleeps[0]).toBe(7000)
  })

  it("devuelve el 429 tras agotar los reintentos (sin bucle infinito)", async () => {
    const r429 = () => new Response("", { status: 429, headers: { "Retry-After": "1" } })
    const { client, fetchImpl } = setup([r429(), r429(), r429(), r429(), r429()])
    const res = await client.get("u")
    expect(res.status).toBe(429)
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  it("lanza DeadlineReachedError si no queda presupuesto", async () => {
    const { client, fetchImpl } = setup([], 4000)
    await expect(client.get("u")).rejects.toBeInstanceOf(DeadlineReachedError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("no espera un Retry-After que supere el deadline", async () => {
    const { client } = setup([new Response("", { status: 429, headers: { "Retry-After": "120" } })], 60_000)
    await expect(client.get("u")).rejects.toBeInstanceOf(DeadlineReachedError)
  })
})
