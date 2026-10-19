type LanguageModelAvailability = "unavailable" | "downloadable" | "downloading" | "available"

interface LanguageModelExpected {
  type?: "text" | "image" | "audio"
  languages?: string[]
}

interface LanguageModelMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface LanguageModelCreateMonitor extends EventTarget {
  addEventListener(
    type: "downloadprogress",
    listener: (event: Event & { loaded: number; total?: number }) => void
  ): void
}

interface LanguageModelCreateOptions {
  initialPrompts?: LanguageModelMessage[]
  expectedInputs?: LanguageModelExpected[]
  expectedOutputs?: LanguageModelExpected[]
  signal?: AbortSignal
  monitor?: (monitor: LanguageModelCreateMonitor) => void
}

interface LanguageModelPromptOptions {
  responseConstraint?: object
  omitResponseConstraintInput?: boolean
  signal?: AbortSignal
}

interface LanguageModelSession {
  prompt(input: string, options?: LanguageModelPromptOptions): Promise<string>
  destroy(): void
}

interface LanguageModelStatic {
  availability(options?: Omit<LanguageModelCreateOptions, "monitor" | "signal" | "initialPrompts">): Promise<LanguageModelAvailability>
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>
}

declare var LanguageModel: LanguageModelStatic | undefined
