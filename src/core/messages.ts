import type { AnalysisStatus, GroupColor } from "./types"

// The popup and full page hold a port with this name open while they're showing
export const UI_PORT_NAME = "tabby-ui"

export type Message =
  | { type: "REFRESH_SUGGESTIONS" }
  | { type: "APPLY_SUGGESTION"; tabIds: number[]; name: string; color: GroupColor; suggestionId?: string }
  | { type: "RENAME_SUGGESTION"; suggestionId: string; name: string; color?: GroupColor }
  | { type: "REMOVE_FROM_SUGGESTION"; suggestionId: string; tabId: number }
  | { type: "ADD_TO_SUGGESTION"; suggestionId: string; tabId: number }
  | { type: "ADD_TO_GROUP"; groupId: number; tabIds: number[] }
  | { type: "CLOSE_TAB"; tabId: number; suggestionId?: string }
  | { type: "CLOSE_BULK"; items: { id: string; tabIds: number[] }[] }
  | { type: "DISMISS_SUGGESTION"; suggestionId: string }
  | { type: "DISMISS_BULK"; suggestionIds: string[] }
  | { type: "DISMISS_PR_TAB"; url: string }
  | { type: "DISMISS_STALE_TAB"; tabId: number; lastAccessed: number }
  | { type: "DISMISS_DUPLICATE_TAB"; suggestionId: string }

export type MessageType = Message["type"]

export interface MessageResponse {
  ok: boolean
  error?: string
  groupId?: number
  status?: AnalysisStatus | null
}

export const sendMessage = async (message: Message): Promise<MessageResponse> => {
  try {
    const response = (await chrome.runtime.sendMessage(message)) as MessageResponse | undefined
    return response ?? { ok: false, error: "No response" }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
