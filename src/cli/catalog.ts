export type OptionSpec = {
  readonly name: string
  readonly required: boolean
  readonly value: string
  readonly about: string
}

export type Addresses = "review" | "repo" | "none"

export type CommandSpec = {
  readonly name: string
  readonly about: string
  readonly group: string
  readonly addresses: Addresses
  readonly safety: "read" | "write"
  readonly options: ReadonlyArray<OptionSpec>
  readonly dataKey: string
  readonly example: string
}

const worktreeOf: OptionSpec = {
  name: "worktree",
  required: false,
  value: "path",
  about: "The worktree under review. Give this, or --repo with --branch",
}

const repoOf: OptionSpec = {
  name: "repo",
  required: false,
  value: "path",
  about: "Repository the worktree belongs to. Give this with --branch, or give --worktree",
}

const branchOf: OptionSpec = {
  name: "branch",
  required: false,
  value: "name",
  about: "Branch to act on, as `branch list` reports it. Give this with --repo, or give --worktree",
}

export const addressing: ReadonlyArray<OptionSpec> = [worktreeOf, repoOf, branchOf]

const baseOf: OptionSpec = {
  name: "base",
  required: false,
  value: "ref",
  about:
    "Ref to diff against, instead of the one this branch is stacked on. `auto` asks for the stacked parent explicitly",
}

export const based: ReadonlyArray<OptionSpec> = [...addressing, baseOf]

const repo: OptionSpec = {
  name: "repo",
  required: true,
  value: "path",
  about: "Repository whose worktrees are reviewed",
}

const opening: OptionSpec = {
  name: "branch",
  required: false,
  value: "name",
  about: "Branch to open on, as `branch list` reports it. Without it the review opens on the list",
}

const file: OptionSpec = {
  name: "file",
  required: true,
  value: "path",
  about: "File path as it appears in the diff",
}

const range: ReadonlyArray<OptionSpec> = [
  file,
  { name: "start", required: true, value: "line", about: "First line of the range" },
  { name: "end", required: true, value: "line", about: "Last line of the range" },
  { name: "body", required: true, value: "text", about: "What to tell the agent" },
  {
    name: "side",
    required: false,
    value: "new|old",
    about: "Which version the lines are on. Defaults to new",
  },
]

const READ_A_BRANCH = "Read a branch"
const WRITE_COMMENTS = "Write comments"
const ANSWER_COMMENTS = "Answer comments, in the worktree"
const FOLLOW_UP = "Follow up"
const SET_UP = "Set up"

