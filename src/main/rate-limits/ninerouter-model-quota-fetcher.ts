import { join } from 'node:path'
import { z } from 'zod'
import type { ProviderRateLimits, RateLimitBucket } from '../../shared/rate-limit-types'
import {
  deriveNinerouterCliToken,
  resolveNinerouterDataDir
} from '../ninerouter-usage/ninerouter-cli-token'
import {
  fetchGatewayJson,
  NINEROUTER_UNREACHABLE_MESSAGE,
  nineRouterConnectionsSchema,
  type NineRouterConnection
} from '../ninerouter-usage/ninerouter-gateway-client'

const MODEL_ACTIVITY_PERIOD = '24h'
// Why: each connection read can hit the upstream provider's quota API; cap the fan-out per poll.
const MAX_CONNECTIONS_PER_POLL = 8

const accountUsageSchema = z.object({
  byAccount: z.record(
    z.string(),
    z.object({
      rawModel: z.string().default(''),
      provider: z.string().default(''),
      connectionId: z.string().optional(),
      lastUsed: z.string().nullable().default(null)
    })
  )
})

const quotaSchema = z.object({
  used: z.number().optional(),
  total: z.number().optional(),
  remainingPercentage: z.number().optional(),
  resetAt: z.string().nullable().optional(),
  unlimited: z.boolean().optional()
})

const connectionQuotaSchema = z.object({
  quotas: z.record(z.string(), quotaSchema).optional()
})

type Connection = NineRouterConnection
type Quota = z.infer<typeof quotaSchema>
type ModelUse = { model: string; lastUsedMs: number; connectionIds: Set<string> }
type QuotaReading = { usedPercent: number; resetsAt: number | null; windowMinutes: number }

function result(
  status: ProviderRateLimits['status'],
  error: string | null,
  buckets?: RateLimitBucket[]
): ProviderRateLimits {
  return {
    provider: 'ninerouter',
    session: null,
    weekly: null,
    ...(buckets ? { buckets } : {}),
    updatedAt: Date.now(),
    error,
    status
  }
}

export function nineRouterUsageDisabledSnapshot(): ProviderRateLimits {
  return result('unavailable', null)
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) {
    return null
  }
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

// Quota names are free text from 9router ("session (5h)", "weekly (7d)", "Monthly").
export function guessQuotaWindowMinutes(name: string): number {
  const lower = name.toLowerCase()
  if (/\b5h\b|session|rolling/.test(lower)) {
    return 300
  }
  if (/\b7d\b|week/.test(lower)) {
    return 10_080
  }
  if (/month/.test(lower)) {
    return 43_200
  }
  return 1_440
}

export function readQuota(name: string, quota: Quota): QuotaReading | null {
  if (quota.unlimited) {
    return null
  }
  let usedPercent: number | null = null
  if (typeof quota.remainingPercentage === 'number') {
    usedPercent = 100 - quota.remainingPercentage
  } else if (typeof quota.used === 'number' && typeof quota.total === 'number' && quota.total > 0) {
    usedPercent = (quota.used / quota.total) * 100
  }
  if (usedPercent === null || !Number.isFinite(usedPercent)) {
    return null
  }
  return {
    usedPercent: Math.min(100, Math.max(0, usedPercent)),
    resetsAt: parseTime(quota.resetAt),
    windowMinutes: guessQuotaWindowMinutes(name)
  }
}

const WINDOW_NAME_WORDS = new Set([
  'session',
  'rolling',
  'daily',
  'day',
  'weekly',
  'week',
  'monthly',
  'month',
  'on',
  'demand',
  'usage',
  'limit',
  'quota'
])

/** Whether a free-text window ("weekly fable (7d)") is scoped to a model family other than `model`. */
export function isQuotaScopedToOtherModel(name: string, model: string): boolean {
  const lowerModel = model.toLowerCase()
  // Single letters are duration units ("5h", "7d").
  const scopeWords = (name.toLowerCase().match(/[a-z]{2,}/g) ?? []).filter(
    (word) => !WINDOW_NAME_WORDS.has(word)
  )
  return scopeWords.length > 0 && !scopeWords.some((word) => lowerModel.includes(word))
}

/** Tightest quota on one connection that applies to `model`; Antigravity keys its quotas by model id. */
export function pickConnectionQuota(
  model: string,
  quotas: Record<string, Quota>
): QuotaReading | null {
  const modelQuota = quotas[model]
  if (modelQuota) {
    return readQuota(model, modelQuota)
  }
  let tightest: QuotaReading | null = null
  for (const [name, quota] of Object.entries(quotas)) {
    if (isQuotaScopedToOtherModel(name, model)) {
      continue
    }
    const reading = readQuota(name, quota)
    if (reading && (!tightest || reading.usedPercent > tightest.usedPercent)) {
      tightest = reading
    }
  }
  return tightest
}

export function isConnectionBlockedForModel(
  connection: Connection,
  model: string,
  now: number
): boolean {
  if (!connection.isActive) {
    return true
  }
  const rateLimitedUntil = parseTime(connection.rateLimitedUntil)
  if (rateLimitedUntil !== null && rateLimitedUntil > now) {
    return true
  }
  const lock = connection[`modelLock_${model}`]
  const lockUntil = typeof lock === 'string' ? parseTime(lock) : null
  return lockUntil !== null && lockUntil > now
}

