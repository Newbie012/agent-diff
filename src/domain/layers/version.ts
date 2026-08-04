import { Option } from "effect"
import type { Patch } from "../patch/index.ts"
import { codeBlocks, coverage, spansOf, withFullCoverage } from "./coverage.ts"
import type { Layer, Layers, LayersStatus } from "./model.ts"

export const statusOf = (
  patches: ReadonlyArray<Patch>,
  layers: Layers,
  branchHead: string,
): LayersStatus => {
  const gap = coverage(patches, layers.layers)
  const present = new Set(patches.map((patch) => patch.path))
  const mentioned = new Set(spansOf(layers.layers).map((span) => span.path))
  return {
    version: layers.version,
    parent: layers.parent,
    stale: layers.head !== branchHead,
    layersHead: layers.head,
    branchHead,
    uncovered: gap.missing,
    vanished: [...mentioned].filter((path) => !present.has(path)),
    covered: gap.covered,
    total: gap.total,
  }
}

export const describeStatus = (status: LayersStatus): { line: string; warn: boolean } => {
  if (status.stale) {
    return { line: `v${status.version} written for ${status.layersHead}, head is ${status.branchHead}`, warn: true }
  }
  if (status.uncovered.length > 0) {
    return { line: `v${status.version} covers ${status.covered}/${status.total} hunks`, warn: true }
  }
  const lineage = Option.match(status.parent, {
    onNone: () => `v${status.version}`,
    onSome: (parent) => `v${status.version}, revised from v${parent}`,
  })
  return { line: `${lineage} covers the whole diff`, warn: false }
}

export const reviseFor = (
  previous: Layers,
  branchHead: string,
  patches: ReadonlyArray<Patch>,
  written: string,
): Layers => {
  const present = new Set(patches.map((patch) => patch.path))
  const kept: ReadonlyArray<Layer> = previous.layers
    .map((layer) => ({
      ...layer,
      blocks: layer.blocks.filter((block) => block.kind === "prose" || present.has(block.path)),
    }))
    .filter((layer) => codeBlocks(layer).length > 0)

  return withFullCoverage(patches, {
    ...previous,
    version: previous.version + 1,
    parent: Option.some(previous.version),
    head: branchHead,
    written,
    layers: kept,
  })
}
