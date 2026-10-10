import { describe, expect, it, vi } from 'vitest'
import { createNineRouterGatewayClient, type NineRouterUsageChart, type NineRouterUsageStats } from './ninerouter-gateway-client'
import { scanNineRouterUsage } from './ninerouter-usage-scan'

const NOW = new Date('2026-10-11T12:00:00')

function statsResponse() {
  return {
    totalRequests: 12,
    totalPromptTokens: 900,
    totalCompletionTokens: 100,
    totalCachedTokens: 40,
    totalCost: 1.5,
    byModel: {
      'claude-sonnet-5 (claude)': {
        requests: 8,
        promptTokens: 700,
        completionTokens: 80,
        cachedTokens: 30,
        cost: 1.2,
        rawModel: 'claude-sonnet-5',
        provider: 'claude',
        lastUsed: '2026-10-10T08:00:00.000Z'
      },
      'glm-5.3 (zcode)': {
        requests: 4,
        promptTokens: 200,
        completionTokens: 20,
        cachedTokens: 10,
        cost: 0.3,
        rawModel: '',
        provider: 'zcode',
        lastUsed: null
      }
    },
    byProvider: {
      claude: {
        requests: 8,
        promptTokens: 700,
        completionTokens: 80,
        cachedTokens: 30,
        cost: 1.2
      }
    }
  }
}

function clientWith(overrides: { stats?: NineRouterUsageStats; chart?: NineRouterUsageChart } = {}) {
  return {
    fetchStats: vi.fn(async (): Promise<NineRouterUsageStats> => overrides.stats ?? statsResponse()),
    fetchDailyChart: vi.fn(
      async (): Promise<NineRouterUsageChart> =>
        overrides.chart ?? [
          { label: 'Oct 11', tokens: 500, cost: 0.5 },
          { label: 'Oct 10', tokens: 0, cost: 0 },
          { label: 'gibberish', tokens: 5, cost: 0.1 }
        ]
    )
  }
}

describe('ninerouter usage scan', () => {
  it('builds one session per model and daily rows from chart buckets', async () => {
    const client = clientWith()
    const { sessions, dailyAggregates } = await scanNineRouterUsage(client, NOW)

    expect(client.fetchStats).toHaveBeenCalledWith('all')
    expect(sessions).toHaveLength(2)
    const claude = sessions.find((session) => session.primaryModel === 'claude-sonnet-5')
    expect(claude).toMatchObject({
      sessionId: 'ninerouter:claude:claude-sonnet-5',
      eventCount: 8,
      totalInputTokens: 700,
      totalOutputTokens: 80,
      totalTokens: 780,
      costUsd: 1.2,
      primaryWorktreeId: null
    })
    const fallbackKey = sessions.find((session) => session.sessionId === 'ninerouter:zcode:glm-5.3 (zcode)')
    expect(fallbackKey?.primaryModel).toBe('glm-5.3 (zcode)')
    expect(fallbackKey?.lastTimestamp).toBe(NOW.toISOString())

    // The zero bucket is dropped; the unreadable label is skipped.
    expect(dailyAggregates).toEqual([
      {
        day: '2026-10-11',
        model: null,
        projectKey: '9router',
        projectLabel: '9router',
        repoId: null,
        worktreeId: null,
        eventCount: 0,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningOutputTokens: 0,
        totalTokens: 500,
        costUsd: 0.5
      }
    ])
  })

  it('fills a stats body without model rows through the gateway defaults', async () => {
    const fetchMock = vi.fn(async (url: string | URL) =>
      String(url).includes('/api/usage/stats')
        ? new Response(JSON.stringify({ byModel: {}, byProvider: {} }), { status: 200 })
        : new Response('[]', { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)
    try {
      const client = createNineRouterGatewayClient('token123')
      const { sessions, dailyAggregates } = await scanNineRouterUsage(client, NOW)
      expect(sessions).toEqual([])
      expect(dailyAggregates).toEqual([])
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('ninerouter gateway client', () => {
  it('sends the cli token and parses a stats payload', async () => {
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe('http://127.0.0.1:20128/api/usage/stats?period=all')
      expect(init?.headers).toMatchObject({ 'x-9r-cli-token': 'token123' })
      return new Response(JSON.stringify(statsResponse()), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    try {
      const client = createNineRouterGatewayClient('token123')
      const stats = await client.fetchStats('all')
      expect(stats.totalCost).toBe(1.5)
      expect(Object.keys(stats.byModel)).toHaveLength(2)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('maps a 401 to a token message and connection refusal to a reachability message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"error":"Unauthorized"}', { status: 401 }))
    )
    const client = createNineRouterGatewayClient('token123')
    await expect(client.fetchStats('all')).rejects.toThrow('rejected the usage request')
    vi.unstubAllGlobals()

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('fetch failed', { cause: { code: 'ECONNREFUSED' } })
      })
    )
    await expect(client.fetchStats('all')).rejects.toThrow('not reachable on 127.0.0.1:20128')
    vi.unstubAllGlobals()
  })

  it('rejects a response with an unexpected shape', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"byModel": 5}', { status: 200 })))
    try {
      const client = createNineRouterGatewayClient('token123')
      await expect(client.fetchStats('7d')).rejects.toThrow('unexpected shape')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
