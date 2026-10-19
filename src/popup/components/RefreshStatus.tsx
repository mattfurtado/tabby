import { AlertTriangle } from "lucide-react"
import { useEffect, useState } from "react"

import type { AIRunResult, AnalysisStatus } from "~src/core/types"

import { cx } from "./ui"

const relativeTime = (since: number, now: number) => {
  const seconds = Math.max(0, Math.round((now - since) / 1000))
  if (seconds < 10) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.round(minutes / 60)}h ago`
}

const FADE_AFTER_MS = 5000

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`

export const aiProblem = (ai: AIRunResult) => {
  if (ai.status === "unavailable") {
    if (ai.availability === "downloadable") return "Gemini Nano isn't downloaded yet"
    if (ai.availability === "downloading") return "Gemini Nano is still downloading"
    return ai.error ?? "Gemini Nano isn't available on this device"
  }
  if (ai.status === "error") return `AI grouping failed: ${ai.error ?? "unknown error"}`
  return null
}

interface RefreshStatusProps {
  refreshing: boolean
  useAI: boolean
  status: AnalysisStatus
  error: string | null
}

export const RefreshStatus = ({ refreshing, useAI, status, error }: RefreshStatusProps) => {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [status.finishedAt])

  if (refreshing) return null

  if (error) {
    return <span className="truncate text-xs text-red-600 dark:text-red-400">Refresh failed: {error}</span>
  }

  if (!status.finishedAt) return null

  const problem = useAI ? aiProblem(status.ai) : null
  const suggestions = status.newSuggestionCount ? plural(status.newSuggestionCount, "new suggestion") : "no new suggestions"
  const parts = [`Updated ${relativeTime(status.finishedAt, now)}`, suggestions, useAI ? null : "AI off"].filter(Boolean)
  const faded = !problem && now - status.finishedAt >= FADE_AFTER_MS

  return (
    <span
      aria-hidden={faded}
      className={cx(
        "flex min-w-0 items-center gap-1.5 text-xs transition-opacity duration-500",
        problem ? "text-amber-700 dark:text-amber-400" : "text-gray-500 dark:text-gray-400",
        faded && "opacity-0"
      )}
      title={problem ?? `Took ${(status.durationMs / 1000).toFixed(1)}s`}>
      {problem && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate">{problem ? `${parts[0]} · using rules` : parts.join(" · ")}</span>
    </span>
  )
}
