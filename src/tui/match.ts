import { glossaryFor, listableFor, type Command } from "./command.ts"
import type { Screen } from "./model.ts"

const subsequence = (haystack: string, needle: string): boolean => {
  let index = 0
  for (const character of haystack) {
    if (character === needle[index]) index += 1
    if (index === needle.length) return true
  }
  return needle.length === 0
}

const label = (entry: Command): string =>
  `${entry.category} ${entry.title} ${entry.keys.join(" ")} ${entry.also.join(" ")}`.toLowerCase()

const matches = (entry: Command, query: string): boolean =>
  query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .every((word) => subsequence(label(entry), word))

const closeness = (entry: Command, query: string): number => {
  const wanted = query.trim().toLowerCase()
  if (wanted.length === 0) return 3
  const title = entry.title.toLowerCase()
  if (title.startsWith(wanted)) return 0
  if (entry.also.some((one) => one.toLowerCase() === wanted)) return 1
  if (title.includes(wanted)) return 2
  return label(entry).includes(wanted) ? 3 : 4
}

export const searchCommands = (screen: Screen, query: string): ReadonlyArray<Command> =>
  listableFor(screen)
    .filter((entry) => matches(entry, query))
    .toSorted((left, right) => closeness(left, query) - closeness(right, query))

const byCategory = (screen: Screen): ReadonlyMap<string, number> => {
  const seen = new Map<string, number>()
  for (const entry of glossaryFor(screen)) {
    if (!seen.has(entry.category)) seen.set(entry.category, seen.size)
  }
  return seen
}

export const searchGlossary = (screen: Screen, query: string): ReadonlyArray<Command> => {
  const order = byCategory(screen)
  const placed = (entry: Command): number => order.get(entry.category) ?? order.size
  return glossaryFor(screen)
    .filter((entry) => matches(entry, query))
    .toSorted(
      (left, right) =>
        closeness(left, query) - closeness(right, query) || placed(left) - placed(right),
    )
}
