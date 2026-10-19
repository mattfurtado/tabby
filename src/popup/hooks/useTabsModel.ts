import { useEffect, useMemo } from "react"

import type { CleanupSuggestion } from "~src/core/types"

import { BADGE_LABELS, BADGE_ORDER, buildRows, type TabRow } from "../rows"
import { matchesSearch } from "../search"
import { usePopupStore } from "../store"
import type { LiveGroup, LiveTab } from "./useWindowData"

export interface FilterOption {
  value: string
  label: string
}

const tabCount = (rows: TabRow[]) => rows.reduce((sum, row) => sum + row.tabs.length, 0)

const matchesFilter = (row: TabRow, filter: string) => {
  if (filter === "all") return true
  if (filter === "ungrouped") return !row.group
  return row.kinds.includes(filter as TabRow["kinds"][number])
}

export const useTabsModel = (tabs: LiveTab[], groups: LiveGroup[], cleanup: CleanupSuggestion[]) => {
  const search = usePopupStore((state) => state.search)
  const filter = usePopupStore((state) => state.filter)
  const setFilter = usePopupStore((state) => state.setFilter)
  const selected = usePopupStore((state) => state.selected)

  const rows = useMemo(() => buildRows(tabs, groups, cleanup), [tabs, groups, cleanup])

  const filterOptions = useMemo(() => {
    const options: FilterOption[] = [{ value: "all", label: `All tabs (${tabCount(rows)})` }]
    const ungrouped = tabCount(rows.filter((row) => !row.group))
    if (ungrouped > 0) options.push({ value: "ungrouped", label: `Ungrouped (${ungrouped})` })
    for (const kind of BADGE_ORDER) {
      const count = rows.reduce((sum, row) => sum + (row.kindCounts[kind] ?? 0), 0)
      if (count > 0) options.push({ value: kind, label: `${BADGE_LABELS[kind]} (${count})` })
    }
    return options
  }, [rows])

  const activeFilter = filterOptions.some((option) => option.value === filter) ? filter : "all"

  useEffect(() => {
    if (activeFilter !== filter) setFilter("all")
  }, [activeFilter, filter, setFilter])

  const visibleRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          matchesFilter(row, activeFilter) &&
          (matchesSearch({ title: row.title, url: row.url }, search) || row.group?.title.toLowerCase().includes(search.trim().toLowerCase()))
      ),
    [rows, activeFilter, search]
  )

  const selectedRows = useMemo(() => {
    const set = new Set(selected)
    return visibleRows.filter((row) => set.has(row.key))
  }, [visibleRows, selected])

  return {
    rows,
    visibleRows,
    selectedRows,
    filterOptions,
    activeFilter,
    flaggedTabCount: tabCount(rows.filter((row) => row.kinds.length > 0))
  }
}

export type TabsModel = ReturnType<typeof useTabsModel>
