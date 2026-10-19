import { useEffect, useState } from "react"

import { getItem, normalizeValue, type StorageKey, type StorageSchema } from "~src/core/storage"

export const useStorageValue = <TKey extends StorageKey>(key: TKey) => {
  const [value, setValue] = useState<StorageSchema[TKey]>(() => normalizeValue(key, undefined))

  useEffect(() => {
    let active = true
    void getItem(key).then((initial) => {
      if (active) setValue(initial)
    })
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local" || !changes[key]) return
      setValue(normalizeValue(key, changes[key].newValue))
    }
    chrome.storage.onChanged.addListener(listener)
    return () => {
      active = false
      chrome.storage.onChanged.removeListener(listener)
    }
  }, [key])

  return value
}
