import { suggestionId } from "./heuristics"
import type { GroupColor, TabInfo } from "./types"

export interface ReconcilableSuggestion {
  id: string
  name: string
  color: GroupColor
  tabIds: number[]
  tabs: TabInfo[]
  excludedTabIds?: number[]
}

export interface ReconcileOptions {
  minGroupSize: number
  maxGroupSize: number | null
  maxGroups: number | null
  excludeIds?: Set<string>
}

const withTabs = <TSuggestion extends ReconcilableSuggestion>(suggestion: TSuggestion, tabs: TabInfo[]): TSuggestion => ({
  ...suggestion,
  tabIds: tabs.map((tab) => tab.id),
  tabs
})

export const reconcile = <TSuggestion extends ReconcilableSuggestion>(
  previous: TSuggestion[],
  fresh: TSuggestion[],
  availableTabs: TabInfo[],
  options: ReconcileOptions
): TSuggestion[] => {
  const tabsById = new Map(availableTabs.map((tab) => [tab.id, tab]))
  const assigned = new Set<number>()
  const kept: TSuggestion[] = []
  const excluded = options.excludeIds ?? new Set<string>()

  for (const suggestion of previous) {
    if (excluded.has(suggestion.id)) continue
    const removed = new Set(suggestion.excludedTabIds)
    const tabs = suggestion.tabIds
      .filter((id) => !assigned.has(id) && !removed.has(id))
      .map((id) => tabsById.get(id))
      .filter((tab): tab is TabInfo => !!tab)
    if (tabs.length < options.minGroupSize) continue
    tabs.forEach((tab) => assigned.add(tab.id))
    kept.push(withTabs(suggestion, tabs))
  }

  const capacity = (suggestion: TSuggestion) =>
    options.maxGroupSize ? Math.max(0, options.maxGroupSize - suggestion.tabIds.length) : Infinity

  for (const suggestion of fresh) {
    const unassigned = suggestion.tabIds
      .filter((id) => !assigned.has(id))
      .map((id) => tabsById.get(id))
      .filter((tab): tab is TabInfo => !!tab)
    if (!unassigned.length) continue

    const freshIds = new Set(suggestion.tabIds)
    let bestIndex = -1
    let bestOverlap = 0
    kept.forEach((candidate, index) => {
      if (capacity(candidate) === 0) return
      const overlap = candidate.tabIds.filter((id) => freshIds.has(id)).length
      if (overlap > bestOverlap) {
        bestOverlap = overlap
        bestIndex = index
      }
    })

    let remaining = unassigned
    if (bestIndex !== -1) {
      const target = kept[bestIndex]
      // Tabs the user removed from the target stay out of it and don't seed a new group from the same fresh suggestion
      const removed = new Set(target.excludedTabIds)
      const eligible = remaining.filter((tab) => !removed.has(tab.id))
      const moving = eligible.slice(0, capacity(target))
      remaining = eligible.slice(moving.length)
      moving.forEach((tab) => assigned.add(tab.id))
      kept[bestIndex] = withTabs(target, [...target.tabs, ...moving])
    }

    if (remaining.length < options.minGroupSize) continue
    const limited = options.maxGroupSize ? remaining.slice(0, options.maxGroupSize) : remaining
    const id = suggestionId(limited.map((tab) => tab.id))
    if (excluded.has(id)) continue
    limited.forEach((tab) => assigned.add(tab.id))
    kept.push({ ...withTabs(suggestion, limited), id })
  }

  if (!options.maxGroups) return kept
  return kept.slice(0, options.maxGroups)
}
