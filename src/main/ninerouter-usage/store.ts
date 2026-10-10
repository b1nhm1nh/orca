import { app } from 'electron'
import { join } from 'node:path'
import type { Store } from '../persistence'
import { UsageProviderStoreLifecycle } from '../usage/usage-provider-store-lifecycle'
import { splitUsageCacheFileViaWorker } from '../usage/usage-scan-worker-spawn'
import { nineRouterUsageProvider } from './ninerouter-usage-provider'
import { getDefaultNinerouterUsageState, normalizeNinerouterUsageState } from './persisted-state-normalization'
import { buildNineRouterUsageSnapshot } from './snapshot-rollups'
import type { NineRouterUsagePersistedState } from './types'
import type {
  NineRouterUsageBreakdownRow,
  NineRouterUsageRange,
  NineRouterUsageScope,
  NineRouterUsageSnapshot
} from '../../shared/ninerouter-usage-types'

let nineRouterUsageFile: string | null = null

export function initNinerouterUsagePath(): void {
  nineRouterUsageFile = join(app.getPath('userData'), 'orca-ninerouter-usage.json')
}

function getNinerouterUsageFile(): string {
  nineRouterUsageFile ??= join(app.getPath('userData'), 'orca-ninerouter-usage.json')
  return nineRouterUsageFile
}

export class NineRouterUsageStore extends UsageProviderStoreLifecycle<
  'sources',
  NineRouterUsagePersistedState,
  'hasAnyNinerouterData'
> {
  constructor(store: Pick<Store, 'getRepos' | 'getAllWorktreeMeta'>) {
    super(store, {
      logTag: '[ninerouter-usage]',
      resolveCacheFile: getNinerouterUsageFile,
      createDefaultState: getDefaultNinerouterUsageState,
      normalizeState: normalizeNinerouterUsageState,
      sourceKey: 'sources',
      dataPresenceKey: 'hasAnyNinerouterData',
      scan: nineRouterUsageProvider.scan,
      // Why: the source list stays empty, so this only runs for legacy oversized caches.
      splitCacheFile: splitUsageCacheFileViaWorker
    })
  }

  getSnapshot(scope: NineRouterUsageScope, range: NineRouterUsageRange): NineRouterUsageSnapshot {
    return buildNineRouterUsageSnapshot(
      scope,
      range,
      this.state.sessions,
      this.state.dailyAggregates,
      this.getScanState()
    )
  }

  async getSummary(
    scope: NineRouterUsageScope,
    range: NineRouterUsageRange
  ): Promise<NineRouterUsageSnapshot['summary']> {
    await this.refresh(false)
    return this.getSnapshot(scope, range).summary
  }

  async getDaily(
    scope: NineRouterUsageScope,
    range: NineRouterUsageRange
  ): Promise<NineRouterUsageSnapshot['daily']> {
    await this.refresh(false)
    return this.getSnapshot(scope, range).daily
  }

  async getBreakdown(
    scope: NineRouterUsageScope,
    range: NineRouterUsageRange
  ): Promise<NineRouterUsageBreakdownRow[]> {
    await this.refresh(false)
    return this.getSnapshot(scope, range).modelBreakdown
  }

  async getRecentSessions(
    scope: NineRouterUsageScope,
    range: NineRouterUsageRange,
    limit = 10
  ): Promise<NineRouterUsageSnapshot['recentSessions']> {
    await this.refresh(false)
    return this.getSnapshot(scope, range).recentSessions.slice(0, limit)
  }
}
