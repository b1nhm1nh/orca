import { join } from 'node:path'
import type {
  NineRouterConnectionStatus,
  NineRouterGatewayStatus
} from '../../shared/ninerouter-usage-types'
import { deriveNinerouterCliToken, resolveNinerouterDataDir } from './ninerouter-cli-token'
import {
  fetchGatewayJson,
  NINEROUTER_UNREACHABLE_MESSAGE,
  nineRouterConnectionsSchema,
  type NineRouterConnection
} from './ninerouter-gateway-client'

function toConnectionStatus(
  connection: NineRouterConnection,
  now: number
): NineRouterConnectionStatus {
  const until = connection.rateLimitedUntil ? Date.parse(connection.rateLimitedUntil) : Number.NaN
  const rateLimitedUntil = Number.isFinite(until) && until > now ? until : null
  return {
    id: connection.id,
    provider: connection.provider,
    name: connection.name ?? null,
    state: !connection.isActive ? 'disabled' : rateLimitedUntil ? 'rate-limited' : 'active',
    rateLimitedUntil
  }
}

/** Connection check for AI Provider Accounts: is 9router set up, running, and which accounts it routes. */
export async function getNineRouterGatewayStatus(
  dataDir = resolveNinerouterDataDir()
): Promise<NineRouterGatewayStatus> {
  let cliToken: string
  try {
    cliToken = await deriveNinerouterCliToken({
      machineIdFile: join(dataDir, 'machine-id'),
      cliSecretFile: join(dataDir, 'auth', 'cli-secret')
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { installed: false, reachable: false, connections: [], error: message }
  }
  try {
    const { connections } = await fetchGatewayJson(
      '/api/providers',
      cliToken,
      nineRouterConnectionsSchema
    )
    const now = Date.now()
    return {
      installed: true,
      reachable: true,
      connections: connections.map((connection) => toConnectionStatus(connection, now)),
      error: null
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      installed: true,
      reachable: message !== NINEROUTER_UNREACHABLE_MESSAGE,
      connections: [],
      error: message
    }
  }
}
