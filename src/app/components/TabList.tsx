import type { TabInfo } from "~core/types"
import { hostnameOf } from "~core/url"

import { activateTab, Favicon } from "./ui"

interface TabListProps {
  tabs: TabInfo[]
}

export const TabList = ({ tabs }: TabListProps) => (
  <ul className="mt-2 space-y-0.5 border-t border-gray-100 pt-2 dark:border-gray-800">
    {tabs.map((tab) => (
      <li key={tab.id}>
        <button
          type="button"
          onClick={() => void activateTab(tab.id)}
          className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-800/60">
          <Favicon url={tab.favIconUrl} />
          <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200">{tab.title}</span>
          <span className="max-w-[35%] shrink-0 truncate text-gray-400">{hostnameOf(tab.url)}</span>
        </button>
      </li>
    ))}
  </ul>
)

