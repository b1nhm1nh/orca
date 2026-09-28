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
  hostWorkspaceLabel,
  loadShowHostInWorkspaceTitles,
  reloadShowHostInWorkspaceTitles,
  resetHostWorkspaceLabelForTest,
  saveShowHostInWorkspaceTitles
} from './host-workspace-label'

describe('host workspace label', () => {
  beforeEach(() => {
    stored.value = null
    resetHostWorkspaceLabelForTest()
  })

  it('prefixes the host only when enabled and known', () => {
    expect(hostWorkspaceLabel(true, 'BMM1', 'orca')).toBe('BMM1: orca')
    expect(hostWorkspaceLabel(false, 'BMM1', 'orca')).toBe('orca')
    expect(hostWorkspaceLabel(true, null, 'orca')).toBe('orca')
  })

  it('is off by default and persists when turned on', async () => {
    expect(await loadShowHostInWorkspaceTitles()).toBe(false)
    await saveShowHostInWorkspaceTitles(true)
    resetHostWorkspaceLabelForTest()
    expect(await loadShowHostInWorkspaceTitles()).toBe(true)
  })

  it('picks up a value an import wrote to storage', async () => {
    expect(await loadShowHostInWorkspaceTitles()).toBe(false)
    stored.value = 'true'
    expect(await reloadShowHostInWorkspaceTitles()).toBe(true)
  })
})
