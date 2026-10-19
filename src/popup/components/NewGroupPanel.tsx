import { Loader2, X } from "lucide-react"
import { useMemo, useState } from "react"

import { hashColor } from "~src/core/heuristics"
import { sendMessage } from "~src/core/messages"
import type { GroupColor } from "~src/core/types"
import { hostnameOf } from "~src/core/url"

import type { LiveGroup, LiveTab } from "../hooks/useWindowData"
import { filterBySearch } from "../search"
import { usePopupStore } from "../store"
import { Button, ColorDot, ColorPicker, Favicon, IconButton } from "./ui"

interface NewGroupPanelProps {
  tabs: LiveTab[]
  groups: LiveGroup[]
}

export const NewGroupPanel = ({ tabs, groups }: NewGroupPanelProps) => {
  const creatingGroup = usePopupStore((state) => state.creatingGroup)
  const close = usePopupStore((state) => state.closeCreateGroup)
  const setSelected = usePopupStore((state) => state.setSelected)
  const [name, setName] = useState("")
  const [color, setColor] = useState<GroupColor>("blue")
  const [colorTouched, setColorTouched] = useState(false)
  const [picked, setPicked] = useState<Set<number>>(() => new Set(creatingGroup?.tabIds ?? []))
  const [filter, setFilter] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const groupsById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups])
  const ordered = useMemo(
    () => [...tabs.filter((tab) => picked.has(tab.id)), ...tabs.filter((tab) => !picked.has(tab.id))],
    [tabs, creatingGroup]
  )
  const visible = filterBySearch(ordered, filter)
  const pickedIds = tabs.filter((tab) => picked.has(tab.id)).map((tab) => tab.id)
  const effectiveColor = colorTouched || !name.trim() ? color : hashColor(name.trim())

  const toggle = (id: number) =>
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const create = async () => {
    setBusy(true)
    setError(null)
    const result = await sendMessage({
      type: "APPLY_SUGGESTION",
      tabIds: pickedIds,
      name: name.trim(),
      color: effectiveColor
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error ?? "Couldn't create the group")
      return
    }
    setSelected([])
    close()
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-gray-50 dark:bg-gray-950">
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <h2 className="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100">New group</h2>
        <IconButton onClick={close} aria-label="Close">
          <X className="h-4 w-4" />
        </IconButton>
      </div>
      <div className="space-y-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <ColorPicker
            value={effectiveColor}
            onChange={(next) => {
              setColor(next)
              setColorTouched(true)
            }}
          />
          <input
            autoFocus
            value={name}
            maxLength={50}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && name.trim() && pickedIds.length >= 2) void create()
            }}
            placeholder="Group name"
            className="flex-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-ginger-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter tabs"
          className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none placeholder:text-gray-400 focus:border-ginger-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-4">
        {visible.map((tab) => {
          const group = groupsById.get(tab.groupId)
          return (
            <li key={tab.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-white dark:hover:bg-gray-900">
                <input
                  type="checkbox"
                  checked={picked.has(tab.id)}
                  onChange={() => toggle(tab.id)}
                  className="h-3.5 w-3.5 accent-ginger-600"
                />
                <Favicon url={tab.favIconUrl} />
                <span className="min-w-0 flex-1 truncate text-gray-800 dark:text-gray-200">{tab.title || tab.url}</span>
                {group && <ColorDot color={group.color} className="h-2 w-2" />}
                <span className="max-w-[30%] shrink-0 truncate text-gray-400">{hostnameOf(tab.url)}</span>
              </label>
            </li>
          )
        })}
      </ul>
      <div className="flex items-center gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-800">
        <span className="flex-1 text-xs text-gray-500 dark:text-gray-400">
          {error ? (
            <span className="text-red-600 dark:text-red-400">{error}</span>
          ) : (
            `${pickedIds.length} ${pickedIds.length === 1 ? "tab" : "tabs"} selected`
          )}
        </span>
        <Button variant="ghost" size="md" onClick={close}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="md"
          disabled={busy || !name.trim() || pickedIds.length < 2}
          title={pickedIds.length < 2 ? "Pick at least 2 tabs" : undefined}
          onClick={() => void create()}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Create group
        </Button>
      </div>
    </div>
  )
}
