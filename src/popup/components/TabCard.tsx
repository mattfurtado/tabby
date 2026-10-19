import { X } from "lucide-react"

import { sendMessage } from "~src/core/messages"

import type { LiveGroup } from "../hooks/useWindowData"
import type { TabRow } from "../rows"
import { usePopupStore } from "../store"
import { CleanupBadge, CurrentBadge } from "./CleanupBadge"
import { MoveMenu } from "./MoveMenu"
import { activateTab, Button, ColorDot, cx, Favicon } from "./ui"

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

  return (
    <div
      className={cx(
        "flex items-start gap-3 rounded-lg border bg-white px-3 py-2.5 transition-colors dark:bg-gray-900",
        isSelected
          ? "border-blue-400 ring-1 ring-blue-400/40 dark:border-blue-500"
          : "border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700"
      )}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => toggleSelected(row.key)}
        aria-label={`Select ${row.title}`}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 accent-blue-600"
      />
      <Favicon url={row.favIconUrl} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => void activateTab(target.id)}
          className="flex w-full min-w-0 items-baseline gap-1 text-left"
          title={row.url}>
          <span className="truncate text-sm font-medium text-gray-900 hover:underline dark:text-gray-100">{row.title}</span>
          {copies > 1 && <span className="shrink-0 text-sm text-gray-400">({copies - 1})</span>}
        </button>
        {row.group && (
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <ColorDot color={row.group.color} className="h-2 w-2" />
            <span className="truncate">{row.group.title || "Untitled group"}</span>
          </div>
        )}
        <div className="mt-1.5 flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {row.active && <CurrentBadge />}
            {row.kinds.map((kind) => (
              <CleanupBadge key={kind} kind={kind} staleSince={row.staleSince} />
            ))}
          </div>
          <MoveMenu tabIds={tabIds} currentGroupId={row.group?.id ?? null} groups={groups} />
          <Button
            variant="danger"
            onClick={() => void sendMessage({ type: "CLOSE_BULK", items: [{ id: row.key, tabIds }] })}>
            <X className="h-3.5 w-3.5" />
            {copies > 1 ? "Close tabs" : "Close tab"}
          </Button>
        </div>
      </div>
    </div>
  )
}
