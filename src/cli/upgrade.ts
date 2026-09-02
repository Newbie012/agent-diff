import { spawn, type StdioOptions } from "node:child_process"
import { fileURLToPath } from "node:url"
import { Effect, Option, Schema } from "effect"
import manifest from "../../package.json" with { type: "json" }
import { registryUrl, upgradeRoute } from "./config.ts"
import { RegistryUnanswered } from "./error.ts"

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
  return `curl -fsSL ${RELEASES}/download/${assetOf()}.tar.gz | tar -xzO ${assetOf()} > ${executable} && chmod +x ${executable}`
}

const NOTES: Readonly<Record<Route, string>> = {
  brew: "Homebrew installed it, so Homebrew replaces it.",
  npm: "npm installed it, so npm replaces it.",
  bun: "bun installed it, so bun replaces it.",
  binary: "A running binary cannot rewrite itself.",
  source: "This is a checkout, so git is what updates it.",
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

const DistTags = Schema.Struct({
  alpha: Schema.optionalKey(Schema.String),
  latest: Schema.optionalKey(Schema.String),
})

const readTags = Schema.decodeUnknownEffect(DistTags)

const unanswered = (url: string) => (reason: unknown) =>
  new RegistryUnanswered({ url, reason: String(reason) })

const fetched = Effect.fn("Cli.fetchRegistry")(function* (url: string) {
  const response = yield* Effect.tryPromise({
    try: (signal) => fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(ASK_MS)]) }),
    catch: unanswered(url),
  })
  if (!response.ok) return yield* unanswered(url)(`HTTP ${response.status}`)
  return yield* Effect.tryPromise({ try: (): Promise<unknown> => response.json(), catch: unanswered(url) })
})

export const askLatest: Effect.Effect<string, RegistryUnanswered> = Effect.gen(function* () {
  const named = yield* Effect.mapError(registryUrl, unanswered(REGISTRY))
  const url = Option.getOrElse(named, () => REGISTRY)
  const body = yield* fetched(url)
  const tags = yield* Effect.mapError(readTags(body), unanswered(url))
  const version = tags[TAG] ?? tags.latest
  if (version === undefined) return yield* unanswered(url)("no version tag")
  return version
}).pipe(Effect.withSpan("Cli.askLatest"))

export const here = (): { executable: string; module: string } => ({
  executable: process.execPath,
  module: fileURLToPath(new URL(".", import.meta.url)),
})

export const findUpgrade = Effect.gen(function* () {
  const { executable, module } = here()
  const route = asRoute(Option.getOrUndefined(yield* upgradeRoute)) ?? routeOf(executable, module)
  const version = manifest.version
  const command = commandFor(route, executable, module)
  const latest = Option.getOrUndefined(yield* Effect.option(askLatest))
  const known = latest === undefined ? {} : { latest, current: !newer(latest, version) }
  return { route, version, checked: latest !== undefined, ...known, command } satisfies UpgradeFound
}).pipe(Effect.withSpan("Cli.findUpgrade"))

export const willUpgrade = (found: UpgradeFound, check: boolean): boolean =>
  !check && found.current !== true && RUNNABLE.has(found.route)

type Spawned = {
  readonly command: string
  readonly args: ReadonlyArray<string>
  readonly timeout: number
  readonly stdio: StdioOptions
}

const ranChild = <A>(
  spec: Spawned,
  done: (code: number | null, said: string) => A,
  broke: A,
): Effect.Effect<A> =>
  Effect.callback<A>((resume) => {
    let said = ""
    let answered = false
    const settle = (value: A): void => {
      if (answered) return
      answered = true
      resume(Effect.succeed(value))
    }
    const child = spawn(spec.command, [...spec.args], {
      timeout: spec.timeout,
      stdio: spec.stdio,
    })
    child.stdout?.on("data", (chunk: Buffer) => {
      said += chunk.toString("utf8")
    })
    child.on("error", () => settle(broke))
    child.on("close", (code) => settle(done(code, said)))
    return Effect.sync(() => void child.kill())
  })

export const runUpgrade = (found: UpgradeFound, quiet: boolean): Effect.Effect<boolean> =>
  ranChild(
    {
      command: "/bin/sh",
      args: ["-c", found.command],
      timeout: RUN_MS,
      stdio: quiet ? "ignore" : ["ignore", "inherit", "inherit"],
    },
    (code) => code === 0,
    false,
  ).pipe(Effect.withSpan("Cli.runUpgrade"))

const statusOf = (found: UpgradeFound): string => {
  if (!found.checked)
    return `adiff ${found.version} is installed. The registry did not answer.`
  if (found.current === true) return `adiff ${found.version} is the newest build.`
  return `adiff ${found.version} is installed, ${found.latest} is out.`
}

export const sayFound = (found: UpgradeFound, check: boolean): string => {
  if (found.current === true) return statusOf(found)
  if (willUpgrade(found, check))
    return found.checked ? `$ ${found.command}` : `${statusOf(found)}\n$ ${found.command}`
  const offer = RUNNABLE.has(found.route)
    ? `Run \`adiff upgrade\`, or \`${found.command}\` yourself.`
    : `Run: ${found.command}`
  return `${statusOf(found)} ${NOTES[found.route]} ${offer}`
}

export const sayDone = (found: UpgradeFound, ran: boolean): string => {
  if (!ran) return `That did not work. Run \`${found.command}\` yourself to see what it said.`
  if (found.latest === undefined)
    return "Upgraded. Run `adiff --version` to see which build you have now."
  return `adiff ${found.latest} is installed now.`
}

const attempted = (found: UpgradeFound, ran: boolean): string => {
  if (!ran) return `Ran \`${found.command}\` and it did not work.`
  if (found.latest === undefined)
    return `Ran \`${found.command}\`. Run \`adiff --version\` to see which build you have now.`
  return `Ran \`${found.command}\`, and adiff ${found.latest} is installed now.`
}

export const SAY_SKILL_TOO =
  "Run `npx skills update adiff` to bring the skill up with it."

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
        : `${statusOf(found)} ${NOTES[found.route]} Run \`${found.command}\` to upgrade.`
  return { ...found, ran, note }
}
