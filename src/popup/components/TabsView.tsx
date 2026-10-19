import { ListChecks } from "lucide-react"
import { useEffect, useRef } from "react"

import type { TabsModel } from "../hooks/useTabsModel"
import type { LiveGroup } from "../hooks/useWindowData"
import { usePopupStore } from "../store"
import { SearchBox } from "./SearchBox"
import { TabCard } from "./TabCard"
import { EmptyState } from "./ui"

interface TabsViewProps {
  model: TabsModel
  groups: LiveGroup[]
  loaded: boolean
}

export const TabsView = ({ model, groups, loaded }: TabsViewProps) => {
  const { visibleRows, selectedRows, filterOptions, activeFilter } = model
  const setFilter = usePopupStore((state) => state.setFilter)
  const setSelected = usePopupStore((state) => state.setSelected)
  const checkbox = useRef<HTMLInputElement>(null)

  const allSelected = visibleRows.length > 0 && selectedRows.length === visibleRows.length
  const partial = selectedRows.length > 0 && !allSelected
  const selectedTabs = selectedRows.reduce((sum, row) => sum + row.tabs.length, 0)
  const visibleTabs = visibleRows.reduce((sum, row) => sum + row.tabs.length, 0)

  useEffect(() => {
    if (checkbox.current) checkbox.current.indeterminate = partial
  }, [partial])

  const toggleAll = () => setSelected(allSelected ? [] : visibleRows.map((row) => row.key))

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 space-y-2 border-b border-gray-200 bg-gray-50/95 px-4 py-2 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
        <SearchBox placeholder="Search tabs" />
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <input
              ref={checkbox}
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              disabled={!visibleRows.length}
              className="h-4 w-4 cursor-pointer rounded accent-blue-600"
            />
            {selectedRows.length > 0 ? `${selectedTabs} of ${visibleTabs} selected` : "Select all"}
          </label>
          <div className="flex-1" />
          <select
            value={activeFilter}
            onChange={(event) => {
              setFilter(event.target.value)
              setSelected([])
            }}
            aria-label="Filter tabs"
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 outline-none focus:border-blue-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {loaded && !visibleRows.length ? (
        <EmptyState icon={<ListChecks className="h-10 w-10" />} title="No tabs to show">
          Try a different search or filter.
        </EmptyState>
      ) : (
        <div className="space-y-2 p-4">
          {visibleRows.map((row) => (
            <TabCard key={row.key} row={row} groups={groups} />
          ))}
        </div>
      )}
    </div>
  )
}
