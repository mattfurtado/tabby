import { useMemo } from "react"

import { sendMessage } from "~src/core/messages"
import { computeGroupActions } from "~src/core/group-actions"
import type { TabInfo } from "~src/core/types"
import { isHttpUrl } from "~src/core/url"

import { Footer, Header, Sidebar } from "./components/Layout"
import { GroupsView } from "./components/GroupsView"
import { NewGroupPanel } from "./components/NewGroupPanel"
import { aiProblem } from "./components/RefreshStatus"
import { TabsView } from "./components/TabsView"
import { cx } from "./components/ui"
import { useCleanupSuggestions } from "./hooks/useCleanupSuggestions"
import { useAppearance, useColorScheme } from "./hooks/useColorScheme"
import { useStorageValue } from "./hooks/useStorageValue"
import { useTabsModel } from "./hooks/useTabsModel"
import { useWindowData, type LiveTab } from "./hooks/useWindowData"
import { usePopupStore } from "./store"

const toInfo = (tab: LiveTab): TabInfo => ({
  id: tab.id,
  title: tab.title || tab.url || "Untitled",
  url: tab.url ?? "",
  favIconUrl: tab.favIconUrl
})

export const App = () => {
  const inTab = useMemo(() => new URLSearchParams(location.search).get("view") === "tab", [])
  const view = usePopupStore((state) => state.view)
  const creatingGroup = usePopupStore((state) => state.creatingGroup)
  const { tabs, groups, loaded, refresh: refreshWindow } = useWindowData()
  const settings = useStorageValue("settings")
  useColorScheme(useAppearance())
  const heuristic = useStorageValue("heuristic_suggestions")
  const ai = useStorageValue("ai_suggestions")
  const cleanup = useCleanupSuggestions()
  const analysisStatus = useStorageValue("analysis_status")
  const tabsModel = useTabsModel(tabs, groups, cleanup)

  const suggestions = ai.length ? ai : heuristic
  const actions = useMemo(() => {
    const ungrouped = tabs
      .filter((tab) => isHttpUrl(tab.url) && tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE)
      .map(toInfo)
    const snapshots = groups.map((group) => ({ ...group, tabs: group.tabs.map(toInfo) }))
    return computeGroupActions(snapshots, ungrouped, new Set(settings.dismissedSuggestions))
  }, [tabs, groups, settings.dismissedSuggestions])

  const liveIds = useMemo(
    () => new Set(tabs.filter((tab) => tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE).map((tab) => tab.id)),
    [tabs]
  )
  const liveSuggestionCount = suggestions.filter((item) => item.tabIds.some((id) => liveIds.has(id))).length

  const refresh = async () => {
    const result = await sendMessage({ type: "REFRESH_SUGGESTIONS" })
    await refreshWindow()
    return result.ok ? null : (result.error ?? "Unknown error")
  }

  return (
    <div
      className={cx(
        "flex flex-col overflow-hidden bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100",
        inTab ? "mx-auto h-screen max-w-4xl border-x border-gray-200 dark:border-gray-800" : "h-[580px] w-[680px]"
      )}>
      <Header inTab={inTab} />
      <div className="flex min-h-0 flex-1">
        <Sidebar counts={{ groups: liveSuggestionCount + actions.length, tabs: tabsModel.flaggedTabCount }} />
        <main className="relative min-w-0 flex-1 overflow-y-auto">
          {view === "groups" ? (
            <GroupsView
              tabs={tabs}
              groups={groups}
              suggestions={suggestions}
              actions={actions}
              aiProblem={settings.useAI ? aiProblem(analysisStatus.ai) : null}
              useAI={settings.useAI}
              minGroupSize={settings.minGroupSize}
              loaded={loaded}
            />
          ) : (
            <TabsView model={tabsModel} groups={groups} loaded={loaded} />
          )}
          {creatingGroup && <NewGroupPanel key={creatingGroup.tabIds.join(",")} tabs={tabs} groups={groups} />}
        </main>
      </div>
      <Footer onRefresh={refresh} selectedRows={tabsModel.selectedRows} useAI={settings.useAI} />
    </div>
  )
}
