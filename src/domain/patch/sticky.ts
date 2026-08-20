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

export const stickyChain = (
  source: ReadonlyArray<string>,
  line: number,
  max: number,
): ReadonlyArray<string> => {
  const index = line - 1
  if (index <= 0 || index >= source.length) return []
  let limit = limitFrom(source, index)
  const chain: Array<string> = []
  for (let above = index - 1; above >= 0; above -= 1) {
    const text = source[above] ?? ""
    if (!pinnable(text)) continue
    const indent = indentOf(text)
    if (indent >= limit) continue
    chain.push(text)
    limit = indent
    if (indent === 0) break
  }
  return kept(chain.toReversed(), max)
}

const kept = (chain: ReadonlyArray<string>, max: number): ReadonlyArray<string> => {
  if (chain.length <= max || max < 2) return chain.slice(0, max)
  const outer = chain[0] ?? ""
  const inner = chain.slice(chain.length - (max - 1))
  return [`${outer} ⋯`, ...inner]
}
