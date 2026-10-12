import { ipcMain } from 'electron'
import { getNineRouterGatewayStatus } from '../ninerouter-usage/ninerouter-gateway-status'

export function registerNineRouterAccountHandlers(): void {
  ipcMain.handle('nineRouterAccounts:getStatus', () => getNineRouterGatewayStatus())
}
