import { CheckCircle2, Download, Loader2, Monitor, Moon, Sun, XCircle } from "lucide-react"
import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from "react"

import { downloadModel, modelAvailability } from "~core/ai"
import { getItem, getSettings, normalizeSettings, setItem } from "~core/storage"
import {
  DEFAULT_SETTINGS,
  MAX_CUSTOM_INSTRUCTIONS,
  type Appearance,
  type CleanupChecks,
  type Settings,
  type StaleUnit
} from "~core/types"

import { Logo } from "./components/Layout"
import { cacheAppearance, cachedAppearance, useColorScheme } from "./hooks/useColorScheme"
import { Button, cx } from "./components/ui"

const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={cx(
      "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
      checked ? "bg-ginger-600" : "bg-gray-300 dark:bg-gray-600"
    )}>
    <span
      className={cx(
        "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
        checked ? "translate-x-[18px]" : "translate-x-0.5"
      )}
    />
  </button>
)

const Section = ({ title, description, children }: { title: string; description?: string; children: ReactNode }) => (
  <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
    {description && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>}
    <div className="mt-4 space-y-4">{children}</div>
  </section>
)

const Row = ({ title, description, control }: { title: string; description?: ReactNode; control: ReactNode }) => (
  <div className="flex items-start gap-4">
    <div className="min-w-0 flex-1">
      <div className="text-sm text-gray-800 dark:text-gray-200">{title}</div>
      {description && <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</div>}
    </div>
    <div className="shrink-0">{control}</div>
  </div>
)

const FIELD =
  "rounded-md border border-gray-300 bg-white text-sm text-gray-900 outline-none focus:border-ginger-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"

const NUMBER_INPUT = cx(FIELD, "w-20 px-2 py-1")

