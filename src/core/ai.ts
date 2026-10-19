import { isGroupColor } from "./storage"
import { hashColor, makeSuggestion } from "./heuristics"
import type { AIRunResult, GroupSuggestion, Settings, TabInfo } from "./types"
import { GROUP_COLORS, MAX_CUSTOM_INSTRUCTIONS } from "./types"
import { hostnameOf } from "./url"

const LANGUAGE_OPTIONS: Pick<LanguageModelCreateOptions, "expectedInputs" | "expectedOutputs"> = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }]
}

const getLanguageModel = () => (typeof LanguageModel === "undefined" ? undefined : LanguageModel)

export const modelAvailability = async (): Promise<LanguageModelAvailability> => {
  const model = getLanguageModel()
  if (!model) return "unavailable"
  try {
    return await model.availability(LANGUAGE_OPTIONS)
  } catch {
    return "unavailable"
  }
}

export const downloadModel = async (onProgress: (fraction: number) => void) => {
  const model = getLanguageModel()
  if (!model) throw new Error("The Prompt API is not available in this browser")
  const session = await model.create({
    ...LANGUAGE_OPTIONS,
    monitor: (monitor) => monitor.addEventListener("downloadprogress", (event) => onProgress(event.loaded))
  })
  session.destroy()
}

const GROUPING_SYSTEM_PROMPT = [
  "You organize browser tabs into tab groups.",
  "Group tabs by the topic, project or task they relate to, not by website.",
  "Name each group after its topic, never with a generic service name like \"GitHub\" or \"Google Docs\".",
  "Group names must be under 30 characters.",
  "Never put the same tab in more than one group.",
  `Colors must be one of: ${GROUP_COLORS.join(", ")}.`,
  "Respond with JSON only, no prose and no code fences."
].join("\n")

const NAMING_SYSTEM_PROMPT = [
  "You name browser tab groups.",
  "Give a short topic-based name under 30 characters that describes what the tabs have in common.",
  "Avoid generic service names. Respond with the name only."
].join("\n")

const GROUPS_SCHEMA = {
  type: "object",
  properties: {
    groups: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          color: { type: "string", enum: [...GROUP_COLORS] },
          tabIndexes: { type: "array", items: { type: "integer" } }
        },
        required: ["name", "color", "tabIndexes"]
      }
    }
  },
  required: ["groups"]
}

const withInstructions = (base: string, custom: string) => {
  const trimmed = custom.trim().slice(0, MAX_CUSTOM_INSTRUCTIONS)
  if (!trimmed) return base
  return `${base}\n\nAdditional instructions from the user:\n${trimmed}`
}

const tabLine = (tab: TabInfo, index: number) => `[${index}] "${tab.title.replace(/"/g, "'")}" (${hostnameOf(tab.url)})`

export const parseJsonObject = (text: string): unknown => {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}

interface RawGroup {
  name?: unknown
  color?: unknown
  tabIndexes?: unknown
}

const promptWithFallback = async (session: LanguageModelSession, prompt: string) => {
  try {
    return await session.prompt(prompt, { responseConstraint: GROUPS_SCHEMA })
  } catch {
    return session.prompt(prompt)
  }
}

