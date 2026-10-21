import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react"
import { ChevronDown, ChevronRight, Combine, Plus, Trash2, Ungroup } from "lucide-react"
import { useState } from "react"

import { removedFromGroupId } from "~core/group-actions"
import { sendMessage } from "~core/messages"
import type { AddToGroupAction, MergeGroupsAction } from "~core/types"

import type { LiveGroup } from "../hooks/useWindowData"
import { usePopupStore } from "../store"
import { AddTabMenu, type AddTabSection } from "./AddTabMenu"
import { TabList } from "./TabList"
import { Button, ColorDot, cx, MENU_ITEM_CLASS, MENU_ITEMS_CLASS } from "./ui"

interface ExistingGroupCardProps {
  group: LiveGroup
  visibleTabs: LiveGroup["tabs"]
  otherGroups: LiveGroup[]
  addAction?: AddToGroupAction
  mergeActions: MergeGroupsAction[]
  addSections: AddTabSection[]
  forceExpanded: boolean
}

const refresh = () => sendMessage({ type: "REFRESH_SUGGESTIONS" })

const toTabInfo = (tab: chrome.tabs.Tab & { id: number }) => ({
  id: tab.id,
  title: tab.title || tab.url || "Untitled",
  url: tab.url ?? "",
  favIconUrl: tab.favIconUrl
})

export const ExistingGroupCard = ({
  group,
  visibleTabs,
  otherGroups,
  addAction,
  mergeActions,
  addSections,
  forceExpanded
}: ExistingGroupCardProps) => {
  const cardId = `group_${group.id}`
  const expanded = usePopupStore((state) => state.expanded[cardId]) || forceExpanded
  const toggleExpanded = usePopupStore((state) => state.toggleExpanded)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const tabIds = group.tabs.map((tab) => tab.id)
  const title = group.title || "Untitled group"

  const ungroup = async () => {
    if (!tabIds.length) return
    await chrome.tabs.ungroup(tabIds as [number, ...number[]])
    void refresh()
  }

  const remove = async () => {
    setConfirmDelete(false)
    await sendMessage({ type: "CLOSE_BULK", items: [{ id: cardId, tabIds }] })
  }

  const removeTab = async (tabId: number) => {
    // Record the removal first so the tab doesn't flash up as a suggestion to add back
    await sendMessage({ type: "DISMISS_SUGGESTION", suggestionId: removedFromGroupId(group.id, tabId) })
    await chrome.tabs.ungroup(tabId)
  }

  const skipSuggestedTab = (tabId: number) =>
    sendMessage({ type: "DISMISS_SUGGESTION", suggestionId: removedFromGroupId(group.id, tabId) })

  const mergeInto = async (target: LiveGroup) => {
    if (!tabIds.length) return
    await chrome.tabs.group({ groupId: target.id, tabIds: tabIds as [number, ...number[]] })
    void refresh()
  }

  const addTabs = async () => {
    if (!addAction?.tabIds.length) return
    await chrome.tabs.group({ groupId: group.id, tabIds: addAction.tabIds as [number, ...number[]] })
    void refresh()
  }

  const acceptMerge = async (action: MergeGroupsAction) => {
    const source = otherGroups.find((item) => item.id === action.sourceGroupId)
    if (!source?.tabs.length) return
    await chrome.tabs.group({ groupId: group.id, tabIds: source.tabs.map((tab) => tab.id) as [number, ...number[]] })
    void refresh()
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => toggleExpanded(cardId)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={expanded}>
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
          )}
          <ColorDot color={group.color} />
          <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{title}</span>
          <span className="shrink-0 text-xs text-gray-400">
            {group.tabs.length} {group.tabs.length === 1 ? "tab" : "tabs"}
          </span>
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 dark:text-gray-400">Close {group.tabs.length} tabs?</span>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void remove()}>
              Delete
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Menu>
              <MenuButton
                disabled={!otherGroups.length}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-800">
                <Combine className="h-3.5 w-3.5" />
                Merge
              </MenuButton>
              <MenuItems anchor="bottom end" className={MENU_ITEMS_CLASS}>
                {otherGroups.map((target) => (
                  <MenuItem key={target.id}>
                    <button type="button" className={MENU_ITEM_CLASS} onClick={() => void mergeInto(target)}>
                      <ColorDot color={target.color} />
                      <span className="truncate">{target.title || "Untitled group"}</span>
                    </button>
                  </MenuItem>
                ))}
              </MenuItems>
            </Menu>
            <Button variant="ghost" onClick={() => void ungroup()}>
              <Ungroup className="h-3.5 w-3.5" />
              Ungroup
            </Button>
            <Button variant="ghost" className="hover:text-red-600" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {expanded && (
        <>
          <TabList tabs={visibleTabs.map(toTabInfo)} onRemove={(tab) => void removeTab(tab.id)} />
          <AddTabMenu
            sections={addSections}
            onAdd={(tab) => void sendMessage({ type: "ADD_TO_GROUP", groupId: group.id, tabIds: [tab.id] })}
          />
        </>
      )}

      {addAction && (
        <div className="mt-3 rounded-md border border-dashed border-ginger-300 bg-ginger-50/60 p-2 dark:border-ginger-800 dark:bg-ginger-950/30">
          <div className="flex items-center gap-2">
            <span className="flex-1 text-xs font-medium text-ginger-700 dark:text-ginger-300">
              Suggested to add ({addAction.tabs.length})
            </span>
            <Button variant="ghost" onClick={() => void sendMessage({ type: "DISMISS_SUGGESTION", suggestionId: addAction.id })}>
              Dismiss
            </Button>
            <Button variant="primary" onClick={() => void addTabs()}>
              <Plus className="h-3.5 w-3.5" />
              Add to group
            </Button>
          </div>
          <TabList tabs={addAction.tabs} removeLabel="Don't add" onRemove={(tab) => void skipSuggestedTab(tab.id)} />
        </div>
      )}

      {mergeActions.map((action) => (
        <div
          key={action.id}
          className={cx(
            "mt-3 flex items-center gap-2 rounded-md border border-dashed p-2",
            "border-purple-300 bg-purple-50/60 dark:border-purple-800 dark:bg-purple-950/30"
          )}>
          <span className="flex-1 truncate text-xs text-purple-700 dark:text-purple-300">
            Merge “{action.sourceGroupTitle || "Untitled group"}” into this group ({action.tabCount}{" "}
            {action.tabCount === 1 ? "tab" : "tabs"})
          </span>
          <Button variant="ghost" onClick={() => void sendMessage({ type: "DISMISS_SUGGESTION", suggestionId: action.id })}>
            Dismiss
          </Button>
          <Button variant="primary" onClick={() => void acceptMerge(action)}>
            <Combine className="h-3.5 w-3.5" />
            Merge
          </Button>
        </div>
      ))}
    </div>
  )
}
