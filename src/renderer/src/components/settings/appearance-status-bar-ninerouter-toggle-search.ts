import type { StatusBarItem } from '../../../../shared/ui-chrome-types'
import { translate } from '@/i18n/i18n'
import { translateSearchKeyword } from './settings-search-keywords'

export function getNinerouterStatusBarToggleSearchEntry(): {
  id: StatusBarItem
  title: string
  description: string
  keywords: string[]
  toggleDescription: string
} {
  return {
    id: 'ninerouter',
    title: translate(
      'auto.components.settings.appearance.search.ninerouterUsageTitle',
      '9router Usage'
    ),
    description: translate(
      'auto.components.settings.appearance.search.ninerouterUsageDescription',
      'Show quota for the models the local 9router gateway is routing in the status bar.'
    ),
    keywords: [
      ...translateSearchKeyword(
        'auto.components.settings.appearance.search.896eb53fd4',
        'status bar'
      ),
      ...translateSearchKeyword('auto.components.settings.appearance.search.ninerouter', '9router'),
      ...translateSearchKeyword('auto.components.settings.appearance.search.00a028f25f', 'usage')
    ],
    toggleDescription: translate(
      'settings.appearance.statusBar.ninerouterToggleDescription',
      'Show quota for the models 9router routed in the last 24 hours.'
    )
  }
}
