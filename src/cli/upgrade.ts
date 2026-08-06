import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { Effect } from "effect"
import manifest from "../../package.json" with { type: "json" }

export type Route = "brew" | "npm" | "bun" | "binary" | "source"

export type UpgradeFound = {
  readonly route: Route
  readonly version: string
  readonly checked: boolean
  readonly latest?: string
  readonly current?: boolean
  readonly command: string
}

export type UpgradeReport = UpgradeFound & {
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

const ROUTES: ReadonlyArray<Route> = ["brew", "npm", "bun", "binary", "source"]

const asRoute = (named: string | undefined): Route | undefined =>
  ROUTES.find((route) => route === named)

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
  npm: `npm installed this build, so npm replaces it. The ${TAG} tag matters: the latest tag on the registry still points at an old build.`,
  bun: `bun installed this build, so bun replaces it. The ${TAG} tag matters: the latest tag on the registry still points at an old build.`,
  binary:
    "This is a downloaded binary, so nothing upgrades it on its own, and a running executable cannot rewrite itself.",
  source: "This is running from a checkout, so git is what updates it.",
}

const REFUSALS: Readonly<Partial<Record<Route, string>>> = {
  binary: `adiff cannot do this one for you. Every build is listed on ${RELEASES}.`,
  source: "adiff will not pull your checkout for you.",
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

export const here = (): { executable: string; module: string } => ({
  executable: process.execPath,
  module: fileURLToPath(new URL(".", import.meta.url)),
})

export const findUpgrade: Effect.Effect<UpgradeFound> = Effect.gen(function* () {
  const { executable, module } = here()
  const route = asRoute(process.env["ADIFF_UPGRADE_ROUTE"]) ?? routeOf(executable, module)
  const version = manifest.version
  const command = commandFor(route, executable, module)
  const latest = yield* askLatest
  const known = latest === undefined ? {} : { latest, current: !newer(latest, version) }
  return { route, version, checked: latest !== undefined, ...known, command } satisfies UpgradeFound
}).pipe(Effect.withSpan("Cli.findUpgrade"))

export const willUpgrade = (found: UpgradeFound, check: boolean): boolean =>
  !check && found.current !== true && RUNNABLE.has(found.route)

export const runUpgrade = (found: UpgradeFound, quiet: boolean): Effect.Effect<boolean> =>
  Effect.callback<boolean>((resume) => {
    let answered = false
    const settle = (worked: boolean): void => {
      if (answered) return
      answered = true
      resume(Effect.succeed(worked))
    }
    const child = spawn("/bin/sh", ["-c", found.command], {
      timeout: RUN_MS,
      stdio: quiet ? "ignore" : ["ignore", "inherit", "inherit"],
    })
    child.on("error", () => settle(false))
    child.on("close", (code) => settle(code === 0))
  }).pipe(Effect.withSpan("Cli.runUpgrade"))

const statusOf = (found: UpgradeFound): string => {
  if (!found.checked)
    return `adiff ${found.version} is installed. The registry did not answer, so adiff cannot tell whether a newer build is out.`
  if (found.current === true) return `adiff ${found.version} is the newest build.`
  return `adiff ${found.version} is installed, and ${found.latest} is out.`
}

const refusalOf = (found: UpgradeFound): string => {
  const refusal = REFUSALS[found.route]
  return refusal === undefined ? NOTES[found.route] : `${NOTES[found.route]} ${refusal}`
}

const OFFER = "Run `adiff upgrade` and adiff runs that for you."

export const sayFound = (found: UpgradeFound, check: boolean): string => {
  if (found.current === true) return statusOf(found)
  if (willUpgrade(found, check))
    return [statusOf(found), `${NOTES[found.route]} Running it now:`, `  ${found.command}`].join(
      "\n\n",
    )
  const offer = RUNNABLE.has(found.route) ? [OFFER] : []
  return [statusOf(found), refusalOf(found), `  ${found.command}`, ...offer].join("\n\n")
}

export const sayDone = (found: UpgradeFound, ran: boolean): string => {
  if (!ran) return `That did not work. Run \`${found.command}\` yourself to see what it said.`
  if (found.latest === undefined)
    return "That worked. Run `adiff --version` to see which build you have now."
  return `adiff ${found.latest} is installed now.`
}

const attempted = (found: UpgradeFound, ran: boolean): string => {
  if (!ran) return `Ran \`${found.command}\` and it did not work. Run it yourself to see what it said.`
  if (found.latest === undefined)
    return `Ran \`${found.command}\`. Run \`adiff --version\` to see which build you have now.`
  return `Ran \`${found.command}\`, and adiff ${found.latest} is installed now.`
}

export const upgradeReport = (
  found: UpgradeFound,
  ran: boolean,
  check: boolean,
): UpgradeReport => {
  const note =
    found.current === true
      ? statusOf(found)
      : willUpgrade(found, check)
        ? `${statusOf(found)} ${attempted(found, ran)}`
        : `${statusOf(found)} ${refusalOf(found)} Run \`${found.command}\` to upgrade.`
  return { ...found, ran, note }
}
