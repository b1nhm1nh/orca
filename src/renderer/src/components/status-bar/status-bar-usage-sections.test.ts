import { describe, expect, it } from 'vitest'
import type { ProviderRateLimits } from '../../../../shared/rate-limit-types'
import { getStatusBarUsageSections } from './status-bar-usage-sections'

function nineRouter(models: string[]): ProviderRateLimits {
  return {
    provider: 'ninerouter',
    session: null,
    weekly: null,
    buckets: models.map((name, index) => ({
      name,
      usedPercent: index * 10,
      windowMinutes: 300,
      resetsAt: null,
      resetDescription: null
    })),
    updatedAt: 0,
    error: null,
    status: 'ok'
  }
}

describe('getStatusBarUsageSections for 9router', () => {
  it('shows the three most recent models inline, labelled by model id', () => {
    const sections = getStatusBarUsageSections(
      nineRouter(['claude-opus-5-5', 'glm-5.3-flash', 'gemini-3.8-flash-high', 'grok-4.7']),
      'verbose'
    )
    expect(sections.map((section) => section.label)).toEqual([
      'claude-opus-5-5',
      'glm-5.3-flash',
      'gemini-3.8-flash-high'
    ])
    expect(sections.every((section) => section.labelFirst)).toBe(true)
  })

  it('collapses to the tightest model in compact mode', () => {
    const sections = getStatusBarUsageSections(
      nineRouter(['claude-opus-5-5', 'glm-5.3-flash', 'grok-4.7']),
      'compact'
    )
    expect(sections).toHaveLength(1)
    expect(sections[0]?.window.usedPercent).toBe(20)
  })
})
