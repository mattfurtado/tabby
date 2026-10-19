import { Clock, Copy, GitMerge, GitPullRequestClosed, Plus, Search, Video } from "lucide-react"
import type { ComponentType } from "react"

import { BADGE_LABELS, formatAge, type BadgeKind } from "../rows"
import { cx } from "./ui"

const STYLES: Record<BadgeKind, { className: string; icon: ComponentType<{ className?: string }> }> = {
  "pr-merged": { className: "bg-[#8250df] dark:bg-[#8957e5]", icon: GitMerge },
  "pr-closed": { className: "bg-[#cf222e] dark:bg-[#da3633]", icon: GitPullRequestClosed },
  duplicate: { className: "bg-ember-500", icon: Copy },
  zoom: { className: "bg-[#2d8cff]", icon: Video },
  newtab: { className: "bg-teal-600", icon: Plus },
  search: { className: "bg-amber-600", icon: Search },
  stale: { className: "bg-gray-500", icon: Clock }
}

export const CleanupBadge = ({ kind, staleSince }: { kind: BadgeKind; staleSince?: number | null }) => {
  const { className, icon: Icon } = STYLES[kind]
  const label = kind === "stale" && staleSince ? `Stale ${formatAge(staleSince)}` : BADGE_LABELS[kind]
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white",
        className
      )}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

export const CurrentBadge = () => (
  <span className="inline-flex shrink-0 items-center rounded-full border border-ember-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-ember-600 dark:text-ember-400">
    current
  </span>
)
