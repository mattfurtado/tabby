import {
  APPEARANCES,
  DEFAULT_SETTINGS,
  type AnalysisStatus,
  type Appearance,
  TOOLBAR_INDICATORS,
  type ToolbarIndicator,
  GROUP_COLORS,
  MAX_CUSTOM_INSTRUCTIONS,
  type DuplicateSuggestion,
  type GroupActionCounts,
  type GroupSuggestion,
  type NewTabSuggestion,
  type PRState,
  type PRSuggestion,
  type SearchSuggestion,
  type Settings,
  type StaleSuggestion,
  type StaleUnit,
  type ZoomSuggestion
} from "./types"

export interface StorageSchema {
  settings: Settings
  heuristic_suggestions: GroupSuggestion[]
  ai_suggestions: GroupSuggestion[]
  pr_suggestions: PRSuggestion[]
  duplicate_suggestions: DuplicateSuggestion[]
  zoom_suggestions: ZoomSuggestion[]
  stale_suggestions: StaleSuggestion[]
  new_tab_suggestions: NewTabSuggestion[]
  google_search_suggestions: SearchSuggestion[]
  group_action_counts: GroupActionCounts
  pr_states: Record<string, PRState>
  dismissed_stale: string[]
  analysis_status: AnalysisStatus
}

export type StorageKey = keyof StorageSchema

export const CLEANUP_KEYS = [
  "pr_suggestions",
  "duplicate_suggestions",
  "zoom_suggestions",
  "stale_suggestions",
  "new_tab_suggestions",
  "google_search_suggestions"
] as const satisfies StorageKey[]

export type CleanupKey = (typeof CLEANUP_KEYS)[number]

const FALLBACKS: { [TKey in StorageKey]: () => StorageSchema[TKey] } = {
  settings: () => structuredClone(DEFAULT_SETTINGS),
  heuristic_suggestions: () => [],
  ai_suggestions: () => [],
  pr_suggestions: () => [],
  duplicate_suggestions: () => [],
  zoom_suggestions: () => [],
  stale_suggestions: () => [],
  new_tab_suggestions: () => [],
  google_search_suggestions: () => [],
  group_action_counts: () => ({ add: 0, merge: 0 }),
  pr_states: () => ({}),
  dismissed_stale: () => [],
  analysis_status: () => ({ finishedAt: 0, durationMs: 0, newSuggestionCount: 0, ai: { status: "off", groupCount: 0 } })
}

const positiveIntOrNull = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) return null
  return Math.floor(value)
}

const STALE_UNITS: StaleUnit[] = ["minutes", "hours", "days"]

export const normalizeSettings = (raw: unknown): Settings => {
  const input = (raw && typeof raw === "object" ? raw : {}) as Partial<Settings>
  const base = DEFAULT_SETTINGS
  const threshold = (input.staleThreshold ?? {}) as Partial<Settings["staleThreshold"]>
  const checks = (input.cleanupChecks ?? {}) as Partial<Settings["cleanupChecks"]>
  const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback)
  const stringList = (value: unknown) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []

  return {
    appearance: APPEARANCES.includes(input.appearance as Appearance) ? (input.appearance as Appearance) : base.appearance,
    toolbarIndicator: TOOLBAR_INDICATORS.includes(input.toolbarIndicator as ToolbarIndicator)
      ? (input.toolbarIndicator as ToolbarIndicator)
      : base.toolbarIndicator,
    useAI: bool(input.useAI, base.useAI),
    customInstructions:
      typeof input.customInstructions === "string"
        ? input.customInstructions.slice(0, MAX_CUSTOM_INSTRUCTIONS)
        : base.customInstructions,
    minGroupSize: Math.max(2, positiveIntOrNull(input.minGroupSize) ?? base.minGroupSize),
    maxGroupSize: positiveIntOrNull(input.maxGroupSize),
    maxGroups: positiveIntOrNull(input.maxGroups),
    staleThreshold: {
      value: positiveIntOrNull(threshold.value) ?? base.staleThreshold.value,
      unit: STALE_UNITS.includes(threshold.unit as StaleUnit)
        ? (threshold.unit as StaleUnit)
        : base.staleThreshold.unit
    },
    cleanupChecks: {
      pr: bool(checks.pr, base.cleanupChecks.pr),
      duplicate: bool(checks.duplicate, base.cleanupChecks.duplicate),
      zoom: bool(checks.zoom, base.cleanupChecks.zoom),
      stale: bool(checks.stale, base.cleanupChecks.stale),
      newTab: bool(checks.newTab, base.cleanupChecks.newTab),
      googleSearch: bool(checks.googleSearch, base.cleanupChecks.googleSearch)
    },
    dismissedSuggestions: stringList(input.dismissedSuggestions),
    dismissedPRUrls: stringList(input.dismissedPRUrls)
  }
}

export const isGroupColor = (value: unknown): value is (typeof GROUP_COLORS)[number] =>
  typeof value === "string" && (GROUP_COLORS as readonly string[]).includes(value)

export const normalizeValue = <TKey extends StorageKey>(key: TKey, raw: unknown): StorageSchema[TKey] => {
  if (key === "settings") return normalizeSettings(raw) as StorageSchema[TKey]
  if (raw === undefined || raw === null) return FALLBACKS[key]()
  return raw as StorageSchema[TKey]
}

export const getItem = async <TKey extends StorageKey>(key: TKey): Promise<StorageSchema[TKey]> => {
  const result = await chrome.storage.local.get(key)
  return normalizeValue(key, result[key])
}

export const setItem = async <TKey extends StorageKey>(key: TKey, value: StorageSchema[TKey]) => {
  await chrome.storage.local.set({ [key]: value })
}

export const getSettings = () => getItem("settings")

export const updateSettings = async (patch: Partial<Settings>) => {
  const current = await getSettings()
  const next = normalizeSettings({ ...current, ...patch })
  await setItem("settings", next)
  return next
}
