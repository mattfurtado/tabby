import { classifyUrl } from "./heuristics"
import type { AddToGroupAction, GroupAction, GroupColor, MergeGroupsAction, TabInfo } from "./types"

export interface GroupSnapshot {
  id: number
  title: string
  color: GroupColor
  tabs: TabInfo[]
}

export const dominantBucket = (tabs: TabInfo[]) => {
  if (!tabs.length) return null
  const counts = new Map<string, number>()
  for (const tab of tabs) {
    const bucket = classifyUrl(tab.url)
    if (!bucket) continue
    counts.set(bucket.key, (counts.get(bucket.key) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key
      bestCount = count
    }
  }
  if (!best || bestCount * 2 < tabs.length) return null
  return best
}

export const addToGroupId = (groupId: number, tabIds: number[]) =>
  `add_${groupId}_${[...tabIds].sort((a, b) => a - b).join("_")}`

export const mergeGroupsId = (sourceId: number, targetId: number) => `merge_${sourceId}_${targetId}`

export const computeGroupActions = (
  groups: GroupSnapshot[],
  ungrouped: TabInfo[],
  dismissed: Set<string> = new Set()
): GroupAction[] => {
  const dominant = groups
    .map((group) => ({ group, key: dominantBucket(group.tabs) }))
    .filter((entry): entry is { group: GroupSnapshot; key: string } => !!entry.key)

  const actions: GroupAction[] = []
  const claimed = new Set<number>()
  for (const { group, key } of dominant) {
    const tabs = ungrouped.filter((tab) => !claimed.has(tab.id) && classifyUrl(tab.url)?.key === key)
    if (!tabs.length) continue
    const tabIds = tabs.map((tab) => tab.id)
    const id = addToGroupId(group.id, tabIds)
    if (dismissed.has(id)) continue
    tabIds.forEach((tabId) => claimed.add(tabId))
    const action: AddToGroupAction = {
      type: "add-to-group",
      id,
      targetGroupId: group.id,
      targetGroupTitle: group.title,
      targetGroupColor: group.color,
      tabIds,
      tabs
    }
    actions.push(action)
  }

  for (let i = 0; i < dominant.length; i++) {
    for (let j = i + 1; j < dominant.length; j++) {
      if (dominant[i].key !== dominant[j].key) continue
      const [target, source] =
        dominant[i].group.tabs.length >= dominant[j].group.tabs.length
          ? [dominant[i].group, dominant[j].group]
          : [dominant[j].group, dominant[i].group]
      const id = mergeGroupsId(source.id, target.id)
      if (dismissed.has(id)) continue
      const action: MergeGroupsAction = {
        type: "merge-groups",
        id,
        sourceGroupId: source.id,
        sourceGroupTitle: source.title,
        targetGroupId: target.id,
        targetGroupTitle: target.title,
        color: target.color,
        tabCount: source.tabs.length
      }
      actions.push(action)
    }
  }

  return actions
}
