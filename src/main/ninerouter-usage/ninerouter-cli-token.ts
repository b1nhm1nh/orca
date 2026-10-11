import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir, platform } from 'node:os'

export const NINEROUTER_CLI_TOKEN_SALT = '9r-cli-auth'

/**
 * Mirrors 9router's `src/lib/dataDir.js`: `DATA_DIR` when set (a Unix path is ignored on
 * Windows), else %APPDATA%\9router on Windows and ~/.9router elsewhere.
 */
export function resolveNinerouterDataDir(): string {
  const configured = process.env.DATA_DIR?.trim()
  if (configured && !(platform() === 'win32' && configured.startsWith('/'))) {
    return configured
  }
  if (platform() === 'win32') {
    return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), '9router')
  }
  return join(homedir(), '.9router')
}

/**
 * Same value 9router's dashboard guard expects in `x-9r-cli-token`:
 * sha256(machineId + salt + cliSecret), first 16 hex chars (9router `machineId.js`).
 */
export async function deriveNinerouterCliToken(paths: {
  machineIdFile: string
  cliSecretFile: string
}): Promise<string> {
  const [machineId, cliSecret] = await Promise.all([
    readFile(paths.machineIdFile, 'utf8'),
    readFile(paths.cliSecretFile, 'utf8')
  ]).catch(() => {
    throw new Error(
      '9router CLI token not found — start 9router once so it writes its machine-id and cli-secret'
    )
  })
  const digest = createHash('sha256')
    .update(`${machineId.trim()}${NINEROUTER_CLI_TOKEN_SALT}${cliSecret.trim()}`)
    .digest('hex')
  return digest.slice(0, 16)
}
