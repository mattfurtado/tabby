import type { GroupColor, GroupSuggestion, Settings, TabInfo } from "./types"
import { GROUP_COLORS } from "./types"
import { safeUrl } from "./url"

interface ServiceRule {
  key: string
  name: string
  color: GroupColor
  match: (host: string, path: string) => boolean
}

const host = (...hosts: string[]) => (h: string) => hosts.some((item) => h === item || h.endsWith(`.${item}`))

const SERVICE_RULES: ServiceRule[] = [
  { key: "google-docs", name: "Google Docs", color: "blue", match: (h, p) => h === "docs.google.com" && p.startsWith("/document") },
  { key: "google-sheets", name: "Google Sheets", color: "green", match: (h, p) => h === "docs.google.com" && p.startsWith("/spreadsheets") },
  { key: "google-slides", name: "Google Slides", color: "yellow", match: (h, p) => h === "docs.google.com" && p.startsWith("/presentation") },
  { key: "google-forms", name: "Google Forms", color: "purple", match: (h, p) => h === "docs.google.com" && p.startsWith("/forms") },
  { key: "google-drive", name: "Google Drive", color: "yellow", match: (h) => h === "drive.google.com" },
  { key: "gmail", name: "Gmail", color: "red", match: (h) => h === "mail.google.com" },
  { key: "google-calendar", name: "Calendar", color: "blue", match: (h) => h === "calendar.google.com" },
  { key: "google-meet", name: "Meet", color: "green", match: (h) => h === "meet.google.com" },
  { key: "stackoverflow", name: "Stack Overflow", color: "yellow", match: host("stackoverflow.com", "stackexchange.com") },
  { key: "mdn", name: "MDN", color: "grey", match: (h) => h === "developer.mozilla.org" },
  { key: "npm", name: "npm", color: "red", match: host("npmjs.com") },
  { key: "notion", name: "Notion", color: "grey", match: host("notion.so", "notion.site") },
  { key: "linear", name: "Linear", color: "purple", match: host("linear.app") },
  { key: "figma", name: "Figma", color: "pink", match: host("figma.com") },
  { key: "confluence", name: "Confluence", color: "blue", match: (h, p) => h.endsWith("atlassian.net") && p.startsWith("/wiki") },
  { key: "jira", name: "Jira", color: "blue", match: (h, p) => (h.endsWith("atlassian.net") && !p.startsWith("/wiki")) || h.startsWith("jira.") },
  { key: "slack", name: "Slack", color: "purple", match: host("slack.com") },
  { key: "youtube", name: "YouTube", color: "red", match: (h) => h === "youtube.com" || h === "m.youtube.com" || h === "youtu.be" },
  { key: "spotify", name: "Spotify", color: "green", match: host("spotify.com") }
]

const CHROME_INTERNAL_HOSTS = new Set(["newtab", "extensions", "settings", "history", "downloads", "bookmarks"])

const GITHUB_RESERVED = new Set([
  "settings", "notifications", "pulls", "issues", "explore", "marketplace", "orgs", "sponsors", "topics",
  "trending", "login", "new", "codespaces", "features", "search", "collections", "dashboard"
])

export interface Bucket {
  key: string
  name: string
  color?: GroupColor
}

export const classifyUrl = (url: string): Bucket | null => {
  const parsed = safeUrl(url)
  if (!parsed) return null
  const hostname = parsed.hostname.replace(/^www\./, "")
  if (CHROME_INTERNAL_HOSTS.has(hostname)) return null
  if (!/^https?:$/.test(parsed.protocol)) return null
  const path = parsed.pathname

  const rule = SERVICE_RULES.find((item) => item.match(hostname, path))
  if (rule) return { key: rule.key, name: rule.name, color: rule.color }

  if (hostname === "github.com") {
    const [owner, repo] = path.split("/").filter(Boolean)
    if (!owner || GITHUB_RESERVED.has(owner)) return { key: "github", name: "GitHub" }
    if (!repo) return { key: `github:${owner}`, name: owner }
    return { key: `github:${owner}/${repo}`.toLowerCase(), name: repo }
  }

  return null
}

export const hashColor = (name: string): GroupColor => {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length]
}

export const suggestionId = (tabIds: number[]) => `sg_${[...tabIds].sort((a, b) => a - b).join("_")}`

export const makeSuggestion = (
  name: string,
  color: GroupColor,
  tabs: TabInfo[],
  source: GroupSuggestion["source"]
): GroupSuggestion => {
  const tabIds = tabs.map((tab) => tab.id)
  return { id: suggestionId(tabIds), name, color, tabIds, tabs, source }
}

const chunk = <TItem>(items: TItem[], size: number | null) => {
  if (!size || items.length <= size) return [items]
  const chunks: TItem[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

export const heuristicSuggestions = (
  tabs: TabInfo[],
  settings: Pick<Settings, "minGroupSize" | "maxGroupSize" | "maxGroups">
): GroupSuggestion[] => {
  const buckets = new Map<string, { bucket: Bucket; tabs: TabInfo[] }>()
  for (const tab of tabs) {
    const bucket = classifyUrl(tab.url)
    if (!bucket) continue
    const entry = buckets.get(bucket.key) ?? { bucket, tabs: [] }
    entry.tabs.push(tab)
    buckets.set(bucket.key, entry)
  }

  const suggestions: GroupSuggestion[] = []
  const ordered = [...buckets.values()].sort((a, b) => b.tabs.length - a.tabs.length)
  for (const { bucket, tabs: bucketTabs } of ordered) {
    for (const part of chunk(bucketTabs, settings.maxGroupSize)) {
      if (part.length < settings.minGroupSize) continue
      suggestions.push(makeSuggestion(bucket.name, bucket.color ?? hashColor(bucket.name), part, "heuristic"))
    }
  }

  if (!settings.maxGroups) return suggestions
  return suggestions.slice(0, settings.maxGroups)
}
