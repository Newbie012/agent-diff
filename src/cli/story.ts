import { realpath } from "node:fs/promises"
import { Effect, Option } from "effect"
import {
  codeBlocks,
  noteOf,
  statusOf,
  withFullCoverage,
  type Span,
  type Step,
  type Story,
  type StoryBlock,
} from "../domain/narrative/index.ts"
import type { Patch } from "../domain/patch/index.ts"
import { Git, type Worktree } from "../service/git/index.ts"
import { Store, type StoredStory } from "../service/store/index.ts"
import { findBranch, patchesOf } from "./commands.ts"
import { MalformedStory, NoStory, UnknownWorktree } from "./error.ts"

export type StoryStep = {
  readonly title: string
  readonly note: string
  readonly files: ReadonlyArray<string>
  readonly spans: ReadonlyArray<Span>
}

export type StoryReport = {
  readonly version: number
  readonly parent: number | undefined
  readonly head: string
  readonly branchHead: string
  readonly stale: boolean
  readonly written: string
  readonly summary: string
  readonly covered: number
  readonly total: number
  readonly uncovered: ReadonlyArray<Span>
  readonly vanished: ReadonlyArray<string>
  readonly steps: ReadonlyArray<StoryStep>
}

type StepInput = {
  readonly title?: unknown
  readonly note?: unknown
  readonly blocks?: unknown
  readonly spans?: unknown
}

const unique = (paths: ReadonlyArray<string>): ReadonlyArray<string> => [...new Set(paths)]

const spansOfStep = (step: Step): ReadonlyArray<Span> =>
  codeBlocks(step).map(({ path, start, end }) => ({ path, start, end }))

const isSpan = (value: unknown): value is Span => {
  const span = value as Partial<Span> | undefined
  return (
    typeof span?.path === "string" &&
    typeof span.start === "number" &&
    typeof span.end === "number"
  )
}

const isBlock = (value: unknown): value is StoryBlock => {
  const block = value as { kind?: unknown; markdown?: unknown } | undefined
  if (block?.kind === "prose") return typeof block.markdown === "string"
  return block?.kind === "code" && isSpan(value)
}

const codeBlockOf = (span: Span): StoryBlock => ({
  kind: "code",
  path: span.path,
  start: span.start,
  end: span.end,
})

const blocksOf = (step: StepInput): ReadonlyArray<StoryBlock> => {
  if (Array.isArray(step.blocks)) return step.blocks.filter(isBlock)
  const note = typeof step.note === "string" ? [{ kind: "prose" as const, markdown: step.note }] : []
  const spans = Array.isArray(step.spans) ? step.spans.filter(isSpan) : []
  return [...note, ...spans.map(codeBlockOf)]
}

const stepOf = (value: unknown): Option.Option<Step> => {
  const step = value as StepInput | undefined
  const title = typeof step?.title === "string" ? step.title.trim() : ""
  if (step === undefined || title.length === 0) return Option.none()
  const blocks = blocksOf(step)
  return blocks.length === 0 ? Option.none() : Option.some({ title, blocks })
}

const parsed = (text: string): Option.Option<Record<string, unknown>> => {
  try {
    const value: unknown = JSON.parse(text)
    return typeof value === "object" && value !== null
      ? Option.some(value as Record<string, unknown>)
      : Option.none()
  } catch {
    return Option.none()
  }
}

export const readStory = Effect.fn("Cli.readStory")(function* (text: string) {
  const document = yield* Option.match(parsed(text), {
    onNone: () => new MalformedStory({ reason: "the story is not a JSON object" }),
    onSome: Effect.succeed,
  })
  const raw = document["steps"]
  const steps = (Array.isArray(raw) ? raw : []).flatMap((entry) =>
    Option.match(stepOf(entry), { onNone: (): ReadonlyArray<Step> => [], onSome: (step) => [step] }),
  )
  if (steps.length === 0) {
    return yield* new MalformedStory({
      reason: "every step needs a title and at least one span or block",
    })
  }
  const summary = document["summary"]
  return { summary: typeof summary === "string" ? summary : "", steps }
})

