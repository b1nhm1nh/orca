import { randomBytes } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

vi.mock('expo-crypto', () => ({
  getRandomBytes: (length: number) => new Uint8Array(randomBytes(length))
}))

import {
  decryptDeviceBackup,
  encryptDeviceBackup,
  ENCRYPTED_DEVICE_BACKUP_FORMAT,
  parseEncryptedDeviceBackup
} from './device-backup-encryption'

const plaintext = JSON.stringify({ format: 'orca-mobile-backup', secret: 'device-token' })

describe('device backup encryption', () => {
  it('round-trips with the right password and hides the plaintext', async () => {
    const encrypted = await encryptDeviceBackup(plaintext, 'correct horse')

    expect(encrypted.format).toBe(ENCRYPTED_DEVICE_BACKUP_FORMAT)
    expect(JSON.stringify(encrypted)).not.toContain('device-token')
    expect(await decryptDeviceBackup(encrypted, 'correct horse')).toBe(plaintext)
  })

  it('rejects a wrong password and a tampered file', async () => {
    const encrypted = await encryptDeviceBackup(plaintext, 'correct horse')
    const tampered = { ...encrypted, ciphertext: `A${encrypted.ciphertext.slice(1)}` }

    await expect(decryptDeviceBackup(encrypted, 'wrong horse')).rejects.toThrow('Wrong password')
    await expect(decryptDeviceBackup(tampered, 'correct horse')).rejects.toThrow('Wrong password')
  })

  it('salts every export so equal passwords give different files', async () => {
    const first = await encryptDeviceBackup(plaintext, 'correct horse')
    const second = await encryptDeviceBackup(plaintext, 'correct horse')

    expect(first.salt).not.toBe(second.salt)
    expect(first.ciphertext).not.toBe(second.ciphertext)
  })

  it('refuses a short password', async () => {
    await expect(encryptDeviceBackup(plaintext, 'short')).rejects.toThrow('at least 8')
  })

  it('recognises only encrypted backups and bounds the stored work factor', async () => {
    const encrypted = await encryptDeviceBackup(plaintext, 'correct horse')

    expect(parseEncryptedDeviceBackup(JSON.parse(JSON.stringify(encrypted)))).toEqual(encrypted)
    expect(parseEncryptedDeviceBackup(JSON.parse(plaintext))).toBeNull()
    expect(
      parseEncryptedDeviceBackup({ ...encrypted, kdf: { ...encrypted.kdf, N: 2 ** 30 } })
    ).toBeNull()
  })
})
