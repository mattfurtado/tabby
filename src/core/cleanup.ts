import type {
  DuplicateSuggestion,
  NewTabSuggestion,
  PRState,
  PRSuggestion,
  SearchSuggestion,
  Settings,
  StaleSuggestion,
  ZoomSuggestion
} from "./types"
import { canonicalPRUrl, isGoogleSearchUrl, isHttpUrl, isNewTabUrl, stripHash, ZOOM_PATTERN } from "./url"

type Tab = chrome.tabs.Tab & { id: number }

const base = (tab: Tab, prefix: string) => ({
  id: `${prefix}_${tab.id}`,
  tabId: tab.id,
  tabUrl: tab.url ?? tab.pendingUrl ?? "",
  title: tab.title || tab.url || "Untitled",
  favIconUrl: tab.favIconUrl
})

const UNIT_MS = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 }

export const staleThresholdMs = (threshold: Settings["staleThreshold"]) => threshold.value * UNIT_MS[threshold.unit]

export const staleKey = (tabId: number, lastAccessed: number) => `${tabId}:${lastAccessed}`

export const findPRTabs = (tabs: Tab[]) => {
  const byUrl = new Map<string, Tab[]>()
  for (const tab of tabs) {
    if (!isHttpUrl(tab.url)) continue
    const canonical = canonicalPRUrl(tab.url)
    if (!canonical) continue
    byUrl.set(canonical, [...(byUrl.get(canonical) ?? []), tab])
  }
  return byUrl
}

export const prSuggestions = (
  prTabs: Map<string, Tab[]>,
  states: Record<string, PRState>,
  dismissedUrls: string[]
): PRSuggestion[] => {
  const dismissed = new Set(dismissedUrls)
  const result: PRSuggestion[] = []
  for (const [url, tabs] of prTabs) {
    const prState = states[url]
    if (!prState || dismissed.has(url)) continue
    result.push({ ...base(tabs[0], "pr"), source: "pr", tabIds: tabs.map((tab) => tab.id), prState })
  }
  return result
}

export const duplicateSuggestions = (tabs: Tab[]): DuplicateSuggestion[] => {
  const seen = new Set<string>()
  const result: DuplicateSuggestion[] = []
  for (const tab of tabs) {
    if (!isHttpUrl(tab.url)) continue
    const key = stripHash(tab.url)
    if (!seen.has(key)) {
      seen.add(key)
      continue
    }
    result.push({ ...base(tab, "dup"), source: "duplicate" })
  }
  return result
}

export const zoomSuggestions = (tabs: Tab[]): ZoomSuggestion[] =>
  tabs
    .filter((tab) => isHttpUrl(tab.url) && ZOOM_PATTERN.test(tab.url))
    .map((tab) => ({ ...base(tab, "zoom"), source: "zoom" }))

export const newTabSuggestions = (tabs: Tab[]): NewTabSuggestion[] =>
  tabs
    .filter((tab) => !tab.active && isNewTabUrl(tab.url || tab.pendingUrl))
    .map((tab) => ({ ...base(tab, "newtab"), source: "newtab" }))

export const searchSuggestions = (tabs: Tab[]): SearchSuggestion[] =>
  tabs
    .filter((tab) => isGoogleSearchUrl(tab.url))
    .map((tab) => ({ ...base(tab, "search"), source: "search" }))

export const staleSuggestions = (
  tabs: Tab[],
  threshold: Settings["staleThreshold"],
  flagged: Set<number>,
  dismissed: string[],
  now = Date.now()
): StaleSuggestion[] => {
  const cutoff = now - staleThresholdMs(threshold)
  const dismissedKeys = new Set(dismissed)
  const result: StaleSuggestion[] = []
  for (const tab of tabs) {
    const lastAccessed = tab.lastAccessed
    if (tab.active || !lastAccessed || lastAccessed > cutoff) continue
    if (flagged.has(tab.id) || dismissedKeys.has(staleKey(tab.id, lastAccessed))) continue
    result.push({ ...base(tab, "stale"), source: "stale", lastAccessed })
  }
  return result
}
