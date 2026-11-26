import type { Layer, OutdatedSpan } from "./model.ts"

const OFFSET = 0x811c9dc5

const PRIME = 0x01000193

const hashOf = (text: string): string => {
  let hash = OFFSET
  for (const unit of text) {
    hash = Math.imul(hash ^ (unit.codePointAt(0) ?? 0), PRIME)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

export const textOf = (lines: ReadonlyArray<string>, start: number, end: number): string =>
  hashOf(lines.slice(start - 1, end).join("\n"))

export const stamped = (
  layers: ReadonlyArray<Layer>,
  sources: ReadonlyMap<string, ReadonlyArray<string>>,
): ReadonlyArray<Layer> =>
  layers.map((layer) => ({
    ...layer,
    blocks: layer.blocks.map((block) =>
      block.kind === "code" ? { ...block, text: textOf(sources.get(block.path) ?? [], block.start, block.end) } : block,
    ),
  }))

export const outdatedSpans = (
  layers: ReadonlyArray<Layer>,
  sources: ReadonlyMap<string, ReadonlyArray<string>>,
): ReadonlyArray<OutdatedSpan> =>
  layers.flatMap((layer, at) =>
    layer.blocks.flatMap((block) => {
      if (block.kind !== "code" || block.text === undefined) return []
      const lines = sources.get(block.path)
      if (lines === undefined || textOf(lines, block.start, block.end) === block.text) return []
      return [{ layer: at + 1, path: block.path, start: block.start, end: block.end }]
    }),
  )
