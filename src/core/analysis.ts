import { aiSuggestions } from "./ai"
import {
  duplicateSuggestions,
  findPRTabs,
  newTabSuggestions,
  prSuggestions,
  searchSuggestions,
  staleSuggestions,
  zoomSuggestions
} from "./cleanup"
import { computeGroupActions, removedTabIds, type GroupSnapshot } from "./group-actions"
import { countFlaggedTabs, countLiveGroupSuggestions } from "./counts"
import { heuristicSuggestions } from "./heuristics"
import { reconcile } from "./reconcile"
import { CLEANUP_KEYS, getItem, getSettings } from "./storage"
import type { AIRunResult, AnalysisStatus, CleanupSuggestion, GroupColor, GroupSuggestion, PRState, TabInfo } from "./types"
import { isHttpUrl } from "./url"

export type Tab = chrome.tabs.Tab & { id: number }

const BADGE_COLOR = "#c06018"

export const toTabInfo = (tab: chrome.tabs.Tab): TabInfo => ({
  id: tab.id!,
  title: tab.title || tab.url || "Untitled",
  url: tab.url || tab.pendingUrl || "",
  favIconUrl: tab.favIconUrl
})

export const targetWindowId = async () => {
  try {
    const window = await chrome.windows.getLastFocused({ windowTypes: ["normal"] })
    return window.id ?? null
  } catch {
    return null
  }
}

const readPRState = async (tabId: number): Promise<PRState | null> => {
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const label = document.querySelector('[data-component="StateLabel"][data-status]')
        const status = label?.getAttribute("data-status") ?? ""
        if (status === "pullMerged" || status === "merged") return "merged"
        if (status === "pullClosed" || status === "closed") return "closed"
        return null
      }
    })
    return (injection?.result as PRState | null) ?? null
  } catch {
    return null
  }
}

const resolvePRStates = async (prTabs: Map<string, Tab[]>) => {
  const cached = await getItem("pr_states")
  const states: Record<string, PRState> = {}
  await Promise.all(
    [...prTabs].map(async ([url, tabs]) => {
      const live = (await Promise.all(tabs.map((tab) => readPRState(tab.id)))).find(Boolean)
      const state = live ?? cached[url]
      if (state) states[url] = state
    })
  )
  return states
}

const groupSnapshots = async (windowId: number, tabs: Tab[]): Promise<GroupSnapshot[]> => {
  const groups = await chrome.tabGroups.query({ windowId })
  return groups.map((group) => ({
    id: group.id,
    title: group.title ?? "",
    color: group.color as GroupColor,
    tabs: tabs.filter((tab) => tab.groupId === group.id).map(toTabInfo)
  }))
}

// Gray copies of the manifest icons, made once per service worker lifetime
let grayIcons: Promise<Record<number, ImageData>> | null = null

const loadGrayIcons = async () => {
  const icons = chrome.runtime.getManifest().icons ?? {}
  const entries = await Promise.all(
    [16, 32].map(async (size) => {
      const blob = await (await fetch(chrome.runtime.getURL(icons[size]))).blob()
      const bitmap = await createImageBitmap(blob)
      const context = new OffscreenCanvas(size, size).getContext("2d")!
      context.drawImage(bitmap, 0, 0, size, size)
      const image = context.getImageData(0, 0, size, size)
      const data = image.data
      for (let i = 0; i < data.length; i += 4) {
        const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        data[i] = data[i + 1] = data[i + 2] = luma
        data[i + 3] *= 0.75
      }
      return [size, image] as const
    })
  )
  return Object.fromEntries(entries)
}

const setToolbarIcon = async (gray: boolean) => {
  if (!gray) {
    const icons = chrome.runtime.getManifest().icons ?? {}
    // Relative paths would resolve against the service worker's folder
    await chrome.action.setIcon({ path: { 16: `/${icons[16]}`, 32: `/${icons[32]}` } })
    return
  }
  grayIcons ??= loadGrayIcons().catch((error) => {
    grayIcons = null
    throw error
  })
  await chrome.action.setIcon({ imageData: await grayIcons })
}

// Open popup or full-page views; the toolbar icon stays in color while any are showing
let openViews = 0

export const trackOpenView = (port: chrome.runtime.Port) => {
  openViews += 1
  void updateBadge()
  port.onDisconnect.addListener(() => {
    openViews -= 1
    void updateBadge()
  })
}

