import { ipcRenderer } from 'electron'
import { createUsageProviderApi } from '../usage-provider-api'
import type { PreloadApi } from '../api-types'

export const nineRouterUsageApi = createUsageProviderApi(
  ipcRenderer,
  'nineRouterUsage'
) satisfies PreloadApi['nineRouterUsage']
