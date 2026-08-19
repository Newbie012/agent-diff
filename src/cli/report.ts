import type { Options } from "./parse.ts"

export const USAGE = 2
export const NOT_FOUND = 3
export const FAILED = 1

type Advice = { readonly exit: number; readonly suggestion: string; readonly retriable: boolean }

const ADVICE: Readonly<Record<string, Advice>> = {
  UnknownCommand: {
    exit: USAGE,
    suggestion: "Run `adiff --help` for the commands this build exposes, or `adiff describe` for the same as JSON.",
    retriable: false,
  },
  MissingOption: {
    exit: USAGE,
    suggestion: "Run `adiff <command> --help` for the options it requires.",
    retriable: false,
  },
  UnknownBranch: {
    exit: NOT_FOUND,
    suggestion: "Run `adiff branch list` for the branches that have something to review.",
    retriable: false,
  },
  UnknownBase: {
    exit: NOT_FOUND,
    suggestion:
      "--base takes a ref this repository can resolve and that shares history with the branch. Run `adiff base clear --repo . --branch <name>` to go back to picking the base automatically.",
    retriable: false,
  },
  UnknownFile: {
    exit: NOT_FOUND,
    suggestion: "The error lists the files this branch changed. Use one of those paths.",
    retriable: false,
  },
  UnknownPreference: {
    exit: NOT_FOUND,
    suggestion:
      "The error lists the preferences adiff knows. Run `adiff config list` to see them with their values.",
    retriable: false,
  },
  UnknownPreferenceValue: {
    exit: NOT_FOUND,
    suggestion: "A preference is on or off. Pass --value on or --value off.",
    retriable: false,
  },
  UnknownWorktree: {
    exit: NOT_FOUND,
    suggestion:
      "--worktree takes the path of a worktree of the repository under review. The error lists the ones that exist; pass one of those, or run the command from inside it with `--worktree .`.",
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
      "No comment carries that id. `adiff comment take` reports the ids an agent can answer, and `adiff comment list` reports every id on a review.",
    retriable: false,
  },
  UnknownDraft: {
    exit: NOT_FOUND,
    suggestion:
      "No held comment carries that id. `adiff draft list` reports the drafts waiting on a review.",
    retriable: false,
  },
  NothingDrafted: {
    exit: NOT_FOUND,
    suggestion:
      "Nothing is being held for this review. Write a comment on the pull request first; `adiff draft list` reports what is waiting.",
    retriable: false,
  },
  PullMoved: {
    exit: FAILED,
    suggestion:
      "The pull request has moved since these comments were written, so they name lines that may no longer be there. Nothing was sent and nothing was lost. Read the diff again and check each draft still says what you mean.",
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

const sharpen = (
  tag: string,
  detail: Readonly<Record<string, unknown>>,
  fallback: string,
): string => {
  const meant = detail["didYouMean"]
  const named = detail["name"]
  const command = detail["command"]
  if (tag === "UnknownCommand" && typeof meant === "string") {
    return `Run \`adiff ${meant} --help\` for what it needs, or \`adiff --help\` for every command.`
  }
  if (tag === "UnknownCommand" && Array.isArray(detail["verbs"]) && typeof named === "string") {
    return `\`${named}\` needs a verb after it. Run \`adiff ${named} --help\` for the ones it has.`
  }
  if (tag === "MissingOption" && typeof command === "string") {
    return `Run \`adiff ${command} --help\` for what it needs.`
  }
  return fallback
}

export const failure = (cause: unknown): { readonly line: string; readonly exit: number } => {
  const tag = tagOf(cause)
  const advice = ADVICE[tag] ?? FALLBACK
  const spread = typeof cause === "object" && cause !== null ? { ...cause } : { detail: String(cause) }
  const { _tag: _ignored, ...detail } = spread as Record<string, unknown>
  const said =
    cause instanceof Error && Object.keys(detail).length === 0
      ? { detail: cause.message }
      : detail
  return {
    line: JSON.stringify({
      ok: false,
      error: {
        ...said,
        type: tag,
        retriable: advice.retriable,
        suggestion: sharpen(tag, said, advice.suggestion),
      },
    }),
    exit: advice.exit,
  }
}
