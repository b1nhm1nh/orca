import { beforeEach, describe, expect, it, vi } from 'vitest'

const stored = vi.hoisted((): { value: string | null } => ({ value: null }))

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async () => stored.value,
    setItem: async (_key: string, value: string) => {
      stored.value = value
    }
  }
}))

import {
  DEFAULT_RELAY_BACKGROUND_GRACE_MS,
  loadRelayBackgroundGraceMs,
  relayBackgroundGraceMs,
  resetRelayBackgroundGraceForTest,
  saveRelayBackgroundGraceMs
} from './relay-background-grace-preference'
import { MobileRelayBackgroundGraceTimer } from './mobile-relay-background-grace'

describe('relay background grace preference', () => {
  beforeEach(() => {
    stored.value = null
    resetRelayBackgroundGraceForTest()
  })

  it('defaults to 5 minutes', async () => {
    expect(await loadRelayBackgroundGraceMs()).toBe(DEFAULT_RELAY_BACKGROUND_GRACE_MS)
  })

  it('persists a chosen grace and serves it synchronously', async () => {
    await saveRelayBackgroundGraceMs(15 * 60_000)
    expect(relayBackgroundGraceMs()).toBe(15 * 60_000)
    resetRelayBackgroundGraceForTest()
    expect(await loadRelayBackgroundGraceMs()).toBe(15 * 60_000)
  })

  it('falls back to the default for a value that is not one of the choices', async () => {
    stored.value = '999'
    expect(await loadRelayBackgroundGraceMs()).toBe(DEFAULT_RELAY_BACKGROUND_GRACE_MS)
  })

  it('arms the relay grace timer with the chosen duration', async () => {
    vi.useFakeTimers()
    try {
      await saveRelayBackgroundGraceMs(30_000)
      const onExpired = vi.fn()
      const timer = new MobileRelayBackgroundGraceTimer(
        {
          now: Date.now,
          setTimer: (handler, ms) => setTimeout(handler, ms),
          clearTimer: (handle) => clearTimeout(handle)
        },
        onExpired
      )
      timer.arm()
      await vi.advanceTimersByTimeAsync(30_000 - 1)
      expect(onExpired).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(onExpired).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })
})
