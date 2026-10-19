export const GROUP_COLORS = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan"] as const

export type GroupColor = (typeof GROUP_COLORS)[number]

export interface TabInfo {
  id: number
  title: string
  url: string
  favIconUrl?: string
}

export type SuggestionSource = "heuristic" | "ai"

export interface GroupSuggestion {
  id: string
  name: string
  color: GroupColor
  tabIds: number[]
  tabs: TabInfo[]
  source: SuggestionSource
}

export type CleanupKind = "pr" | "duplicate" | "zoom" | "stale" | "newtab" | "search"

interface CleanupBase<TKind extends CleanupKind> {
  id: string
  tabId: number
  tabUrl: string
  title: string
  favIconUrl?: string
  source: TKind
}

export type PRState = "merged" | "closed"

export interface PRSuggestion extends CleanupBase<"pr"> {
  tabIds: number[]
  prState: PRState
}

export type DuplicateSuggestion = CleanupBase<"duplicate">
export type ZoomSuggestion = CleanupBase<"zoom">
export type NewTabSuggestion = CleanupBase<"newtab">
export type SearchSuggestion = CleanupBase<"search">

export interface StaleSuggestion extends CleanupBase<"stale"> {
  lastAccessed: number
}

export type CleanupSuggestion =
  | PRSuggestion
  | DuplicateSuggestion
  | ZoomSuggestion
  | StaleSuggestion
  | NewTabSuggestion
  | SearchSuggestion

export interface AddToGroupAction {
  type: "add-to-group"
  id: string
  targetGroupId: number
  targetGroupTitle: string
  targetGroupColor: GroupColor
  tabIds: number[]
  tabs: TabInfo[]
}

export interface MergeGroupsAction {
  type: "merge-groups"
  id: string
  sourceGroupId: number
  sourceGroupTitle: string
  targetGroupId: number
  targetGroupTitle: string
  color: GroupColor
  tabCount: number
}

export type GroupAction = AddToGroupAction | MergeGroupsAction

export interface GroupActionCounts {
  add: number
  merge: number
}

export type AIRunStatus = "off" | "skipped" | "used" | "no-groups" | "unavailable" | "error"

export interface AIRunResult {
  status: AIRunStatus
  groupCount: number
  availability?: string
  error?: string
}

export interface AnalysisStatus {
  finishedAt: number
  durationMs: number
  newSuggestionCount: number
  ai: AIRunResult
}

export type StaleUnit = "minutes" | "hours" | "days"

export interface CleanupChecks {
  pr: boolean
  duplicate: boolean
  zoom: boolean
  stale: boolean
  newTab: boolean
  googleSearch: boolean
}

export interface Settings {
  useAI: boolean
  customInstructions: string
  minGroupSize: number
  maxGroupSize: number | null
  maxGroups: number | null
  staleThreshold: { value: number; unit: StaleUnit }
  cleanupChecks: CleanupChecks
  dismissedSuggestions: string[]
  dismissedPRUrls: string[]
}

export const MAX_CUSTOM_INSTRUCTIONS = 500

export const DEFAULT_SETTINGS: Settings = {
  useAI: false,
  customInstructions: "",
  minGroupSize: 2,
  maxGroupSize: null,
  maxGroups: null,
  staleThreshold: { value: 48, unit: "hours" },
  cleanupChecks: { pr: true, duplicate: true, zoom: true, stale: true, newTab: true, googleSearch: true },
  dismissedSuggestions: [],
  dismissedPRUrls: []
}
