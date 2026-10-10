import { describe, expect, it } from 'vitest'
import {
  buildModelBuckets,
  collectModelsInUse,
  guessQuotaWindowMinutes,
  isConnectionBlockedForModel,
  pickConnectionQuota,
  readQuota
} from './ninerouter-model-quota-fetcher'

const NOW = Date.parse('2026-10-11T00:00:00.000Z')

describe('ninerouter model quota', () => {
  it('maps free-text quota names to window lengths', () => {
    expect(guessQuotaWindowMinutes('session (5h)')).toBe(300)
    expect(guessQuotaWindowMinutes('Rolling')).toBe(300)
    expect(guessQuotaWindowMinutes('weekly fable (7d)')).toBe(10_080)
    expect(guessQuotaWindowMinutes('Monthly')).toBe(43_200)
    expect(guessQuotaWindowMinutes('gemini-3.8-flash-high')).toBe(1_440)
  })

  it('reads remainingPercentage first, then used/total, and skips unlimited', () => {
    expect(readQuota('Weekly', { remainingPercentage: 83, used: 1, total: 2 })?.usedPercent).toBe(
      17
    )
    expect(readQuota('Weekly', { used: 1, total: 4 })?.usedPercent).toBe(25)
    expect(readQuota('Weekly', { unlimited: true, remainingPercentage: 10 })).toBeNull()
    expect(readQuota('Weekly', { used: 1 })).toBeNull()
  })

  it('prefers a model-keyed quota, else the tightest one', () => {
    const quotas = {
      'session (5h)': { remainingPercentage: 98 },
      'weekly (7d)': { remainingPercentage: 83, resetAt: '2026-10-14T12:00:00.000Z' },
      'gemini-3.8-flash-high': { remainingPercentage: 99 }
    }
    expect(pickConnectionQuota('gemini-3.8-flash-high', quotas)?.usedPercent).toBe(1)
    const tightest = pickConnectionQuota('claude-opus-5-5', quotas)
    expect(tightest?.usedPercent).toBe(17)
    expect(tightest?.windowMinutes).toBe(10_080)
    expect(tightest?.resetsAt).toBe(Date.parse('2026-10-14T12:00:00.000Z'))
  })

  it('treats inactive, rate-limited, and model-locked connections as blocked', () => {
    const base = { id: 'c1', provider: 'claude', isActive: true }
    expect(isConnectionBlockedForModel(base, 'm', NOW)).toBe(false)
    expect(isConnectionBlockedForModel({ ...base, isActive: false }, 'm', NOW)).toBe(true)
    expect(
      isConnectionBlockedForModel({ ...base, rateLimitedUntil: '2026-10-11T01:00:00Z' }, 'm', NOW)
    ).toBe(true)
    expect(
      isConnectionBlockedForModel({ ...base, modelLock_m: '2026-10-11T01:00:00Z' }, 'm', NOW)
    ).toBe(true)
    // An expired lock no longer blocks.
    expect(
      isConnectionBlockedForModel({ ...base, modelLock_m: '2026-10-10T01:00:00Z' }, 'm', NOW)
    ).toBe(false)
  })

  it('builds one bucket per model, newest first, using its freest open account', () => {
    const models = collectModelsInUse({
      'claude-opus-5-5 (claude - A)': {
        rawModel: 'claude-opus-5-5',
        provider: 'claude',
        connectionId: 'a',
        lastUsed: '2026-10-10T19:00:00Z'
      },
      'claude-opus-5-5 (claude - B)': {
        rawModel: 'claude-opus-5-5',
        provider: 'claude',
        connectionId: 'b',
        lastUsed: '2026-10-10T18:00:00Z'
      },
      'grok-4.7 (grok-cli - G)': {
        rawModel: 'grok-4.7',
        provider: 'grok-cli',
        connectionId: 'g',
        lastUsed: '2026-10-10T20:00:00Z'
      },
      'glm-5.3 (glm - Z)': {
        rawModel: 'glm-5.3',
        provider: 'glm',
        connectionId: 'z',
        lastUsed: '2026-10-10T10:00:00Z'
      }
    })
    expect(models.map((m) => m.model)).toEqual(['grok-4.7', 'claude-opus-5-5', 'glm-5.3'])

    const connections = new Map([
      ['a', { id: 'a', provider: 'claude', isActive: true }],
      ['b', { id: 'b', provider: 'claude', isActive: true }],
      [
        'g',
        {
          id: 'g',
          provider: 'grok-cli',
          isActive: true,
          'modelLock_grok-4.7': '2026-10-12T00:00:00Z'
        }
      ],
      ['z', { id: 'z', provider: 'glm', isActive: true }]
    ])
    const quotas = new Map([
      ['a', { weekly: { remainingPercentage: 20 } }],
      ['b', { weekly: { remainingPercentage: 70 } }]
    ])
    const buckets = buildModelBuckets(models, connections, quotas, NOW)
    expect(buckets.map((b) => [b.name, b.usedPercent])).toEqual([
      ['grok-4.7', 100],
      ['claude-opus-5-5', 30],
      ['glm-5.3', 0]
    ])
  })
})
