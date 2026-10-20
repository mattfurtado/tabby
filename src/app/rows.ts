import type { CleanupSuggestion } from "~core/types"
import { isHttpUrl, stripHash } from "~core/url"

import type { LiveGroup, LiveTab } from "./hooks/useWindowData"

export type BadgeKind = "pr-merged" | "pr-closed" | "duplicate" | "zoom" | "newtab" | "search" | "stale"

export const BADGE_ORDER: BadgeKind[] = ["pr-merged", "pr-closed", "duplicate", "zoom", "newtab", "search", "stale"]

export const BADGE_LABELS: Record<BadgeKind, string> = {
  "pr-merged": "Merged PR",
  "pr-closed": "Closed PR",
  duplicate: "Duplicate",
  zoom: "Zoom",
  newtab: "New tab",
  search: "Google search",
  stale: "Stale"
}

export interface TabRow {
  key: string
  tabs: LiveTab[]
  title: string
  url: string
  favIconUrl?: string
  group: LiveGroup | null
  kinds: BadgeKind[]
  kindCounts: Partial<Record<BadgeKind, number>>
  staleSince: number | null
  active: boolean
  lastAccessed: number
}

const badgeKind = (suggestion: CleanupSuggestion): BadgeKind => {
  if (suggestion.source === "pr") return suggestion.prState === "merged" ? "pr-merged" : "pr-closed"
  return suggestion.source
}

const suggestionTabIds = (suggestion: CleanupSuggestion) =>
  suggestion.source === "pr" ? suggestion.tabIds : [suggestion.tabId]

export const buildRows = (tabs: LiveTab[], groups: LiveGroup[], suggestions: CleanupSuggestion[]): TabRow[] => {
  const kindsByTab = new Map<number, Set<BadgeKind>>()
  const staleByTab = new Map<number, number>()
  for (const suggestion of suggestions) {
    for (const tabId of suggestionTabIds(suggestion)) {
      const kinds = kindsByTab.get(tabId) ?? new Set<BadgeKind>()
      kinds.add(badgeKind(suggestion))
      kindsByTab.set(tabId, kinds)
      if (suggestion.source === "stale") staleByTab.set(tabId, suggestion.lastAccessed)
    }
  }

  const groupsById = new Map(groups.map((group) => [group.id, group]))
  const buckets = new Map<string, LiveTab[]>()
  for (const tab of tabs) {
    const key = isHttpUrl(tab.url) ? `url:${stripHash(tab.url)}` : `tab:${tab.id}`
    buckets.set(key, [...(buckets.get(key) ?? []), tab])
  }

  const rows: TabRow[] = []
  for (const [key, bucketTabs] of buckets) {
    const [first] = bucketTabs
    const kindCounts: Partial<Record<BadgeKind, number>> = {}
    bucketTabs.forEach((tab) =>
      kindsByTab.get(tab.id)?.forEach((kind) => {
        kindCounts[kind] = (kindCounts[kind] ?? 0) + 1
      })
    )
    const staleTimes = bucketTabs.map((tab) => staleByTab.get(tab.id)).filter((time): time is number => !!time)
    rows.push({
      key: bucketTabs.length > 1 ? key : `tab:${first.id}`,
      tabs: bucketTabs,
      title: first.title || first.url || "Untitled",
      url: first.url ?? first.pendingUrl ?? "",
      favIconUrl: first.favIconUrl,
      group: groupsById.get(first.groupId) ?? null,
      kinds: BADGE_ORDER.filter((kind) => kindCounts[kind]),
      kindCounts,
      staleSince: staleTimes.length ? Math.min(...staleTimes) : null,
      active: bucketTabs.some((tab) => tab.active),
      lastAccessed: Math.min(...bucketTabs.map((tab) => tab.lastAccessed ?? Date.now()))
    })
  }

  const priority = (row: TabRow) => {
    if (row.kinds.length) return BADGE_ORDER.indexOf(row.kinds[0])
    return row.active ? BADGE_ORDER.length : BADGE_ORDER.length + 1
  }
  return rows.sort((a, b) => priority(a) - priority(b) || a.lastAccessed - b.lastAccessed)
}

export const rowTabIds = (rows: TabRow[]) => rows.flatMap((row) => row.tabs.map((tab) => tab.id))

export const formatAge = (since: number, now = Date.now()) => {
  const minutes = Math.max(1, Math.floor((now - since) / 60_000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}
