import { X } from "lucide-react"

import { sendMessage } from "~src/core/messages"
import { displayUrl } from "~src/core/url"

import type { LiveGroup } from "../hooks/useWindowData"
import type { TabRow } from "../rows"
import { usePopupStore } from "../store"
import { CleanupBadge, CurrentBadge } from "./CleanupBadge"
import { MoveMenu } from "./MoveMenu"
import { activateTab, ColorDot, cx, Favicon } from "./ui"

interface TabCardProps {
  row: TabRow
  groups: LiveGroup[]
}

export const TabCard = ({ row, groups }: TabCardProps) => {
  const isSelected = usePopupStore((state) => state.selected.includes(row.key))
  const toggleSelected = usePopupStore((state) => state.toggleSelected)
  const tabIds = row.tabs.map((tab) => tab.id)
  const copies = row.tabs.length
  const target = row.tabs.find((tab) => tab.active) ?? row.tabs[0]
  const hasDetails = !!row.group || groups.length > 0
  const url = displayUrl(row.url)
  const closeLabel = copies > 1 ? "Close tabs" : "Close tab"

  return (
    <div
      role="checkbox"
      aria-checked={isSelected}
      aria-label={`Select ${row.title}`}
      tabIndex={0}
      onClick={() => toggleSelected(row.key)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || (event.key !== " " && event.key !== "Enter")) return
        event.preventDefault()
        toggleSelected(row.key)
      }}
      className={cx(
        "cursor-pointer select-none rounded-lg border px-3 py-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ginger-400",
        isSelected
          ? "border-ginger-400 bg-ginger-50 ring-1 ring-ginger-400/40 dark:border-ginger-500 dark:bg-ginger-950/30"
          : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
      )}>
      <div className="flex items-start gap-3">
        <Favicon url={row.favIconUrl} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              void activateTab(target.id)
            }}
            className="flex max-w-full items-baseline gap-1 text-left"
            title={row.url}>
            <span className="truncate text-sm font-medium text-gray-900 hover:underline dark:text-gray-100">{row.title}</span>
            {copies > 1 && <span className="shrink-0 text-sm text-gray-400">({copies - 1})</span>}
          </button>
          {url && url !== row.title && <div className="truncate text-xs text-gray-500 dark:text-gray-400">{url}</div>}
        </div>
        {(row.active || row.kinds.length > 0) && (
          <div className="flex shrink-0 items-center gap-1">
            {row.active && <CurrentBadge />}
            {row.kinds.map((kind) => (
              <CleanupBadge key={kind} kind={kind} staleSince={row.staleSince} />
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            void sendMessage({ type: "CLOSE_BULK", items: [{ id: row.key, tabIds }] })
          }}
          title={closeLabel}
          aria-label={closeLabel}
          className="-m-1 shrink-0 rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>
      {hasDetails && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {row.group && (
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <ColorDot color={row.group.color} className="h-2 w-2" />
                <span className="truncate">{row.group.title || "Untitled group"}</span>
              </span>
            )}
          </div>
          <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
            <MoveMenu tabIds={tabIds} currentGroupId={row.group?.id ?? null} groups={groups} />
          </div>
        </div>
      )}
    </div>
  )
}
