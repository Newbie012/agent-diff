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

const label = (entry: Command): string => `${entry.category} ${entry.title}`.toLowerCase()

const matches = (entry: Command, query: string): boolean =>
  query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .every((word) => subsequence(label(entry), word))

const closeness = (entry: Command, query: string): number => {
  const wanted = query.trim().toLowerCase()
  if (wanted.length === 0) return 2
  const title = entry.title.toLowerCase()
  if (title.startsWith(wanted)) return 0
  if (title.includes(wanted)) return 1
  return label(entry).includes(wanted) ? 2 : 3
}

export const searchCommands = (screen: Screen, query: string): ReadonlyArray<Command> =>
  listableFor(screen)
    .filter((entry) => matches(entry, query))
    .toSorted((left, right) => closeness(left, query) - closeness(right, query))

export const searchGlossary = (screen: Screen, query: string): ReadonlyArray<Command> =>
  glossaryFor(screen).filter((entry) => matches(entry, query))
