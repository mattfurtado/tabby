import { Menu, MenuButton, MenuHeading, MenuItem, MenuItems, MenuSection, MenuSeparator } from "@headlessui/react"
import { ChevronDown, ChevronRight, Combine, Loader2, Pencil } from "lucide-react"
import { useEffect, useState } from "react"

import { sendMessage } from "~src/core/messages"
import type { GroupColor, GroupSuggestion, TabInfo } from "~src/core/types"

import type { LiveGroup } from "../hooks/useWindowData"
import { usePopupStore } from "../store"
import { TabList } from "./TabList"
import { Button, ColorDot, ColorPicker, MENU_HEADING_CLASS, MENU_ITEM_CLASS, MENU_ITEMS_CLASS } from "./ui"

interface SuggestionCardProps {
  suggestion: GroupSuggestion
  tabs: TabInfo[]
  visibleTabs: TabInfo[]
  existingGroups: LiveGroup[]
  otherSuggestions: { suggestion: GroupSuggestion; tabs: TabInfo[] }[]
  forceExpanded: boolean
}

export const SuggestionCard = ({
  suggestion,
  tabs,
  visibleTabs,
  existingGroups,
  otherSuggestions,
  forceExpanded
}: SuggestionCardProps) => {
  const expanded = usePopupStore((state) => state.expanded[suggestion.id]) || forceExpanded
  const toggleExpanded = usePopupStore((state) => state.toggleExpanded)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(suggestion.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mergeTarget, setMergeTarget] = useState<{ suggestion: GroupSuggestion; tabs: TabInfo[] } | null>(null)

  useEffect(() => {
    if (!editing) setDraft(suggestion.name)
  }, [suggestion.name, editing])

  const tabIds = tabs.map((tab) => tab.id)

  const rename = async (name: string, color?: GroupColor) => {
    const trimmed = name.trim()
    if (!trimmed) {
      setDraft(suggestion.name)
      return
    }
    if (trimmed === suggestion.name && !color) return
    await sendMessage({ type: "RENAME_SUGGESTION", suggestionId: suggestion.id, name: trimmed, color })
  }

  const commitEdit = () => {
    setEditing(false)
    void rename(draft)
  }

  const run = async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true)
    setError(null)
    const result = await action()
    setBusy(false)
    if (!result.ok) setError(result.error ?? "Something went wrong")
  }

  const create = () =>
    run(() =>
      sendMessage({
        type: "APPLY_SUGGESTION",
        suggestionId: suggestion.id,
        tabIds,
        name: suggestion.name,
        color: suggestion.color
      })
    )

  const mergeIntoGroup = (group: LiveGroup) =>
    run(async () => {
      if (!tabIds.length) return { ok: false, error: "No tabs to move" }
      await chrome.tabs.group({ groupId: group.id, tabIds: tabIds as [number, ...number[]] })
      return sendMessage({ type: "REFRESH_SUGGESTIONS" })
    })

  const confirmMergeIntoSuggestion = () => {
    const target = mergeTarget
    setMergeTarget(null)
    if (!target) return
    return run(() =>
      sendMessage({
        type: "APPLY_SUGGESTION",
        suggestionId: target.suggestion.id,
        tabIds: [...target.tabs.map((tab) => tab.id), ...tabIds],
        name: target.suggestion.name,
        color: target.suggestion.color
      })
    )
  }

  const hasMergeTargets = existingGroups.length > 0 || otherSuggestions.length > 0

  return (
    <div className="rounded-lg bg-gradient-to-r from-ginger-300 to-ginger-500 dark:from-ginger-800 dark:to-ginger-600 p-px">
      <div className="rounded-[7px] bg-white p-3 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleExpanded(suggestion.id)}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse" : "Expand"}>
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </button>
          <ColorPicker value={suggestion.color} onChange={(color) => void rename(suggestion.name, color)} />
          {editing ? (
            <input
              autoFocus
              value={draft}
              maxLength={50}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitEdit}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitEdit()
                if (event.key === "Escape") {
                  setDraft(suggestion.name)
                  setEditing(false)
                }
              }}
              className="min-w-0 flex-1 rounded border border-ginger-400 bg-transparent px-1.5 py-0.5 text-sm font-medium text-gray-900 outline-none dark:text-gray-100"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="group flex min-w-0 flex-1 items-center gap-1.5 text-left"
              title="Rename">
              <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{suggestion.name}</span>
              <Pencil className="h-3 w-3 shrink-0 text-gray-400 opacity-0 group-hover:opacity-100" />
            </button>
          )}
          <span className="shrink-0 text-xs text-gray-400">
            {tabs.length} {tabs.length === 1 ? "tab" : "tabs"}
          </span>
        </div>

        {expanded && <TabList tabs={visibleTabs} />}

        {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

        {mergeTarget ? (
          <div className="mt-3 flex items-center gap-2 rounded-md bg-ginger-50 p-2 dark:bg-ginger-950/40">
            <ColorDot color={mergeTarget.suggestion.color} />
            <span className="flex-1 truncate text-xs text-ginger-800 dark:text-ginger-200">
              Create “{mergeTarget.suggestion.name}” with {mergeTarget.tabs.length + tabs.length} tabs?
            </span>
            <Button variant="ghost" onClick={() => setMergeTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void confirmMergeIntoSuggestion()}>
              Create group
            </Button>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2">
            <Menu>
              <MenuButton
                disabled={!hasMergeTargets || busy}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-800">
                <Combine className="h-3.5 w-3.5" />
                Merge
              </MenuButton>
              <MenuItems anchor="bottom start" className={MENU_ITEMS_CLASS}>
                {existingGroups.length > 0 && (
                  <MenuSection>
                    <MenuHeading className={MENU_HEADING_CLASS}>Existing groups</MenuHeading>
                    {existingGroups.map((group) => (
                      <MenuItem key={group.id}>
                        <button type="button" className={MENU_ITEM_CLASS} onClick={() => void mergeIntoGroup(group)}>
                          <ColorDot color={group.color} />
                          <span className="truncate">{group.title || "Untitled group"}</span>
                        </button>
                      </MenuItem>
                    ))}
                  </MenuSection>
                )}
                {existingGroups.length > 0 && otherSuggestions.length > 0 && (
                  <MenuSeparator className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
                )}
                {otherSuggestions.length > 0 && (
                  <MenuSection>
                    <MenuHeading className={MENU_HEADING_CLASS}>New groups</MenuHeading>
                    {otherSuggestions.map((other) => (
                      <MenuItem key={other.suggestion.id}>
                        <button type="button" className={MENU_ITEM_CLASS} onClick={() => setMergeTarget(other)}>
                          <ColorDot color={other.suggestion.color} />
                          <span className="truncate">{other.suggestion.name}</span>
                        </button>
                      </MenuItem>
                    ))}
                  </MenuSection>
                )}
              </MenuItems>
            </Menu>
            <div className="flex-1" />
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void sendMessage({ type: "DISMISS_SUGGESTION", suggestionId: suggestion.id })}>
              Dismiss
            </Button>
            <Button variant="primary" disabled={busy || tabs.length < 2} onClick={() => void create()}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
