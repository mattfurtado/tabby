import { Menu, MenuButton, MenuHeading, MenuItem, MenuItems, MenuSection, MenuSeparator } from "@headlessui/react"
import { Plus } from "lucide-react"

import type { GroupColor, TabInfo } from "~core/types"

import { ColorDot, Favicon, MENU_HEADING_CLASS, MENU_ITEM_CLASS, MENU_ITEMS_CLASS } from "./ui"

export interface AddTabSection {
  key: string
  label: string
  color?: GroupColor
  tabs: TabInfo[]
}

interface AddTabMenuProps {
  sections: AddTabSection[]
  onAdd: (tab: TabInfo) => void
}

export const AddTabMenu = ({ sections, onAdd }: AddTabMenuProps) => {
  const visible = sections.filter((section) => section.tabs.length > 0)
  if (!visible.length) return null

  return (
    <Menu>
      <MenuButton className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200">
        <Plus className="h-3.5 w-3.5" />
        Add tab
      </MenuButton>
      <MenuItems anchor="bottom start" className={`${MENU_ITEMS_CLASS} w-80`}>
        {visible.map((section, index) => (
          <MenuSection key={section.key}>
            {index > 0 && <MenuSeparator className="my-1 h-px bg-gray-200 dark:bg-gray-700" />}
            <MenuHeading className={`${MENU_HEADING_CLASS} flex items-center gap-1.5`}>
              {section.color && <ColorDot color={section.color} className="h-2 w-2" />}
              <span className="truncate">{section.label}</span>
            </MenuHeading>
            {section.tabs.map((tab) => (
              <MenuItem key={tab.id}>
                <button type="button" className={MENU_ITEM_CLASS} onClick={() => onAdd(tab)}>
                  <Favicon url={tab.favIconUrl} />
                  <span className="min-w-0 flex-1 truncate text-xs">{tab.title}</span>
                </button>
              </MenuItem>
            ))}
          </MenuSection>
        ))}
      </MenuItems>
    </Menu>
  )
}
