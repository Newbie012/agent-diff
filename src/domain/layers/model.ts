import type { Option } from "effect"

export type LayerBlock =
  | { readonly kind: "prose"; readonly markdown: string }
  | { readonly kind: "code"; readonly path: string; readonly start: number; readonly end: number }

export type Layer = {
  readonly title: string
  readonly blocks: ReadonlyArray<LayerBlock>
}

export type Layers = {
  readonly version: number
  readonly head: string
  readonly base: string
  readonly parent: Option.Option<number>
  readonly written: string
  readonly summary: string
  readonly layers: ReadonlyArray<Layer>
}

export type Span = {
  readonly path: string
  readonly start: number
  readonly end: number
}

export type ProseAnchor = {
  readonly path: string
  readonly line: number
  readonly markdown: string
  readonly after: boolean
}

export type Coverage = {
  readonly total: number
  readonly covered: number
  readonly missing: ReadonlyArray<Span>
}

export type LayersStatus = {
  readonly version: number
  readonly parent: Option.Option<number>
  readonly stale: boolean
  readonly layersHead: string
  readonly branchHead: string
  readonly uncovered: ReadonlyArray<Span>
  readonly vanished: ReadonlyArray<string>
  readonly covered: number
  readonly total: number
}

export const REMAINDER_TITLE = "not in any layer"
