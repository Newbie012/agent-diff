import { execFile } from "node:child_process"
import { fileURLToPath } from "node:url"
import { Effect } from "effect"
import manifest from "../../package.json" with { type: "json" }

export type Route = "brew" | "npm" | "bun" | "binary" | "source"

export type UpgradeReport = {
  readonly route: Route
  readonly version: string
  readonly checked: boolean
  readonly latest?: string
  readonly current?: boolean
  readonly command: string
  readonly ran: boolean
  readonly note: string
}

const PACKAGE = "@eliya-oss/agent-diff"
const TAG = "alpha"
const RELEASES = "https://github.com/Newbie012/agent-diff/releases/latest"
const REGISTRY = `https://registry.npmjs.org/-/package/${encodeURIComponent(PACKAGE)}/dist-tags`
const ASK_MS = 2_500
const RUN_MS = 300_000

const CELLAR = /[/\\]Cellar[/\\]adiff[/\\]/
const COMPILED = /^[/\\]\$bunfs[/\\]/
const INSTALLED = /node_modules[/\\]@eliya-oss[/\\]agent-diff/
const BUN_GLOBAL = /[/\\]\.bun[/\\]install[/\\]global[/\\]/

export const routeOf = (executable: string, module: string): Route => {
  if (CELLAR.test(executable) || CELLAR.test(module)) return "brew"
  if (COMPILED.test(module)) return "binary"
  if (!INSTALLED.test(module)) return "source"
  return BUN_GLOBAL.test(module) ? "bun" : "npm"
}

const checkoutOf = (module: string): string =>
  module.replace(/[/\\](?:src|dist)[/\\].*$/, "").replace(/[/\\](?:src|dist)$/, "")

const assetOf = (): string => `adiff-${process.platform}-${process.arch}`

const commandFor = (route: Route, executable: string, module: string): string => {
  if (route === "brew") return "brew upgrade Newbie012/tap/adiff"
  if (route === "npm") return `npm i -g ${PACKAGE}@${TAG}`
  if (route === "bun") return `bun add -g ${PACKAGE}@${TAG}`
  if (route === "source") return `git -C ${checkoutOf(module)} pull && pnpm install && pnpm build`
  return `curl -fsSL ${RELEASES}/download/${assetOf()} -o ${executable} && chmod +x ${executable}`
}

const NOTES: Readonly<Record<Route, string>> = {
  brew: "Homebrew installed this build, so Homebrew replaces it.",
  npm: `npm installed this build. Name the ${TAG} tag: the latest tag on the registry is an old build.`,
  bun: `bun installed this build. Name the ${TAG} tag: the latest tag on the registry is an old build.`,
  binary:
    `This is a downloaded binary, so nothing upgrades it on its own. The command replaces it in place; a running executable cannot rewrite itself, so run it yourself. Every build is on ${RELEASES}.`,
  source: "This is running from a checkout, so git is what updates it.",
}

const RUNNABLE: ReadonlySet<Route> = new Set(["brew", "npm", "bun"])

const NUMBERS = /\d+/g

const numbersIn = (text: string): ReadonlyArray<number> =>
  (text.match(NUMBERS) ?? []).map((digits) => Number(digits))

const compare = (left: ReadonlyArray<number>, right: ReadonlyArray<number>): number => {
  const [head, ...restLeft] = left
  const [other, ...restRight] = right
  if (head === undefined && other === undefined) return 0
  if (head === undefined) return -1
  if (other === undefined) return 1
  if (head === other) return compare(restLeft, restRight)
  return head < other ? -1 : 1
}

const partsOf = (version: string): { core: ReadonlyArray<number>; pre: ReadonlyArray<number> } => {
  const [core = "", ...rest] = version.split("-")
  return { core: numbersIn(core), pre: numbersIn(rest.join("-")) }
}

export const newer = (candidate: string, held: string): boolean => {
  const left = partsOf(candidate)
  const right = partsOf(held)
  const cores = compare(left.core, right.core)
  if (cores !== 0) return cores > 0
  if (left.pre.length === 0 && right.pre.length === 0) return false
  if (left.pre.length === 0) return true
  if (right.pre.length === 0) return false
  return compare(left.pre, right.pre) > 0
}

const tagIn = (body: unknown): string | undefined => {
  if (typeof body !== "object" || body === undefined || body === null) return undefined
  const tags = body as Record<string, unknown>
  const named = tags[TAG] ?? tags["latest"]
  return typeof named === "string" ? named : undefined
}

const fetched = (url: string): Promise<string | undefined> =>
  fetch(url, { signal: AbortSignal.timeout(ASK_MS) })
    .then((response) => (response.ok ? response.json() : undefined))
    .then(tagIn)
    .catch(() => undefined)

export const askLatest: Effect.Effect<string | undefined> = Effect.promise(() =>
  fetched(process.env["ADIFF_REGISTRY"] ?? REGISTRY),
)

const ran = (command: string): Effect.Effect<boolean> =>
  Effect.callback<boolean>((resume) => {
    execFile("/bin/sh", ["-c", command], { timeout: RUN_MS }, (cause) =>
      resume(Effect.succeed(!cause)),
    )
  })

export const here = (): { executable: string; module: string } => ({
  executable: process.execPath,
  module: fileURLToPath(new URL(".", import.meta.url)),
})

const noteFor = (route: Route, run: boolean, version: string, checked: boolean): string => {
  const refused =
    run && !RUNNABLE.has(route) ? " adiff will not run this one for you; run it yourself." : ""
  const blind = checked
    ? ""
    : ` adiff could not reach the registry, so it cannot say whether ${version} is current. Every build is listed on ${RELEASES}.`
  return `${NOTES[route]}${refused}${blind}`
}

export const upgradeAdiff = Effect.fn("Cli.upgradeAdiff")(function* (run: boolean) {
  const { executable, module } = here()
  const route = routeOf(executable, module)
  const version = manifest.version
  const command = commandFor(route, executable, module)
  const latest = yield* askLatest
  const current = latest === undefined ? undefined : !newer(latest, version)
  const known = latest === undefined ? {} : { latest, current: current === true }
  const performed = run && RUNNABLE.has(route) && current !== true ? yield* ran(command) : false
  return {
    route,
    version,
    checked: latest !== undefined,
    ...known,
    command,
    ran: performed,
    note: noteFor(route, run, version, latest !== undefined),
  } satisfies UpgradeReport
})
