interface TSearchable {
  title?: string
  url?: string
}

export const normalizeQuery = (query: string) => query.trim().toLowerCase()

export const matchesSearch = <TItem extends TSearchable>(item: TItem, query: string) => {
  const needle = normalizeQuery(query)
  if (!needle) return true
  const haystack = `${item.title ?? ""} ${item.url ?? ""}`.toLowerCase()
  return needle.split(/\s+/).every((term) => haystack.includes(term))
}

export const filterBySearch = <TItem extends TSearchable>(items: TItem[], query: string) =>
  normalizeQuery(query) ? items.filter((item) => matchesSearch(item, query)) : items
