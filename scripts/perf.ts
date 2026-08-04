import { createTestRenderer } from "@opentui/core/testing"
import { Effect, Layer, Scope } from "effect"
import { GitLive } from "../src/service/git/index.ts"
import { storeAt } from "../src/service/store/index.ts"
import { launch } from "../src/tui/index.ts"
import { createWorkspace } from "./simulation/workspace.ts"

const space = await createWorkspace({ branches: 7 })
const setup = await createTestRenderer({ width: 120, height: 34 })
const scope = Scope.makeUnsafe()
const context = await Effect.runPromise(
  Layer.buildWithScope(Layer.mergeAll(GitLive, storeAt(space.storeRoot)), scope),
)
const app = await Effect.runPromise(launch(space.repo, setup.renderer).pipe(Effect.provideContext(context)))

await setup.mockInput.pressKeys(["j", "j", "j", "j", "RETURN"])
await app.settled()
await setup.flush()

const time = async (label: string, run: () => Promise<void>): Promise<void> => {
  const started = process.hrtime.bigint()
  await run()
  await app.settled()
  await setup.flush()
  console.log(`${label.padEnd(26)} ${(Number(process.hrtime.bigint() - started) / 1_000_000).toFixed(0)}ms`)
}

const wheel = (direction: "up" | "down", times: number): Promise<void> =>
  Array.from({ length: times }).reduce<Promise<void>>(
    (chain) => chain.then(() => setup.mockMouse.scroll(80, 16, direction)),
    Promise.resolve(),
  )

await time("scroll down x20", () => wheel("down", 20))
await time("scroll up x20", () => wheel("up", 20))
await time("cursor down x20", () => setup.mockInput.pressKeys(Array.from({ length: 20 }, () => "j")))
setup.renderer.destroy()
await space.dispose()
process.exit(0)
