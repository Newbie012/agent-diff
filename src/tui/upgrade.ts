import { Effect, type Scope } from "effect"
import manifest from "../../package.json" with { type: "json" }
import { askLatest, newer } from "../cli/index.ts"
import { Store, type UpgradeCheck } from "../service/store/index.ts"

const DAY_MS = 86_400_000

const NOTE =
  "adiff keeps this file so it asks the registry for the newest version at most once a day, never while you are waiting on a command. told is the version it has already mentioned once. Delete the file and it is written again. Set ADIFF_NO_UPGRADE_CHECK=1 to stop the check and the hint entirely."

const off = (): boolean => process.env["ADIFF_NO_UPGRADE_CHECK"] !== undefined

const stale = (held: UpgradeCheck): boolean =>
  held.checkedAt === undefined || Date.now() - Date.parse(held.checkedAt) > DAY_MS

const refresh = Effect.gen(function* () {
  const store = yield* Store
  const latest = yield* askLatest
  const held = yield* store.upgradeCheck
  yield* store.saveUpgradeCheck({
    ...held,
    note: NOTE,
    checkedAt: new Date().toISOString(),
    latest,
  })
}).pipe(Effect.withSpan("Tui.refreshUpgrade"))

const worded = Effect.gen(function* () {
  if (off()) return ""
  const store = yield* Store
  const held = yield* store.upgradeCheck
  const { latest } = held
  const due = latest !== undefined && latest !== held.told && newer(latest, manifest.version)
  if (due && latest !== undefined) {
    yield* store.saveUpgradeCheck({ ...held, note: NOTE, told: latest })
  }
  if (stale(held)) yield* Effect.forkScoped(Effect.ignore(refresh))
  return due ? `adiff ${latest} is out · adiff upgrade` : ""
}).pipe(Effect.withSpan("Tui.upgradeHint"))

export const upgradeHint: Effect.Effect<string, never, Store | Scope.Scope> = worded.pipe(
  Effect.catchTag(["StoreUnreadable", "StoreUnwritable"], () => Effect.succeed("")),
)
