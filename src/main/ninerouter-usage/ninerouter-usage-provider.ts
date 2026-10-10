import { join } from 'node:path'
import type { UsageProvider } from '../usage/usage-provider-contract'
import { deriveNinerouterCliToken, resolveNinerouterDataDir } from './ninerouter-cli-token'
import { createNineRouterGatewayClient } from './ninerouter-gateway-client'
import { scanNineRouterUsage } from './ninerouter-usage-scan'
import type { NineRouterUsageDailyAggregate, NineRouterUsageSession } from './types'

// v1: first gateway snapshot cache.
export const NINEROUTER_USAGE_SCHEMA_VERSION = 1

async function scanViaGateway(): Promise<{
  sessions: NineRouterUsageSession[]
  dailyAggregates: NineRouterUsageDailyAggregate[]
}> {
  const cliToken = await deriveNinerouterCliToken({
    machineIdFile: join(resolveNinerouterDataDir(), 'machine-id'),
    cliSecretFile: join(resolveNinerouterDataDir(), 'auth', 'cli-secret')
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
