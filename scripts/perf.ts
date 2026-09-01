import { createTestRenderer } from "@opentui/core/testing"
import { Effect, Layer, Scope } from "effect"
import { GitLive } from "../src/service/git/index.ts"
import { ForgeLive } from "../src/service/forge/index.ts"
import { storeAt } from "../src/service/store/index.ts"
import { launch } from "../src/tui/index.ts"
import { createWorkspace } from "./simulation/workspace.ts"

const space = await createWorkspace({ branches: 7 })
const scope = Scope.makeUnsafe()
const context = await Effect.runPromise(
  Layer.buildWithScope(Layer.mergeAll(ForgeLive, storeAt(space.storeRoot)).pipe(Layer.provideMerge(GitLive)), scope),
)

const repeat = (times: number, run: () => Promise<unknown>): Promise<void> =>
  Array.from({ length: times }).reduce<Promise<void>>(
    (chain) => chain.then(() => run()).then(() => undefined),
    Promise.resolve(),
  )

const scenario = async (label: string, branchIndex: number): Promise<void> => {
  const setup = await createTestRenderer({ width: 120, height: 34 })
  const app = await Effect.runPromise(
    launch(space.repo, setup.renderer).pipe(Effect.provideContext(context), Scope.provide(scope)),
  )
  const keys = (name: string, times: number): Promise<void> =>
    setup.mockInput.pressKeys(Array.from({ length: times }, () => name))
  const time = async (name: string, run: () => Promise<void>): Promise<void> => {
    const started = process.hrtime.bigint()
    await run()
    await app.settled()
    await setup.flush()
    const ms = Number(process.hrtime.bigint() - started) / 1_000_000
    console.log(`  ${name.padEnd(20)} ${ms.toFixed(0).padStart(5)}ms`)
  }
  await setup.mockInput.pressKeys([
    ...Array.from({ length: branchIndex }, () => "j"),
    "RETURN",
  ])
  await app.settled()
  await setup.flush()
  console.log(label)
  const burst = async (times: number, direction: "up" | "down"): Promise<void> => {
    await Promise.all(
      Array.from({ length: times }, () => setup.mockMouse.scroll(80, 16, direction)),
    )
  }
  await time("scroll down x20", () => repeat(20, () => setup.mockMouse.scroll(80, 16, "down")))
  await time("scroll up x20", () => repeat(20, () => setup.mockMouse.scroll(80, 16, "up")))
  await time("burst down x240", () => burst(240, "down"))
  await time("burst up x240", () => burst(240, "up"))
  await time("pan right x20", () => keys(">", 20))
  await time("cursor down x20", () => keys("j", 20))
  await time("file next x10", () => keys("]", 10))
  setup.renderer.destroy()
}

await scenario("rewrite-the-invite-scheduler", 4)
await scenario("move-invites-to-the-mailer", 6)

await space.dispose()
process.exit(0)
