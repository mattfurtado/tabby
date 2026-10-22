import { runAnalysis, toTabInfo, trackOpenView, updateBadge } from "~core/analysis"
import { removedTabId } from "~core/group-actions"
import { UI_PORT_NAME, type Message, type MessageResponse } from "~core/messages"
import { CLEANUP_KEYS, getItem, getSettings, setItem, updateSettings } from "~core/storage"
import type { AnalysisStatus, CleanupSuggestion, GroupSuggestion, Settings } from "~core/types"
import { canonicalPRUrl } from "~core/url"

const ANALYSIS_DELAY = 1500
const REMOVAL_BATCH_DELAY = 50

let analysisTimer: ReturnType<typeof setTimeout> | null = null
let running: Promise<AnalysisStatus | null> | null = null
let rerunRequested = false

const analyzeNow = async (): Promise<AnalysisStatus | null> => {
  if (running) {
    rerunRequested = true
    return running
  }
  running = (async () => {
    let status: AnalysisStatus | null = null
    try {
      do {
        rerunRequested = false
        status = await runAnalysis()
      } while (rerunRequested)
    } catch (error) {
      console.error("[Tabby] analysis failed", error)
    } finally {
      running = null
    }
    return status
  })()
  return running
}

const scheduleAnalysis = () => {
  if (analysisTimer) clearTimeout(analysisTimer)
  analysisTimer = setTimeout(() => {
    analysisTimer = null
    void analyzeNow()
  }, ANALYSIS_DELAY)
}

const GROUP_KEYS = ["heuristic_suggestions", "ai_suggestions"] as const

const updateGroupSuggestions = async (update: (list: GroupSuggestion[]) => GroupSuggestion[]) => {
  for (const key of GROUP_KEYS) {
    const list = await getItem(key)
    const next = update(list)
    if (next !== list) await setItem(key, next)
  }
}

const removeCleanupEntries = async (predicate: (item: CleanupSuggestion) => boolean) => {
  const values = await chrome.storage.local.get([...CLEANUP_KEYS])
  const changes: Record<string, CleanupSuggestion[]> = {}
  for (const key of CLEANUP_KEYS) {
    const list = (values[key] ?? []) as CleanupSuggestion[]
    const next = list.filter((item) => !predicate(item))
    if (next.length !== list.length) changes[key] = next
  }
  if (Object.keys(changes).length) await chrome.storage.local.set(changes)
}

const touchesTabs = (item: CleanupSuggestion, tabIds: Set<number>) =>
  tabIds.has(item.tabId) || (item.source === "pr" && item.tabIds.some((id) => tabIds.has(id)))

// Removal records hold session-scoped tab ids, so drop them once the tab is gone or the browser restarts
const forgetRemovals = async (shouldForget: (tabId: number) => boolean) => {
  const { dismissedSuggestions } = await getSettings()
  const next = dismissedSuggestions.filter((id) => {
    const tabId = removedTabId(id)
    return tabId === null || !shouldForget(tabId)
  })
  if (next.length !== dismissedSuggestions.length) await updateSettings({ dismissedSuggestions: next })
}

const pruneTabs = async (tabIds: Set<number>) => {
  await forgetRemovals((tabId) => tabIds.has(tabId))
  const { minGroupSize } = await getSettings()
  await updateGroupSuggestions((list) => {
    let changed = false
    const next = list.flatMap((suggestion) => {
      if (!suggestion.tabIds.some((id) => tabIds.has(id))) return [suggestion]
      changed = true
      const tabs = suggestion.tabs.filter((tab) => !tabIds.has(tab.id))
      if (tabs.length < minGroupSize) return []
      return [{ ...suggestion, tabs, tabIds: tabs.map((tab) => tab.id) }]
    })
    return changed ? next : list
  })
  await removeCleanupEntries((item) => touchesTabs(item, tabIds))
  await updateBadge()
}

const dismissIds = async (ids: string[]) => {
  const settings = await getSettings()
  const dismissed = [...new Set([...settings.dismissedSuggestions, ...ids])]
  await updateSettings({ dismissedSuggestions: dismissed })
  const idSet = new Set(ids)
  await updateGroupSuggestions((list) => {
    const next = list.filter((item) => !idSet.has(item.id))
    return next.length === list.length ? list : next
  })
  await removeCleanupEntries((item) => idSet.has(item.id))
  await updateBadge()
  scheduleAnalysis()
}

