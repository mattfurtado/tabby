import { AlertTriangle, Loader2 } from "lucide-react"
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

const aiSummary = (ai: AIRunResult) => {
  if (ai.status === "used") return plural(ai.groupCount, "AI group")
  if (ai.status === "no-groups") return ai.groupCount ? plural(ai.groupCount, "AI group") : "AI found no groups"
  if (ai.status === "skipped") return "not enough ungrouped tabs for AI"
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
    const timer = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [status.finishedAt])

  if (refreshing) {
    return (
      <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-gray-500 dark:text-gray-400">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        {useAI ? "Asking Gemini Nano… this can take a few seconds" : "Refreshing…"}
      </span>
    )
  }

  if (error) {
    return <span className="truncate text-xs text-red-600 dark:text-red-400">Refresh failed: {error}</span>
  }

  if (!status.finishedAt) return null

  const problem = useAI ? aiProblem(status.ai) : null
  const summary = useAI ? aiSummary(status.ai) : null
  const parts = [`Updated ${relativeTime(status.finishedAt, now)}`, summary].filter(Boolean)

  return (
    <span
      className={cx(
        "flex min-w-0 items-center gap-1.5 text-xs",
        problem ? "text-amber-700 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"
      )}
      title={problem ?? `Took ${(status.durationMs / 1000).toFixed(1)}s`}>
      {problem && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate">{problem ? `${parts[0]} · using rules` : parts.join(" · ")}</span>
    </span>
  )
}
