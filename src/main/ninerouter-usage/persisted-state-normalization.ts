import { NINEROUTER_USAGE_SCHEMA_VERSION } from './ninerouter-usage-provider'
import type { NineRouterUsagePersistedState } from './types'

export function getDefaultNinerouterUsageState(): NineRouterUsagePersistedState {
  return {
    schemaVersion: NINEROUTER_USAGE_SCHEMA_VERSION,
    worktreeFingerprint: null,
    sources: [],
    sessions: [],
    dailyAggregates: [],
    scanState: {
      enabled: false,
      lastScanStartedAt: null,
      lastScanCompletedAt: null,
      lastScanError: null
    }
  }
}

export function normalizeNinerouterUsageState(
  state: NineRouterUsagePersistedState
): NineRouterUsagePersistedState {
  // Why: a cache from another schema cannot be trusted; rescan but keep the opt-in.
  if (state.schemaVersion !== NINEROUTER_USAGE_SCHEMA_VERSION) {
    const defaults = getDefaultNinerouterUsageState()
    return {
      ...defaults,
      scanState: { ...defaults.scanState, enabled: state.scanState?.enabled ?? false }
    }
  }
  return {
    ...state,
    sources: [],
    sessions: state.sessions ?? [],
    dailyAggregates: state.dailyAggregates ?? []
  }
}
