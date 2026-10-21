import { CircleMinus } from "lucide-react"

import type { TabInfo } from "~core/types"
import { hostnameOf } from "~core/url"

import { activateTab, Favicon } from "./ui"

interface TabListProps {
  tabs: TabInfo[]
  onRemove?: (tab: TabInfo) => void
  removeLabel?: string
}

export const TabList = ({ tabs, onRemove, removeLabel = "Remove from group" }: TabListProps) => (
  <ul className="mt-2 space-y-0.5 border-t border-gray-100 pt-2 dark:border-gray-800">
    {tabs.map((tab) => (
      <li key={tab.id} className="group/row flex items-center gap-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800/60">
        <button
          type="button"
          onClick={() => void activateTab(tab.id)}
          className="flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1 text-left text-xs">
          <Favicon url={tab.favIconUrl} />
          <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200">{tab.title}</span>
          <span className="max-w-[35%] shrink-0 truncate text-gray-400">{hostnameOf(tab.url)}</span>
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(tab)}
            title={removeLabel}
            aria-label={`${removeLabel}: ${tab.title}`}
            className="mr-1 shrink-0 rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-200 hover:text-gray-700 focus-visible:opacity-100 group-hover/row:opacity-100 dark:hover:bg-gray-700 dark:hover:text-gray-200">
            <CircleMinus className="h-3.5 w-3.5" />
          </button>
        )}
      </li>
    ))}
  </ul>
)

