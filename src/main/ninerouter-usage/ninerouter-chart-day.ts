const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/**
 * 9router's chart labels are locale strings ("Oct 11") with no year, so the year is
 * inferred: assume the current year, and roll back one when that lands in the future.
 */
export function parseNinerouterChartDay(label: string, now = new Date()): string | null {
  const match = label.trim().match(/^([A-Za-z]{3,})\s+(\d{1,2})$/)
  if (!match) {
    return null
  }
  const month = MONTHS.indexOf(match[1]!.slice(0, 3).toLowerCase())
  if (month === -1) {
    return null
  }
  const day = Number(match[2])
  for (const yearDelta of [0, -1]) {
    const candidate = new Date(now.getFullYear() + yearDelta, month, day)
    if (candidate.getMonth() === month && candidate <= now) {
      return formatLocalDay(candidate)
    }
  }
  return null
}

function formatLocalDay(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
