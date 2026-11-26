import { Option } from "effect"
import type { Patch } from "../patch/index.ts"
import { codeBlocks } from "./coverage.ts"
import type { Declaration, Layer, Split } from "./model.ts"

const addedLines = (patch: Patch): ReadonlyArray<number> =>
  patch.rows.filter((row) => row.kind === "added").flatMap((row) => Option.toArray(row.newLine))

const claimsAny = (layer: Layer, path: string, lines: ReadonlyArray<number>): boolean =>
  codeBlocks(layer).some(
    (block) => block.path === path && lines.some((line) => line >= block.start && line <= block.end),
  )

export const sharedPaths = (layers: ReadonlyArray<Layer>): ReadonlyArray<string> => {
  const claimed = layers.flatMap((layer) => [...new Set(codeBlocks(layer).map((block) => block.path))])
  return [...new Set(claimed.filter((path, at) => claimed.indexOf(path) !== at))]
}

export const splitsIn = (
  layers: ReadonlyArray<Layer>,
  patch: Patch,
  declarations: ReadonlyArray<Declaration>,
): ReadonlyArray<Split> => {
  const added = addedLines(patch)
  return declarations.flatMap((declaration) => {
    const inside = added.filter((line) => line >= declaration.start && line <= declaration.end)
    const holding = layers.flatMap((layer, at) => (claimsAny(layer, patch.path, inside) ? [at + 1] : []))
    return holding.length > 1 ? [{ path: patch.path, ...declaration, layers: holding }] : []
  })
}
