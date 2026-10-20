import { useMemo } from "react"

import type { CleanupSuggestion } from "~core/types"

import { useStorageValue } from "./useStorageValue"

export const useCleanupSuggestions = (): CleanupSuggestion[] => {
  const pr = useStorageValue("pr_suggestions")
  const duplicate = useStorageValue("duplicate_suggestions")
  const zoom = useStorageValue("zoom_suggestions")
  const stale = useStorageValue("stale_suggestions")
  const newTab = useStorageValue("new_tab_suggestions")
  const search = useStorageValue("google_search_suggestions")

  return useMemo(
    () => [...pr, ...duplicate, ...zoom, ...newTab, ...search, ...stale],
    [pr, duplicate, zoom, stale, newTab, search]
  )
}