export const catalog: ReadonlyArray<CommandSpec> = [
  {
    name: "branch list",
    about: "Branches with changes against their merge base, and how large each is",
    group: READ_A_BRANCH,
    addresses: "repo",
    safety: "read",
    options: [repo, baseOf],
    dataKey: "branches",
    example: "adiff branch list --repo . --fields branch,files",
  },
  {
    name: "review open",
    about:
      "Open the review terminal. With --branch it opens on that branch rather than the worktree list. The only command that does not answer in JSON",
    group: READ_A_BRANCH,
    addresses: "repo",
    safety: "read",
    options: [repo, opening, baseOf],
    dataKey: "",
    example: "adiff review open --repo . --branch cdr-1",
  },
  {
    name: "review pane",
    about:
      "Open the review beside the conversation, in whichever multiplexer is running. With --branch it opens on that branch. Answers with the command when none is",
    group: READ_A_BRANCH,
    addresses: "repo",
    safety: "read",
    options: [repo, opening, baseOf],
    dataKey: "pane",
    example: "adiff review pane --repo .",
  },
  {
    name: "file review",
    about: "Toggle a file as reviewed. Lapses on its own when the file changes",
    group: READ_A_BRANCH,
    addresses: "review",
    safety: "write",
    options: [...based, file],
    dataKey: "reviewed",
    example: "adiff file review --worktree . --file src/api.ts",
  },
  {
    name: "base set",
    about: "Remember the ref this branch is diffed against, so it is not retyped on every command",
    group: READ_A_BRANCH,
    addresses: "review",
    safety: "write",
    options: [
      ...addressing,
      {
        name: "base",
        required: true,
        value: "ref",
        about: "Ref to diff this branch against",
      },
    ],
    dataKey: "base",
    example: "adiff base set --repo . --branch cdr-2 --base cdr-1",
  },
  {
    name: "base clear",
    about: "Forget a remembered base, so the branch goes back to using the one it is stacked on",
    group: READ_A_BRANCH,
    addresses: "review",
    safety: "write",
    options: [...addressing],
    dataKey: "base",
    example: "adiff base clear --repo . --branch cdr-2",
  },
  {
    name: "review progress",
    about: "Which files of a review are marked reviewed, and how many there are",
    group: READ_A_BRANCH,
    addresses: "review",
    safety: "read",
    options: [...based],
    dataKey: "reviewed",
    example: "adiff review progress --repo . --branch cdr-1",
  },
  {
    name: "comment send",
    about: "Send one comment against a line range, straight to the agent",
    group: WRITE_COMMENTS,
    addresses: "review",
    safety: "write",
    options: [...addressing, ...range],
    dataKey: "batch",
    example:
      'adiff comment send --repo . --branch cdr-1 --file src/api.ts --start 4 --end 5 --body "why"',
  },
  {
    name: "comment reply",
    about: "Write back to a comment already sent, continuing its thread",
    group: WRITE_COMMENTS,
    addresses: "review",
    safety: "write",
    options: [
      ...addressing,
      {
        name: "to",
        required: true,
        value: "id",
        about: "The comment being continued, as `comment list` reports it",
      },
      { name: "body", required: true, value: "text", about: "What to tell the agent" },
    ],
    dataKey: "batch",
    example: 'adiff comment reply --repo . --branch cdr-1 --to c1 --body "the other one"',
  },
  {
    name: "comment take",
    about: "Collect the comments this review is still owed an answer on. Repeats until answered",
    group: ANSWER_COMMENTS,
    addresses: "review",
    safety: "read",
    options: [
      ...addressing,
      {
        name: "wait",
        required: false,
        value: "seconds",
        about: "Block until a comment arrives or the timeout elapses",
      },
    ],
    dataKey: "comments",
    example: "adiff comment take --worktree . --wait 300",
  },
  {
    name: "comment answer",
    about: "Say what was done about a comment, or ask the reviewer something back",
    group: ANSWER_COMMENTS,
    addresses: "review",
    safety: "write",
    options: [
      ...addressing,
      {
        name: "id",
        required: true,
        value: "id",
        about: "The comment being answered, as `comment take` reported it",
      },
      { name: "body", required: true, value: "text", about: "What was done, or what is being asked" },
      {
        name: "question",
        required: false,
        value: "flag",
        about: "The answer is a question, and the work waits for a reply",
      },
    ],
    dataKey: "answered",
    example: 'adiff comment answer --worktree . --id c1 --body "dropped it, and the import with it"',
  },
  {
    name: "layers set",
    about: "Write the reading order for this review's diff: ordered layers over spans of files",
    group: ANSWER_COMMENTS,
    addresses: "review",
    safety: "write",
    options: [
      ...based,
      {
        name: "json",
        required: true,
        value: "file|-",
        about:
          "The document, as a file path or - to read stdin: {\"summary\":\"…\",\"layers\":[{\"title\":\"…\",\"note\":\"…\",\"spans\":[{\"path\":\"…\",\"start\":1,\"end\":9}]}]}. A layer may carry blocks instead of spans, interleaving {\"kind\":\"prose\",\"markdown\":\"…\"} with {\"kind\":\"code\",\"path\":\"…\",\"start\":1,\"end\":9}",
      },
    ],
    dataKey: "layers",
    example: "adiff layers set --worktree . --json -",
  },
  {
    name: "layers show",
    about: "The layers of a review, with the hunks no layer claims",
    group: ANSWER_COMMENTS,
    addresses: "review",
    safety: "read",
    options: [...based],
    dataKey: "layers",
    example: "adiff layers show --worktree . --fields layers,uncovered",
  },
  {
    name: "comment list",
    about: "Every comment on a review, with its answers and whether it is settled",
    group: FOLLOW_UP,
    addresses: "review",
    safety: "read",
    options: [...addressing],
    dataKey: "comments",
    example: "adiff comment list --worktree . --fields id,body,settled",
  },
  {
    name: "comment resolve",
    about: "Mark a comment settled. Only the reviewer who raised it can",
    group: FOLLOW_UP,
    addresses: "review",
    safety: "write",
    options: [
      ...addressing,
      { name: "id", required: true, value: "id", about: "The comment to settle" },
    ],
    dataKey: "settled",
    example: "adiff comment resolve --repo . --branch cdr-1 --id c1",
  },
  {
    name: "comment remove",
    about: "Take a comment out of the review, leaving what was already delivered on the record",
    group: FOLLOW_UP,
    addresses: "review",
    safety: "write",
    options: [
      ...addressing,
      { name: "id", required: true, value: "id", about: "The comment to withdraw" },
    ],
    dataKey: "removed",
    example: "adiff comment remove --repo . --branch cdr-1 --id c1",
  },
  {
    name: "comment restore",
    about: "Put a removed comment back into the review",
    group: FOLLOW_UP,
    addresses: "review",
    safety: "write",
    options: [
      ...addressing,
      { name: "id", required: true, value: "id", about: "The comment to restore" },
    ],
    dataKey: "restored",
    example: "adiff comment restore --repo . --branch cdr-1 --id c1",
  },
  {
    name: "init",
    about:
      "Write the review loop into this repository's agent instructions, so an agent finds it unprompted",
    group: SET_UP,
    addresses: "repo",
    safety: "write",
    options: [
      { name: "repo", required: true, value: "path", about: "Repository to write the loop into" },
      {
        name: "write",
        required: false,
        value: "flag",
        about: "Make the changes. Without it, init reports what each file would become",
      },
      {
        name: "skill",
        required: false,
        value: "flag",
        about: "Also commit the adiff skill at .claude/skills/adiff/SKILL.md",
      },
    ],
    dataKey: "changes",
    example: "adiff init --repo . --write",
  },
  {
    name: "skill refresh",
    about:
      "Rewrite the adiff skill wherever it is already installed, in this directory and in your home directory. Installs nothing that is not already there",
    group: SET_UP,
    addresses: "none",
    safety: "write",
    options: [],
    dataKey: "changes",
    example: "adiff skill refresh",
  },
  {
    name: "upgrade",
    about:
      "Upgrade this install to the newest build, using whatever installed it. Answers a person in plain text, and a caller in JSON with --json",
    group: SET_UP,
    addresses: "none",
    safety: "write",
    options: [
      {
        name: "check",
        required: false,
        value: "flag",
        about:
          "Report what would happen and name the command, without running anything. Always exits 0",
      },
      {
        name: "json",
        required: false,
        value: "flag",
        about:
          "Answer with the usual envelope instead of plain text. This is the only command that needs it",
      },
    ],
    dataKey: "upgrade",
    example: "adiff upgrade --check --json --fields route,latest,current",
  },
  {
    name: "describe",
    about: "This catalog, as JSON",
    group: SET_UP,
    addresses: "none",
    safety: "read",
    options: [
      { name: "command", required: false, value: "name", about: "Describe one command only" },
    ],
    dataKey: "commands",
    example: "adiff describe --command 'comment send'",
  },
]

