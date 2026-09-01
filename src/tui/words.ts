export const counted = (many: number, one: string): string => `${many} ${one}${many === 1 ? "" : "s"}`

export const chunked = (word: string, room: number): ReadonlyArray<string> =>
  word.length <= room ? [word] : [word.slice(0, room), ...chunked(word.slice(room), room)]

export const packed = (lines: ReadonlyArray<string>, word: string, room: number): ReadonlyArray<string> => {
  const last = lines.at(-1)
  if (last === undefined || last.length + 1 + word.length > room) return [...lines, word]
  return [...lines.slice(0, -1), `${last} ${word}`]
}

export const shortened = (word: string, room: number): string =>
  word.length <= room ? word : `${word.slice(0, Math.max(1, room - 1))}\u2026`

export const wordWrapped = (text: string, room: number): ReadonlyArray<string> => {
  const width = Math.max(1, room)
  return text
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => shortened(word, width))
    .reduce<ReadonlyArray<string>>((lines, word) => packed(lines, word, width), [])
}

export const wrapped = (text: string, room: number): ReadonlyArray<string> => {
  const width = Math.max(1, room)
  return text
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .flatMap((word) => chunked(word, width))
    .reduce<ReadonlyArray<string>>((lines, word) => packed(lines, word, width), [])
}

export const clip = (label: string, room: number): string =>
  label.length > room ? `${label.slice(0, Math.max(0, room - 1))}…` : label