export const updateBadge = async () => {
  const keys = ["heuristic_suggestions", "ai_suggestions", "group_action_counts", ...CLEANUP_KEYS] as const
  const values = await chrome.storage.local.get([...keys])
  const ai = (values.ai_suggestions ?? []) as GroupSuggestion[]
  const heuristic = (values.heuristic_suggestions ?? []) as GroupSuggestion[]
  const counts = (values.group_action_counts ?? { add: 0, merge: 0 }) as { add: number; merge: number }
  const cleanup = CLEANUP_KEYS.flatMap((key) => (values[key] ?? []) as CleanupSuggestion[])
  const windowId = await targetWindowId()
  const tabs = windowId === null ? [] : await chrome.tabs.query({ windowId })
  const openIds = new Set(tabs.flatMap((tab) => (tab.id === undefined ? [] : [tab.id])))
  const ungroupedIds = new Set(
    tabs.flatMap((tab) => (tab.id !== undefined && tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE ? [tab.id] : []))
  )
  const total =
    countLiveGroupSuggestions(ai.length ? ai : heuristic, ungroupedIds) +
    counts.add +
    counts.merge +
    countFlaggedTabs(cleanup, openIds)
  const { toolbarIndicator } = await getSettings()
  await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR })
  await chrome.action.setBadgeText({ text: toolbarIndicator === "badge" && total ? String(total) : "" })
  await chrome.action.setTitle({ title: total ? `Tabby: ${total} ${total === 1 ? "suggestion" : "suggestions"}` : "Tabby" })
  await setToolbarIcon(toolbarIndicator === "color" && !total && !openViews).catch((error) =>
    console.warn("Tabby: couldn't update the toolbar icon", error)
  )
}

export const runAnalysis = async (): Promise<AnalysisStatus | null> => {
  const startedAt = Date.now()
  const windowId = await targetWindowId()
  if (windowId === null) return null
  const settings = await getSettings()
  const ownPrefix = chrome.runtime.getURL("")
  const allTabs = (await chrome.tabs.query({ windowId })).filter(
    (tab): tab is Tab => tab.id !== undefined && !tab.pinned && !(tab.url ?? "").startsWith(ownPrefix)
  )
  const httpTabs = allTabs.filter((tab) => isHttpUrl(tab.url))
  const ungrouped = httpTabs.filter((tab) => tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE).map(toTabInfo)
  const dismissed = new Set(settings.dismissedSuggestions)
  const sizing = { minGroupSize: settings.minGroupSize, maxGroupSize: settings.maxGroupSize, maxGroups: settings.maxGroups }

  const previousIds = new Set(
    [...(await getItem("heuristic_suggestions")), ...(await getItem("ai_suggestions"))].map((item) => item.id)
  )
  let heuristic: GroupSuggestion[] = []
  let ai: GroupSuggestion[] = []
  let aiRun: AIRunResult = { status: settings.useAI ? "skipped" : "off", groupCount: 0 }
  // Tabs the user took out of a group (or chose not to add) aren't offered in new group suggestions either
  const removed = removedTabIds(dismissed)
  const suggestable = ungrouped.filter((tab) => !removed.has(tab.id))
  if (suggestable.length >= settings.minGroupSize) {
    const freshHeuristic = heuristicSuggestions(suggestable, settings).filter((item) => !dismissed.has(item.id))
    const previousHeuristic = await getItem("heuristic_suggestions")
    heuristic = reconcile(previousHeuristic, freshHeuristic, suggestable, { ...sizing, excludeIds: dismissed })

    if (settings.useAI) {
      const result = await aiSuggestions(suggestable, heuristic, settings)
      const freshAI = result.suggestions.filter((item) => !dismissed.has(item.id))
      const previousAI = await getItem("ai_suggestions")
      ai = reconcile(previousAI, freshAI, suggestable, { ...sizing, excludeIds: dismissed })
      aiRun = { ...result.run, groupCount: ai.length }
    }
  }

  const checks = settings.cleanupChecks
  const prTabs = checks.pr ? findPRTabs(httpTabs) : new Map<string, Tab[]>()
  const prStates = checks.pr ? await resolvePRStates(prTabs) : {}
  const pr = checks.pr ? prSuggestions(prTabs, prStates, settings.dismissedPRUrls) : []
  const duplicate = checks.duplicate ? duplicateSuggestions(httpTabs).filter((item) => !dismissed.has(item.id)) : []
  const zoom = checks.zoom ? zoomSuggestions(httpTabs) : []
  const newTab = checks.newTab ? newTabSuggestions(allTabs) : []
  const search = checks.googleSearch ? searchSuggestions(httpTabs) : []

  const flagged = new Set<number>()
  for (const item of [...duplicate, ...zoom, ...newTab, ...search]) flagged.add(item.tabId)
  for (const item of pr) item.tabIds.forEach((id) => flagged.add(id))
  const stale = checks.stale
    ? staleSuggestions(allTabs, settings.staleThreshold, flagged, await getItem("dismissed_stale"))
    : []

  const groupActions = computeGroupActions(await groupSnapshots(windowId, allTabs), ungrouped, dismissed)

  const shown = ai.length ? ai : heuristic
  const status: AnalysisStatus = {
    finishedAt: Date.now(),
    durationMs: Date.now() - startedAt,
    newSuggestionCount: shown.filter((item) => !previousIds.has(item.id)).length,
    ai: aiRun
  }
  console.info("[Tabby] analysis finished", status)

  await chrome.storage.local.set({
    analysis_status: status,
    heuristic_suggestions: heuristic,
    ai_suggestions: ai,
    pr_suggestions: pr,
    duplicate_suggestions: duplicate,
    zoom_suggestions: zoom,
    stale_suggestions: stale,
    new_tab_suggestions: newTab,
    google_search_suggestions: search,
    group_action_counts: {
      add: groupActions.filter((action) => action.type === "add-to-group").length,
      merge: groupActions.filter((action) => action.type === "merge-groups").length
    }
  })
  await updateBadge()
  return status
}
