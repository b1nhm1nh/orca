import { describe, expect, it } from 'vitest'
import {
  getDefaultNinerouterUsageState,
  normalizeNinerouterUsageState
} from './persisted-state-normalization'

describe('ninerouter usage persisted state', () => {
  it('defaults to disabled with no data', () => {
    const state = getDefaultNinerouterUsageState()
    expect(state).toMatchObject({
      schemaVersion: 1,
      sources: [],
      sessions: [],
      dailyAggregates: [],
      scanState: { enabled: false, lastScanError: null }
    })
  })

  it('keeps the opt-in but discards data from another schema', () => {
    const migrated = normalizeNinerouterUsageState({
      ...getDefaultNinerouterUsageState(),
      schemaVersion: 99,
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: a foreign-schema row on purpose; normalization must drop it.
      sessions: [{ stale: true } as never],
      scanState: {
        enabled: true,
        lastScanStartedAt: null,
        lastScanCompletedAt: 5,
        lastScanError: null
      }
    })
    expect(migrated.schemaVersion).toBe(1)
    expect(migrated.sessions).toEqual([])
    expect(migrated.scanState.enabled).toBe(true)
  })

  it('fills missing arrays on a current-schema cache', () => {
    const defaults = getDefaultNinerouterUsageState()
    const normalized = normalizeNinerouterUsageState({
      ...defaults,
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: older caches may omit these arrays entirely.
      sessions: undefined as never,
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: same omission, checked in the same expectation.
      dailyAggregates: undefined as never
    })
    expect(normalized.sessions).toEqual([])
    expect(normalized.dailyAggregates).toEqual([])
  })
})
