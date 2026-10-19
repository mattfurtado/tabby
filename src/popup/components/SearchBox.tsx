import { Search, X } from "lucide-react"

import { usePopupStore } from "../store"

export const SearchBox = ({ placeholder }: { placeholder: string }) => {
  const search = usePopupStore((state) => state.search)
  const setSearch = usePopupStore((state) => state.setSearch)
  return (
    <div className="relative flex-1">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-8 pr-7 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      />
      {search && (
        <button
          type="button"
          onClick={() => setSearch("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
