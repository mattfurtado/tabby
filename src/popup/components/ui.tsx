import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react"
import { Check, Globe } from "lucide-react"
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react"

import { GROUP_COLORS, type GroupColor } from "~src/core/types"

export const GROUP_COLOR_HEX: Record<GroupColor, string> = {
  grey: "#5f6368",
  blue: "#1a73e8",
  red: "#d93025",
  yellow: "#f9ab00",
  green: "#188038",
  pink: "#d01884",
  purple: "#a142f4",
  cyan: "#007b83"
}

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ")

type TVariant = "primary" | "danger" | "ghost" | "outline"

const VARIANTS: Record<TVariant, string> = {
  primary:
    "bg-gray-800 text-white hover:bg-gray-700 disabled:bg-gray-800/50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white dark:disabled:bg-gray-100/50",
  danger: "bg-red-600 text-white hover:bg-red-500 disabled:bg-red-600/50",
  ghost: "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
  outline:
    "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: TVariant
  size?: "sm" | "md"
}

export const Button = ({ variant = "outline", size = "sm", className, ...props }: ButtonProps) => (
  <button
    type="button"
    className={cx(
      "inline-flex shrink-0 items-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
      size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
      VARIANTS[variant],
      className
    )}
    {...props}
  />
)

export const IconButton = ({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    className={cx(
      "rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100",
      className
    )}
    {...props}
  />
)

export const ColorDot = ({ color, className }: { color: GroupColor; className?: string }) => (
  <span
    className={cx("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)}
    style={{ backgroundColor: GROUP_COLOR_HEX[color] }}
  />
)

export const Favicon = ({ url, className }: { url?: string; className?: string }) => {
  const [failed, setFailed] = useState(false)
  if (!url || failed || url.startsWith("chrome://")) {
    return <Globe className={cx("h-4 w-4 shrink-0 text-gray-400", className)} />
  }
  return <img src={url} alt="" className={cx("h-4 w-4 shrink-0 rounded-sm", className)} onError={() => setFailed(true)} />
}

export const ColorPicker = ({ value, onChange }: { value: GroupColor; onChange: (color: GroupColor) => void }) => (
  <Menu>
    <MenuButton
      className="flex items-center rounded-md p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
      title="Change color"
      aria-label="Change color">
      <ColorDot color={value} className="h-3.5 w-3.5" />
    </MenuButton>
    <MenuItems
      anchor="bottom start"
      className="z-50 mt-1 grid grid-cols-4 gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg focus:outline-none dark:border-gray-700 dark:bg-gray-900">
      {GROUP_COLORS.map((color) => (
        <MenuItem key={color}>
          <button
            type="button"
            title={color}
            onClick={() => onChange(color)}
            className="flex h-6 w-6 items-center justify-center rounded-full data-[focus]:ring-2 data-[focus]:ring-ginger-400"
            style={{ backgroundColor: GROUP_COLOR_HEX[color] }}>
            {color === value && <Check className="h-3.5 w-3.5 text-white" />}
          </button>
        </MenuItem>
      ))}
    </MenuItems>
  </Menu>
)

export const MENU_ITEMS_CLASS =
  "z-50 mt-1 max-h-72 min-w-48 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg focus:outline-none dark:border-gray-700 dark:bg-gray-900"

export const MENU_ITEM_CLASS =
  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-gray-700 data-[focus]:bg-gray-100 dark:text-gray-200 dark:data-[focus]:bg-gray-800"

export const MENU_HEADING_CLASS = "px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400"

export const EmptyState = ({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) => (
  <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center text-gray-500 dark:text-gray-400">
    <div className="text-gray-300 dark:text-gray-600">{icon}</div>
    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{title}</p>
    {children && <div className="text-xs">{children}</div>}
  </div>
)

export const activateTab = async (tabId: number) => {
  const tab = await chrome.tabs.update(tabId, { active: true }).catch(() => undefined)
  if (!tab) return
  await chrome.windows.update(tab.windowId, { focused: true })
}
