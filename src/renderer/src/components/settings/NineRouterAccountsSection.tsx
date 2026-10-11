import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw, Route, ShieldCheck } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { NineRouterGatewayStatus } from '../../../../shared/ninerouter-usage-types'
import { useAppStore } from '../../store'
import { useNow } from '../../hooks/use-now'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'
import { SearchableSetting } from './SearchableSetting'
import { NineRouterConnectionRow, NineRouterModelQuotaRow } from './ninerouter-accounts-rows'

const SEARCH_KEYWORDS = ['9router', 'router', 'gateway', 'proxy', 'quota', 'usage', 'rate limit']

function statusHeadline(status: NineRouterGatewayStatus | null): string {
  if (!status) {
    return translate('auto.components.settings.NineRouterAccountsSection.loading', 'Loading…')
  }
  if (!status.installed) {
    return translate(
      'auto.components.settings.NineRouterAccountsSection.notInstalled',
      '9router not found on this computer'
    )
  }
  if (!status.reachable) {
    return translate(
      'auto.components.settings.NineRouterAccountsSection.notRunning',
      '9router is not running'
    )
  }
  return translate(
    'auto.components.settings.NineRouterAccountsSection.connected',
    'Connected to 9router on 127.0.0.1:20128'
  )
}

export function NineRouterAccountsSection(): React.JSX.Element {
  const refreshRateLimits = useAppStore((s) => s.refreshRateLimits)
  const nineRouterUsage = useAppStore((s) => s.rateLimits.ninerouter)
  const scanState = useAppStore((s) => s.nineRouterUsageScanState)
  const fetchNineRouterUsage = useAppStore((s) => s.fetchNineRouterUsage)
  const setNineRouterUsageEnabled = useAppStore((s) => s.setNineRouterUsageEnabled)
  const statusBarItems = useAppStore((s) => s.statusBarItems)
  const toggleStatusBarItem = useAppStore((s) => s.toggleStatusBarItem)
  const recordFeatureInteraction = useAppStore((s) => s.recordFeatureInteraction)
  const [status, setStatus] = useState<NineRouterGatewayStatus | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const now = useNow(60_000)
  // Why: overlapping reads (mount + refresh) must not let the older one repaint last.
  const latestLoad = useRef(0)

  const loadStatus = useCallback(async (): Promise<void> => {
    const generation = ++latestLoad.current
    let next: NineRouterGatewayStatus
    try {
      next = await window.api.nineRouterAccounts.getStatus()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      next = { installed: false, reachable: false, connections: [], error: message }
    }
    if (latestLoad.current === generation) {
      setStatus(next)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus, nineRouterUsage?.updatedAt])

  useEffect(() => {
    if (!scanState) {
      void fetchNineRouterUsage()
    }
  }, [scanState, fetchNineRouterUsage])

  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true)
    try {
      await Promise.all([refreshRateLimits(), loadStatus()])
    } finally {
      setRefreshing(false)
    }
  }

  const trackingEnabled = scanState?.enabled === true
  const statusBarVisible = statusBarItems.includes('ninerouter')
  const connected = status?.reachable === true && !status.error
  const buckets = nineRouterUsage?.status === 'ok' ? (nineRouterUsage.buckets ?? []) : []
  const trackingLabel = translate(
    'auto.components.settings.NineRouterAccountsSection.trackingTitle',
    'Track 9router usage'
  )

  return (
    <section id="accounts-ninerouter" className="space-y-4 scroll-mt-6">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Route className="size-4" />
          9router
        </h3>
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.settings.NineRouterAccountsSection.subtitle',
            'Local AI gateway on this computer. Orca signs in with the token 9router keeps in its own data folder, so there is no key to paste.'
          )}
        </p>
      </div>

      <div
        className={cn(
          'flex items-start gap-3 rounded-lg border bg-muted/20 p-3',
          connected ? 'border-border/60' : 'border-border/40'
        )}
      >
        <ShieldCheck
          className={cn(
            'mt-0.5 size-4 shrink-0',
            connected ? 'text-foreground' : 'text-muted-foreground'
          )}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium">{statusHeadline(status)}</p>
          {status?.error ? <p className="text-xs text-destructive">{status.error}</p> : null}
          {status && !status.installed ? (
            <p className="text-xs text-muted-foreground">
              {translate(
                'auto.components.settings.NineRouterAccountsSection.notInstalledHelp',
                'Start 9router once on the computer running Orca so it writes its machine-id and cli-secret, then click Refresh.'
              )}
            </p>
          ) : null}
        </div>
        <Button
          variant="outline"
          size="xs"
          disabled={refreshing}
          onClick={() => void handleRefresh()}
          className="shrink-0"
        >
          {refreshing ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          {translate('auto.components.settings.NineRouterAccountsSection.refresh', 'Refresh')}
        </Button>
      </div>

      <SearchableSetting
        title={trackingLabel}
        description={translate(
          'auto.components.settings.NineRouterAccountsSection.trackingDescription',
          'Read usage, cost and model quota from 9router for Stats & Usage and the status bar.'
        )}
        keywords={SEARCH_KEYWORDS}
        className="flex items-center justify-between gap-4 py-2"
      >
        <div className="space-y-0.5">
          <Label>{trackingLabel}</Label>
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.settings.NineRouterAccountsSection.trackingHelp',
              'Same switch as the 9router tab in Stats & Usage.'
            )}
          </p>
        </div>
        <Switch
          aria-label={trackingLabel}
          checked={trackingEnabled}
          disabled={!scanState}
          onCheckedChange={(checked) => {
            recordFeatureInteraction('usage-tracking')
            void setNineRouterUsageEnabled(checked)
          }}
        />
      </SearchableSetting>

      <SearchableSetting
        title={translate(
          'auto.components.settings.NineRouterAccountsSection.statusBarTitle',
          'Show in status bar'
        )}
        description={translate(
          'auto.components.settings.NineRouterAccountsSection.statusBarDescription',
          'Show quota for the models 9router routed in the last 24 hours.'
        )}
        keywords={SEARCH_KEYWORDS}
        className="flex items-center justify-between gap-4 py-2"
      >
        <div className="space-y-0.5">
          <Label>
            {translate(
              'auto.components.settings.NineRouterAccountsSection.statusBarTitle',
              'Show in status bar'
            )}
          </Label>
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.settings.NineRouterAccountsSection.statusBarDescription',
              'Show quota for the models 9router routed in the last 24 hours.'
            )}
          </p>
        </div>
        <Switch
          aria-label={translate(
            'auto.components.settings.NineRouterAccountsSection.statusBarTitle',
            'Show in status bar'
          )}
          checked={statusBarVisible}
          onCheckedChange={() => toggleStatusBarItem('ninerouter')}
        />
      </SearchableSetting>

      {trackingEnabled && statusBarVisible && buckets.length > 0 ? (
        <SearchableSetting
          title={translate(
            'auto.components.settings.NineRouterAccountsSection.quotaTitle',
            'Model quota'
          )}
          description={translate(
            'auto.components.settings.NineRouterAccountsSection.quotaDescription',
            'Quota used for each model, read from the account 9router would pick next.'
          )}
          keywords={SEARCH_KEYWORDS}
        >
          <div className="space-y-1">
            {buckets.map((bucket) => (
              <NineRouterModelQuotaRow key={bucket.name} bucket={bucket} now={now} />
            ))}
          </div>
        </SearchableSetting>
      ) : null}

      {status && status.connections.length > 0 ? (
        <SearchableSetting
          title={translate(
            'auto.components.settings.NineRouterAccountsSection.accountsTitle',
            'Routed accounts'
          )}
          description={translate(
            'auto.components.settings.NineRouterAccountsSection.accountsDescription',
            'Upstream accounts 9router routes through. Manage them in the 9router dashboard.'
          )}
          keywords={SEARCH_KEYWORDS}
        >
          <div className="space-y-1">
            {status.connections.map((connection) => (
              <NineRouterConnectionRow key={connection.id} connection={connection} now={now} />
            ))}
          </div>
        </SearchableSetting>
      ) : null}
    </section>
  )
}
