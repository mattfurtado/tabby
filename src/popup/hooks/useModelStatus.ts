import { useEffect, useState } from "react"

import { modelAvailability } from "~src/core/ai"

export const useModelStatus = (enabled: boolean) => {
  const [status, setStatus] = useState<LanguageModelAvailability>("unavailable")

  useEffect(() => {
    if (!enabled) {
      setStatus("unavailable")
      return
    }
    let active = true
    void modelAvailability().then((next) => {
      if (active) setStatus(next)
    })
    return () => {
      active = false
    }
  }, [enabled])

  return status
}
