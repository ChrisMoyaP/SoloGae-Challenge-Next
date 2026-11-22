export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterAt?: number,
  ) {
    super(message)
    this.name = "ApiRequestError"
  }
}

const retryBlocks = new Map<string, number>()

function getRetryAfterAt(response: Response): number {
  const seconds = Number.parseInt(response.headers.get("Retry-After") ?? "", 10)
  return Date.now() + (Number.isFinite(seconds) ? seconds : 30) * 1000
}

export async function fetchApi<T>(url: string, signal?: AbortSignal): Promise<T> {
  const blockedUntil = retryBlocks.get(url)
  if (blockedUntil && blockedUntil > Date.now()) {
    throw new ApiRequestError("La consulta está esperando el límite de solicitudes.", 429, blockedUntil)
  }

  const response = await fetch(url, { signal })
  if (response.ok) return response.json() as Promise<T>

  const retryAfterAt = response.status === 429 ? getRetryAfterAt(response) : undefined
  if (retryAfterAt) retryBlocks.set(url, retryAfterAt)
  throw new ApiRequestError(`La consulta falló (${response.status}).`, response.status, retryAfterAt)
}

export function isRateLimited(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError && error.status === 429
}
