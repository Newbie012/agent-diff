import { execFileSync, spawn } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { argv, env, exit, stderr } from "node:process"
import { NODE, runArgs } from "./lib/entry.ts"
import { createWorkspace, type Workspace } from "./simulation/workspace.ts"
import type { Trace } from "../src/testing/scenario/index.ts"

export const tracesIn = (path: string): ReadonlyArray<Trace> =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Trace)

export const traceNamed = (path: string, test: string): Trace => {
  const every = tracesIn(path)
  const found = every.findLast((held) => held.test === test)
  if (found === undefined) {
    stderr.write(`No trace for ${test}. There are ${every.length}.\n`)
    exit(1)
  }
  const beyond = found.cannotReplay ?? []
  if (beyond.length > 0) {
    stderr.write(
      `${test} drives adiff with ${beyond.join(" and ")}, which a replay cannot do, so this trace would capture the wrong screen. Write the test with keys instead, or leave it uncaptured.\n`,
    )
    exit(1)
  }
  return found
}

export const worldOf = (held: Trace, at?: string): Promise<Workspace> =>
  createWorkspace({
    branches: 1,
    ...(at === undefined ? {} : { at }),
    fixtures: [
      {
        name: held.world.branch.name ?? "review",
        files: held.world.branch.files ?? [],
      },
    ],
  })

const threadsFor = (held: Trace): string =>
  JSON.stringify({
    data: {
      repository: {
        pullRequests: {
          nodes: [{
          reviewThreads: {
            pageInfo: { hasNextPage: false },
            nodes: (held.world.remarks ?? []).map((one) => ({
              id: one.id,
              isResolved: one.resolved === true,
              isOutdated: one.outdated === true,
              path: one.path,
              diffSide: one.side === "old" ? "LEFT" : "RIGHT",
              line: one.line,
              comments: {
                totalCount: one.comments.length,
                nodes: one.comments.map((said, at) => ({
                  databaseId: 1000 + at,
                  author: { login: said.by },
                  body: said.body,
                  diffHunk: at === 0 ? (one.hunk ?? `@@ -1 +${one.line} @@`) : "",
                  originalCommit: { oid: "headcommit" },
                })),
              },
            })),
          },
          }],
        },
      },
    },
  })

const forgeFor = (space: Workspace, held: Trace): string => {
  const bin = join(space.root, "bin")
  mkdirSync(bin, { recursive: true })
  if (held.world.readsRemarks === true) {
    mkdirSync(space.storeRoot, { recursive: true })
    writeFileSync(join(space.storeRoot, "settings.json"), JSON.stringify({ remarks: true }))
  }
  const branch = space.branches[0]?.name ?? "review"
  const lines =
    (held.world.remarks ?? []).length === 0
      ? ["#!/bin/sh", "printf '[]'"]
      : [
          "#!/bin/sh",
          'if [ "$1" = "pr" ] && [ "$2" = "list" ]; then',
          `printf '%s' '${JSON.stringify([{ headRefName: branch, state: "OPEN", isDraft: false }])}'`,
          "exit 0",
          "fi",
          'if [ "$1" = "pr" ] && [ "$2" = "view" ]; then',
          `printf '%s' '${JSON.stringify({ number: 1, headRefOid: "headcommit", url: "https://forge.test/one/two/pull/1" })}'`,
          "exit 0",
          "fi",
          'if [ "$1" = "repo" ]; then',
          "printf '%s' 'one/two'",
          "exit 0",
          "fi",
          'if [ "$1" = "api" ]; then',
          `cat <<'JSON'`,
          threadsFor(held),
          "JSON",
          "exit 0",
          "fi",
          "printf '[]'",
        ]
  writeFileSync(join(bin, "gh"), `${lines.join("\n")}\n`, { mode: 0o755 })
  return bin
}

const layersInto = (space: Workspace, held: Trace): void => {
  const layers = held.world.layers
  const worktree = space.branches[0]?.worktree
  if (layers === undefined || worktree === undefined) return
  execFileSync(
    NODE,
    runArgs(["layers", "set", "--worktree", worktree, "--json", "-"]),
    {
      cwd: space.repo,
      input: JSON.stringify(layers),
      env: { ...env, ADIFF_ROOT: space.storeRoot, ADIFF_NO_UPGRADE_CHECK: "1" },
      stdio: ["pipe", "ignore", "inherit"],
    },
  )
}

export const openTerminal = (space: Workspace, held: Trace): Promise<number> =>
  new Promise((resolve) => {
    layersInto(space, held)
    const child = spawn(NODE, runArgs(["review", "open", "--repo", space.repo]), {
      cwd: space.repo,
      env: {
        ...env,
        ADIFF_ROOT: space.storeRoot,
        ADIFF_NO_UPGRADE_CHECK: "1",
        PATH: `${forgeFor(space, held)}:${env["PATH"] ?? ""}`,
      },
      stdio: "inherit",
    })
    child.on("exit", (code) => resolve(code ?? 0))
  })

const asked = argv[2]
const wanted = argv[3]
const inside = argv[4]
const isEntry = argv[1]?.endsWith("scenario.ts") === true

if (isEntry && asked !== undefined && wanted !== undefined) {
  const held = traceNamed(asked, wanted)
  const space = await worldOf(held, inside)
  await openTerminal(space, held)
  await space.dispose()
}
