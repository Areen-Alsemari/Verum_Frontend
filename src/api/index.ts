import { createMockClient } from './mock'
import { createRealClient } from './real'
import type { ApiClient } from './types'

export * from './types'
export { MOCK_SPEEDS, getMockSpeed, setMockSpeed } from './mock'

export type ApiMode = 'mock' | 'real' | 'auto'

export interface ResolvedApi {
  client: ApiClient
  /** why mock mode is active, for the badge tooltip (null in real mode) */
  mockReason: string | null
}

function configuredMode(): ApiMode {
  const m = import.meta.env.VITE_API_MODE as string | undefined
  return m === 'mock' || m === 'real' ? m : 'auto'
}

/**
 * VITE_API_MODE=mock  -> mock data, no network
 * VITE_API_MODE=real  -> real backend only; failures surface as errors
 * unset / auto        -> probe the backend, fall back to mock data if unreachable
 * VITE_API_BASE       -> backend origin (default: same origin, i.e. the Vite /api proxy)
 */
export async function resolveApi(): Promise<ResolvedApi> {
  const mode = configuredMode()
  if (mode === 'mock') return { client: createMockClient(), mockReason: 'Mock mode selected (VITE_API_MODE=mock).' }
  const base = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''
  const real = createRealClient(base)
  if (mode === 'real') return { client: real, mockReason: null }
  try {
    await withTimeout(real.listAgents(), 2500)
    return { client: real, mockReason: null }
  } catch (e) {
    return {
      client: createMockClient(),
      mockReason: `Backend not reachable (${e instanceof Error ? e.message : 'unknown error'}). Showing demo data.`,
    }
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}
