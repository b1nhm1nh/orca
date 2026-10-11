import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RateLimitService } from './service'
import { fetchClaudeRateLimits } from './claude-fetcher'
import { fetchCodexRateLimits } from './codex-fetcher'
import { fetchNineRouterRateLimits } from './ninerouter-model-quota-fetcher'
import { okProvider, resetRateLimitProviderMocks } from './rate-limit-service-test-harness'

vi.mock('./claude-fetcher', () => ({
  fetchClaudeRateLimits: vi.fn(),
  fetchManagedAccountUsage: vi.fn()
}))

vi.mock('./codex-fetcher', () => ({
  consumeCodexRateLimitResetCredit: vi.fn(),
  fetchCodexRateLimits: vi.fn()
}))

vi.mock('./gemini-usage-fetcher', () => ({
  fetchGeminiRateLimits: vi.fn()
}))

vi.mock('./antigravity-usage-fetcher', () => ({
  fetchAntigravityRateLimits: vi.fn()
}))

vi.mock('./kimi-fetcher', () => ({
  fetchKimiRateLimits: vi.fn()
}))

vi.mock('./opencode-go-usage-source-selection', () => ({
  fetchOpenCodeGoUsage: vi.fn()
}))

vi.mock('./ninerouter-model-quota-fetcher', () => {
  const unavailable = () => ({
    provider: 'ninerouter',
    session: null,
    weekly: null,
    updatedAt: Date.now(),
    error: null,
    status: 'unavailable'
  })
  return {
    fetchNineRouterRateLimits: vi.fn(async () => unavailable()),
    nineRouterUsageDisabledSnapshot: vi.fn(unavailable)
  }
})

vi.mock('./zcode-usage-fetcher', () => ({
  fetchZcodeRateLimits: vi.fn(),
  hasZcodeCliPlanCredentials: vi.fn(() => false)
}))

vi.mock('./minimax/minimax-fetcher', () => ({
  fetchMiniMaxRateLimits: vi.fn()
}))

vi.mock('./grok-fetcher', () => ({
  fetchGrokRateLimits: vi.fn()
}))

vi.mock('./cursor-fetcher', () => ({
  fetchCursorRateLimits: vi.fn()
}))

vi.mock('./cursor-auth', () => ({
  readCursorAuthSession: vi.fn()
}))

vi.mock('./grok-auth', () => ({
  readGrokAuthSession: vi.fn(() => ({ status: 'missing' }))
}))

vi.mock('../minimax/minimax-cookie-store', () => ({
  hasMiniMaxSessionCookie: vi.fn(() => false)
}))

vi.mock('../minimax/minimax-api-key-store', () => ({
  hasMiniMaxApiKey: vi.fn(() => false)
}))

vi.mock('../zcode/zcode-plan-api-key-store', () => ({
  hasZcodePlanApiKey: vi.fn(() => false),
  readZcodePlanApiKey: vi.fn(() => null),
  saveZcodePlanApiKey: vi.fn(),
  clearZcodePlanApiKey: vi.fn()
}))

describe('RateLimitService 9router model quota', () => {
  beforeEach(() => {
    resetRateLimitProviderMocks()
    vi.mocked(fetchClaudeRateLimits).mockResolvedValue(okProvider('claude', 7))
    vi.mocked(fetchCodexRateLimits).mockResolvedValue(okProvider('codex', 20))
  })

  it('does not read 9router until its usage tracking is turned on', async () => {
    const service = new RateLimitService()

    await service.refresh()

    expect(fetchNineRouterRateLimits).toHaveBeenCalledWith({ enabled: false })
    expect(service.getState().ninerouter?.status).toBe('unavailable')
  })

  it('reads 9router once the opt-in resolver allows it', async () => {
    const service = new RateLimitService()
    service.setNineRouterUsageEnabledResolver(() => true)
    vi.mocked(fetchNineRouterRateLimits).mockResolvedValueOnce({
      ...okProvider('ninerouter', 0, Date.now()),
      buckets: [
        {
          name: 'claude-opus-5-5',
          usedPercent: 17,
          windowMinutes: 10_080,
          resetsAt: null,
          resetDescription: null
        }
      ]
    })

    await service.refresh()

    expect(fetchNineRouterRateLimits).toHaveBeenCalledWith({ enabled: true })
    expect(service.getState().ninerouter?.buckets?.[0]).toMatchObject({
      name: 'claude-opus-5-5',
      usedPercent: 17
    })
  })
})
