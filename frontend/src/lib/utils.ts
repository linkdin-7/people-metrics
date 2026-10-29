export { cn } from "cn"

export type FilterOption = { value: string; label: string; hint?: string; keywords?: string[] }

// Ranks an option for a search: exact name or code, then name start, then a word start, then anywhere.
export function rankMatch(label: string, search: string, keywords: string[] = []): number {
  const query = search.trim().toLowerCase()
  if (!query) {
    return 1
  }
  const name = label.toLowerCase()
  if (name === query || keywords.some((keyword) => keyword.toLowerCase() === query)) {
    return 1
  }
  // Within a tier, shorter names are closer to what was typed ("United States" before its islands).
  const shorterFirst = name.length / 1000
  if (name.startsWith(query)) {
    return 0.8 - shorterFirst
  }
  if (name.split(/[\s,()-]+/).some((word) => word.startsWith(query))) {
    return 0.6 - shorterFirst
  }
  return name.includes(query) ? 0.3 - shorterFirst : 0
}
