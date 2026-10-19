import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react"
import { FolderInput } from "lucide-react"

import type { LiveGroup } from "../hooks/useWindowData"
import { ColorDot, MENU_ITEM_CLASS, MENU_ITEMS_CLASS } from "./ui"

interface MoveMenuProps {
  tabIds: number[]
  currentGroupId: number | null
  groups: LiveGroup[]
}

export const MoveMenu = ({ tabIds, currentGroupId, groups }: MoveMenuProps) => {
  const targets = groups.filter((group) => group.id !== currentGroupId)
  const canUngroup = currentGroupId !== null
  const disabled = !tabIds.length || (!canUngroup && !targets.length)

  const moveTo = async (groupId: number | null) => {
    const ids = tabIds as [number, ...number[]]
    if (groupId === null) await chrome.tabs.ungroup(ids)
    else await chrome.tabs.group({ groupId, tabIds: ids })
  }

  return (
    <Menu>
      <MenuButton
        disabled={disabled}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-800">
        <FolderInput className="h-3.5 w-3.5" />
        Move
      </MenuButton>
      <MenuItems anchor="bottom end" className={MENU_ITEMS_CLASS}>
        {canUngroup && (
          <MenuItem>
            <button type="button" className={MENU_ITEM_CLASS} onClick={() => void moveTo(null)}>
              <span className="inline-block h-2.5 w-2.5 rounded-full border border-gray-400" />
              Ungrouped
            </button>
          </MenuItem>
        )}
        {targets.map((group) => (
          <MenuItem key={group.id}>
            <button type="button" className={MENU_ITEM_CLASS} onClick={() => void moveTo(group.id)}>
              <ColorDot color={group.color} />
              <span className="truncate">{group.title || "Untitled group"}</span>
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  )
}
