import { useCallback, useEffect, useRef, useState } from "react"

import type { GroupColor } from "~src/core/types"

export type LiveTab = chrome.tabs.Tab & { id: number }

export interface LiveGroup {
  id: number
  title: string
  color: GroupColor
  tabs: LiveTab[]
}

interface WindowData {
  windowId: number | null
  tabs: LiveTab[]
  groups: LiveGroup[]
  loaded: boolean
}

const REFRESH_DELAY = 300

const ownPagePrefix = () => chrome.runtime.getURL("")

const loadWindowData = async (): Promise<WindowData> => {
  const window = await chrome.windows.getLastFocused({ windowTypes: ["normal"] }).catch(() => null)
  if (!window?.id) return { windowId: null, tabs: [], groups: [], loaded: true }
  const [rawTabs, rawGroups] = await Promise.all([
    chrome.tabs.query({ windowId: window.id }),
    chrome.tabGroups.query({ windowId: window.id })
  ])
  const prefix = ownPagePrefix()
  const tabs = rawTabs.filter(
    (tab): tab is LiveTab => tab.id !== undefined && !tab.pinned && !(tab.url ?? "").startsWith(prefix)
  )
  const groups = rawGroups
    .map((group) => ({
      id: group.id,
      title: group.title ?? "",
      color: group.color as GroupColor,
      tabs: tabs.filter((tab) => tab.groupId === group.id)
    }))
    .sort((a, b) => (a.tabs[0]?.index ?? 0) - (b.tabs[0]?.index ?? 0))
  return { windowId: window.id, tabs, groups, loaded: true }
}

export const useWindowData = () => {
  const [data, setData] = useState<WindowData>({ windowId: null, tabs: [], groups: [], loaded: false })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    setData(await loadWindowData())
  }, [])

  useEffect(() => {
    void refresh()
    const schedule = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void refresh(), REFRESH_DELAY)
    }
    const events = [
      chrome.tabs.onCreated,
      chrome.tabs.onRemoved,
      chrome.tabs.onUpdated,
      chrome.tabs.onMoved,
      chrome.tabs.onActivated,
      chrome.tabs.onAttached,
      chrome.tabs.onDetached,
      chrome.tabGroups.onCreated,
      chrome.tabGroups.onUpdated,
      chrome.tabGroups.onRemoved,
      chrome.tabGroups.onMoved
    ] as unknown as chrome.events.Event<() => void>[]
    events.forEach((event) => event.addListener(schedule))
    return () => {
      events.forEach((event) => event.removeListener(schedule))
      if (timer.current) clearTimeout(timer.current)
    }
  }, [refresh])

  return { ...data, refresh }
}