export function collectModelsInUse(
  byAccount: z.infer<typeof accountUsageSchema>['byAccount']
): ModelUse[] {
  const models = new Map<string, ModelUse>()
  for (const entry of Object.values(byAccount)) {
    if (!entry.rawModel || !entry.connectionId) {
      continue
    }
    const use = models.get(entry.rawModel) ?? {
      model: entry.rawModel,
      lastUsedMs: 0,
      connectionIds: new Set<string>()
    }
    use.connectionIds.add(entry.connectionId)
    use.lastUsedMs = Math.max(use.lastUsedMs, parseTime(entry.lastUsed) ?? 0)
    models.set(entry.rawModel, use)
  }
  return [...models.values()].sort((a, b) => b.lastUsedMs - a.lastUsedMs)
}

/**
 * Per-connection quota as read this poll. A missing entry means unknown (request failed or
 * skipped by the cap); an empty record means 9router confirmed the account has no limits.
 */
export type ConnectionQuotas = Map<string, Record<string, Quota>>

/**
 * One bucket per model 9router routed in the last 24h. 9router fails over between
 * a model's accounts, so the model is as free as its least-used unblocked account.
 * A model whose open accounts all went unread is left out rather than shown as free.
 */
export function buildModelBuckets(
  models: ModelUse[],
  connections: Map<string, Connection>,
  quotasByConnection: ConnectionQuotas,
  now: number
): RateLimitBucket[] {
  const buckets: RateLimitBucket[] = []
  for (const use of models) {
    let best: QuotaReading | null = null
    let anyOpen = false
    let anyUnlimited = false
    for (const id of use.connectionIds) {
      const connection = connections.get(id)
      if (!connection || isConnectionBlockedForModel(connection, use.model, now)) {
        continue
      }
      anyOpen = true
      const quotas = quotasByConnection.get(id)
      if (!quotas) {
        continue
      }
      const reading = pickConnectionQuota(use.model, quotas)
      if (!reading) {
        anyUnlimited = true
      } else if (!best || reading.usedPercent < best.usedPercent) {
        best = reading
      }
    }
    const window: QuotaReading | null = !anyOpen
      ? { usedPercent: 100, windowMinutes: 0, resetsAt: null }
      : anyUnlimited
        ? { usedPercent: 0, windowMinutes: 0, resetsAt: null }
        : best
    if (window) {
      buckets.push({ name: use.model, ...window, resetDescription: null })
    }
  }
  return buckets
}

/** One account per model first (newest model first), then fill the cap, so no model goes unread early. */
export function pickConnectionsToRead(models: ModelUse[], limit: number): string[] {
  const picked = new Set<string>()
  const remaining = models.map((use) => [...use.connectionIds])
  while (picked.size < limit && remaining.some((ids) => ids.length > 0)) {
    for (const ids of remaining) {
      // Skip accounts another model already pulled in; this model takes its next unread one.
      while (ids.length > 0 && picked.has(ids[0]!)) {
        ids.shift()
      }
      const id = ids.shift()
      if (id && picked.size < limit) {
        picked.add(id)
      }
    }
  }
  return [...picked]
}

async function fetchConnectionQuotas(ids: string[], cliToken: string): Promise<ConnectionQuotas> {
  const settled = await Promise.allSettled(
    ids.map((id) =>
      fetchGatewayJson(`/api/usage/${encodeURIComponent(id)}`, cliToken, connectionQuotaSchema)
    )
  )
  const quotas: ConnectionQuotas = new Map()
  settled.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      // No `quotas` key is 9router's "usage not available" answer: an account with no limits.
      quotas.set(ids[index]!, outcome.value.quotas ?? {})
    }
  })
  return quotas
}

export async function fetchNineRouterRateLimits(options?: {
  enabled?: boolean
  dataDir?: string
}): Promise<ProviderRateLimits> {
  if (options?.enabled === false) {
    return nineRouterUsageDisabledSnapshot()
  }
  const dataDir = options?.dataDir ?? resolveNinerouterDataDir()
  let cliToken: string
  try {
    cliToken = await deriveNinerouterCliToken({
      machineIdFile: join(dataDir, 'machine-id'),
      cliSecretFile: join(dataDir, 'auth', 'cli-secret')
    })
  } catch (error) {
    // Why: no 9router on this machine is "not configured", which hides the bar.
    return result('unavailable', error instanceof Error ? error.message : String(error))
  }
  try {
    const [usage, providers] = await Promise.all([
      fetchGatewayJson(
        `/api/usage/stats?period=${MODEL_ACTIVITY_PERIOD}`,
        cliToken,
        accountUsageSchema
      ),
      fetchGatewayJson('/api/providers', cliToken, nineRouterConnectionsSchema)
    ])
    const models = collectModelsInUse(usage.byAccount)
    const connectionIds = pickConnectionsToRead(models, MAX_CONNECTIONS_PER_POLL)
    const quotas = await fetchConnectionQuotas(connectionIds, cliToken)
    const connections = new Map(providers.connections.map((c) => [c.id, c]))
    return result('ok', null, buildModelBuckets(models, connections, quotas, Date.now()))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Why: a stopped gateway is not a failing meter; hide the row until 9router runs again.
    return result(message === NINEROUTER_UNREACHABLE_MESSAGE ? 'unavailable' : 'error', message)
  }
}
