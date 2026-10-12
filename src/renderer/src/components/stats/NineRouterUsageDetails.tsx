import type {
  NineRouterUsageBreakdownRow,
  NineRouterUsageDailyPoint,
  NineRouterUsageSessionRow,
  NineRouterUsageSummary
} from '../../../../shared/ninerouter-usage-types'
import { NineRouterUsageDailyChart } from './NineRouterUsageDailyChart'
import { UsageBreakdownSection, type UsageBreakdownRow } from './UsageBreakdownSection'
import { UsageRecentSessionsTable } from './UsageRecentSessionsTable'
import { translate } from '@/i18n/i18n'

type NineRouterUsageDetailsProps = {
  daily: NineRouterUsageDailyPoint[]
  modelBreakdown: NineRouterUsageBreakdownRow[]
  recentSessions: NineRouterUsageSessionRow[]
  summary: NineRouterUsageSummary | null | undefined
}

function toBreakdownRows(rows: NineRouterUsageBreakdownRow[]): UsageBreakdownRow[] {
  return rows.map((row) => ({
    key: row.key,
    label: row.label,
    tokens: row.totalTokens,
    // One synthetic session per model, so each breakdown row belongs to exactly one.
    sessions: 1,
    eventsOrTurns: row.events,
    estimatedCostUsd: row.costUsd
  }))
}

export function NineRouterUsageDetails({
  daily,
  modelBreakdown,
  recentSessions,
  summary
}: NineRouterUsageDetailsProps): React.JSX.Element {
  return (
    <>
      <NineRouterUsageDailyChart daily={daily} />

      <UsageBreakdownSection
        title={translate('auto.components.stats.OpenCodeUsagePane.040c044d39', 'By model')}
        topLabel={translate('auto.components.stats.OpenCodeUsagePane.a15206a63a', 'Top model:')}
        topValue={summary?.topModel}
        rows={toBreakdownRows(modelBreakdown)}
        eventsOrTurns="events"
      />

      <UsageRecentSessionsTable
        title={translate('auto.components.stats.OpenCodeUsagePane.4799177b1c', 'Recent sessions')}
        description={translate(
          'auto.components.stats.NineRouterUsageDetails.recentSessionsDescription',
          'Per-model totals 9router has routed, newest first.'
        )}
        headings={[
          translate('auto.components.stats.OpenCodeUsagePane.d97bdf6e27', 'Last active'),
          translate('auto.components.stats.OpenCodeUsagePane.a4738de041', 'Project'),
          translate('auto.components.stats.OpenCodeUsagePane.08c78441b7', 'Model'),
          translate('auto.components.stats.OpenCodeUsagePane.d416f5cf92', 'Events'),
          translate('auto.components.stats.OpenCodeUsagePane.0f2f266c9d', 'Input'),
          translate('auto.components.stats.OpenCodeUsagePane.dfc4513657', 'Output'),
          translate('auto.components.stats.UsageOverviewPane.3887b94ce5', 'Total')
        ]}
        unknownModel={translate('auto.components.stats.OpenCodeUsagePane.362231082f', 'Unknown')}
        rows={recentSessions}
        getActivity={(row) => row.events}
        getTrailingTokens={(row) => row.totalTokens}
        getModelSuffix={(row) => (row.provider === 'unknown' ? '' : ` · ${row.provider}`)}
      />
    </>
  )
}
