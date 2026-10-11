import { ipcRenderer } from 'electron'
import type { NineRouterGatewayStatus } from '../../shared/ninerouter-usage-types'
import type { PreloadApi } from '../api-types'

export const nineRouterAccountsApi = {
  getStatus: (): Promise<NineRouterGatewayStatus> =>
    ipcRenderer.invoke('nineRouterAccounts:getStatus')
} satisfies PreloadApi['nineRouterAccounts']
