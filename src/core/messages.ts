import type { GroupColor } from "./types"

export type Message =
  | { type: "REFRESH_SUGGESTIONS" }
  | { type: "APPLY_SUGGESTION"; tabIds: number[]; name: string; color: GroupColor; suggestionId?: string }
  | { type: "RENAME_SUGGESTION"; suggestionId: string; name: string; color?: GroupColor }
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
}

export const sendMessage = async (message: Message): Promise<MessageResponse> => {
  try {
    const response = (await chrome.runtime.sendMessage(message)) as MessageResponse | undefined
    return response ?? { ok: false, error: "No response" }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
