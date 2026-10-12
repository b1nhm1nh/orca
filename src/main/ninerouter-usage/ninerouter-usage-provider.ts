import { join } from 'node:path'
import type { UsageProvider } from '../usage/usage-provider-contract'
import { deriveNinerouterCliToken, resolveNinerouterDataDir } from './ninerouter-cli-token'
import { createNineRouterGatewayClient } from './ninerouter-gateway-client'
import { scanNineRouterUsage } from './ninerouter-usage-scan'
import type { NineRouterUsageDailyAggregate, NineRouterUsageSession } from './types'

// v2: one session per model per stats period (v1 mixed all-time model totals into every range).
export const NINEROUTER_USAGE_SCHEMA_VERSION = 2

async function scanViaGateway(): Promise<{
  sessions: NineRouterUsageSession[]
  dailyAggregates: NineRouterUsageDailyAggregate[]
}> {
  const dataDir = resolveNinerouterDataDir()
  const cliToken = await deriveNinerouterCliToken({
    machineIdFile: join(dataDir, 'machine-id'),
    cliSecretFile: join(dataDir, 'auth', 'cli-secret')
  })
  return scanNineRouterUsage(createNineRouterGatewayClient(cliToken))
}

export const nineRouterUsageProvider = {
  id: 'ninerouter',
  label: '9router',
  schemaVersion: NINEROUTER_USAGE_SCHEMA_VERSION,
  // Why: an HTTP source, not transcripts — fetch in main instead of the scan worker.
  scan: scanViaGateway
} satisfies UsageProvider<NineRouterUsageSession, NineRouterUsageDailyAggregate>
