import { translate } from '@/i18n/i18n'
import { formatResetDuration } from '../../../../shared/rate-limit-reset-format'
import type { NineRouterConnectionStatus } from '../../../../shared/ninerouter-usage-types'
import type { RateLimitBucket } from '../../../../shared/rate-limit-types'
import { Badge } from '../ui/badge'

function resetIn(resetsAt: number | null, now: number): string | null {
  return resetsAt && resetsAt > now ? formatResetDuration(resetsAt - now) : null
}

export function NineRouterModelQuotaRow({
  bucket,
  now
}: {
  bucket: RateLimitBucket
  now: number
}): React.JSX.Element {
  const reset = resetIn(bucket.resetsAt, now)
  return (
    <div className="flex items-center gap-2 text-xs">
      <Badge variant="secondary">
        <span className="tabular-nums">{Math.round(bucket.usedPercent)}%</span>
      </Badge>
      <span className="truncate font-mono">{bucket.name}</span>
      {reset ? (
        <span className="text-muted-foreground">
          {translate(
            'auto.components.settings.NineRouterAccountsSection.resetIn',
            'resets in {{value0}}',
            { value0: reset }
          )}
        </span>
      ) : null}
    </div>
  )
}

function stateLabel(connection: NineRouterConnectionStatus, now: number): string {
  if (connection.state === 'disabled') {
    return translate(
      'auto.components.settings.NineRouterAccountsSection.state.disabled',
      'Disabled'
    )
  }
  if (connection.state === 'rate-limited') {
    const reset = resetIn(connection.rateLimitedUntil, now)
    return reset
      ? translate(
          'auto.components.settings.NineRouterAccountsSection.state.rateLimitedFor',
          'Rate-limited · {{value0}}',
          { value0: reset }
        )
      : translate(
          'auto.components.settings.NineRouterAccountsSection.state.rateLimited',
          'Rate-limited'
        )
  }
  return translate('auto.components.settings.NineRouterAccountsSection.state.active', 'Active')
}

export function NineRouterConnectionRow({
  connection,
  now
}: {
  connection: NineRouterConnectionStatus
  now: number
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Badge variant={connection.state === 'active' ? 'secondary' : 'outline'}>
        {stateLabel(connection, now)}
      </Badge>
      <span className="font-medium">{connection.provider}</span>
      {connection.name ? (
        <span className="truncate text-muted-foreground">{connection.name}</span>
      ) : null}
    </div>
  )
}
