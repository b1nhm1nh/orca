import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deriveNinerouterCliToken, NINEROUTER_CLI_TOKEN_SALT } from './ninerouter-cli-token'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ninerouter-token-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('ninerouter cli token', () => {
  it('derives the same value the 9router dashboard guard computes', async () => {
    writeFileSync(join(root, 'machine-id'), 'machine-123\n')
    writeFileSync(join(root, 'cli-secret'), 'secret-456\n')

    const token = await deriveNinerouterCliToken({
      machineIdFile: join(root, 'machine-id'),
      cliSecretFile: join(root, 'cli-secret')
    })

    // Independent re-derivation of 9router's sha256(machineId + salt + secret)[:16].
    const expected = createHash('sha256')
      .update(`machine-123${NINEROUTER_CLI_TOKEN_SALT}secret-456`)
      .digest('hex')
      .slice(0, 16)
    expect(token).toBe(expected)
    expect(token).toMatch(/^[0-9a-f]{16}$/)
  })

  it('trims surrounding whitespace like the 9router file reads', async () => {
    writeFileSync(join(root, 'machine-id'), 'machine-123\n')
    writeFileSync(join(root, 'cli-secret'), 'secret-456\n')
    const trimmed = await deriveNinerouterCliToken({
      machineIdFile: join(root, 'machine-id'),
      cliSecretFile: join(root, 'cli-secret')
    })
    writeFileSync(join(root, 'machine-id'), 'machine-123')
    writeFileSync(join(root, 'cli-secret'), 'secret-456')
    const untrimmed = await deriveNinerouterCliToken({
      machineIdFile: join(root, 'machine-id'),
      cliSecretFile: join(root, 'cli-secret')
    })
    expect(untrimmed).toBe(trimmed)
  })

  it('names the missing 9router data files instead of throwing ENOENT', async () => {
    await expect(
      deriveNinerouterCliToken({
        machineIdFile: join(root, 'missing-id'),
        cliSecretFile: join(root, 'missing-secret')
      })
    ).rejects.toThrow('9router CLI token not found')
  })
})
