import { join } from 'node:path'
import { z } from 'zod'
import type { ProviderRateLimits, RateLimitBucket } from '../../shared/rate-limit-types'
import {
  deriveNinerouterCliToken,
  resolveNinerouterDataDir
} from '../ninerouter-usage/ninerouter-cli-token'
import { fetchGatewayJson } from '../ninerouter-usage/ninerouter-gateway-client'

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

// Locks live in dynamic `modelLock_<model>` keys, so keep unknown keys.
const connectionsSchema = z.object({
  connections: z.array(
    z
      .object({
        id: z.string(),
        provider: z.string().default(''),
        isActive: z.boolean().default(true),
        rateLimitedUntil: z.string().nullable().optional()
      })
      .passthrough()
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

type Connection = z.infer<typeof connectionsSchema>['connections'][number]
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

/** Tightest quota on one connection; Antigravity keys its quotas by model id. */
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
 * One bucket per model 9router routed in the last 24h. 9router fails over between
 * a model's accounts, so the model is as free as its least-used unblocked account.
 */
export function buildModelBuckets(
  models: ModelUse[],
  connections: Map<string, Connection>,
  quotasByConnection: Map<string, Record<string, Quota>>,
  now: number
): RateLimitBucket[] {
  const buckets: RateLimitBucket[] = []
  for (const use of models) {
    let best: QuotaReading | null = null
    let anyOpen = false
    for (const id of use.connectionIds) {
      const connection = connections.get(id)
      if (!connection || isConnectionBlockedForModel(connection, use.model, now)) {
        continue
      }
      anyOpen = true
      const quotas = quotasByConnection.get(id)
      const reading = quotas ? pickConnectionQuota(use.model, quotas) : null
      if (reading && (!best || reading.usedPercent < best.usedPercent)) {
        best = reading
      }
    }
    if (!anyOpen) {
      buckets.push({
        name: use.model,
        usedPercent: 100,
        windowMinutes: 0,
        resetsAt: null,
        resetDescription: null
      })
    } else {
      // Open with no reported quota (API-key accounts, Ollama) reads as free.
      buckets.push({
        name: use.model,
        ...(best ?? { usedPercent: 0, windowMinutes: 0, resetsAt: null }),
        resetDescription: null
      })
    }
  }
  return buckets
}

async function fetchConnectionQuotas(
  ids: string[],
  cliToken: string
): Promise<Map<string, Record<string, Quota>>> {
  const settled = await Promise.allSettled(
    ids.map((id) =>
      fetchGatewayJson(`/api/usage/${encodeURIComponent(id)}`, cliToken, connectionQuotaSchema)
    )
  )
  const quotas = new Map<string, Record<string, Quota>>()
  settled.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled' && outcome.value.quotas) {
      quotas.set(ids[index], outcome.value.quotas)
    }
  })
  return quotas
}

export async function fetchNineRouterRateLimits(options?: {
  dataDir?: string
}): Promise<ProviderRateLimits> {
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
      fetchGatewayJson('/api/providers', cliToken, connectionsSchema)
    ])
    const models = collectModelsInUse(usage.byAccount)
    const connectionIds = [...new Set(models.flatMap((use) => [...use.connectionIds]))].slice(
      0,
      MAX_CONNECTIONS_PER_POLL
    )
    const quotas = await fetchConnectionQuotas(connectionIds, cliToken)
    const connections = new Map(providers.connections.map((c) => [c.id, c]))
    return result('ok', null, buildModelBuckets(models, connections, quotas, Date.now()))
  } catch (error) {
    return result('error', error instanceof Error ? error.message : String(error))
  }
}
