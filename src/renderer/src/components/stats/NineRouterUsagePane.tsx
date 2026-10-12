import { useEffect } from 'react'
import { Activity, Brain, DatabaseZap, DollarSign, FolderKanban, Sigma, Sparkles } from 'lucide-react'
import type { NineRouterUsageRange } from '../../../../shared/ninerouter-usage-types'
import { useAppStore } from '../../store'
import { ClaudeUsageLoadingState } from './ClaudeUsageLoadingState'
import { NineRouterUsageDetails } from './NineRouterUsageDetails'
import { StatCard } from './StatCard'
import { UsageFilterRadioGroup, UsageTrackingPaneShell } from './UsageTrackingPaneShell'
import { formatCost, formatTokens, formatUpdatedAt } from './usage-formatters'
import { translate } from '@/i18n/i18n'

// 9router's stats API has no 90d period, so the ranges mirror its own.
const RANGE_OPTIONS: NineRouterUsageRange[] = ['7d', '30d', '60d', 'all']
const RANGE_LABELS: Record<NineRouterUsageRange, string> = {
  get '7d'() {
    return translate('auto.components.stats.OpenCodeUsagePane.rangeLast7Days', 'Last 7 days')
  },
  get '30d'() {
    return translate('auto.components.stats.OpenCodeUsagePane.rangeLast30Days', 'Last 30 days')
  },
  get '60d'() {
    return translate('auto.components.stats.NineRouterUsagePane.rangeLast60Days', 'Last 60 days')
  },
  get all() {
    return translate('auto.components.stats.OpenCodeUsagePane.rangeAllTime', 'All time')
  }
}