export interface AISuggestionsResult {
  suggestions: GroupSuggestion[]
  run: AIRunResult
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

export const aiSuggestions = async (
  tabs: TabInfo[],
  heuristics: GroupSuggestion[],
  settings: Settings
): Promise<AISuggestionsResult> => {
  const empty = (run: Omit<AIRunResult, "groupCount">): AISuggestionsResult => ({ suggestions: [], run: { ...run, groupCount: 0 } })
  const model = getLanguageModel()
  if (!model) return empty({ status: "unavailable", availability: "missing", error: "The Prompt API isn't available in this browser" })
  if (tabs.length < settings.minGroupSize) return empty({ status: "skipped" })
  const availability = await modelAvailability()
  if (availability !== "available") return empty({ status: "unavailable", availability })

  let session: LanguageModelSession | null = null
  try {
    session = await model.create({
      ...LANGUAGE_OPTIONS,
      initialPrompts: [{ role: "system", content: withInstructions(GROUPING_SYSTEM_PROMPT, settings.customInstructions) }]
    })

    const indexById = new Map(tabs.map((tab, index) => [tab.id, index]))
    const constraints = [
      `Each group needs at least ${settings.minGroupSize} tabs.`,
      settings.maxGroupSize ? `Each group can have at most ${settings.maxGroupSize} tabs.` : null,
      settings.maxGroups ? `Create at most ${settings.maxGroups} groups.` : null,
      "Leave tabs ungrouped if they do not fit a group."
    ].filter(Boolean)
    const starting = heuristics.length
      ? heuristics
          .map((group) => `- ${group.name}: [${group.tabIds.map((id) => indexById.get(id)).filter((i) => i !== undefined).join(", ")}]`)
          .join("\n")
      : "- (none)"

    const prompt = [
      "Tabs:",
      tabs.map(tabLine).join("\n"),
      "",
      "Constraints:",
      constraints.join("\n"),
      "",
      "Groups found by simple rules, as a starting point (improve and rename them by topic):",
      starting,
      "",
      'Reply as {"groups":[{"name":"...","color":"...","tabIndexes":[0,1]}]}'
    ].join("\n")

    const reply = await promptWithFallback(session, prompt)
    const parsed = parseJsonObject(reply) as { groups?: unknown } | null
    if (!parsed || !Array.isArray(parsed.groups)) {
      console.warn("[Tabby] AI reply wasn't valid JSON", reply)
      return empty({ status: "error", availability, error: "The model's reply couldn't be read" })
    }

    const used = new Set<number>()
    const result: GroupSuggestion[] = []
    for (const raw of parsed.groups as RawGroup[]) {
      if (settings.maxGroups && result.length >= settings.maxGroups) break
      if (typeof raw?.name !== "string" || !Array.isArray(raw.tabIndexes)) continue
      const name = raw.name.trim().slice(0, 30)
      if (!name) continue
      const picked: TabInfo[] = []
      for (const index of raw.tabIndexes) {
        if (typeof index !== "number" || used.has(index) || !tabs[index]) continue
        if (settings.maxGroupSize && picked.length >= settings.maxGroupSize) break
        picked.push(tabs[index])
        used.add(index)
      }
      if (picked.length < settings.minGroupSize) {
        picked.forEach((tab) => used.delete(indexById.get(tab.id)!))
        continue
      }
      const color = isGroupColor(raw.color) ? raw.color : hashColor(name)
      result.push(makeSuggestion(name, color, picked, "ai"))
    }
    return {
      suggestions: result,
      run: { status: result.length ? "used" : "no-groups", groupCount: result.length, availability }
    }
  } catch (error) {
    console.warn("[Tabby] AI grouping failed", error)
    return empty({ status: "error", availability, error: errorMessage(error) })
  } finally {
    session?.destroy()
  }
}

export const suggestGroupName = async (tabs: TabInfo[], customInstructions: string) => {
  const model = getLanguageModel()
  if (!model || !tabs.length) return null
  if ((await modelAvailability()) !== "available") return null

  let session: LanguageModelSession | null = null
  try {
    session = await model.create({
      ...LANGUAGE_OPTIONS,
      initialPrompts: [{ role: "system", content: withInstructions(NAMING_SYSTEM_PROMPT, customInstructions) }]
    })
    const reply = await session.prompt(`Tabs:\n${tabs.map(tabLine).join("\n")}\n\nGroup name:`)
    const name = reply.replace(/["`*]/g, "").split("\n")[0].trim().slice(0, 30)
    return name || null
  } catch (error) {
    console.warn("[Tabby] AI naming failed", error)
    return null
  } finally {
    session?.destroy()
  }
}
