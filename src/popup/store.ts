import { create } from "zustand"

export type TopView = "groups" | "tabs"

interface PopupState {
  view: TopView
  expanded: Record<string, boolean>
  creatingGroup: { tabIds: number[] } | null
  selected: string[]
  search: string
  filter: string
  setView: (view: TopView) => void
  toggleExpanded: (id: string) => void
  openCreateGroup: (tabIds?: number[]) => void
  closeCreateGroup: () => void
  setSelected: (ids: string[]) => void
  toggleSelected: (id: string) => void
  setSearch: (search: string) => void
  setFilter: (filter: string) => void
}

export const usePopupStore = create<PopupState>((set) => ({
  view: "groups",
  expanded: {},
  creatingGroup: null,
  selected: [],
  search: "",
  filter: "all",
  setView: (view) =>
    set((state) => (state.view === view ? state : { view, search: "", selected: [], creatingGroup: null })),
  toggleExpanded: (id) => set((state) => ({ expanded: { ...state.expanded, [id]: !state.expanded[id] } })),
  openCreateGroup: (tabIds = []) => set({ creatingGroup: { tabIds } }),
  closeCreateGroup: () => set({ creatingGroup: null }),
  setSelected: (selected) => set({ selected }),
  toggleSelected: (id) =>
    set((state) => ({
      selected: state.selected.includes(id) ? state.selected.filter((item) => item !== id) : [...state.selected, id]
    })),
  setSearch: (search) => set((state) => (state.search === search ? state : { search, selected: [] })),
  setFilter: (filter) => set({ filter })
}))
