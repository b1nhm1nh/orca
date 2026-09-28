import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const SHOW_HOST_IN_WORKSPACE_TITLES_KEY = 'orca:showHostInWorkspaceTitles'

let current = false
let loaded: Promise<boolean> | null = null
const listeners = new Set<(show: boolean) => void>()

function publish(show: boolean): void {
  current = show
  for (const listener of listeners) {
    listener(show)
  }
}

export function loadShowHostInWorkspaceTitles(): Promise<boolean> {
  loaded ??= AsyncStorage.getItem(SHOW_HOST_IN_WORKSPACE_TITLES_KEY)
    .then((raw) => raw === 'true')
    .catch(() => false)
    .then((show) => {
      publish(show)
      return show
    })
  return loaded
}

export async function saveShowHostInWorkspaceTitles(show: boolean): Promise<void> {
  loaded = Promise.resolve(show)
  publish(show)
  await AsyncStorage.setItem(SHOW_HOST_IN_WORKSPACE_TITLES_KEY, String(show))
}

/** Re-reads storage, for after an import rewrote it underneath this cache. */
export function reloadShowHostInWorkspaceTitles(): Promise<boolean> {
  loaded = null
  return loadShowHostInWorkspaceTitles()
}

export function useShowHostInWorkspaceTitles(): boolean {
  const [show, setShow] = useState(current)
  useEffect(() => {
    listeners.add(setShow)
    void loadShowHostInWorkspaceTitles().then(setShow)
    return () => {
      listeners.delete(setShow)
    }
  }, [])
  return show
}

/** `Host: project` when enabled and the host is known; otherwise the project alone. */
export function hostWorkspaceLabel(
  show: boolean,
  hostName: string | null | undefined,
  workspaceName: string
): string {
  return show && hostName ? `${hostName}: ${workspaceName}` : workspaceName
}

export function resetHostWorkspaceLabelForTest(): void {
  current = false
  loaded = null
  listeners.clear()
}
