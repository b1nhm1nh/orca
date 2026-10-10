import type { NineRouterGatewayClient } from './ninerouter-gateway-client'
import { parseNinerouterChartDay } from './ninerouter-chart-day'
import type { NineRouterUsageDailyAggregate, NineRouterUsageSession } from './types'

const PROJECT_LABEL = '9router'

/**
 * Shapes the gateway's aggregate responses into the shared session/daily rollups.
 * Sessions are one per model (9router has no session ids), and chart buckets become
 * whole-gateway daily rows; 9router records no cwd, so nothing is worktree-attributed.
 */
export async function scanNineRouterUsage(
  client: NineRouterGatewayClient,
  now = new Date()
): Promise<{ sessions: NineRouterUsageSession[]; dailyAggregates: NineRouterUsageDailyAggregate[] }> {
  const [stats, chart] = await Promise.all([client.fetchStats('all'), client.fetchDailyChart()])
  const sessions = Object.entries(stats.byModel).map(([key, row]) =>
    buildModelSession(key, row, now)
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

type NineRouterModelRow = {
  requests: number
  promptTokens: number
  completionTokens: number
  cachedTokens: number
  cost: number
  rawModel: string
  provider: string
  lastUsed: string | null
}

function buildModelSession(
  key: string,
  row: NineRouterModelRow,
  now: Date
): NineRouterUsageSession {
  const model = row.rawModel || key
  const timestamp = row.lastUsed ?? now.toISOString()
  return {
    sessionId: `ninerouter:${row.provider || 'unknown'}:${model}`,
    firstTimestamp: timestamp,
    lastTimestamp: timestamp,
    primaryModel: model,
    hasMixedModels: false,
    primaryProjectLabel: PROJECT_LABEL,
    hasMixedLocations: false,
    primaryWorktreeId: null,
    primaryRepoId: null,
    eventCount: row.requests,
    totalInputTokens: row.promptTokens,
    totalCachedInputTokens: row.cachedTokens,
    totalOutputTokens: row.completionTokens,
    totalReasoningOutputTokens: 0,
    totalTokens: row.promptTokens + row.completionTokens,
    costUsd: row.cost,
    locationBreakdown: [
      {
        locationKey: PROJECT_LABEL,
        projectLabel: PROJECT_LABEL,
        repoId: null,
        worktreeId: null,
        eventCount: row.requests,
        inputTokens: row.promptTokens,
        cachedInputTokens: row.cachedTokens,
        outputTokens: row.completionTokens,
        reasoningOutputTokens: 0,
        totalTokens: row.promptTokens + row.completionTokens,
        costUsd: row.cost
      }
    ],
    modelBreakdown: [
      {
        modelKey: model,
        modelLabel: key,
        eventCount: row.requests,
        inputTokens: row.promptTokens,
        cachedInputTokens: row.cachedTokens,
        outputTokens: row.completionTokens,
        reasoningOutputTokens: 0,
        totalTokens: row.promptTokens + row.completionTokens,
        costUsd: row.cost
      }
    ],
    locationModelBreakdown: [
      {
        locationKey: PROJECT_LABEL,
        modelKey: model,
        modelLabel: key,
        repoId: null,
        worktreeId: null,
        eventCount: row.requests,
        inputTokens: row.promptTokens,
        cachedInputTokens: row.cachedTokens,
        outputTokens: row.completionTokens,
        reasoningOutputTokens: 0,
        totalTokens: row.promptTokens + row.completionTokens,
        costUsd: row.cost
      }
    ]
  }
}
