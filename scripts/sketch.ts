import { createTestRenderer } from "@opentui/core/testing"
import { Effect, Exit, Layer, Scope } from "effect"
import { GitLive } from "../src/service/git/index.ts"
import { ForgeLive } from "../src/service/forge/index.ts"
import { storeAt } from "../src/service/store/index.ts"
import { launch } from "../src/tui/index.ts"
import { markSetNames, useMarks } from "../src/tui/marks.ts"
import { createWorkspace } from "./simulation/workspace.ts"
import { seedComments } from "./simulation/seed.ts"

const WIDTH = 108
const HEIGHT = 20
const wanted = process.argv.slice(2).filter((token) => !token.startsWith("--"))
const names = wanted.length > 0 ? wanted : markSetNames

const space = await createWorkspace({ branches: 1 })
await seedComments(space)

const rule = "─".repeat(WIDTH)

const shot = async (name: string): Promise<void> => {
  useMarks(name)
  const setup = await createTestRenderer({ width: WIDTH, height: HEIGHT })
  const scope = Scope.makeUnsafe()
  const context = await Effect.runPromise(
    Layer.buildWithScope(Layer.mergeAll(ForgeLive, storeAt(space.storeRoot)).pipe(Layer.provideMerge(GitLive)), scope),
  )
  const app = await Effect.runPromise(
    launch(space.repo, setup.renderer).pipe(Effect.provideContext(context), Scope.provide(scope)),
  )
  await setup.mockInput.pressKeys(["RETURN"])
  await app.settled()
  await setup.flush()
  await setup.mockInput.pressKeys(["]", "n"])
  await app.settled()
  await setup.flush()
  console.log(`\n${rule}\n  ${name}   (ADIFF_MARKS=${name} pnpm simulate)\n${rule}`)
  console.log(setup.captureCharFrame())
  setup.renderer.destroy()
  await Effect.runPromise(Scope.close(scope, Exit.void))
}

await names.reduce<Promise<void>>((chain, name) => chain.then(() => shot(name)), Promise.resolve())

await space.dispose()
process.exit(0)
