import { describe, expect, it } from 'vitest'
import {
  buildNineRouterUsageBreakdownRows,
  buildNineRouterUsageDailyPoints,
  buildNineRouterUsageRecentSessions,
  buildNineRouterUsageSummary,
  getNineRouterRangeCutoff
} from './snapshot-rollups'
import type {
  NineRouterUsageDailyAggregate,
  NineRouterUsageSession
} from './types'

const NOW = new Date('2026-10-11T12:00:00')

function dailyRow(day: string, totalTokens: number, costUsd = 0): NineRouterUsageDailyAggregate {
  return {
    day,
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
    totalTokens,
    costUsd
  }
}

function modelSession(model: string, lastUsed: string, tokens: number, costUsd: number): NineRouterUsageSession {
  return {
    sessionId: `ninerouter:claude:${model}`,
    firstTimestamp: lastUsed,
    lastTimestamp: lastUsed,
    primaryModel: model,
    hasMixedModels: false,
    primaryProjectLabel: '9router',
    hasMixedLocations: false,
    primaryWorktreeId: null,
    primaryRepoId: null,
    eventCount: 3,
    totalInputTokens: tokens - 10,
    totalCachedInputTokens: 5,
    totalOutputTokens: 10,
    totalReasoningOutputTokens: 0,
    totalTokens: tokens,
    costUsd,
    locationBreakdown: [],
    modelBreakdown: [
      {
        modelKey: model,
        modelLabel: model,
        eventCount: 3,
        inputTokens: tokens - 10,
        cachedInputTokens: 5,
        outputTokens: 10,
        reasoningOutputTokens: 0,
        totalTokens: tokens,
        costUsd
      }
    ],
    locationModelBreakdown: []
  }
}

describe('ninerouter usage rollups', () => {
  it('computes a day cutoff per range', () => {
    expect(getNineRouterRangeCutoff('7d', NOW)).toBe('2026-10-05')
    expect(getNineRouterRangeCutoff('60d', NOW)).toBe('2026-08-13')
    expect(getNineRouterRangeCutoff('all', NOW)).toBeNull()
  })

  it('summarizes tokens from daily rows and activity from sessions', () => {
    const summary = buildNineRouterUsageSummary(
      'all',
      '7d',
      [dailyRow('2026-10-10', 400, 0.4), dailyRow('2026-09-01', 9000, 9)],
      [modelSession('claude-sonnet-5', '2026-10-10T08:00:00.000Z', 380, 0.35)],
      NOW
    )
    expect(summary.totalTokens).toBe(400)
    expect(summary.costUsd).toBeCloseTo(0.4)
    expect(summary.sessions).toBe(1)
    expect(summary.events).toBe(3)
    expect(summary.topModel).toBe('claude-sonnet-5')
    expect(summary.hasAnyNinerouterData).toBe(true)
  })

  it('keeps the all-time presence flag even when the range filters everything', () => {
    const summary = buildNineRouterUsageSummary(
      'all',
      '7d',
      [dailyRow('2026-09-01', 9000, 9)],
      [modelSession('glm-5.3', '2026-09-01T08:00:00.000Z', 9000, 9)],
      NOW
    )
    expect(summary.totalTokens).toBe(0)
    expect(summary.hasAnyNinerouterData).toBe(true)
  })

  it('merges daily points by day and sorts them', () => {
    const points = buildNineRouterUsageDailyPoints(
      [dailyRow('2026-10-10', 5), dailyRow('2026-10-11', 7), dailyRow('2026-10-10', 3)],
      'all',
      NOW
    )
    expect(points).toEqual([
      { day: '2026-10-10', totalTokens: 8, costUsd: 0 },
      { day: '2026-10-11', totalTokens: 7, costUsd: 0 }
    ])
  })

  it('breaks tokens down per model and lists recent sessions newest first', () => {
    const sessions = [
      modelSession('claude-sonnet-5', '2026-10-01T08:00:00.000Z', 100, 1),
      modelSession('glm-5.3', '2026-10-11T08:00:00.000Z', 200, 2)
    ]
    const rows = buildNineRouterUsageBreakdownRows(sessions, 'all', NOW)
    expect(rows.map((row) => row.key)).toEqual(['glm-5.3', 'claude-sonnet-5'])
    expect(rows[0]).toMatchObject({ events: 3, totalTokens: 200, costUsd: 2 })

    const recent = buildNineRouterUsageRecentSessions(sessions, 'all', 10, NOW)
    expect(recent.map((row) => row.model)).toEqual(['glm-5.3', 'claude-sonnet-5'])
    expect(recent[0]).toMatchObject({ projectLabel: '9router', inputTokens: 190, outputTokens: 10 })
  })
})
