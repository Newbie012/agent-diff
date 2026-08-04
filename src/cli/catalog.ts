export type OptionSpec = {
  readonly name: string
  readonly required: boolean
  readonly value: string
  readonly about: string
}

export type CommandSpec = {
  readonly name: string
  readonly about: string
  readonly safety: "read" | "write"
  readonly options: ReadonlyArray<OptionSpec>
  readonly dataKey: string
  readonly example: string
}

const repo: OptionSpec = {
  name: "repo",
  required: true,
  value: "path",
  about: "Repository whose worktrees are reviewed",
}

const branch: OptionSpec = {
  name: "branch",
  required: true,
  value: "name",
  about: "Branch to act on, as reported by `branch list`",
}

const file: OptionSpec = {
  name: "file",
  required: true,
  value: "path",
  about: "File path as it appears in the diff",
}

export const catalog: ReadonlyArray<CommandSpec> = [
  {
    name: "branch list",
    about: "Branches with changes against their merge base, and how large each is",
    safety: "read",
    options: [repo],
    dataKey: "branches",
    example: "adiff branch list --repo . --fields branch,files",
  },
  {
    name: "comment add",
    about: "File a comment against a line range, for the agent in that worktree",
    safety: "write",
    options: [
      repo,
      branch,
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
    ],
    dataKey: "batch",
    example: 'adiff comment add --repo . --branch cdr-1 --file src/api.ts --start 4 --end 5 --body "why"',
  },
  {
    name: "comment stage",
    about: "Add a comment to the review without sending it yet",
    safety: "write",
    options: [
      repo,
      branch,
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
    ],
    dataKey: "pending",
    example: 'adiff comment stage --repo . --branch cdr-1 --file src/api.ts --start 4 --end 4 --body "why"',
  },
  {
    name: "comment edit",
    about: "Reword a staged comment. It keeps its id and the lines it was written against",
    safety: "write",
    options: [
      repo,
      branch,
      { name: "id", required: true, value: "id", about: "The staged comment, as `review progress` reported it" },
      { name: "body", required: true, value: "text", about: "What it should say instead" },
    ],
    dataKey: "pending",
    example: 'adiff comment edit --repo . --branch add-teammate-invitations --id c1 --body "why is this unused"',
  },
  {
    name: "comment drop",
    about: "Take a staged comment out of the review before it is sent",
    safety: "write",
    options: [
      repo,
      branch,
      { name: "id", required: true, value: "id", about: "The staged comment to withdraw" },
    ],
    dataKey: "pending",
    example: "adiff comment drop --repo . --branch add-teammate-invitations --id c1",
  },
  {
    name: "comment take",
    about: "Collect the comments this worktree has not been handed yet. Exactly-once",
    safety: "write",
    options: [
      { name: "worktree", required: true, value: "path", about: "The worktree to collect for" },
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
    safety: "write",
    options: [
      { name: "worktree", required: true, value: "path", about: "The worktree the comment was written against" },
      { name: "id", required: true, value: "id", about: "The comment being answered, as `comment take` reported it" },
      { name: "body", required: true, value: "text", about: "What was done, or what is being asked" },
      { name: "asks", required: false, value: "flag", about: "The answer needs a reply before the work continues" },
    ],
    dataKey: "answered",
    example: 'adiff comment answer --worktree . --id c1 --body "dropped it, and the import with it"',
  },
  {
    name: "comment threads",
    about: "Every comment on a branch with its answers and whether it is settled",
    safety: "read",
    options: [repo, branch],
    dataKey: "threads",
    example: "adiff comment threads --repo . --branch add-teammate-invitations",
  },
  {
    name: "comment resolve",
    about: "Mark a comment settled. Only the reviewer who raised it can",
    safety: "write",
    options: [repo, branch, { name: "id", required: true, value: "id", about: "The comment to settle" }],
    dataKey: "settled",
    example: "adiff comment resolve --repo . --branch add-teammate-invitations --id c1",
  },
  {
    name: "file vouch",
    about: "Toggle a file as reviewed. Lapses on its own when the file changes",
    safety: "write",
    options: [repo, branch, file],
    dataKey: "vouched",
    example: "adiff file vouch --repo . --branch cdr-1 --file src/api.ts",
  },
  {
    name: "review submit",
    about: "Send every staged comment as one review, so the agent wakes once",
    safety: "write",
    options: [repo, branch],
    dataKey: "submitted",
    example: "adiff review submit --repo . --branch cdr-1",
  },
  {
    name: "review progress",
    about: "Which files of a branch are still vouched, and how many there are",
    safety: "read",
    options: [repo, branch],
    dataKey: "vouched",
    example: "adiff review progress --repo . --branch cdr-1",
  },
  {
    name: "layers set",
    about: "Write the reading order for this worktree's diff: ordered layers over spans of files",
    safety: "write",
    options: [
      { name: "worktree", required: true, value: "path", about: "The worktree the layers is about" },
      {
        name: "json",
        required: true,
        value: "file|-",
        about: "The layers document, as a file path or - to read stdin",
      },
    ],
    dataKey: "layers",
    example: "adiff layers set --worktree . --json -",
  },
  {
    name: "layers show",
    about: "The layers of a worktree, with the hunks no layer claims",
    safety: "read",
    options: [
      { name: "worktree", required: true, value: "path", about: "The worktree to read" },
    ],
    dataKey: "layers",
    example: "adiff layers show --worktree . --fields layers,uncovered",
  },
  {
    name: "review open",
    about: "Open the review terminal. The only command that does not answer in JSON",
    safety: "read",
    options: [repo],
    dataKey: "",
    example: "adiff review open --repo .",
  },
  {
    name: "describe",
    about: "This catalog, as JSON",
    safety: "read",
    options: [
      { name: "command", required: false, value: "name", about: "Describe one command only" },
    ],
    dataKey: "commands",
    example: "adiff describe --command 'comment add'",
  },
]

export const commandNames: ReadonlyArray<string> = catalog.map((command) => command.name)

export const findCommand = (name: string): CommandSpec | undefined =>
  catalog.find((command) => command.name === name)
