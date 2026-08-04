export type FileFixture = {
  readonly path: string
  readonly before: ReadonlyArray<string>
  readonly after: ReadonlyArray<string>
}

export type BranchFixture = {
  readonly name: string
  readonly files: ReadonlyArray<FileFixture>
}

const invitationsBefore = [
  "import { client } from './client'",
  "",
  "export const listInvitations = async (team: string) => {",
  "  const res = await client.get(`/teams/${team}/invitations`)",
  "  return res.json()",
  "}",
  "",
  "export const inviteTeammate = async (team: string, email: string) => {",
  "  const res = await client.post(`/teams/${team}/invitations`, { email })",
  "  return res.json()",
  "}",
]

const invitationsAfter = [
  "import { client } from './client'",
  "import { SeatsExhausted, AlreadyInvited, Upstream } from './errors'",
  "",
  "export const listInvitations = async (team: string) => {",
  "  const res = await client.get(`/teams/${team}/invitations`)",
  "  if (!res.ok) throw new Upstream(res.status)",
  "  return res.json()",
  "}",
  "",
  "export const inviteTeammate = async (team: string, email: string) => {",
  "  const res = await client.post(`/teams/${team}/invitations`, { email })",
  "  if (res.status === 409) throw new AlreadyInvited(email)",
  "  if (res.status === 402) throw new SeatsExhausted(team)",
  "  if (!res.ok) throw new Upstream(res.status)",
  "  return res.json()",
  "}",
]

const errorsAfter = [
  "export class AlreadyInvited extends Error {",
  "  constructor(readonly email: string) {",
  "    super(`${email} already has an open invitation`)",
  "  }",
  "}",
  "",
  "export class SeatsExhausted extends Error {",
  "  constructor(readonly team: string) {",
  "    super(`team ${team} has no seats left`)",
  "  }",
  "}",
  "",
  "export class Upstream extends Error {",
  "  constructor(readonly status: number) {",
  "    super(`invitations upstream returned ${status}`)",
  "  }",
  "}",
]

const inviteListBefore = [
  "export function InviteList({ team }: { team: string }) {",
  "  const { data } = useInvitations(team)",
  "",
  "  if (!data) return <Spinner />",
  "",
  "  return (",
  "    <ul>",
  "      {data.map((invite) => (",
  "        <li key={invite.id}>{invite.email}</li>",
  "      ))}",
  "    </ul>",
  "  )",
  "}",
]

const inviteListAfter = [
  "export function InviteList({ team }: { team: string }) {",
  "  const { data, error } = useInvitations(team)",
  "",
  "  if (error instanceof SeatsExhausted) return <UpgradePrompt team={team} />",
  "  if (error) return <Failed onRetry={() => refetch(team)} />",
  "  if (!data) return <Spinner />",
  "  if (data.length === 0) return <Empty reason=\"nobody invited yet\" />",
  "",
  "  return (",
  "    <ul>",
  "      {data.map((invite) => (",
  "        <li key={invite.id}>",
  "          {invite.email} <Badge status={invite.status} />",
  "        </li>",
  "      ))}",
  "    </ul>",
  "  )",
  "}",
]

const legacyInvitesBefore = [
  "export const normalise = (raw: any) => ({",
  "  id: raw.invitation_id,",
  "  email: raw.invitee_email,",
  "})",
]

const docsBefore = [
  "# Invitations",
  "",
  "Inviting a teammate returns 200 whatever happens.",
  "A full team and a repeat invite look the same to the caller.",
]

const docsAfter = [
  "# Invitations",
  "",
  "Inviting a teammate returns 201 with the pending invitation.",
  "",
  "A repeat invite raises `AlreadyInvited`. A team with no seats left",
  "raises `SeatsExhausted`, and the settings page offers an upgrade.",
  "Any other non-2xx raises `Upstream` carrying the status.",
]

