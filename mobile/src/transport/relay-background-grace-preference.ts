import AsyncStorage from '@react-native-async-storage/async-storage'

export const RELAY_BACKGROUND_GRACE_STORAGE_KEY = 'orca:relayBackgroundGraceMs'
export const DEFAULT_RELAY_BACKGROUND_GRACE_MS = 5 * 60_000
export const RELAY_BACKGROUND_GRACE_CHOICES_MS = [
  30_000,
  2 * 60_000,
  5 * 60_000,
  15 * 60_000
] as const

// Why: the grace timer arms synchronously on the background transition, so it reads memory, not storage.
let current = DEFAULT_RELAY_BACKGROUND_GRACE_MS

function parseGraceMs(raw: string | null): number {
  const value = Number(raw)
  return RELAY_BACKGROUND_GRACE_CHOICES_MS.some((choice) => choice === value)
    ? value
    : DEFAULT_RELAY_BACKGROUND_GRACE_MS
}

export function relayBackgroundGraceMs(): number {
  return current
}

export async function loadRelayBackgroundGraceMs(): Promise<number> {
  try {
    current = parseGraceMs(await AsyncStorage.getItem(RELAY_BACKGROUND_GRACE_STORAGE_KEY))
  } catch {
    // Keep the last value; an unreadable store must not shorten a grace the user chose.
  }
  return current
}

export async function saveRelayBackgroundGraceMs(ms: number): Promise<void> {
  current = parseGraceMs(String(ms))
  await AsyncStorage.setItem(RELAY_BACKGROUND_GRACE_STORAGE_KEY, String(current))
}

export function resetRelayBackgroundGraceForTest(): void {
  current = DEFAULT_RELAY_BACKGROUND_GRACE_MS
}
