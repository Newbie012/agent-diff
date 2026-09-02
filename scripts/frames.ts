// Dump every screen of the review terminal at a realistic size.
//
//   pnpm frames              # all screens
//   pnpm frames --width 140  # a wider terminal
import { writeFile } from "node:fs/promises"
import { createTestRenderer } from "@opentui/core/testing"
import { toAnsi, toHtml, toPlain, type Line, type Shot } from "./lib/paint.ts"
import { Effect, Layer, Scope } from "effect"
import { GitLive } from "../src/service/git/index.ts"
import { ForgeLive } from "../src/service/forge/index.ts"
import { storeAt } from "../src/service/store/index.ts"
import { launch, type App } from "../src/tui/index.ts"
import { answerLive } from "./simulation/seed.ts"
import { seedDemo } from "./simulation/seed.ts"
import { createWorkspace } from "./simulation/workspace.ts"

const number = (name: string, fallback: number): number => {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : Number(process.argv[index + 1] ?? fallback)
}

const width = number("width", 110)
const height = number("height", 26)

const space = await createWorkspace({ branches: number("branches", 7) })
await seedDemo(space)
const setup = await createTestRenderer({ width, height })
const scope = Scope.makeUnsafe()
const layer = Layer.mergeAll(ForgeLive, storeAt(space.storeRoot)).pipe(Layer.provideMerge(GitLive))
const context = await Effect.runPromise(Layer.buildWithScope(layer, scope))
const app: App = await Effect.runPromise(
  launch(space.repo, setup.renderer).pipe(Effect.provideContext(context), Scope.provide(scope)),
)

const settle = async (): Promise<void> => {
  await app.settled()
  await setup.flush()
}

const press = async (keys: ReadonlyArray<string>): Promise<void> => {
  await setup.mockInput.pressKeys([...keys])
  await settle()
}

const type = async (text: string): Promise<void> => {
  await setup.mockInput.typeText(text)
  await settle()
}

const chord = async (letter: string): Promise<void> => {
  setup.mockInput.pressKey(letter, { ctrl: true })
  await settle()
}

const escape = async (): Promise<void> => {
  setup.mockInput.pressEscape()
  await new Promise((resolve) => setTimeout(resolve, 250))
  await settle()
}

const rule = "─".repeat(width)
const wantsHtml = process.argv.includes("--html") || process.argv.includes("--json")
const plain = process.argv.includes("--plain")
const shots: Array<Shot> = []

const show = async (label: string): Promise<void> => {
  await app.settled()
  await setup.flush()
  const captured = setup.captureSpans() as { lines: ReadonlyArray<Line> }
  const shot: Shot = { label, lines: captured.lines }
  shots.push(shot)
  if (wantsHtml) return
  console.log(`\n${rule}\n  ${label}\n${rule}`)
  console.log(plain ? setup.captureCharFrame() : toAnsi(shot))
}

await show("branches")
await press(["RETURN"])
await show("review")

await answerLive(space, "add-teammate-invitations")
await new Promise((resolve) => setTimeout(resolve, 400))
await settle()
await show("an answer arriving while you read")
await press(["r"])
await show("the answer pulled in")

await press(["l"])
await show("layer opened")
await press(["TAB", "j"])
await show("prose beside the code it describes")
await press(["j", "l"])
await show("layer without a note opened")
await press(["h", "s"])
await show("back to the file tree")

await press(["c"])
await type("this needs a union")
await show("compose")
await press(["RETURN"])
await type("and a second line under it")
await show("compose on two lines")
await press(["RETURN"])
await type("a line long enough that it has to wrap inside the panel rather than run past the edge of it, which is what this sentence is here to check")
await show("compose with a long line")
await chord("a")
await show("staged")
await press(["S"])
await show("pending review")
await escape()
await escape()
await show("branches with work waiting")

await press(["j", "j", "j", "RETURN"])
await show("a thread the agent asked back on")
await press(["]"])
await show("a thread the agent answered")
await escape()
await press(["j", "j", "RETURN"])
await show("a thread already settled")
await escape()

await press(["RETURN"])

await press(["]", "]"])
await show("third file")
await press(["G"])
await show("scrolled into scope")
await press(["m"])
await show("marked reviewed")
await press(["h"])
await show("directory folded")
await press(["v", "j", "j"])
await show("selection")

await escape()
await press(["j", "j", "j", "RETURN", "TAB"])
await show("a gap holding lines back")
await press(["l"])
await show("the gap opened once")
await press(["l"])
await show("the gap opened again")

await chord("b")
await type("the cursor jumps two lines")
await show("bug report")
await escape()

await press(["j", "j", "j"])
await press(["v"])
await press(["/"])
await show("what else uses this")
await press(["j"])
await show("peeking at a match")
await escape()

await chord("p")
await show("palette")
await type("file")
await show("palette filtered")
await escape()

await press(["?"])
await show("every key here")

setup.renderer.destroy()
if (process.argv.includes("--html")) {
  const out = process.argv[process.argv.indexOf("--html") + 1] ?? "frames.html"
  await writeFile(out, toHtml(shots, "adiff — every screen"), "utf8")
  console.log(`${shots.length} screens written to ${out}`)
}
if (process.argv.includes("--json")) {
  const out = process.argv[process.argv.indexOf("--json") + 1] ?? "frames.json"
  await writeFile(out, JSON.stringify(shots.map(toPlain)), "utf8")
}
await space.dispose()
process.exit(0)
