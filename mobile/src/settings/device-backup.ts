import AsyncStorage from '@react-native-async-storage/async-storage'
import { z } from 'zod'
import { loadHosts, savePairedHost } from '../transport/host-store'
import {
  MobileRelayCredentialBundleSchema,
  readMobileRelayCredentialBundle,
  writeMobileRelayCredentialBundle
} from '../transport/mobile-relay-credential-bundle'
import { HostProfileSchema } from '../transport/types'

export const DEVICE_BACKUP_FORMAT = 'orca-mobile-backup'

// Plain preferences a new phone should inherit. Per-device state (push tokens, caches, journals) stays out.
export const DEVICE_BACKUP_SETTING_KEYS = [
  'orca:terminalTextScale',
  'orca:terminalAutocompleteEnabled',
  'orca:terminalLinkOpenMode',
  'orca:terminal-accessory-layout',
  'orca:custom-accessory-keys',
  'orca:defaultSessionView',
  'orca:hostSidebarWidth',
  'orca:hostDockWidth',
  'orca:notificationDeliveryPreferences',
  'orca:relayBackgroundGraceMs',
  'orca:showHostInWorkspaceTitles',
  'orca:recent-workspaces'
] as const

const DeviceBackupSchema = z.object({
  format: z.literal(DEVICE_BACKUP_FORMAT),
  v: z.literal(1),
  exportedAt: z.number(),
  hosts: z.array(
    z.object({
      profile: HostProfileSchema,
      relayCredential: MobileRelayCredentialBundleSchema.nullable()
    })
  ),
  settings: z.record(z.string(), z.string())
})

export type DeviceBackup = z.infer<typeof DeviceBackupSchema>

export async function buildDeviceBackup(now = Date.now()): Promise<DeviceBackup> {
  const hosts = await Promise.all(
    (await loadHosts()).map(async (profile) => ({
      profile,
      relayCredential: profile.relay
        ? await readMobileRelayCredentialBundle(profile.id).catch(() => null)
        : null
    }))
  )
  const settings: Record<string, string> = {}
  for (const [key, value] of await AsyncStorage.multiGet(DEVICE_BACKUP_SETTING_KEYS)) {
    if (value !== null) {
      settings[key] = value
    }
  }
  return { format: DEVICE_BACKUP_FORMAT, v: 1, exportedAt: now, hosts, settings }
}

export type DeviceBackupImportResult = { hosts: number; relayCredentials: number; settings: number }

export async function importDeviceBackup(json: string): Promise<DeviceBackupImportResult> {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Not a valid backup file')
  }
  const result = DeviceBackupSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error('Not an Orca mobile backup')
  }
  const backup = result.data
  let relayCredentials = 0
  for (const { profile, relayCredential } of backup.hosts) {
    // Credential first: a relay host saved without one would dial and fail before the write lands.
    if (relayCredential && relayCredential.hostId === profile.id) {
      await writeMobileRelayCredentialBundle(relayCredential)
      relayCredentials += 1
    }
    await savePairedHost(profile)
  }
  const allowed = new Set<string>(DEVICE_BACKUP_SETTING_KEYS)
  const settings = Object.entries(backup.settings).filter(([key]) => allowed.has(key))
  if (settings.length > 0) {
    await AsyncStorage.multiSet(settings)
  }
  return { hosts: backup.hosts.length, relayCredentials, settings: settings.length }
}