const existingTabIds = async (tabIds: number[]) => {
  const tabs = await Promise.all(tabIds.map((id) => chrome.tabs.get(id).catch(() => null)))
  return tabs.filter((tab): tab is chrome.tabs.Tab & { id: number } => !!tab?.id).map((tab) => tab.id)
}

const handlers: { [TType in Message["type"]]: (message: Extract<Message, { type: TType }>) => Promise<MessageResponse> } = {
  REFRESH_SUGGESTIONS: async () => {
    const status = await analyzeNow()
    return { ok: !!status, status, error: status ? undefined : "Analysis failed" }
  },
  APPLY_SUGGESTION: async ({ tabIds, name, color, suggestionId }) => {
    const valid = await existingTabIds(tabIds)
    if (valid.length < 2) return { ok: false, error: "At least 2 open tabs are needed to create a group" }
    const groupId = await chrome.tabs.group({ tabIds: valid as [number, ...number[]] })
    await chrome.tabGroups.update(groupId, { title: name, color })
    const applied = new Set(valid)
    await updateGroupSuggestions((list) => {
      const next = list.filter((item) => item.id !== suggestionId && !item.tabIds.every((id) => applied.has(id)))
      return next.length === list.length ? list : next
    })
    await pruneTabs(applied)
    scheduleAnalysis()
    return { ok: true, groupId }
  },
  RENAME_SUGGESTION: async ({ suggestionId, name, color }) => {
    const trimmed = name.trim().slice(0, 50)
    if (!trimmed) return { ok: false, error: "Name cannot be empty" }
    await updateGroupSuggestions((list) => {
      if (!list.some((item) => item.id === suggestionId)) return list
      return list.map((item) => (item.id === suggestionId ? { ...item, name: trimmed, color: color ?? item.color } : item))
    })
    return { ok: true }
  },
  REMOVE_FROM_SUGGESTION: async ({ suggestionId, tabId }) => {
    const { minGroupSize } = await getSettings()
    let tooSmall = false
    await updateGroupSuggestions((list) => {
      if (!list.some((item) => item.id === suggestionId)) return list
      return list.map((item) => {
        if (item.id !== suggestionId) return item
        const tabs = item.tabs.filter((tab) => tab.id !== tabId)
        if (tabs.length < minGroupSize) tooSmall = true
        return { ...item, tabs, tabIds: tabs.map((tab) => tab.id), excludedTabIds: [...new Set([...(item.excludedTabIds ?? []), tabId])] }
      })
    })
    if (tooSmall) await dismissIds([suggestionId])
    return { ok: true }
  },
  ADD_TO_SUGGESTION: async ({ suggestionId, tabId }) => {
    const tab = await chrome.tabs.get(tabId).catch(() => null)
    if (!tab) return { ok: false, error: "That tab is no longer open" }
    const info = toTabInfo(tab)
    await forgetRemovals((id) => id === tabId)
    const { minGroupSize } = await getSettings()
    await updateGroupSuggestions((list) => {
      if (!list.some((item) => item.id === suggestionId)) return list
      // A tab belongs to one suggestion at a time, so take it out of any other
      return list.flatMap((item) => {
        if (item.id === suggestionId) {
          if (item.tabIds.includes(tabId)) return [item]
          const tabs = [...item.tabs, info]
          const excludedTabIds = item.excludedTabIds?.filter((id) => id !== tabId)
          return [{ ...item, tabs, tabIds: tabs.map((entry) => entry.id), excludedTabIds }]
        }
        if (!item.tabIds.includes(tabId)) return [item]
        const tabs = item.tabs.filter((entry) => entry.id !== tabId)
        return tabs.length < minGroupSize ? [] : [{ ...item, tabs, tabIds: tabs.map((entry) => entry.id) }]
      })
    })
    await updateBadge()
    return { ok: true }
  },
  ADD_TO_GROUP: async ({ groupId, tabIds }) => {
    const valid = await existingTabIds(tabIds)
    if (!valid.length) return { ok: false, error: "That tab is no longer open" }
    await chrome.tabs.group({ groupId, tabIds: valid as [number, ...number[]] })
    const added = new Set(valid)
    await forgetRemovals((id) => added.has(id))
    return { ok: true }
  },
  CLOSE_TAB: async ({ tabId }) => {
    await chrome.tabs.remove(tabId).catch(() => undefined)
    await pruneTabs(new Set([tabId]))
    return { ok: true }
  },
  CLOSE_BULK: async ({ items }) => {
    const tabIds = [...new Set(items.flatMap((item) => item.tabIds))]
    const ids = new Set(items.map((item) => item.id))
    await chrome.tabs.remove(tabIds).catch(async () => {
      await Promise.all(tabIds.map((id) => chrome.tabs.remove(id).catch(() => undefined)))
    })
    const closed = new Set(tabIds)
    await removeCleanupEntries((item) => ids.has(item.id) || touchesTabs(item, closed))
    await pruneTabs(closed)
    return { ok: true }
  },
  DISMISS_SUGGESTION: async ({ suggestionId }) => {
    await dismissIds([suggestionId])
    return { ok: true }
  },
  DISMISS_BULK: async ({ suggestionIds }) => {
    await dismissIds(suggestionIds)
    return { ok: true }
  },
  DISMISS_PR_TAB: async ({ url }) => {
    const canonical = canonicalPRUrl(url) ?? url
    const settings = await getSettings()
    await updateSettings({ dismissedPRUrls: [...new Set([...settings.dismissedPRUrls, canonical])] })
    await setItem("pr_suggestions", (await getItem("pr_suggestions")).filter((item) => canonicalPRUrl(item.tabUrl) !== canonical))
    await updateBadge()
    return { ok: true }
  },
  DISMISS_STALE_TAB: async ({ tabId, lastAccessed }) => {
    const dismissed = await getItem("dismissed_stale")
    await setItem("dismissed_stale", [...new Set([...dismissed, `${tabId}:${lastAccessed}`])])
    await setItem("stale_suggestions", (await getItem("stale_suggestions")).filter((item) => item.tabId !== tabId))
    await updateBadge()
    return { ok: true }
  },
  DISMISS_DUPLICATE_TAB: async ({ suggestionId }) => {
    await dismissIds([suggestionId])
    return { ok: true }
  }
}

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  const handler = handlers[message?.type] as ((message: Message) => Promise<MessageResponse>) | undefined
  if (!handler) return false
  handler(message)
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  return true
})

