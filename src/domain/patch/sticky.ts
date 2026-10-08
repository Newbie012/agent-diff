const CLOSER = /^[)\]}>;,]/
const COMMENT = /^(\/\/|\/\*|\*|#|<!--)/
const LOOKAHEAD = 5

const indentOf = (text: string): number => text.length - text.trimStart().length

const pinnable = (text: string): boolean => {
  const trimmed = text.trim()
  if (trimmed.length === 0) return false
  return !CLOSER.test(trimmed) && !COMMENT.test(trimmed)
}

const limitFrom = (source: ReadonlyArray<string>, index: number): number => {
  const here = source[index] ?? ""
  if (here.trim().length > 0) return indentOf(here)
  const ahead = source.slice(index, index + LOOKAHEAD).find((line) => line.trim().length > 0)
  return ahead === undefined ? 0 : indentOf(ahead)
}

const enclosing = (source: ReadonlyArray<string>): ReadonlyArray<number> => {
  const open: Array<number> = []
  const found: Array<number> = []
  source.forEach((text, index) => {
    const limit = limitFrom(source, index)
    const outer = open.findLast((at) => indentOf(source[at] ?? "") < limit)
    found.push(outer === undefined ? 0 : outer + 1)
    if (!pinnable(text)) return
    const indent = indentOf(text)
    while (open.length > 0 && indentOf(source[open.at(-1) ?? 0] ?? "") >= indent) open.pop()
    open.push(index)
  })
  return found
}

const read = new WeakMap<ReadonlyArray<string>, ReadonlyArray<number>>()

export const enclosedBy = (source: ReadonlyArray<string>): ReadonlyArray<number> => {
  const known = read.get(source)
  if (known !== undefined) return known
  const found = enclosing(source)
  read.set(source, found)
  return found
}

export const scopeLines = (source: ReadonlyArray<string>): ReadonlyArray<number> =>
  [...new Set(enclosedBy(source).filter((line) => line > 0))].toSorted((left, right) => left - right)

export const stickyChain = (
  source: ReadonlyArray<string>,
  line: number,
  max: number,
): ReadonlyArray<string> => {
  const index = line - 1
  if (index <= 0 || index >= source.length) return []
  const outer = enclosedBy(source)
  const chain: Array<string> = []
  for (let at = outer[index] ?? 0; at > 0; at = outer[at - 1] ?? 0) chain.push(source[at - 1] ?? "")
  return kept(chain.toReversed(), max)
}

const kept = (chain: ReadonlyArray<string>, max: number): ReadonlyArray<string> => {
  if (chain.length <= max || max < 2) return chain.slice(0, max)
  const outer = chain[0] ?? ""
  const inner = chain.slice(chain.length - (max - 1))
  return [`${outer} ⋯`, ...inner]
}
