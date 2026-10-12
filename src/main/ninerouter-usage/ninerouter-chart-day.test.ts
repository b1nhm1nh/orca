import { describe, expect, it } from 'vitest'
import { parseNinerouterChartDay } from './ninerouter-chart-day'

// Fixed "now" so year inference is deterministic across test runs.
const NOW = new Date('2026-10-11T12:00:00')

describe('ninerouter chart day', () => {
  it('parses month-day labels into local ISO days', () => {
    expect(parseNinerouterChartDay('Oct 11', NOW)).toBe('2026-10-11')
    expect(parseNinerouterChartDay('Jan 3', NOW)).toBe('2026-01-03')
    expect(parseNinerouterChartDay(' Oct 5 ', NOW)).toBe('2026-10-05')
  })

  it('rolls the year back when the label would land in the future', () => {
    expect(parseNinerouterChartDay('Dec 30', NOW)).toBe('2025-12-30')
  })

  it('keeps the current year for a label later today', () => {
    const now = new Date('2026-10-11T23:59:00')
    expect(parseNinerouterChartDay('Oct 11', now)).toBe('2026-10-11')
  })

  it('rejects labels it cannot read', () => {
    expect(parseNinerouterChartDay('10/11', NOW)).toBeNull()
    expect(parseNinerouterChartDay('Foobar 11', NOW)).toBeNull()
    expect(parseNinerouterChartDay('', NOW)).toBeNull()
  })
})
