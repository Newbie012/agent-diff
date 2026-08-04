import type { Option } from "effect"

export type StoryBlock =
  | { readonly kind: "prose"; readonly markdown: string }
  | { readonly kind: "code"; readonly path: string; readonly start: number; readonly end: number }

export type Step = {
  readonly title: string
  readonly blocks: ReadonlyArray<StoryBlock>
}

export type Story = {
  readonly version: number
  readonly head: string
  readonly base: string
  readonly parent: Option.Option<number>
  readonly written: string
  readonly summary: string
  readonly steps: ReadonlyArray<Step>
}

export type Span = {
  readonly path: string
  readonly start: number
  readonly end: number
}

export type Coverage = {
  readonly total: number
  readonly covered: number
  readonly missing: ReadonlyArray<Span>
}

export type StoryStatus = {
  readonly version: number
  readonly parent: Option.Option<number>
  readonly stale: boolean
  readonly storyHead: string
  readonly branchHead: string
  readonly uncovered: ReadonlyArray<Span>
  readonly vanished: ReadonlyArray<string>
  readonly covered: number
  readonly total: number
}

export const REMAINDER_TITLE = "not in any step"
