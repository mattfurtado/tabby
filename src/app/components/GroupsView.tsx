import { AlertTriangle, Layers, Search } from "lucide-react"
import { useMemo } from "react"

import type { AddToGroupAction, GroupAction, GroupSuggestion, MergeGroupsAction, TabInfo } from "~core/types"
import { isHttpUrl } from "~core/url"

import type { LiveGroup, LiveTab } from "../hooks/useWindowData"
import { filterBySearch, normalizeQuery } from "../search"
import { usePopupStore } from "../store"
import { ExistingGroupCard } from "./ExistingGroupCard"
import { SearchBox } from "./SearchBox"
import { SuggestionCard } from "./SuggestionCard"
import { EmptyState } from "./ui"

interface GroupsViewProps {
  tabs: LiveTab[]
  groups: LiveGroup[]
  suggestions: GroupSuggestion[]
  actions: GroupAction[]
  aiProblem: string | null
  useAI: boolean
  minGroupSize: number
  loaded: boolean
}

const liveTabInfo = (tab: LiveTab): TabInfo => ({
  id: tab.id,
  title: tab.title || tab.url || "Untitled",
  url: tab.url ?? "",
  favIconUrl: tab.favIconUrl
})

const explainNoSuggestions = (ungroupedCount: number, minGroupSize: number, useAI: boolean) => {
  if (!ungroupedCount) return "All your web tabs are already in groups."
  if (ungroupedCount < minGroupSize) {
    const tabs = ungroupedCount === 1 ? "Only 1 tab is" : `Only ${ungroupedCount} tabs are`
    return `${tabs} outside a group. Tabby needs at least ${minGroupSize} ungrouped tabs to suggest a new group.`
  }
  if (useAI) return `None of your ${ungroupedCount} ungrouped tabs fit a group.`
  return `None of your ${ungroupedCount} ungrouped tabs matched a grouping rule. Turn on AI in Settings to group them by topic.`
}

export const GroupsView = ({
  tabs,
  groups,
  suggestions,
  actions,
  aiProblem,
  useAI,
  minGroupSize,
  loaded
}: GroupsViewProps) => {
  const search = usePopupStore((state) => state.search)
  const searching = !!normalizeQuery(search)

  const liveById = useMemo(() => new Map(tabs.map((tab) => [tab.id, tab])), [tabs])

  const suggestionEntries = useMemo(
    () =>
      suggestions
        .map((suggestion) => ({
          suggestion,
          tabs: suggestion.tabIds
            .map((id) => liveById.get(id))
            .filter((tab): tab is LiveTab => !!tab && tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE)
            .map(liveTabInfo)
        }))
        .filter((entry) => entry.tabs.length > 0),
    [suggestions, liveById]
  )

  const addActions = new Map(
    actions.filter((action): action is AddToGroupAction => action.type === "add-to-group").map((action) => [action.targetGroupId, action])
  )
  const mergeActions = actions.filter((action): action is MergeGroupsAction => action.type === "merge-groups")

  const groupCards = groups
    .map((group) => ({ group, visibleTabs: filterBySearch(group.tabs, search) }))
    .filter((entry) => !searching || entry.visibleTabs.length > 0)

  const suggestionCards = suggestionEntries
    .map((entry) => ({ ...entry, visibleTabs: filterBySearch(entry.tabs, search) }))
    .filter((entry) => !searching || entry.visibleTabs.length > 0)

  const banner = aiProblem ? (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        {aiProblem}. Showing rule-based groups instead. Check the model status in Settings, then click Refresh.
      </span>
    </div>
  ) : null

  const ungroupedCount = tabs.filter((tab) => tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE && isHttpUrl(tab.url)).length
  const noSuggestionsReason = explainNoSuggestions(ungroupedCount, minGroupSize, useAI)

  const noSuggestionsNote =
    loaded && !searching && !suggestionCards.length ? (
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Suggested groups</h2>
        <p className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
          No suggestions right now. {noSuggestionsReason}
        </p>
      </section>
    ) : null

  if (loaded && !groups.length && !suggestionEntries.length && !searching) {
    return (
      <div className="flex h-full flex-col">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 px-4 py-2 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
          <SearchBox placeholder="Search tabs in groups" />
        </div>
        {banner && <div className="px-4 pt-4">{banner}</div>}
        <EmptyState icon={<Layers className="h-10 w-10" />} title="No groups yet">
          {noSuggestionsReason} Click Refresh to check again.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 px-4 py-2 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
        <SearchBox placeholder="Search tabs in groups" />
      </div>
      <div className="space-y-5 p-4">
        {banner}
        {noSuggestionsNote}
        {suggestionCards.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Suggested groups
            </h2>
            {suggestionCards.map((entry) => (
              <SuggestionCard
                key={entry.suggestion.id}
                suggestion={entry.suggestion}
                tabs={entry.tabs}
                visibleTabs={entry.visibleTabs}
                existingGroups={groups}
                otherSuggestions={suggestionEntries.filter((other) => other.suggestion.id !== entry.suggestion.id)}
                forceExpanded={searching}
              />
            ))}
          </section>
        )}
        {groupCards.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Your groups
            </h2>
            {groupCards.map(({ group, visibleTabs }) => (
              <ExistingGroupCard
                key={group.id}
                group={group}
                visibleTabs={visibleTabs}
                otherGroups={groups.filter((other) => other.id !== group.id)}
                addAction={addActions.get(group.id)}
                mergeActions={mergeActions.filter((action) => action.targetGroupId === group.id)}
                forceExpanded={searching}
              />
            ))}
          </section>
        )}
        {searching && !groupCards.length && !suggestionCards.length && (
          <EmptyState icon={<Search className="h-8 w-8" />} title="No matching tabs" />
        )}
      </div>
    </div>
  )
}
