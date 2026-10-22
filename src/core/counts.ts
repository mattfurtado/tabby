import type { CleanupSuggestion, GroupSuggestion } from "./types"

// Shared by the toolbar icon and the popup sidebar so the two counts always agree

export const cleanupTabIds = (suggestion: CleanupSuggestion) =>
  suggestion.source === "pr" ? suggestion.tabIds : [suggestion.tabId]

// Each open tab counts once, however many checks flag it
export const countFlaggedTabs = (suggestions: CleanupSuggestion[], openTabIds: Set<number>) =>
  new Set(suggestions.flatMap(cleanupTabIds).filter((id) => openTabIds.has(id))).size

// A suggestion counts while at least one of its tabs is still open and ungrouped
export const countLiveGroupSuggestions = (suggestions: GroupSuggestion[], ungroupedTabIds: Set<number>) =>
  suggestions.filter((suggestion) => suggestion.tabIds.some((id) => ungroupedTabIds.has(id))).length
