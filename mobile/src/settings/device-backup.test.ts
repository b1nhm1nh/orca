import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => new Map<string, string>())
const hosts = vi.hoisted((): { list: unknown[]; saved: unknown[] } => ({ list: [], saved: [] }))
const relay = vi.hoisted((): { read: Map<string, unknown>; written: unknown[] } => ({
  read: new Map(),
  written: []
}))

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    multiGet: async (keys: readonly string[]) => keys.map((key) => [key, store.get(key) ?? null]),
    multiSet: async (pairs: [string, string][]) => {
      for (const [key, value] of pairs) {
        store.set(key, value)
      }
    }
  }
}))

vi.mock('../transport/host-store', () => ({
  loadHosts: async () => hosts.list,
  savePairedHost: async (host: unknown) => {
    hosts.saved.push(host)
  }
}))

vi.mock('../transport/mobile-relay-credential-bundle', async () => {
  const { z } = await import('zod')
  return {
    MobileRelayCredentialBundleSchema: z.object({ hostId: z.string() }).passthrough(),
    readMobileRelayCredentialBundle: async (hostId: string) => relay.read.get(hostId) ?? null,
    writeMobileRelayCredentialBundle: async (bundle: unknown) => {
      relay.written.push(bundle)
    }
  }
})

import { buildDeviceBackup, importDeviceBackup } from './device-backup'

const token = 'A'.repeat(43)
const relayEndpoint = {
  v: 1,
  directorUrl: 'https://director.example.com',
  cellUrl: 'https://cell.example.com',
  assignmentEpoch: 1,
  relayHostId: 'rh_0123456789abc',
  e2eeFraming: 2
} as const
const directHost = {
  id: 'host-a',
  name: 'BMM1',
  endpoint: 'ws://192.168.2.89:6768',
  deviceToken: 'device-a',
  publicKeyB64: 'key-a',
  lastConnected: 1
}
const relayHost = {
  ...directHost,
  id: 'host-b',
  name: 'PC',
  publicKeyB64: 'key-b',
  relay: relayEndpoint
}
const relayBundle = {
  v: 1,
  hostId: 'host-b',
  deviceToken: 'device-b',
  current: { token, hash: token, version: 1, expiresAt: 10 }
}

describe('device backup', () => {
  beforeEach(() => {
    store.clear()
    hosts.list = []
    hosts.saved = []
    relay.read.clear()
    relay.written = []
  })

  it('exports every host with its relay credential and only the listed settings', async () => {
    hosts.list = [directHost, relayHost]
    relay.read.set('host-b', relayBundle)
    store.set('orca:terminalTextScale', '1.2')
    store.set('orca:hosts', 'not a setting')

    const backup = await buildDeviceBackup(5)

    expect(backup.hosts).toEqual([
      { profile: directHost, relayCredential: null },
      { profile: relayHost, relayCredential: relayBundle }
    ])
    expect(backup.settings).toEqual({ 'orca:terminalTextScale': '1.2' })
  })

  it('round-trips hosts, relay credentials and settings into a fresh device', async () => {
    hosts.list = [directHost, relayHost]
    relay.read.set('host-b', relayBundle)
    store.set('orca:relayBackgroundGraceMs', '900000')
    const json = JSON.stringify(await buildDeviceBackup(5))
    store.clear()

    const result = await importDeviceBackup(json)

    expect(result).toEqual({ hosts: 2, relayCredentials: 1, settings: 1 })
    expect(hosts.saved).toEqual([directHost, relayHost])
    expect(relay.written).toEqual([relayBundle])
    expect(store.get('orca:relayBackgroundGraceMs')).toBe('900000')
  })

  it('ignores settings keys outside the backup list', async () => {
    const json = JSON.stringify({
      format: 'orca-mobile-backup',
      v: 1,
      exportedAt: 1,
      hosts: [],
      settings: { 'orca:hosts': '[]', 'orca:terminalTextScale': '1' }
    })

    await importDeviceBackup(json)

    expect(store.has('orca:hosts')).toBe(false)
    expect(store.get('orca:terminalTextScale')).toBe('1')
  })

  it('rejects files that are not an Orca backup', async () => {
    await expect(importDeviceBackup('not json')).rejects.toThrow('Not a valid backup file')
    await expect(importDeviceBackup('{"format":"other"}')).rejects.toThrow(
      'Not an Orca mobile backup'
    )
    expect(hosts.saved).toEqual([])
  })
})
