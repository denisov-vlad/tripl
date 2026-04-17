const BASE = '/api/v1'
const BACKEND_UNAVAILABLE_MESSAGE = 'Backend is unavailable. Check that the API server is running and try again.'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response

  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      ...init,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request to the backend timed out. Try again after the API becomes available.')
    }
    throw new Error(BACKEND_UNAVAILABLE_MESSAGE)
  }

  if (!res.ok) {
    if ([502, 503, 504].includes(res.status)) {
      throw new Error(BACKEND_UNAVAILABLE_MESSAGE)
    }

    const body = await res.json().catch(() => ({}))
    const detail = typeof body.detail === 'string' ? body.detail : undefined
    throw new Error(detail || `${res.status} ${res.statusText}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
