import type { PlasmoCSConfig } from "plasmo"

import type { PRState } from "~src/core/types"
import { canonicalPRUrl } from "~src/core/url"

export const config: PlasmoCSConfig = {
  matches: ["https://github.com/*/pull/*"],
  run_at: "document_idle"
}

const RETRY_DELAYS = [0, 500, 1500, 3000, 6000]
const OBSERVER_DEBOUNCE = 400

const isInvalidated = (error: unknown) => String(error instanceof Error ? error.message : error).includes("Extension context invalidated")

const readState = (): PRState | null => {
  const label = document.querySelector('[data-component="StateLabel"][data-status]')
  const status = label?.getAttribute("data-status") ?? ""
  if (status === "pullMerged" || status === "merged") return "merged"
  if (status === "pullClosed" || status === "closed") return "closed"
  return null
}

const hasLabel = () => !!document.querySelector('[data-component="StateLabel"][data-status]')

let lastSynced: string | null = null

const sync = async () => {
  const url = canonicalPRUrl(location.href)
  if (!url || !chrome.runtime?.id || !hasLabel()) return
  const state = readState()
  const signature = `${url}:${state}`
  if (signature === lastSynced) return
  try {
    const stored = await chrome.storage.local.get("pr_states")
    const states = (stored.pr_states ?? {}) as Record<string, PRState>
    lastSynced = signature
    if (state && states[url] === state) return
    if (!state && !(url in states)) return
    const next = { ...states }
    if (state) next[url] = state
    else delete next[url]
    await chrome.storage.local.set({ pr_states: next })
  } catch (error) {
    if (isInvalidated(error)) return
    console.warn("[Tabby] PR state sync failed", error)
  }
}

const initialRun = (attempt = 0) => {
  if (hasLabel() || attempt >= RETRY_DELAYS.length - 1) {
    void sync()
    return
  }
  setTimeout(() => initialRun(attempt + 1), RETRY_DELAYS[attempt + 1])
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
const observer = new MutationObserver(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    try {
      void sync()
    } catch (error) {
      if (!isInvalidated(error)) throw error
    }
  }, OBSERVER_DEBOUNCE)
})

observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-status"] })
initialRun()