const fromStored = (stored: StoredStory): Story => ({
  ...stored,
  parent: Option.fromNullishOr(stored.parent),
})

const toStored = (story: Story): StoredStory => ({
  ...story,
  parent: Option.getOrUndefined(story.parent),
})

const stepsOf = (patches: ReadonlyArray<Patch>, story: Story): ReadonlyArray<StoryStep> => {
  const present = new Set(patches.map((patch) => patch.path))
  return withFullCoverage(patches, story).steps.map((step) => ({
    title: step.title,
    note: noteOf(step),
    files: unique(spansOfStep(step).map((span) => span.path)).filter((path) => present.has(path)),
    spans: spansOfStep(step),
  }))
}

const reportOf = (
  patches: ReadonlyArray<Patch>,
  story: Story,
  branchHead: string,
): StoryReport => {
  const status = statusOf(patches, story, branchHead)
  return {
    version: status.version,
    parent: Option.getOrUndefined(status.parent),
    head: status.storyHead,
    branchHead: status.branchHead,
    stale: status.stale,
    written: story.written,
    summary: story.summary,
    covered: status.covered,
    total: status.total,
    uncovered: status.uncovered,
    vanished: status.vanished,
    steps: stepsOf(patches, story),
  }
}

const resolve = (path: string): Promise<string> => realpath(path).catch(() => path)

const resolveAll = (paths: ReadonlyArray<string>): Promise<ReadonlyArray<string>> =>
  Promise.all(paths.map(resolve))

const worktreeAt = Effect.fn("Cli.worktreeAt")(function* (worktreePath: string) {
  const git = yield* Git
  const asked = yield* Effect.promise(() => resolve(worktreePath))
  const worktrees = yield* git.worktrees(asked)
  const paths = worktrees.map((entry) => entry.path)
  const resolved = yield* Effect.promise(() => resolveAll(paths))
  const at = resolved.indexOf(asked)
  const found = worktrees[at]
  return yield* found === undefined
    ? new UnknownWorktree({ worktree: asked, known: worktrees.map((entry) => entry.path) })
    : Effect.succeed(found)
})

const storyOf = Effect.fn("Cli.storyOf")(function* (worktree: Worktree) {
  const store = yield* Store
  return Option.map(yield* store.story(worktree.path), fromStored)
})

export const setStory = Effect.fn("Cli.setStory")(function* (
  worktreePath: string,
  text: string,
  written: string,
) {
  const store = yield* Store
  const worktree = yield* worktreeAt(worktreePath)
  const input = yield* readStory(text)
  const patches = yield* patchesOf(worktree)
  const previous = yield* storyOf(worktree)
  const story: Story = {
    version: Option.match(previous, { onNone: () => 1, onSome: (old) => old.version + 1 }),
    parent: Option.map(previous, (old) => old.version),
    head: worktree.head,
    base: worktree.base,
    written,
    summary: input.summary,
    steps: input.steps,
  }
  yield* store.saveStory(worktree.path, toStored(story))
  return reportOf(patches, story, worktree.head)
})

export const showStory = Effect.fn("Cli.showStory")(function* (worktreePath: string) {
  const worktree = yield* worktreeAt(worktreePath)
  const patches = yield* patchesOf(worktree)
  const found = yield* storyOf(worktree)
  const story = yield* Option.match(found, {
    onNone: () => new NoStory({ worktree: worktree.path }),
    onSome: Effect.succeed,
  })
  return reportOf(patches, story, worktree.head)
})

export const listStorySteps = Effect.fn("Cli.listStorySteps")(function* (
  repo: string,
  branch: string,
) {
  const worktree = yield* findBranch(repo, branch)
  const found = yield* storyOf(worktree)
  if (Option.isNone(found)) return [] as ReadonlyArray<StoryStep>
  return stepsOf(yield* patchesOf(worktree), found.value)
})
