import { execFile } from "node:child_process"
import { createServer, type ServerResponse } from "node:http"
import { readFile, rm } from "node:fs/promises"
import { watch } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { holdingPage, toHtml, type Shot } from "./lib/paint.ts"

const exec = promisify(execFile)

const PORT = Number(process.env["PORT"] ?? 4319)
const SETTLE_MS = 120
const FRAMES = fileURLToPath(new URL("./frames.ts", import.meta.url))
const SOURCE = fileURLToPath(new URL("../src", import.meta.url))
const OUT = join(tmpdir(), `adiff-frames-${process.pid}.json`)

let page = holdingPage("capturing every screen — this page repaints when it lands…", "wait")
let building = false
let again = false
const watchers = new Set<ServerResponse>()

const capture = async (): Promise<void> => {
  if (building) {
    again = true
    return
  }
  building = true
  const started = Date.now()
  try {
    await exec(process.execPath, ["--experimental-ffi", "--disable-warning=ExperimentalWarning", FRAMES, "--json", OUT], {
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
      maxBuffer: 64 * 1024 * 1024,
    })
    const shots = JSON.parse(await readFile(OUT, "utf8")) as ReadonlyArray<Shot>
    page = toHtml(shots, "adiff — every screen", true)
    console.log(`${shots.length} screens in ${Date.now() - started}ms`)
  } catch (cause) {
    page = holdingPage(String(cause), "bad")
    console.log("capture failed")
  }
  building = false
  for (const watcher of watchers) watcher.write("data: reload\n\n")
  if (again) {
    again = false
    await capture()
  }
}

createServer((request, response) => {
  if (request.url === "/events") {
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    })
    watchers.add(response)
    request.on("close", () => watchers.delete(response))
    return
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" })
  response.end(page)
}).listen(PORT, () => console.log(`http://localhost:${PORT} — save a file in src/ and it repaints`))

let pending: ReturnType<typeof setTimeout> | undefined
watch(SOURCE, { recursive: true }, () => {
  if (pending !== undefined) clearTimeout(pending)
  pending = setTimeout(() => void capture(), SETTLE_MS)
})

process.on("SIGINT", () => {
  void rm(OUT, { force: true }).then(() => process.exit(0))
})

await capture()
