import type { Patch } from "../patch/index.ts"
import { coverage, spansOf } from "./coverage.ts"
import type { Layers, LayersStatus } from "./model.ts"

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
    partial: gap.partial,
    total: gap.total,
  }
}
