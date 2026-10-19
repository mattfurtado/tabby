export const isHttpUrl = (url: string | undefined): url is string => !!url && /^https?:\/\//i.test(url)

export const safeUrl = (url: string | undefined) => {
  if (!url) return null
  try {
    return new URL(url)
  } catch {
    return null
  }
}

export const hostnameOf = (url: string | undefined) => safeUrl(url)?.hostname.replace(/^www\./, "") ?? ""

export const displayUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")

export const stripHash = (url: string) => {
  const index = url.indexOf("#")
  return index === -1 ? url : url.slice(0, index)
}

const PR_PATTERN = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#]|$)/

export const canonicalPRUrl = (url: string | undefined) => {
  if (!url) return null
  const match = url.match(PR_PATTERN)
  if (!match) return null
  return `https://github.com/${match[1]}/${match[2]}/pull/${match[3]}`
}

export const ZOOM_PATTERN = /^https?:\/\/(?:[^/]*\.)?zoom\.us\/(?:j|s|w|wc)\//

const NEW_TAB_PREFIXES = ["chrome://newtab", "chrome://new-tab-page", "chrome-search://", "about:blank"]

export const isNewTabUrl = (url: string | undefined) =>
  !!url && NEW_TAB_PREFIXES.some((prefix) => url.startsWith(prefix))

export const isGoogleSearchUrl = (url: string | undefined) => {
  const parsed = safeUrl(url)
  if (!parsed || !/^https?:$/.test(parsed.protocol)) return false
  if (!/^(?:www\.)?google\.[a-z.]+$/.test(parsed.hostname)) return false
  if (parsed.pathname !== "/search") return false
  return parsed.searchParams.has("q")
}