export const fixtures: ReadonlyArray<BranchFixture> = [
  {
    name: "add-teammate-invitations",
    files: [
      { path: "src/api/invitations.ts", before: invitationsBefore, after: invitationsAfter },
      { path: "src/api/errors.ts", before: [], after: errorsAfter },
      { path: "docs/invitations.md", before: docsBefore, after: docsAfter },
    ],
  },
  {
    name: "show-invites-in-settings",
    files: [
      { path: "src/ui/InviteList.tsx", before: inviteListBefore, after: inviteListAfter },
      { path: "src/api/legacy-invites.ts", before: legacyInvitesBefore, after: [] },
    ],
  },
  {
    name: "resend-expired-invites",
    files: [
      {
        path: "src/jobs/resend-invite.ts",
        before: [],
        after: [
          "import { invites } from '../repository'",
          "import { mailer } from '../mailer'",
          "",
          "export const resendInvite = async (id: string, attempts = 3): Promise<boolean> => {",
          "  const invite = await invites.byId(id)",
          "  if (invite === undefined || invite.status !== 'pending') return false",
          "  try {",
          "    await mailer.send('invite.resent', { to: invite.email, token: invite.token })",
          "    return true",
          "  } catch (cause) {",
          "    if (attempts <= 1) throw cause",
          "    return resendInvite(id, attempts - 1)",
          "  }",
          "}",
        ],
      },
    ],
  },
]

const AREAS = ["api", "ui", "store", "jobs", "auth", "billing", "notify", "search"]

const TOPICS = [
  "invite",
  "seat",
  "member",
  "role",
  "token",
  "team",
  "domain",
  "reminder",
  "audit",
  "quota",
  "digest",
  "webhook",
]

const LAYERS = ["service", "store", "routes", "mapper", "guard", "policy", "queue"]

const NOUNS = ["Invite", "Seat", "Member", "Role", "Token"]

const READ_VERBS = ["load", "list", "find", "count", "collect", "gather"]

const WRITE_VERBS = ["revoke", "resend", "expire", "accept", "decline", "sync"]

const MAP_VERBS = ["to", "parse", "read", "hydrate", "decode", "normalise"]

const PREDICATES = ["isExpired", "isStale", "isLapsed", "isOverdue", "isDormant", "isTimedOut"]

const pick = <A>(items: ReadonlyArray<A>, index: number, fallback: A): A => items[index % items.length] ?? fallback

const headerBefore = (topic: string): ReadonlyArray<string> => [
  `// ${topic} rows are keyed by email until the invitation is accepted.`,
  `import { db } from "../db"`,
  `import { logger } from "../logger"`,
  `import { mailer } from "../mailer"`,
  `import { SELECT } from "./sql"`,
  `import type { Invite, Member, Role, Seat, Token } from "./types"`,
  ``,
  `export type ${topic}Query = { team_id: string; status?: string; page?: number }`,
  ``,
]

const headerAfter = (topic: string): ReadonlyArray<string> => [
  `// ${topic} rows are keyed by email until the invitation is accepted,`,
  `// and by member id from then on.`,
  `import * as repo from "../repository"`,
  `import { logger } from "../logger"`,
  `import { queue, MailerError } from "../queue"`,
  `import { failure, success, type Result } from "../result"`,
  `import type { Invite, Member, Role, Seat, Token } from "./types"`,
  ``,
  `export type ${topic}Query = {`,
  `  readonly teamId: string`,
  `  readonly status?: "pending" | "accepted" | "expired"`,
  `  readonly cursor?: string`,
  `}`,
  ``,
]

const blockBefore = (name: string, noun: string, shape: number): ReadonlyArray<string> => {
  if (shape === 0) {
    return [
      `export function ${name}(teamId: string): Promise<Array<${noun}>> {`,
      `  return db.query(SELECT.${noun.toLowerCase()}sForTeam, [teamId]).then((rows) => {`,
      `    logger.debug("${name}", { teamId, rows: rows.length })`,
      `    return rows.map(to${noun})`,
      `  })`,
      `}`,
      ``,
    ]
  }
  if (shape === 1) {
    return [
      `export function ${name}(row: ${noun}Row) {`,
      `  return { id: row.${noun.toLowerCase()}_id, teamId: row.team_id, invitedBy: row.invited_by }`,
      `}`,
      ``,
    ]
  }
  if (shape === 2) {
    return [
      `export async function ${name}(id: string) {`,
      `  const sent = await mailer.send("${noun.toLowerCase()}.changed", { id })`,
      `  if (!sent.ok) logger.warn("${name} could not notify", { id })`,
      `  return sent.ok`,
      `}`,
      ``,
    ]
  }
  return [
    `export const ${name} = (at: Date, ${noun.toLowerCase()}: ${noun}) =>`,
    `  ${noun.toLowerCase()}.status === "pending" && ${noun.toLowerCase()}.expiresAt < at`,
    ``,
  ]
}

