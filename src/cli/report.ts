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
  UnknownRemark: {
    exit: NOT_FOUND,
    suggestion:
      "No remark on this pull request carries that id. `adiff remark list` reports the ids it holds.",
    retriable: false,
  },
  NothingSaid: {
    exit: NOT_FOUND,
    suggestion: "Nothing was written. Pass `--body` with what you mean to say.",
    retriable: false,
  },
  RemarkTaken: {
    exit: NOT_FOUND,
    suggestion:
      "That remark is already a comment on this review. `adiff comment list` reports it, and removing that comment frees the remark.",
    retriable: false,
  },
  UnknownField: {
    exit: USAGE,
    suggestion: "That is not a field this answer carries. The ones it does are named above.",
    retriable: false,
  },
  UnknownOption: {
    exit: USAGE,
    suggestion:
      "That option is not one this command takes. `adiff <command> --help` lists the options it does.",
    retriable: false,
  },
  BadOption: {
    exit: USAGE,
    suggestion: "That value is not one the option allows. The allowed ones are named above.",
    retriable: false,
  },
  ForgeUnavailable: {
    exit: FAILED,
    suggestion:
      "The forge could not be reached. Check that `gh` is installed and authenticated, and that this repository has a remote on it. Nothing was sent.",
    retriable: false,
  },
  NotARepository: {
    exit: NOT_FOUND,
    suggestion:
      "That path is not a git repository. Point --repo or --worktree at one, or run `adiff branch list` from inside the repository you mean.",
    retriable: false,
  },
  GitCommandFailed: {
    exit: FAILED,
    suggestion: "git refused the command adiff ran. The reason it gave is above.",
    retriable: false,
  },
  FileUnreadable: {
    exit: FAILED,
    suggestion: "That file could not be read. Check it is still there and that you can read it.",
    retriable: false,
  },
  StoreUnreadable: {
    exit: FAILED,
    suggestion:
      "A file adiff keeps this review in could not be read. The path is above; move it aside to start the review's history again, or repair the line that is malformed.",
    retriable: false,
  },
  StoreUnwritable: {
    exit: FAILED,
    suggestion:
      "A file adiff keeps this review in could not be written. Check the path above is a directory you can write to.",
    retriable: false,
  },
  WatchUnavailable: {
    exit: FAILED,
    suggestion: "adiff could not watch that path for changes. The reason it gave is above.",
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
  PartlySent: {
    exit: FAILED,
    suggestion:
      "The forge confirmed some of the comments and said nothing about the rest. What it confirmed is on the pull request; what it did not is still held, listed under kept. Run the same send again to send only those.",
    retriable: true,
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
      "adiff could not write the skill. Check that .claude/skills/adiff/ is somewhere you can write to.",
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

const keysIn = (value: unknown): ReadonlyArray<string> => {
  if (Array.isArray(value)) return value.flatMap((one) => keysIn(one))
  if (typeof value !== "object" || value === null) return []
  return Object.keys(value)
}

export const strangeField = (
  body: Record<string, unknown>,
  fields: ReadonlyArray<string>,
): { readonly field: string; readonly known: ReadonlyArray<string> } | undefined => {
  if (fields.length === 0) return undefined
  const known = [...new Set(Object.values(body).flatMap((value) => keysIn(value)))]
  if (known.length === 0) return undefined
  const field = fields.find((one) => !known.includes(one))
  return field === undefined ? undefined : { field, known: known.toSorted() }
}

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
