// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { NineRouterGatewayStatus } from '../../../../shared/ninerouter-usage-types'
import { NineRouterAccountsSection } from './NineRouterAccountsSection'

const fake = vi.hoisted(() => {
  const statusBarItems: string[] = ['ninerouter']
  return {
    enabled: true,
    statusBarItems,
    getStatus: vi.fn(),
    refreshRateLimits: vi.fn(async () => {}),
    setEnabled: vi.fn(async () => {}),
    toggle: vi.fn(),
    fetchUsage: vi.fn(async () => {})
  }
})
vi.mock('@/i18n/i18n', () => ({
  i18n: { language: 'en' },
  translate: (_key: string, fallback: string, values?: Record<string, string | number>) =>
    Object.entries(values ?? {}).reduce(
      (text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)),
      fallback
    )
}))
vi.mock('../../store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      settingsSearchQuery: '',
      rateLimits: {
        ninerouter: {
          provider: 'ninerouter',
          session: null,
          weekly: null,
          buckets: [
            {
              name: 'claude-opus-5-5',
              usedPercent: 18.4,
              windowMinutes: 300,
              resetsAt: null,
              resetDescription: null
            }
          ],
          updatedAt: 1,
          error: null,
          status: 'ok'
        }
      },
      nineRouterUsageScanState: { enabled: fake.enabled },
      fetchNineRouterUsage: fake.fetchUsage,
      setNineRouterUsageEnabled: fake.setEnabled,
      statusBarItems: fake.statusBarItems,
      toggleStatusBarItem: fake.toggle,
      refreshRateLimits: fake.refreshRateLimits,
      recordFeatureInteraction: vi.fn()
    })
}))

function gateway(overrides: Partial<NineRouterGatewayStatus> = {}): NineRouterGatewayStatus {
  return {
    installed: true,
    reachable: true,
    connections: [
      { id: 'a', provider: 'claude', name: 'work', state: 'active', rateLimitedUntil: null },
      { id: 'b', provider: 'codex', name: null, state: 'disabled', rateLimitedUntil: null }
    ],
    error: null,
    ...overrides
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  fake.enabled = true
  fake.statusBarItems = ['ninerouter']
  fake.getStatus.mockResolvedValue(gateway())
  Object.assign(window, { api: { nineRouterAccounts: { getStatus: fake.getStatus } } })
})
afterEach(() => {
  cleanup()
  Reflect.deleteProperty(window, 'api')
})

async function renderSection(): Promise<void> {
  render(<NineRouterAccountsSection />)
  await act(async () => {})
}

it('shows the connection, model quota and routed accounts', async () => {
  await renderSection()
  expect(screen.getByText('Connected to 9router on 127.0.0.1:20128')).toBeTruthy()
  expect(screen.getByText('claude-opus-5-5')).toBeTruthy()
  expect(screen.getByText('18%')).toBeTruthy()
  expect(screen.getByText('work')).toBeTruthy()
  expect(screen.getByText('Disabled')).toBeTruthy()
})

it('explains a missing install and a stopped gateway', async () => {
  fake.getStatus.mockResolvedValue(gateway({ installed: false, reachable: false, connections: [] }))
  await renderSection()
  expect(screen.getByText('9router not found on this computer')).toBeTruthy()
  cleanup()

  fake.getStatus.mockResolvedValue(
    gateway({ reachable: false, connections: [], error: '9router is not reachable' })
  )
  await renderSection()
  expect(screen.getByText('9router is not running')).toBeTruthy()
  expect(screen.getByText('9router is not reachable')).toBeTruthy()
})

it('hides model quota while tracking or the status-bar item is off', async () => {
  fake.statusBarItems = []
  await renderSection()
  expect(screen.queryByText('claude-opus-5-5')).toBeNull()
  cleanup()

  fake.statusBarItems = ['ninerouter']
  fake.enabled = false
  await renderSection()
  expect(screen.queryByText('claude-opus-5-5')).toBeNull()
})

it('drives the shared tracking switch and status-bar item', async () => {
  await renderSection()
  fireEvent.click(screen.getByRole('switch', { name: 'Track 9router usage' }))
  expect(fake.setEnabled).toHaveBeenCalledWith(false)
  fireEvent.click(screen.getByRole('switch', { name: 'Show in status bar' }))
  expect(fake.toggle).toHaveBeenCalledWith('ninerouter')
})

it('refreshes usage and re-reads the gateway', async () => {
  await renderSection()
  const readsBefore = fake.getStatus.mock.calls.length
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }))
  })
  expect(fake.refreshRateLimits).toHaveBeenCalled()
  expect(fake.getStatus.mock.calls.length).toBeGreaterThan(readsBefore)
})
