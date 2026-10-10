export type NineRouterUsageBreakdownKind = 'model'

export type NineRouterUsageScope = 'all'
export type NineRouterUsageRange = '7d' | '30d' | '60d' | 'all'

export type NineRouterUsageScanState = {
  enabled: boolean
  isScanning: boolean
  lastScanStartedAt: number | null
  lastScanCompletedAt: number | null
  lastScanError: string | null
  hasAnyNinerouterData: boolean
}

export type NineRouterUsageSummary = {
  scope: NineRouterUsageScope
  range: NineRouterUsageRange
  sessions: number
  events: number
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  reasoningOutputTokens: number
  totalTokens: number
  /** 9router prices each request; zero with non-zero tokens means unpriced, not free. */
  costUsd: number
  topModel: string | null
  hasAnyNinerouterData: boolean
}

export type NineRouterUsageDailyPoint = {
  day: string
  totalTokens: number
  costUsd: number
}

export type NineRouterUsageBreakdownRow = {
  key: string
  label: string
  events: number
  totalTokens: number
  costUsd: number
}

export type NineRouterUsageSessionRow = {
  sessionId: string
  lastActiveAt: string
  /** 9router has no per-project data, so every row carries the gateway label. */
  projectLabel: string
  model: string | null
  provider: string
  events: number
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: number
}

export type NineRouterUsageSnapshot = {
  scanState: NineRouterUsageScanState
  summary: NineRouterUsageSummary
  daily: NineRouterUsageDailyPoint[]
  modelBreakdown: NineRouterUsageBreakdownRow[]
  /** 9router records no project paths; the slot stays for the shared usage slice shape. */
  projectBreakdown: NineRouterUsageBreakdownRow[]
  recentSessions: NineRouterUsageSessionRow[]
}