let removedBatch = new Set<number>()
let removedTimer: ReturnType<typeof setTimeout> | null = null

chrome.tabs.onRemoved.addListener((tabId) => {
  removedBatch.add(tabId)
  if (!removedTimer) {
    removedTimer = setTimeout(() => {
      const batch = removedBatch
      removedBatch = new Set()
      removedTimer = null
      void pruneTabs(batch)
    }, REMOVAL_BATCH_DELAY)
  }
  scheduleAnalysis()
})

chrome.tabs.onCreated.addListener(scheduleAnalysis)
chrome.tabs.onMoved.addListener(scheduleAnalysis)
chrome.tabs.onActivated.addListener(scheduleAnalysis)
chrome.tabs.onAttached.addListener(scheduleAnalysis)
chrome.tabs.onDetached.addListener(scheduleAnalysis)
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === "complete" || changeInfo.groupId !== undefined || changeInfo.pinned !== undefined) {
    scheduleAnalysis()
  }
})
chrome.tabGroups.onUpdated.addListener(scheduleAnalysis)
chrome.tabGroups.onRemoved.addListener(scheduleAnalysis)
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) scheduleAnalysis()
})

const ANALYSIS_SETTINGS: (keyof Settings)[] = [
  "staleThreshold",
  "cleanupChecks",
  "customInstructions",
  "useAI",
  "minGroupSize",
  "maxGroupSize",
  "maxGroups"
]

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return
  if (changes.pr_states) scheduleAnalysis()
  const settingsChange = changes.settings
  if (!settingsChange) return
  const before = (settingsChange.oldValue ?? {}) as Partial<Settings>
  const after = (settingsChange.newValue ?? {}) as Partial<Settings>
  const changed = ANALYSIS_SETTINGS.some((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
  if (changed) scheduleAnalysis()
  if (before.toolbarIndicator !== after.toolbarIndicator) void updateBadge()
})

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === UI_PORT_NAME) trackOpenView(port)
})

chrome.runtime.onInstalled.addListener(scheduleAnalysis)
chrome.runtime.onStartup.addListener(() => {
  void forgetRemovals(() => true)
  scheduleAnalysis()
})
scheduleAnalysis()
