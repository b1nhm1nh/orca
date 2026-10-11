import { z } from 'zod'

export const NINEROUTER_BASE_URL = 'http://127.0.0.1:20128'
const FETCH_TIMEOUT_MS = 8_000
export const NINEROUTER_UNREACHABLE_MESSAGE =
  '9router is not reachable on 127.0.0.1:20128 — start it or check the port'

// 9router `usageRepo.getUsageStats`: counters per group, plus provider/model names.
const usageCountersSchema = z.object({
  requests: z.number().default(0),
  promptTokens: z.number().default(0),
  completionTokens: z.number().default(0),
  cachedTokens: z.number().default(0),
  cost: z.number().default(0)
})

const usageStatsSchema = z.object({
  totalRequests: z.number().default(0),
  totalPromptTokens: z.number().default(0),
  totalCompletionTokens: z.number().default(0),
  totalCachedTokens: z.number().default(0),
  totalCost: z.number().default(0),
  byModel: z.record(
    z.string(),
    usageCountersSchema.extend({
      rawModel: z.string().default(''),
      provider: z.string().default(''),
      lastUsed: z.string().nullable().default(null)
    })
  ),
  byProvider: z.record(z.string(), usageCountersSchema)
})

const usageChartSchema = z.array(
  z.object({
    label: z.string(),
    tokens: z.number().default(0),
    cost: z.number().default(0)
  })
)

export type NineRouterUsageStats = z.infer<typeof usageStatsSchema>
export type NineRouterUsageChart = z.infer<typeof usageChartSchema>

export type NineRouterGatewayClient = {
  fetchStats(period: '7d' | '30d' | '60d' | 'all'): Promise<NineRouterUsageStats>
  fetchDailyChart(): Promise<NineRouterUsageChart>
}

function describeFetchError(error: unknown): string {
  if (error instanceof Error && 'cause' in error) {
    // Node folds ECONNREFUSED into a cause; name it instead of a bare fetch failed.
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Node wraps network errors in a `{ code }` cause; only that shape is read.
    const code = (error.cause as { code?: string } | null)?.code
    if (code === 'ECONNREFUSED') {
      return NINEROUTER_UNREACHABLE_MESSAGE
    }
  }
  return error instanceof Error ? error.message : String(error)
}

export async function fetchGatewayJson<T>(
  path: string,
  cliToken: string,
  schema: z.ZodType<T>
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${NINEROUTER_BASE_URL}${path}`, {
      headers: { 'x-9r-cli-token': cliToken },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    })
  } catch (error) {
    throw new Error(describeFetchError(error))
  }
  if (response.status === 401) {
    throw new Error('9router rejected the usage request — its cli-secret may have been regenerated')
  }
  if (!response.ok) {
    throw new Error(`9router usage request failed with HTTP ${response.status}`)
  }
  let parsed: unknown
  try {
    parsed = await response.json()
  } catch {
    throw new Error('9router returned a non-JSON usage response')
  }
  const result = schema.safeParse(parsed)
  if (!result.success) {
    throw new Error('9router usage response has an unexpected shape')
  }
  return result.data
}

/** Reads the two endpoints Orca needs; both require the CLI token header. */
export function createNineRouterGatewayClient(cliToken: string): NineRouterGatewayClient {
  return {
    fetchStats: (period) =>
      fetchGatewayJson(`/api/usage/stats?period=${period}`, cliToken, usageStatsSchema),
    fetchDailyChart: () =>
      fetchGatewayJson('/api/usage/chart?period=60d', cliToken, usageChartSchema)
  }
}
