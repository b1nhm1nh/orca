import { matchesSettingsSearch } from './settings-search'
import {
  getAccountsNineRouterSearchEntries,
  getAccountsZcodePlanSearchEntries
} from './accounts-gateway-search'
import { ZcodePlanAccountsSection } from './ZcodePlanAccountsSection'
import { NineRouterAccountsSection } from './NineRouterAccountsSection'

/** Key-or-gateway usage sources that need no per-runtime account roster. */
export function renderGatewayAccountsSections(searchQuery: string): (React.JSX.Element | null)[] {
  return [
    matchesSettingsSearch(searchQuery, getAccountsZcodePlanSearchEntries()) ? (
      <ZcodePlanAccountsSection key="zcode" />
    ) : null,
    matchesSettingsSearch(searchQuery, getAccountsNineRouterSearchEntries()) ? (
      <NineRouterAccountsSection key="ninerouter" />
    ) : null
  ]
}
