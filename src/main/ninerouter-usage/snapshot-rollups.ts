import type {
  NineRouterUsageBreakdownRow,
  NineRouterUsageDailyPoint,
  NineRouterUsageRange,
  NineRouterUsageScope,
  NineRouterUsageSessionRow,
  NineRouterUsageSnapshot,
  NineRouterUsageSummary
} from '../../shared/ninerouter-usage-types'
import { highestUsageKey } from '../usage/highest-usage-key'
import { parseNineRouterSessionId } from './ninerouter-usage-scan'
import type { NineRouterUsageDailyAggregate, NineRouterUsageSession } from './types'

const RANGE_DAYS: Record<Exclude<NineRouterUsageRange, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '60d': 60
}

/** Local-day cutoff like `usage-calendar-range`, but with 9router's 60d range. */
export function getNineRouterRangeCutoff(
  range: NineRouterUsageRange,
  now = new Date()
): string | null {
  if (range === 'all') {
    return null
  }
  const cutoff = new Date(now)
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - (RANGE_DAYS[range] - 1))
  const year = cutoff.getFullYear()
  const month = String(cutoff.getMonth() + 1).padStart(2, '0')
  const day = String(cutoff.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function filterDaily(
  daily: NineRouterUsageDailyAggregate[],
  range: NineRouterUsageRange,
  now: Date
): NineRouterUsageDailyAggregate[] {
  const cutoff = getNineRouterRangeCutoff(range, now)
  return daily.filter((entry) => !cutoff || entry.day >= cutoff)
}

// Why: each session is one model's total for one 9router stats period, so a range reads its own period.
function sessionsForRange(
  sessions: NineRouterUsageSession[],
  range: NineRouterUsageRange
): NineRouterUsageSession[] {
  return sessions.filter((session) => parseNineRouterSessionId(session.sessionId)?.range === range)
}

// Totals come from 9router's own per-period stats, which split input/output/cache; the chart only has totals.
export function buildNineRouterUsageSummary(
  scope: NineRouterUsageScope,
  range: NineRouterUsageRange,
  daily: NineRouterUsageDailyAggregate[],
  sessions: NineRouterUsageSession[]
): NineRouterUsageSummary {
  const rangeSessions = sessionsForRange(sessions, range)
  let events = 0
  let inputTokens = 0
  let cachedInputTokens = 0
  let outputTokens = 0
  let totalTokens = 0
  let costUsd = 0
  const byModel = new Map<string, number>()
  for (const session of rangeSessions) {
    events += session.eventCount
    inputTokens += session.totalInputTokens
    cachedInputTokens += session.totalCachedInputTokens
    outputTokens += session.totalOutputTokens
    totalTokens += session.totalTokens
    costUsd += session.costUsd
    const model = session.primaryModel ?? 'Unknown model'
    byModel.set(model, (byModel.get(model) ?? 0) + session.totalTokens)
  }
  return {
    scope,
    range,
    sessions: rangeSessions.length,
    events,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningOutputTokens: 0,
    totalTokens,
    costUsd,
    topModel: highestUsageKey(byModel),
    hasAnyNinerouterData: sessions.length > 0 || daily.length > 0
  }
}

export function buildNineRouterUsageDailyPoints(
  daily: NineRouterUsageDailyAggregate[],
  range: NineRouterUsageRange,
  now = new Date()
): NineRouterUsageDailyPoint[] {
  const byDay = new Map<string, NineRouterUsageDailyPoint>()
  for (const row of filterDaily(daily, range, now)) {
    const existing = byDay.get(row.day) ?? { day: row.day, totalTokens: 0, costUsd: 0 }
    existing.totalTokens += row.totalTokens
    existing.costUsd += row.costUsd
    byDay.set(row.day, existing)
  }
  return [...byDay.values()].sort((left, right) => left.day.localeCompare(right.day))
}

export function buildNineRouterUsageBreakdownRows(
  sessions: NineRouterUsageSession[],
  range: NineRouterUsageRange
): NineRouterUsageBreakdownRow[] {
  const rows = new Map<string, NineRouterUsageBreakdownRow>()
  for (const session of sessionsForRange(sessions, range)) {
    for (const model of session.modelBreakdown) {
      const existing = rows.get(model.modelKey) ?? {
        key: model.modelKey,
        label: model.modelLabel,
        events: 0,
        totalTokens: 0,
        costUsd: 0
      }
      existing.events += model.eventCount
      existing.totalTokens += model.totalTokens
      existing.costUsd += model.costUsd
      rows.set(model.modelKey, existing)
    }
  }
  return [...rows.values()].sort((left, right) => right.totalTokens - left.totalTokens)
}

export function buildNineRouterUsageRecentSessions(
  sessions: NineRouterUsageSession[],
  range: NineRouterUsageRange,
  limit = 10
): NineRouterUsageSessionRow[] {
  return sessionsForRange(sessions, range)
    .sort((left, right) => right.lastTimestamp.localeCompare(left.lastTimestamp))
    .slice(0, limit)
    .map((session) => ({
      sessionId: session.sessionId,
      lastActiveAt: session.lastTimestamp,
      projectLabel: session.primaryProjectLabel,
      model: session.primaryModel,
      provider: parseNineRouterSessionId(session.sessionId)?.provider ?? 'unknown',
      events: session.eventCount,
      inputTokens: session.totalInputTokens,
      cachedInputTokens: session.totalCachedInputTokens,
      outputTokens: session.totalOutputTokens,
      totalTokens: session.totalTokens,
      costUsd: session.costUsd
    }))
}

export function buildNineRouterUsageSnapshot(
  scope: NineRouterUsageScope,
  range: NineRouterUsageRange,
  sessions: NineRouterUsageSession[],
  daily: NineRouterUsageDailyAggregate[],
  scanState: NineRouterUsageSnapshot['scanState'],
  now = new Date()
): NineRouterUsageSnapshot {
  return {
    scanState,
    summary: buildNineRouterUsageSummary(scope, range, daily, sessions),
    daily: buildNineRouterUsageDailyPoints(daily, range, now),
    modelBreakdown: buildNineRouterUsageBreakdownRows(sessions, range),
    projectBreakdown: [],
    recentSessions: buildNineRouterUsageRecentSessions(sessions, range)
  }
}