export const commandNames: ReadonlyArray<string> = catalog.map((command) => command.name)

export const findCommand = (name: string): CommandSpec | undefined =>
  catalog.find((command) => command.name === name)

export const verbsUnder = (noun: string): ReadonlyArray<string> =>
  commandNames.filter((name) => name.startsWith(`${noun} `))

export const groups: ReadonlyArray<string> = [...new Set(catalog.map((command) => command.group))]

const NEAR = 3

const distance = (left: string, right: string): number => {
  const previous = Array.from({ length: right.length + 1 }, (_, at) => at)
  for (let row = 1; row <= left.length; row += 1) {
    let corner = previous[0] ?? 0
    previous[0] = row
    for (let column = 1; column <= right.length; column += 1) {
      const kept = previous[column] ?? 0
      const cost = left[row - 1] === right[column - 1] ? 0 : 1
      previous[column] = Math.min(kept + 1, (previous[column - 1] ?? 0) + 1, corner + cost)
      corner = kept
    }
  }
  return previous[right.length] ?? 0
}

const NEAR_ENOUGH = 3

export const nearestCommand = (name: string): string | undefined => {
  const noun = name.split(" ")[0] ?? ""
  const under = verbsUnder(noun)
  const candidates = under.length === 0 ? commandNames : under
  const room = Math.max(NEAR, Math.floor(name.length / NEAR_ENOUGH))
  const scored = candidates
    .map((known) => ({ known, gap: distance(name, known) }))
    .toSorted((left, right) => left.gap - right.gap)[0]
  return scored !== undefined && scored.gap <= room ? scored.known : undefined
}
