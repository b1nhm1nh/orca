import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getNineRouterGatewayStatus } from './ninerouter-gateway-status'

let dataDir: string

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'ninerouter-status-'))
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await rm(dataDir, { recursive: true, force: true })
})

async function writeToken(): Promise<void> {
  await mkdir(join(dataDir, 'auth'), { recursive: true })
  await writeFile(join(dataDir, 'machine-id'), 'machine')
  await writeFile(join(dataDir, 'auth', 'cli-secret'), 'secret')
}

describe('getNineRouterGatewayStatus', () => {
  it('reports not installed without touching the network when the token files are missing', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const status = await getNineRouterGatewayStatus(dataDir)
    expect(status).toMatchObject({ installed: false, reachable: false, connections: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps connections to active, rate-limited and disabled', async () => {
    await writeToken()
    const future = new Date(Date.now() + 60 * 60_000).toISOString()
    const past = new Date(Date.now() - 60_000).toISOString()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        expect(String(url)).toBe('http://127.0.0.1:20128/api/providers')
        return new Response(
          JSON.stringify({
            connections: [
              { id: 'a', provider: 'claude', name: 'work', isActive: true },
              { id: 'b', provider: 'codex', isActive: true, rateLimitedUntil: future },
              { id: 'c', provider: 'gemini', isActive: true, rateLimitedUntil: past },
              { id: 'd', provider: 'glm', isActive: false }
            ]
          }),
          { status: 200 }
        )
      })
    )
    const status = await getNineRouterGatewayStatus(dataDir)
    expect(status.installed && status.reachable).toBe(true)
    expect(status.error).toBeNull()
    expect(status.connections.map((c) => [c.id, c.state, c.name])).toEqual([
      ['a', 'active', 'work'],
      ['b', 'rate-limited', null],
      ['c', 'active', null],
      ['d', 'disabled', null]
    ])
    expect(status.connections[1]?.rateLimitedUntil).toBe(Date.parse(future))
  })

  it('reports a stopped gateway as installed but unreachable', async () => {
    await writeToken()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('fetch failed', { cause: { code: 'ECONNREFUSED' } })
      })
    )
    const status = await getNineRouterGatewayStatus(dataDir)
    expect(status).toMatchObject({ installed: true, reachable: false, connections: [] })
    expect(status.error).toContain('not reachable')
  })

  it('keeps a rejected token reachable with its error', async () => {
    await writeToken()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 401 }))
    )
    const status = await getNineRouterGatewayStatus(dataDir)
    expect(status).toMatchObject({ installed: true, reachable: true, connections: [] })
    expect(status.error).toContain('rejected')
  })
})
