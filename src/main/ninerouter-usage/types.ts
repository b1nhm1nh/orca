import type { UsageDailyAggregate, UsageSession } from '../usage/usage-rollup-records'

/** 9router prices at request time, so `costUsd` is the gateway's own number, not an estimate. */
export type NineRouterUsageMetric = { costUsd: number }

export type NineRouterUsageSession = UsageSession<NineRouterUsageMetric>
export type NineRouterUsageDailyAggregate = UsageDailyAggregate<NineRouterUsageMetric>

export type NineRouterUsagePersistedState = {
  schemaVersion: number
  worktreeFingerprint: string | null
  /** Always empty: the gateway is one source, so the source-cache machinery stays unused. */
  sources: []
  sessions: NineRouterUsageSession[]
  dailyAggregates: NineRouterUsageDailyAggregate[]
  scanState: {
    enabled: boolean
    lastScanStartedAt: number | null
    lastScanCompletedAt: number | null
    lastScanError: string | null
  }
}
