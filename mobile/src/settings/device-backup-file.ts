import { Directory, File } from 'expo-file-system'
import {
  buildDeviceBackup,
  importDeviceBackup,
  type DeviceBackupImportResult
} from './device-backup'

function backupFileName(now: Date): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return `orca-mobile-backup-${stamp}.json`
}

/** Writes a backup into a folder the user picks; resolves to the file name, or null if cancelled. */
export async function exportDeviceBackupToFile(): Promise<string | null> {
  let directory: Directory
  try {
    directory = await Directory.pickDirectoryAsync()
  } catch {
    return null
  }
  const backup = await buildDeviceBackup()
  const name = backupFileName(new Date())
  directory.createFile(name, 'application/json').write(JSON.stringify(backup, null, 2))
  return name
}

/** Reads a backup file the user picks; resolves to what was restored, or null if cancelled. */
export async function importDeviceBackupFromFile(): Promise<DeviceBackupImportResult | null> {
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
  return importDeviceBackup(await file.text())
}
