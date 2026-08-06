import type { Options } from "./parse.ts"

export const USAGE = 2
export const NOT_FOUND = 3
export const FAILED = 1

type Advice = { readonly exit: number; readonly suggestion: string; readonly retriable: boolean }

const ADVICE: Readonly<Record<string, Advice>> = {
  UnknownCommand: {
    exit: USAGE,
    suggestion: "Run `adiff describe` for the commands this build exposes.",
    retriable: false,
  },
  MissingOption: {
    exit: USAGE,
    suggestion: "Run `adiff describe --command <name>` for the options it requires.",
    retriable: false,
  },
  UnknownBranch: {
    exit: NOT_FOUND,
    suggestion: "Run `adiff branch list` for the branches that have something to review.",
    retriable: false,
  },
  UnknownFile: {
    exit: NOT_FOUND,
    suggestion: "The error lists the files this branch changed. Use one of those paths.",
    retriable: false,
  },
  EmptyReview: {
    exit: USAGE,
    suggestion: "Stage a comment with `adiff comment stage` before submitting the review.",
    retriable: false,
  },
  UnknownWorktree: {
    exit: NOT_FOUND,
    suggestion: "Run `adiff layers set` from inside a worktree of the repository under review.",
    retriable: false,
  },
  MalformedLayers: {
    exit: USAGE,
    suggestion:
      "A layers is {\"summary\":\"…\",\"layers\":[{\"title\":\"…\",\"spans\":[{\"path\":\"…\",\"start\":1,\"end\":9}]}]}.",
    retriable: false,
  },
  NoLayers: {
    exit: NOT_FOUND,
    suggestion: "No layers has been written for this worktree. Write one with `adiff layers set`.",
    retriable: false,
  },
  UnknownComment: {
    exit: NOT_FOUND,
    suggestion:
      "No comment carries that id. `adiff comment take` reports the ids an agent can answer, and `adiff comment threads` reports every id on a branch.",
    retriable: false,
  },
  InitUnwritable: {
    exit: FAILED,
    suggestion:
      "adiff init writes AGENTS.md and CLAUDE.md in the repository you point --repo at. Check that path is a directory you can write to.",
    retriable: false,
  },
  UnselectableRange: {
    exit: USAGE,
    suggestion: "Those lines are not in the diff. Check --side: new is the working tree, old is the version being replaced.",
    retriable: false,
  },
}

const FALLBACK: Advice = {
  exit: FAILED,
  suggestion: "Unexpected failure. Re-run with the same arguments to confirm it reproduces.",
  retriable: true,
}

const tagOf = (failure: unknown): string =>
  typeof failure === "object" && failure !== null && "_tag" in failure
    ? String(failure._tag)
    : "Unknown"

const project = (value: unknown, fields: ReadonlyArray<string>): unknown => {
  if (Array.isArray(value)) return value.map((item) => project(item, fields))
  if (typeof value !== "object" || value === null) return value
  const source = value as Record<string, unknown>
  return Object.fromEntries(fields.filter((field) => field in source).map((f) => [f, source[f]]))
}

export const fieldsOf = (options: Options): ReadonlyArray<string> => {
  const raw = options["fields"]
  return raw === undefined || raw === "true" ? [] : raw.split(",").map((field) => field.trim())
}

export const narrow = (value: unknown, fields: ReadonlyArray<string>): unknown =>
  fields.length === 0 ? value : project(value, fields)

export const failure = (cause: unknown): { readonly line: string; readonly exit: number } => {
  const tag = tagOf(cause)
  const advice = ADVICE[tag] ?? FALLBACK
  const spread = typeof cause === "object" && cause !== null ? { ...cause } : { detail: String(cause) }
  const { _tag: _ignored, ...detail } = spread as Record<string, unknown>
  return {
    line: JSON.stringify({
      ok: false,
      error: { ...detail, type: tag, retriable: advice.retriable, suggestion: advice.suggestion },
    }),
    exit: advice.exit,
  }
}
