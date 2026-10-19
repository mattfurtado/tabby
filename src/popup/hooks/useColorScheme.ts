import { useEffect, useLayoutEffect, useState } from "react"

import { getSettings } from "~src/core/storage"
import { APPEARANCES, type Appearance, type Settings } from "~src/core/types"

const CACHE_KEY = "tabby:appearance"

export const cachedAppearance = (): Appearance => {
  try {
    const value = localStorage.getItem(CACHE_KEY)
    return APPEARANCES.includes(value as Appearance) ? (value as Appearance) : "system"
  } catch {
    return "system"
  }
}

export const cacheAppearance = (appearance: Appearance) => {
  try {
    localStorage.setItem(CACHE_KEY, appearance)
  } catch {
    return
  }
}

export const useAppearance = () => {
  const [appearance, setAppearance] = useState(cachedAppearance)

  useEffect(() => cacheAppearance(appearance), [appearance])

  useEffect(() => {
    let active = true
    void getSettings().then((settings) => {
      if (active) setAppearance(settings.appearance)
    })
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      const next = changes.settings?.newValue as Partial<Settings> | undefined
      if (area === "local" && next?.appearance) setAppearance(next.appearance)
    }
    chrome.storage.onChanged.addListener(listener)
    return () => {
      active = false
      chrome.storage.onChanged.removeListener(listener)
    }
  }, [])

  return appearance
}

export const useColorScheme = (appearance: Appearance) => {
  useLayoutEffect(() => {
    const root = document.documentElement
    if (appearance !== "system") {
      root.classList.toggle("dark", appearance === "dark")
      return
    }
    const query = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = () => root.classList.toggle("dark", query.matches)
    apply()
    query.addEventListener("change", apply)
    return () => query.removeEventListener("change", apply)
  }, [appearance])
}
