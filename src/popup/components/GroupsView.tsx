import { Layers, Search } from "lucide-react"
import { useMemo } from "react"

import type { AddToGroupAction, GroupAction, GroupSuggestion, MergeGroupsAction, TabInfo } from "~src/core/types"

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
  canSuggestName: boolean
  customInstructions: string
  loaded: boolean
}

const liveTabInfo = (tab: LiveTab): TabInfo => ({
  id: tab.id,
  title: tab.title || tab.url || "Untitled",
  url: tab.url ?? "",
  favIconUrl: tab.favIconUrl
})

export const GroupsView = ({
  tabs,
  groups,
  suggestions,
  actions,
  canSuggestName,
  customInstructions,
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

  if (loaded && !groups.length && !suggestionEntries.length && !searching) {
    return (
      <div className="flex h-full flex-col">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 px-4 py-2 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
          <SearchBox placeholder="Search tabs in groups" />
        </div>
        <EmptyState icon={<Layers className="h-10 w-10" />} title="No groups yet">
          Open a few related tabs and Tabby will suggest groups. Click Refresh to check again.
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
                canSuggestName={canSuggestName}
                customInstructions={customInstructions}
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
