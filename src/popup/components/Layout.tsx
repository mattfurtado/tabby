import { LayoutList, Layers, Loader2, Maximize2, Plus, RefreshCw, Settings, Trash2, X } from "lucide-react"
import { useEffect, useState, type ComponentType } from "react"

import logoUrl from "data-base64:~assets/logo.png"

import { sendMessage } from "~src/core/messages"

import type { TabRow } from "../rows"
import { useStorageValue } from "../hooks/useStorageValue"
import { usePopupStore, type TopView } from "../store"
import { RefreshStatus } from "./RefreshStatus"
import { Button, cx, IconButton } from "./ui"

export const Logo = () => <img src={logoUrl} alt="" className="h-7 w-7" />

const FULLSCREEN_URL = "tabs/fullscreen.html"

export const Header = ({ fullscreen }: { fullscreen: boolean }) => {
  const openFullscreen = async () => {
    const url = chrome.runtime.getURL(FULLSCREEN_URL)
    const [existing] = await chrome.tabs.query({ url })
    if (existing?.id !== undefined) {
      await chrome.tabs.update(existing.id, { active: true })
      await chrome.windows.update(existing.windowId, { focused: true })
    } else {
      await chrome.tabs.create({ url })
    }
    window.close()
  }

  return (
    <header className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-2.5 dark:border-gray-800 dark:bg-gray-950">
      <Logo />
      <h1 className="flex-1 text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">Tabby</h1>
      {!fullscreen && (
        <IconButton onClick={() => void openFullscreen()} title="Open in a tab" aria-label="Open in a tab">
          <Maximize2 className="h-4 w-4" />
        </IconButton>
      )}
      <IconButton onClick={() => chrome.runtime.openOptionsPage()} title="Settings" aria-label="Settings">
        <Settings className="h-4 w-4" />
      </IconButton>
    </header>
  )
}

const NAV: { view: TopView; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { view: "groups", label: "Groups", icon: Layers },
  { view: "tabs", label: "Tabs", icon: LayoutList }
]

export const Sidebar = ({ counts }: { counts: Record<TopView, number> }) => {
  const view = usePopupStore((state) => state.view)
  const setView = usePopupStore((state) => state.setView)
  return (
    <nav className="flex w-36 shrink-0 flex-col gap-1 border-r border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-950">
      {NAV.map(({ view: item, label, icon: Icon }) => (
        <button
          key={item}
          type="button"
          onClick={() => setView(item)}
          aria-current={view === item ? "page" : undefined}
          className={cx(
            "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
            view === item
              ? "bg-ginger-50 text-ginger-700 dark:bg-ginger-950/60 dark:text-ginger-300"
              : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          )}>
          <Icon className="h-4 w-4" />
          <span className="flex-1 text-left">{label}</span>
          {counts[item] > 0 && (
            <span
              className={cx(
                "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none",
                view === item ? "bg-ginger-600 text-white" : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
              )}>
              {counts[item]}
            </span>
          )}
        </button>
      ))}
    </nav>
  )
}

const MIN_REFRESH_MS = 600

interface FooterProps {
  onRefresh: () => Promise<string | null>
  selectedRows: TabRow[]
  useAI: boolean
}

export const Footer = ({ onRefresh, selectedRows, useAI }: FooterProps) => {
  const view = usePopupStore((state) => state.view)
  const openCreateGroup = usePopupStore((state) => state.openCreateGroup)
  const setSelected = usePopupStore((state) => state.setSelected)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const analysisStatus = useStorageValue("analysis_status")

  const selectedTabIds = selectedRows.flatMap((row) => row.tabs.map((tab) => tab.id))
  const count = selectedTabIds.length

  useEffect(() => {
    if (!count) setConfirmClose(false)
  }, [count])

  const refresh = async () => {
    setRefreshing(true)
    setRefreshError(null)
    const [error] = await Promise.all([onRefresh(), new Promise((resolve) => setTimeout(resolve, MIN_REFRESH_MS))])
    setRefreshError(error)
    setRefreshing(false)
  }

  const closeSelected = async () => {
    setConfirmClose(false)
    await sendMessage({
      type: "CLOSE_BULK",
      items: selectedRows.map((row) => ({ id: row.key, tabIds: row.tabs.map((tab) => tab.id) }))
    })
    setSelected([])
  }

  const refreshButton = (
    <>
      <Button variant="ghost" size="md" onClick={() => void refresh()} disabled={refreshing}>
        {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {refreshing ? "Refreshing…" : "Refresh"}
      </Button>
      <RefreshStatus refreshing={refreshing} useAI={useAI} status={analysisStatus} error={refreshError} />
    </>
  )

  if (view === "groups") {
    return (
      <footer className="flex items-center gap-2 border-t border-gray-200 bg-white px-4 py-2.5 dark:border-gray-800 dark:bg-gray-950">
        {refreshButton}
        <div className="min-w-2 flex-1" />
        <Button variant="primary" size="md" onClick={() => openCreateGroup()}>
          <Plus className="h-4 w-4" />
          New group
        </Button>
      </footer>
    )
  }

  if (confirmClose) {
    return (
      <footer className="flex items-center gap-2 border-t border-red-200 bg-red-50 px-4 py-2.5 dark:border-red-900/60 dark:bg-red-950/40">
        <span className="flex-1 text-sm text-red-800 dark:text-red-200">
          Close {count} {count === 1 ? "tab" : "tabs"}? This can't be undone.
        </span>
        <Button variant="ghost" size="md" onClick={() => setConfirmClose(false)}>
          <X className="h-4 w-4" />
          Cancel
        </Button>
        <Button variant="danger" size="md" onClick={() => void closeSelected()}>
          <Trash2 className="h-4 w-4" />
          Close
        </Button>
      </footer>
    )
  }

  return (
    <footer className="flex items-center gap-2 border-t border-gray-200 bg-white px-4 py-2.5 dark:border-gray-800 dark:bg-gray-950">
      {refreshButton}
      <div className="flex-1" />
      <Button variant="danger" size="md" disabled={!count} onClick={() => setConfirmClose(true)}>
        <Trash2 className="h-4 w-4" />
        Close{count ? ` (${count})` : ""}
      </Button>
      <Button variant="primary" size="md" disabled={!count} onClick={() => openCreateGroup(selectedTabIds)}>
        <Layers className="h-4 w-4" />
        Group{count ? ` (${count})` : ""}
      </Button>
    </footer>
  )
}