export function NineRouterUsagePane(): React.JSX.Element {
  const scanState = useAppStore((state) => state.nineRouterUsageScanState)
  const summary = useAppStore((state) => state.nineRouterUsageSummary)
  const daily = useAppStore((state) => state.nineRouterUsageDaily)
  const modelBreakdown = useAppStore((state) => state.nineRouterUsageModelBreakdown)
  const recentSessions = useAppStore((state) => state.nineRouterUsageRecentSessions)
  const range = useAppStore((state) => state.nineRouterUsageRange)
  const fetchNineRouterUsage = useAppStore((state) => state.fetchNineRouterUsage)
  const setNineRouterUsageEnabled = useAppStore((state) => state.setNineRouterUsageEnabled)
  const refreshNineRouterUsage = useAppStore((state) => state.refreshNineRouterUsage)
  const setNineRouterUsageRange = useAppStore((state) => state.setNineRouterUsageRange)
  const recordFeatureInteraction = useAppStore((state) => state.recordFeatureInteraction)

  useEffect(() => {
    void fetchNineRouterUsage()
  }, [fetchNineRouterUsage])

  const handleSetEnabled = (enabled: boolean): void => {
    recordFeatureInteraction('usage-tracking')
    void setNineRouterUsageEnabled(enabled)
  }

  const title = translate('auto.components.stats.NineRouterUsagePane.title', '9router Usage')
  const enableLabel = translate(
    'auto.components.stats.NineRouterUsagePane.enableLabel',
    'Enable 9router usage analytics'
  )

  if (!scanState?.enabled) {
    return (
      <UsageTrackingPaneShell
        enabled={false}
        title={title}
        disabledDescription={translate(
          'auto.components.stats.NineRouterUsagePane.disabledDescription',
          'Reads usage and cost from the 9router gateway on this machine (127.0.0.1:20128).'
        )}
        enableLabel={enableLabel}
        onEnabledChange={handleSetEnabled}
      />
    )
  }

  if (!summary && (scanState.isScanning || scanState.lastScanCompletedAt === null)) {
    return (
      <ClaudeUsageLoadingState
        title={title}
        summaryCardCount={6}
        summaryGridClassName="md:grid-cols-3"
      />
    )
  }

  const hasAnyData = summary?.hasAnyNinerouterData ?? scanState.hasAnyNinerouterData

  return (
    <UsageTrackingPaneShell
      enabled
      title={title}
      status={
        <>
          {formatUpdatedAt(scanState.lastScanCompletedAt)}
          {scanState.lastScanError
            ? translate(
                'auto.components.stats.OpenCodeUsagePane.6cc7782458',
                ' • Last scan error: {{value0}}',
                { value0: scanState.lastScanError }
              )
            : ''}
        </>
      }
      isRefreshing={scanState.isScanning}
      hasData={hasAnyData}
      enableLabel={enableLabel}
      optionsLabel={translate(
        'auto.components.stats.NineRouterUsagePane.optionsLabel',
        '9router usage options'
      )}
      filtersLabel={translate('auto.components.stats.OpenCodeUsagePane.01583b30aa', 'Filters')}
      refreshAriaLabel={translate(
        'auto.components.stats.NineRouterUsagePane.refreshAriaLabel',
        'Refresh 9router usage'
      )}
      refreshLabel={translate('auto.components.stats.OpenCodeUsagePane.603cd138dc', 'Refresh')}
      filterSections={[
        <UsageFilterRadioGroup
          key="range"
          label={translate('auto.components.stats.OpenCodeUsagePane.b5ed5c9fd0', 'Range')}
          value={range}
          options={RANGE_OPTIONS.map((value) => ({ value, label: RANGE_LABELS[value] }))}
          onValueChange={(value) => void setNineRouterUsageRange(value)}
        />
      ]}
      selectionSummary={<>{RANGE_LABELS[range]} • 9router on this machine</>}
      emptyMessage={translate(
        'auto.components.stats.NineRouterUsagePane.emptyMessage',
        'No 9router usage found yet for this range.'
      )}
      onEnabledChange={handleSetEnabled}
      onRefresh={() => void refreshNineRouterUsage()}
    >
      <>
        <div className="grid gap-3 md:grid-cols-3">
          <StatCard
            label={translate('auto.components.stats.OpenCodeUsagePane.d637a892ed', 'Input tokens')}
            value={formatTokens(summary?.inputTokens ?? 0)}
            icon={<Sparkles className="size-4" />}
          />
          <StatCard
            label={translate('auto.components.stats.OpenCodeUsagePane.7aa4d8ce35', 'Output tokens')}
            value={formatTokens(summary?.outputTokens ?? 0)}
            icon={<Activity className="size-4" />}
          />
          <StatCard
            label={translate('auto.components.stats.OpenCodeUsagePane.603504ee3b', 'Cached input')}
            value={formatTokens(summary?.cachedInputTokens ?? 0)}
            icon={<DatabaseZap className="size-4" />}
          />
          <StatCard
            label={translate(
              'auto.components.stats.OpenCodeUsagePane.5a65d68b77',
              'Reasoning output'
            )}
            value={formatTokens(summary?.reasoningOutputTokens ?? 0)}
            icon={<Brain className="size-4" />}
          />
          <StatCard
            label={translate(
              'auto.components.stats.OpenCodeUsagePane.7e9433469a',
              'Sessions / Events'
            )}
            value={`${(summary?.sessions ?? 0).toLocaleString()} / ${(summary?.events ?? 0).toLocaleString()}`}
            icon={<FolderKanban className="size-4" />}
          />
          <StatCard
            label={translate('auto.components.stats.OpenCodeUsagePane.0eaf937335', 'Est. cost')}
            value={formatCost(summary?.costUsd ?? null)}
            icon={<DollarSign className="size-4" />}
          />
          <StatCard
            label={translate('auto.components.stats.UsageOverviewPane.3887b94ce5', 'Total tokens')}
            value={formatTokens(summary?.totalTokens ?? 0)}
            icon={<Sigma className="size-4" />}
          />
        </div>
        <p className="px-1 text-xs text-muted-foreground">
          {translate(
            'auto.components.stats.NineRouterUsagePane.costNote',
            'Cost is what 9router priced at request time; zero cost with non-zero tokens means that model has no price configured.'
          )}
        </p>

        <NineRouterUsageDetails
          daily={daily}
          modelBreakdown={modelBreakdown}
          recentSessions={recentSessions}
          summary={summary}
        />
      </>
    </UsageTrackingPaneShell>
  )
}
