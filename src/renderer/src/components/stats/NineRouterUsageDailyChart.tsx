import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import type { NineRouterUsageDailyPoint } from '../../../../shared/ninerouter-usage-types'
import { formatCost } from './usage-formatters'
import { translate } from '@/i18n/i18n'

// 9router's chart API exposes one total per day, so this is a single-segment chart
// instead of the input/output split the other providers' charts show.
type NineRouterUsageDailyChartProps = {
  daily: NineRouterUsageDailyPoint[]
}

export function NineRouterUsageDailyChart({
  daily
}: NineRouterUsageDailyChartProps): React.JSX.Element {
  let maxDailyTotal = 1
  for (const entry of daily) {
    maxDailyTotal = Math.max(maxDailyTotal, entry.totalTokens)
  }

  return (
    <section className="rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-foreground">
          {translate('auto.components.stats.CodexUsageDailyChart.609aa96e8b', 'Daily usage')}
        </h4>
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.stats.NineRouterUsageDailyChart.subtitle',
            'Total tokens and cost per day as 9router reports them.'
          )}
        </p>
      </div>
      <div className="grid h-56 grid-cols-10 items-end gap-3">
        {daily.slice(-10).map((entry) => (
          <div key={entry.day} className="flex h-full min-w-0 flex-col justify-end gap-2">
            <span className="text-center text-[11px] text-muted-foreground">
              {formatTokens(entry.totalTokens)}
            </span>
            <div className="flex min-h-0 flex-1 items-end justify-center">
              <div className="flex h-full w-full max-w-12 overflow-hidden rounded-t-sm bg-muted/60">
                <div className="flex h-full w-full flex-col justify-end">
                  <TooltipProvider delayDuration={120}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="bg-chart-1"
                          style={{ height: `${(entry.totalTokens / maxDailyTotal) * 100}%` }}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={8}>
                        <div className="text-xs">
                          <div>{entry.day}</div>
                          <div>
                            {entry.totalTokens.toLocaleString()}{' '}
                            {translate(
                              'auto.components.stats.CodexUsageDailyChart.e4bdcf0071',
                              'tokens'
                            )}
                          </div>
                          <div>
                            {translate(
                              'auto.components.stats.NineRouterUsageDailyChart.cost',
                              'Cost'
                            )}
                            : {formatCost(entry.costUsd)}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
            <span className="text-center text-[11px] text-muted-foreground">
              {entry.day.slice(5)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`
  }
  return value.toLocaleString()
}
