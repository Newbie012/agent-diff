import { type TextChunk } from "@opentui/core"
import { CHIP_CHUNKS } from "./home.ts"

export const CHIP_GAP = 4

const paired = (chunks: ReadonlyArray<TextChunk>): ReadonlyArray<ReadonlyArray<TextChunk>> => {
  const chips: Array<ReadonlyArray<TextChunk>> = []
  for (let at = 0; at < chunks.length; at += CHIP_CHUNKS) {
    chips.push(chunks.slice(at, at + CHIP_CHUNKS))
  }
  return chips
}

const chipWidth = (chip: ReadonlyArray<TextChunk>): number =>
  chip.reduce((total, chunk) => total + chunk.text.length, 0)

const WAYS_OUT = 2

export const keptWithin = (chunks: ReadonlyArray<TextChunk>, room: number): ReadonlyArray<TextChunk> => {
  const chips = paired(chunks)
  if (chips.length <= WAYS_OUT) return chips.flat()
  const ways = chips.slice(-WAYS_OUT)
  const kept: Array<ReadonlyArray<TextChunk>> = []
  let used = ways.reduce((total, chip) => total + chipWidth(chip), 0)
  for (const chip of chips.slice(0, -WAYS_OUT)) {
    const width = chipWidth(chip)
    if (used + width > room) break
    kept.push(chip)
    used += width
  }
  return [...kept, ...ways].flat()
}
