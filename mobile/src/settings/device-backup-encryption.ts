import { scryptAsync } from '@noble/hashes/scrypt'
import * as ExpoCrypto from 'expo-crypto'
import nacl from 'tweetnacl'
import { z } from 'zod'
import { decodeBase64Bytes, encodeBase64Bytes } from '../transport/base64-byte-codec'

export const ENCRYPTED_DEVICE_BACKUP_FORMAT = 'orca-mobile-backup-encrypted'
export const MIN_BACKUP_PASSWORD_LENGTH = 8

// Why: pure-JS scrypt on Hermes; 2^14 keeps a phone around a few seconds. Stored per file so it can rise later.
const SCRYPT_PARAMS = { N: 2 ** 14, r: 8, p: 1 } as const

const EncryptedDeviceBackupSchema = z.object({
  format: z.literal(ENCRYPTED_DEVICE_BACKUP_FORMAT),
  v: z.literal(1),
  kdf: z.object({
    name: z.literal('scrypt'),
    N: z
      .number()
      .int()
      .min(2 ** 14)
      .max(2 ** 20),
    r: z.number().int().min(1).max(32),
    p: z.number().int().min(1).max(16)
  }),
  salt: z.string(),
  nonce: z.string(),
  ciphertext: z.string()
})

export type EncryptedDeviceBackup = z.infer<typeof EncryptedDeviceBackupSchema>

// Why: tweetnacl rejects Hermes typed arrays that fail its `instanceof Uint8Array` check.
function u8(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes)
}

function deriveKey(
  password: string,
  salt: Uint8Array,
  params: EncryptedDeviceBackup['kdf']
): Promise<Uint8Array> {
  return scryptAsync(new TextEncoder().encode(password), salt, {
    N: params.N,
    r: params.r,
    p: params.p,
    dkLen: nacl.secretbox.keyLength
  })
}

export async function encryptDeviceBackup(
  plaintext: string,
  password: string
): Promise<EncryptedDeviceBackup> {
  if (password.length < MIN_BACKUP_PASSWORD_LENGTH) {
    throw new Error(`Use a password of at least ${MIN_BACKUP_PASSWORD_LENGTH} characters`)
  }
  const kdf = { name: 'scrypt' as const, ...SCRYPT_PARAMS }
  const salt = u8(ExpoCrypto.getRandomBytes(16))
  const nonce = u8(ExpoCrypto.getRandomBytes(nacl.secretbox.nonceLength))
  const key = u8(await deriveKey(password, salt, kdf))
  const ciphertext = nacl.secretbox(u8(new TextEncoder().encode(plaintext)), nonce, key)
  return {
    format: ENCRYPTED_DEVICE_BACKUP_FORMAT,
    v: 1,
    kdf,
    salt: encodeBase64Bytes(salt),
    nonce: encodeBase64Bytes(nonce),
    ciphertext: encodeBase64Bytes(ciphertext)
  }
}

/** Null when the value is not an encrypted backup, so callers can fall back to a plain one. */
export function parseEncryptedDeviceBackup(value: unknown): EncryptedDeviceBackup | null {
  const result = EncryptedDeviceBackupSchema.safeParse(value)
  return result.success ? result.data : null
}

export async function decryptDeviceBackup(
  backup: EncryptedDeviceBackup,
  password: string
): Promise<string> {
  const key = u8(await deriveKey(password, decodeBase64Bytes(backup.salt), backup.kdf))
  const plaintext = nacl.secretbox.open(
    u8(decodeBase64Bytes(backup.ciphertext)),
    u8(decodeBase64Bytes(backup.nonce)),
    key
  )
  // Why: secretbox authenticates, so a wrong password and a tampered file fail identically.
  if (!plaintext) {
    throw new Error('Wrong password, or the backup file is damaged')
  }
  return new TextDecoder().decode(plaintext)
}