const blockAfter = (name: string, noun: string, shape: number): ReadonlyArray<string> => {
  if (shape === 0) {
    return [
      `export async function ${name}(teamId: string): Promise<ReadonlyArray<${noun}>> {`,
      `  const rows = await repo.${noun.toLowerCase()}s.forTeam(teamId)`,
      `  if (rows.length === 0) return []`,
      `  logger.debug("${name}", { teamId, rows: rows.length })`,
      `  return rows.map(to${noun})`,
      `}`,
      ``,
    ]
  }
  if (shape === 1) {
    return [
      `export function ${name}(row: ${noun}Row): ${noun} {`,
      `  const invitedBy = row.invitedBy ?? "system"`,
      `  return { id: row.${noun.toLowerCase()}Id, teamId: row.teamId, invitedBy }`,
      `}`,
      ``,
    ]
  }
  if (shape === 2) {
    return [
      `export async function ${name}(id: string): Promise<Result<void, MailerError>> {`,
      `  const job = await queue.enqueue("${noun.toLowerCase()}.changed", { id, attempts: 0 })`,
      `  if (job.status === "rejected") return failure(new MailerError(job.reason))`,
      `  logger.info("${name} queued", { id, job: job.id })`,
      `  return success(undefined)`,
      `}`,
      ``,
    ]
  }
  return [
    `export const ${name} = (at: Date, ${noun.toLowerCase()}: ${noun}): boolean => {`,
    `  if (${noun.toLowerCase()}.status !== "pending") return false`,
    `  return ${noun.toLowerCase()}.expiresAt.getTime() <= at.getTime()`,
    `}`,
    ``,
  ]
}

const titled = (word: string): string => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`

const nameFor = (noun: string, slot: number, shape: number): string => {
  if (shape === 0) return `${pick(READ_VERBS, slot, "load")}${noun}s`
  if (shape === 1) return `${pick(MAP_VERBS, slot, "to")}${noun}`
  if (shape === 2) return `${pick(WRITE_VERBS, slot, "revoke")}${noun}`
  return `${pick(PREDICATES, slot, "isStale")}${noun}`
}

const moduleBody = (
  topic: string,
  seed: number,
  blocks: number,
  phase: "before" | "after",
): ReadonlyArray<string> => {
  const header = phase === "before" ? headerBefore(titled(topic)) : headerAfter(titled(topic))
  const bodies = Array.from({ length: Math.max(1, blocks) }, (_, step) => {
    const slot = seed + step
    const shape = (seed + step * 3) % 4
    const noun = pick(NOUNS, slot, "Invite")
    const name = nameFor(noun, slot, shape)
    return phase === "before" ? blockBefore(name, noun, shape) : blockAfter(name, noun, shape)
  })
  return [...header, ...bodies.flat()]
}

const blocksFor = (lines: number): number => Math.max(1, Math.round(lines / 6))

const generatedFile = (index: number, lines: number): FileFixture => {
  const area = pick(AREAS, index, "api")
  const topic = pick(TOPICS, index, "invite")
  const layer = pick(LAYERS, Math.floor(index / TOPICS.length), "service")
  const blocks = blocksFor(lines)
  return {
    path: `src/${area}/${topic}-${layer}.ts`,
    before: moduleBody(topic, index, blocks, "before"),
    after: moduleBody(topic, index, blocks, "after"),
  }
}

const generatedBranch = (name: string, files: number, lines: number): BranchFixture => ({
  name,
  files: Array.from({ length: files }, (_, index) => generatedFile(index, lines)),
})

const LEGACY = ["client", "mapper", "types", "guard", "hooks", "tokens", "shim", "retry", "index"]

const deletionHeavy: BranchFixture = {
  name: "drop-the-legacy-invite-client",
  files: LEGACY.map((module, index) => ({
    path: `src/legacy/invites/${module}.ts`,
    before: moduleBody(module, index * 3, 3, "before"),
    after: [],
  })),
}

const oneHugeFile: BranchFixture = {
  name: "rewrite-the-invite-scheduler",
  files: [
    {
      path: "src/jobs/invite-scheduler.ts",
      before: moduleBody("reminder", 5, blocksFor(220), "before"),
      after: moduleBody("reminder", 5, blocksFor(240), "after"),
    },
  ],
}

export const variants: ReadonlyArray<BranchFixture> = [
  ...fixtures,
  deletionHeavy,
  oneHugeFile,
  generatedBranch("tidy-the-invitations-api", 12, 14),
  generatedBranch("move-invites-to-the-mailer", 42, 24),
]