const parseOptionalInt = (value: string) => {
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const STATUS_COPY: Record<LanguageModelAvailability, { label: string; tone: string }> = {
  available: { label: "Ready", tone: "text-moss-600 dark:text-moss-400" },
  downloadable: { label: "Not downloaded", tone: "text-amber-600 dark:text-amber-400" },
  downloading: { label: "Downloading…", tone: "text-ginger-600 dark:text-ginger-400" },
  unavailable: { label: "Unavailable on this device", tone: "text-red-600 dark:text-red-400" }
}

const ModelStatus = () => {
  const [status, setStatus] = useState<LanguageModelAvailability | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const check = useCallback(async () => setStatus(await modelAvailability()), [])

  useEffect(() => {
    void check()
  }, [check])

  const download = async () => {
    setError(null)
    setProgress(0)
    setStatus("downloading")
    try {
      await downloadModel(setProgress)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    setProgress(null)
    await check()
  }

  if (!status) return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
  const copy = STATUS_COPY[status]
  const Icon = status === "available" ? CheckCircle2 : status === "unavailable" ? XCircle : Download

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Icon className={cx("h-4 w-4", copy.tone)} />
        <span className={cx("flex-1 text-sm", copy.tone)}>
          {copy.label}
          {progress !== null && ` ${Math.round(progress * 100)}%`}
        </span>
        {(status === "downloadable" || status === "downloading") && (
          <Button variant="primary" onClick={() => void download()} disabled={progress !== null}>
            {progress !== null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Download
          </Button>
        )}
        <Button variant="ghost" onClick={() => void check()}>
          Recheck
        </Button>
      </div>
      {progress !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div className="h-full bg-ginger-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {status === "unavailable" && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Gemini Nano needs desktop Chrome 138+ with On-device AI turned on in Settings &gt; AI Innovations, and capable
          hardware. Tabby keeps working with its built-in rules. See the README for setup steps.
        </p>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

const APPEARANCE_OPTIONS: { value: Appearance; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon }
]

const AppearancePicker = ({ value, onChange }: { value: Appearance; onChange: (value: Appearance) => void }) => (
  <div role="radiogroup" aria-label="Appearance" className="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
    {APPEARANCE_OPTIONS.map(({ value: option, label, icon: Icon }) => (
      <button
        key={option}
        type="button"
        role="radio"
        aria-checked={value === option}
        onClick={() => onChange(option)}
        className={cx(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
          value === option
            ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100"
            : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        )}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </button>
    ))}
  </div>
)

const CHECKS: { key: keyof CleanupChecks; title: string; description: string }[] = [
  { key: "pr", title: "Merged & closed PRs", description: "GitHub pull requests that have been merged or closed." },
  { key: "duplicate", title: "Duplicates", description: "Extra copies of a page that's already open (ignoring #anchors)." },
  { key: "zoom", title: "Zoom links", description: "Zoom join pages left over after a meeting has started." },
  { key: "stale", title: "Stale tabs", description: "Tabs you haven't looked at for a while." },
  { key: "newTab", title: "Empty new tabs", description: "Blank new tab pages you're not currently on." },
  { key: "googleSearch", title: "Google searches", description: "Google search result pages." }
]

export const Options = () => {
  const [saved, setSaved] = useState<Settings | null>(null)
  const [draft, setDraft] = useState<Settings | null>(null)
  const [dismissedCount, setDismissedCount] = useState(0)
  const [savedFlash, setSavedFlash] = useState(false)

  const load = useCallback(async () => {
    const settings = await getSettings()
    const stale = await getItem("dismissed_stale")
    setSaved(settings)
    setDraft(settings)
    setDismissedCount(settings.dismissedSuggestions.length + settings.dismissedPRUrls.length + stale.length)
  }, [])

  useColorScheme(draft?.appearance ?? cachedAppearance())

  useEffect(() => {
    void load()
  }, [load])

  const dirty = !!saved && !!draft && JSON.stringify(saved) !== JSON.stringify(draft)

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  if (!draft || !saved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    )
  }

  const patch = (next: Partial<Settings>) => setDraft({ ...draft, ...next })
  const patchChecks = (next: Partial<CleanupChecks>) => patch({ cleanupChecks: { ...draft.cleanupChecks, ...next } })

  const save = async () => {
    const latest = await getSettings()
    const next = normalizeSettings({
      ...draft,
      dismissedSuggestions: latest.dismissedSuggestions,
      dismissedPRUrls: latest.dismissedPRUrls
    })
    await setItem("settings", next)
    cacheAppearance(next.appearance)
    setSaved(next)
    setDraft(next)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }

  const clearDismissed = async () => {
    const latest = await getSettings()
    const next = { ...latest, dismissedSuggestions: [], dismissedPRUrls: [] }
    await setItem("settings", next)
    await setItem("dismissed_stale", [])
    setSaved({ ...saved, dismissedSuggestions: [], dismissedPRUrls: [] })
    setDraft({ ...draft, dismissedSuggestions: [], dismissedPRUrls: [] })
    setDismissedCount(0)
    void chrome.runtime.sendMessage({ type: "REFRESH_SUGGESTIONS" }).catch(() => undefined)
  }

  const minInvalid = draft.minGroupSize < 2
  const maxInvalid = draft.maxGroupSize !== null && draft.maxGroupSize < draft.minGroupSize
  const staleInvalid = draft.staleThreshold.value < 1
  const defaultsDraft = {
    ...DEFAULT_SETTINGS,
    dismissedSuggestions: draft.dismissedSuggestions,
    dismissedPRUrls: draft.dismissedPRUrls
  }
  const isDefault = JSON.stringify(defaultsDraft) === JSON.stringify(draft)

  return (
    <div className="min-h-screen bg-gray-50 pb-24 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <header className="mb-6 flex items-center gap-3">
          <Logo />
          <h1 className="text-xl font-semibold">Tabby Settings</h1>
        </header>

        <div className="space-y-5">
          <Section title="Appearance">
            <Row
              title="Theme"
              description="System follows your computer's light or dark setting."
              control={<AppearancePicker value={draft.appearance} onChange={(appearance) => patch({ appearance })} />}
            />
          </Section>

          <Section title="AI grouping" description="Runs entirely on your device with Chrome's built-in Gemini Nano.">
            <Row
              title="Use AI"
              description="Name and organize groups by topic. Falls back to built-in rules when the model isn't available."
              control={<Toggle label="Use AI" checked={draft.useAI} onChange={(useAI) => patch({ useAI })} />}
            />
            {draft.useAI && (
              <>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">On-device AI model</div>
                  <ModelStatus />
                </div>
                <div>
                  <label htmlFor="custom-instructions" className="text-sm text-gray-800 dark:text-gray-200">
                    Custom instructions
                  </label>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    Extra guidance for the model, like “Keep work and personal tabs separate” or “Name groups after
                    Jira tickets”.
                  </p>
                  <textarea
                    id="custom-instructions"
                    rows={4}
                    maxLength={MAX_CUSTOM_INSTRUCTIONS}
                    value={draft.customInstructions}
                    onChange={(event) => patch({ customInstructions: event.target.value.slice(0, MAX_CUSTOM_INSTRUCTIONS) })}
                    className={cx(FIELD, "mt-2 w-full resize-y px-3 py-2")}
                  />
                  <div className="text-right text-xs text-gray-500">
                    {draft.customInstructions.length}/{MAX_CUSTOM_INSTRUCTIONS}
                  </div>
                </div>
              </>
            )}
          </Section>

          <Section title="Group suggestions">
            <Row
              title="Minimum group size"
              description={minInvalid ? <span className="text-red-600 dark:text-red-400">Must be at least 2</span> : "Smallest group Tabby will suggest."}
              control={
                <input
                  type="number"
                  min={2}
                  value={draft.minGroupSize}
                  onChange={(event) => patch({ minGroupSize: parseInt(event.target.value, 10) || 0 })}
                  className={NUMBER_INPUT}
                />
              }
            />
            <Row
              title="Maximum group size"
              description={
                maxInvalid ? <span className="text-red-600 dark:text-red-400">Must be at least the minimum size</span> : "Leave empty for no limit."
              }
              control={
                <input
                  type="number"
                  min={2}
                  placeholder="None"
                  value={draft.maxGroupSize ?? ""}
                  onChange={(event) => patch({ maxGroupSize: parseOptionalInt(event.target.value) })}
                  className={NUMBER_INPUT}
                />
              }
            />
            <Row
              title="Maximum number of groups"
              description="Leave empty for no limit."
              control={
                <input
                  type="number"
                  min={1}
                  placeholder="None"
                  value={draft.maxGroups ?? ""}
                  onChange={(event) => patch({ maxGroups: parseOptionalInt(event.target.value) })}
                  className={NUMBER_INPUT}
                />
              }
            />
          </Section>

          <Section title="Cleanup checks" description="Tabs that are probably safe to close.">
            {CHECKS.map((check) => (
              <div key={check.key} className="space-y-2">
                <Row
                  title={check.title}
                  description={check.description}
                  control={
                    <Toggle
                      label={check.title}
                      checked={draft.cleanupChecks[check.key]}
                      onChange={(value) => patchChecks({ [check.key]: value })}
                    />
                  }
                />
                {check.key === "stale" && draft.cleanupChecks.stale && (
                  <div className="flex items-center gap-2 pl-0.5 text-xs text-gray-500 dark:text-gray-400">
                    Not viewed for
                    <input
                      type="number"
                      min={1}
                      value={draft.staleThreshold.value}
                      onChange={(event) =>
                        patch({
                          staleThreshold: { ...draft.staleThreshold, value: parseInt(event.target.value, 10) || 0 }
                        })
                      }
                      className={cx(NUMBER_INPUT, staleInvalid && "border-red-500")}
                      aria-label="Stale threshold"
                    />
                    <select
                      value={draft.staleThreshold.unit}
                      onChange={(event) =>
                        patch({ staleThreshold: { ...draft.staleThreshold, unit: event.target.value as StaleUnit } })
                      }
                      aria-label="Stale threshold unit"
                      className={cx(FIELD, "px-2 py-1")}>
                      <option value="minutes">minutes</option>
                      <option value="hours">hours</option>
                      <option value="days">days</option>
                    </select>
                  </div>
                )}
              </div>
            ))}
          </Section>

          <Section title="Dismissed items">
            <Row
              title={`${dismissedCount} dismissed ${dismissedCount === 1 ? "item" : "items"}`}
              description="Dismissed suggestions and tabs stay hidden until you clear them."
              control={
                <Button variant="outline" disabled={!dismissedCount} onClick={() => void clearDismissed()}>
                  Clear dismissed
                </Button>
              }
            />
          </Section>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-6 py-3">
          <Button
            variant="ghost"
            size="md"
            disabled={isDefault}
            title="Fill the form with default settings. Nothing changes until you click Save."
            onClick={() => setDraft(defaultsDraft)}>
            Restore defaults
          </Button>
          <span className="flex-1 text-sm">
            {dirty ? (
              <span className="text-amber-600 dark:text-amber-400">Unsaved changes</span>
            ) : savedFlash ? (
              <span className="text-moss-600 dark:text-moss-400">Saved</span>
            ) : null}
          </span>
          <Button variant="ghost" size="md" disabled={!dirty} title="Discard unsaved changes" onClick={() => setDraft(saved)}>
            Cancel
          </Button>
          <Button variant="primary" size="md" disabled={!dirty || minInvalid || maxInvalid || staleInvalid} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
