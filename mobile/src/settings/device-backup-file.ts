import { Directory, File } from 'expo-file-system'
import {
  buildDeviceBackup,
  importDeviceBackup,
  type DeviceBackupImportResult
} from './device-backup'
import {
  decryptDeviceBackup,
  encryptDeviceBackup,
  parseEncryptedDeviceBackup
} from './device-backup-encryption'

function backupFileName(now: Date): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return `orca-mobile-backup-${stamp}.json`
}

/** Writes a password-encrypted backup into a folder the user picks; null if cancelled. */
export async function exportDeviceBackupToFile(password: string): Promise<string | null> {
  let directory: Directory
  try {
    directory = await Directory.pickDirectoryAsync()
  } catch {
    return null
  }
  const backup = await buildDeviceBackup()
  const encrypted = await encryptDeviceBackup(JSON.stringify(backup), password)
  const name = backupFileName(new Date())
  directory.createFile(name, 'application/json').write(JSON.stringify(encrypted, null, 2))
  return name
}

export type PickedDeviceBackup = { text: string; encrypted: boolean }

/** Reads a backup file the user picks without restoring it; null if cancelled. */
export async function pickDeviceBackupFile(): Promise<PickedDeviceBackup | null> {
  let picked: File | File[]
  try {
    picked = await File.pickFileAsync(undefined, 'application/json')
  } catch {
    return null
  }
  const file = Array.isArray(picked) ? picked[0] : picked
  if (!file) {
    return null
  }
  const text = await file.text()
  return { text, encrypted: isEncryptedDeviceBackupText(text) }
}

function isEncryptedDeviceBackupText(text: string): boolean {
  try {
    return parseEncryptedDeviceBackup(JSON.parse(text)) !== null
  } catch {
    return false
  }
}

/** Restores a picked backup; an encrypted one needs its password, a plain one ignores it. */
export async function importPickedDeviceBackup(
  picked: PickedDeviceBackup,
  password: string | null
): Promise<DeviceBackupImportResult> {
  if (!picked.encrypted) {
    return importDeviceBackup(picked.text)
  }
  const encrypted = parseEncryptedDeviceBackup(JSON.parse(picked.text))
  if (!encrypted || password === null) {
    throw new Error('This backup needs its password')
  }
  return importDeviceBackup(await decryptDeviceBackup(encrypted, password))
}
