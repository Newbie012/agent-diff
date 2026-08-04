import { createServer } from "node:http"
import { access, mkdir } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { createTestRenderer } from "@opentui/core/testing"
import { Effect, Layer, Scope } from "effect"
import { GitLive } from "../src/service/git/index.ts"
import { ForgeLive } from "../src/service/forge/index.ts"
import { storeAt } from "../src/service/store/index.ts"
import { launch } from "../src/tui/index.ts"
import { playerPage, toPlain, type Line, type Shot } from "./lib/paint.ts"
import { seedRemarks } from "./simulation/seed.ts"
import { createWorkspace } from "./simulation/workspace.ts"

const PORT = Number(process.env["PORT"] ?? 4320)
const WIDTH = 120
const HEIGHT = 36
const ESCAPE_MS = 180
const HOME = join(homedir(), ".cache", "adiff", "watch")

const exists = async (path: string): Promise<boolean> =>
  access(path)
    .then(() => true)
    .catch(() => false)

await mkdir(HOME, { recursive: true })
const repo = join(HOME, "repo")
if (!(await exists(repo))) {
  process.stdout.write("building the workspace once…\n")
  const built = await createWorkspace({ branches: 7, at: HOME })
  await seedRemarks(built)
}

const setup = await createTestRenderer({ width: WIDTH, height: HEIGHT })
const scope = Scope.makeUnsafe()
const context = await Effect.runPromise(
  Layer.buildWithScope(Layer.mergeAll(GitLive, ForgeLive, storeAt(join(HOME, "store"))), scope),
)
const app = await Effect.runPromise(
  launch(repo, setup.renderer, undefined, join(HOME, "session.json")).pipe(
    Effect.provideContext(context),
  ),
)

const frame = async (): Promise<Shot> => {
  await app.settled()
  await setup.flush()
  const captured = setup.captureSpans() as { lines: ReadonlyArray<Line> }
  return toPlain({ label: "live", lines: captured.lines })
}

const CHORD = /^ctrl\+(.)$/

const ALIAS: Readonly<Record<string, string>> = {
  down: "ARROW_DOWN",
  up: "ARROW_UP",
  left: "ARROW_LEFT",
  right: "ARROW_RIGHT",
  enter: "RETURN",
  backspace: "BACKSPACE",
  tab: "TAB",
}

const press = async (key: string): Promise<void> => {
  const chord = CHORD.exec(key)
  if (chord?.[1] !== undefined) {
    setup.mockInput.pressKey(chord[1], { ctrl: true })
  } else if (key === "escape") {
    setup.mockInput.pressEscape()
    await new Promise((resolve) => setTimeout(resolve, ESCAPE_MS))
  } else {
    await setup.mockInput.pressKeys([ALIAS[key.toLowerCase()] ?? key])
  }
  await app.settled()
}

type Move = { readonly kind: string; readonly x: number; readonly y: number; readonly to?: { readonly x: number; readonly y: number } }

const mouse = async (move: Move): Promise<void> => {
  if (move.kind === "wheel") {
    await setup.mockMouse.scroll(move.x, move.y, move.to === undefined ? "down" : "up")
  } else if (move.kind === "move") {
    await setup.mockMouse.moveTo(move.x, move.y)
  } else if (move.kind === "drag" && move.to !== undefined) {
    await setup.mockMouse.drag(move.x, move.y, move.to.x, move.to.y)
  } else {
    await setup.mockMouse.click(move.x, move.y)
  }
  await app.settled()
}

const body = async (request: { on: (event: string, run: (chunk?: Buffer) => void) => void }): Promise<string> =>
  new Promise((resolve) => {
    const chunks: Array<Buffer> = []
    request.on("data", (chunk) => {
      if (chunk !== undefined) chunks.push(chunk)
    })
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
  })

createServer((request, response) => {
  const send = (shot: Shot): void => {
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify(shot))
  }
  if (request.url === "/key" && request.method === "POST") {
    void body(request)
      .then((raw) => press(raw))
      .then(frame)
      .then(send)
    return
  }
  if (request.url === "/mouse" && request.method === "POST") {
    void body(request)
      .then((raw) => mouse(JSON.parse(raw) as Move))
      .then(frame)
      .then(send)
    return
  }
  if (request.url === "/frame") {
    void frame().then(send)
    return
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" })
  response.end(playerPage("adiff — live"))
}).listen(PORT, () => process.stdout.write(`http://localhost:${PORT} — type into it, it is the real terminal\n`))
