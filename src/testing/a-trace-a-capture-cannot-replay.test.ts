import { execFile } from "node:child_process"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { describe, expect, test } from "@effect/vitest"

const exec = promisify(execFile)

const NAME = "when a comment is sent > then the review panel lists it"

const SHOT = [
  "--experimental-ffi",
  "--disable-warning=ExperimentalWarning",
  "scripts/shot.ts",
]

const traceOf = (beyond: ReadonlyArray<string>): string =>
  JSON.stringify({
    test: NAME,
    ...(beyond.length === 0 ? {} : { cannotReplay: beyond }),
    world: { branch: { name: "review" } },
    seat: { width: 120, height: 32 },
    steps: [{ does: "open the branch", keys: ["enter"] }],
    moments: [{ kind: "step", does: "open the branch", keys: ["enter"] }],
  })

const traceHolding = async (runs: ReadonlyArray<ReadonlyArray<string>>): Promise<string> => {
  const where = await mkdtemp(join(tmpdir(), "adiff-trace-"))
  const path = join(where, "trace.jsonl")
  await writeFile(path, `${runs.map(traceOf).join("\n")}\n`, "utf8")
  return path
}

type Said = { readonly code: number; readonly said: string }

const shotOn = async (path: string): Promise<Said> => {
  try {
    const { stdout } = await exec(process.execPath, [...SHOT, "--trace", path, "--test-name", NAME], {
      encoding: "utf8",
    })
    return { code: 0, said: stdout }
  } catch (thrown) {
    const failed = thrown as { code?: number; stderr?: string; stdout?: string }
    return { code: failed.code ?? 1, said: `${failed.stdout ?? ""}${failed.stderr ?? ""}` }
  }
}

describe("when the trace of a test says a capture cannot replay it", () => {
  test("then `pnpm shot` exits and names the route the test took", async () => {
    // ARRANGE
    const path = await traceHolding([["a comment sent from the command line"]])

    // ACT
    const ran = await shotOn(path)

    // ASSERT
    expect(ran.code).not.toBe(0)
    expect(ran.said).toContain("a comment sent from the command line")
    expect(ran.said).not.toContain("user-attachments")
  })
})

describe("when one trace file holds two runs of the same test", () => {
  test("then `pnpm shot` reads the newer run", async () => {
    // ARRANGE
    const path = await traceHolding([[], ["the mouse"]])

    // ACT
    const ran = await shotOn(path)

    // ASSERT
    expect(ran.code).not.toBe(0)
    expect(ran.said).toContain("the mouse")
  })
})
