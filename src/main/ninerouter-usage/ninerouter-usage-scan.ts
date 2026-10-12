import type { NineRouterUsageRange } from '../../shared/ninerouter-usage-types'
import type { NineRouterGatewayClient, NineRouterUsageStats } from './ninerouter-gateway-client'
import { parseNinerouterChartDay } from './ninerouter-chart-day'
import type { NineRouterUsageDailyAggregate, NineRouterUsageSession } from './types'

const PROJECT_LABEL = '9router'
export const NINEROUTER_USAGE_RANGES: readonly NineRouterUsageRange[] = ['7d', '30d', '60d', 'all']

/** Session ids carry the stats period, so a range reads only the rows 9router totalled for it. */
export function buildNineRouterSessionId(
  range: NineRouterUsageRange,
  provider: string,
  model: string
): string {
  return `ninerouter:${range}:${provider || 'unknown'}:${model}`
}

export function parseNineRouterSessionId(
  sessionId: string
): { range: string; provider: string } | null {
  const [prefix, range, provider] = sessionId.split(':')
  return prefix === 'ninerouter' && range && provider ? { range, provider } : null
}

/**
 * Shapes the gateway's aggregate responses into the shared session/daily rollups.
 * Sessions are one per model per stats period (9router has no session ids or per-request
 * history over its API), and chart buckets become whole-gateway daily rows; 9router records
 * no cwd, so nothing is worktree-attributed.
 */
export async function scanNineRouterUsage(
  client: NineRouterGatewayClient,
  now = new Date()
): Promise<{
  sessions: NineRouterUsageSession[]
  dailyAggregates: NineRouterUsageDailyAggregate[]
}> {
  const [chart, ...statsByRange] = await Promise.all([
    client.fetchDailyChart(),
    ...NINEROUTER_USAGE_RANGES.map((range) => client.fetchStats(range))
  ])
  const sessions = NINEROUTER_USAGE_RANGES.flatMap((range, index) =>
    buildRangeSessions(range, statsByRange[index]!, now)
  )
  const dailyAggregates = chart.flatMap((bucket) => {
    const day = parseNinerouterChartDay(bucket.label, now)
    // Zero buckets carry no signal and would make an idle gateway look like tracked usage.
    if (!day || (bucket.tokens === 0 && bucket.cost === 0)) {
      return []
    }
    return [
      {
        day,
        model: null,
        projectKey: PROJECT_LABEL,
        projectLabel: PROJECT_LABEL,
        repoId: null,
        worktreeId: null,
        eventCount: 0,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningOutputTokens: 0,
        totalTokens: bucket.tokens,
        costUsd: bucket.cost
      }
    ]
  })
  return { sessions, dailyAggregates }
}

function buildRangeSessions(
  range: NineRouterUsageRange,
  stats: NineRouterUsageStats,
  now: Date
): NineRouterUsageSession[] {
  return Object.entries(stats.byModel).map(([key, row]) => {
    const model = row.rawModel || key
    const timestamp = row.lastUsed ?? now.toISOString()
    const counters = {
      eventCount: row.requests,
      inputTokens: row.promptTokens,
      cachedInputTokens: row.cachedTokens,
      outputTokens: row.completionTokens,
      reasoningOutputTokens: 0,
      totalTokens: row.promptTokens + row.completionTokens,
      costUsd: row.cost
    }
    const location = {
      locationKey: PROJECT_LABEL,
      repoId: null,
      worktreeId: null
    }
    return {
      sessionId: buildNineRouterSessionId(range, row.provider, model),
      firstTimestamp: timestamp,
      lastTimestamp: timestamp,
      primaryModel: model,
      hasMixedModels: false,
      primaryProjectLabel: PROJECT_LABEL,
      hasMixedLocations: false,
      primaryWorktreeId: null,
      primaryRepoId: null,
      eventCount: counters.eventCount,
      totalInputTokens: counters.inputTokens,
      totalCachedInputTokens: counters.cachedInputTokens,
      totalOutputTokens: counters.outputTokens,
      totalReasoningOutputTokens: 0,
      totalTokens: counters.totalTokens,
      costUsd: counters.costUsd,
      locationBreakdown: [{ ...location, projectLabel: PROJECT_LABEL, ...counters }],
      modelBreakdown: [{ modelKey: model, modelLabel: key, ...counters }],
      locationModelBreakdown: [{ ...location, modelKey: model, modelLabel: key, ...counters }]
    }
  })
}
