import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

type Traced = {
  readonly cannotReplay?: ReadonlyArray<string>
  readonly steps: ReadonlyArray<{ readonly keys: ReadonlyArray<string> }>
  readonly changes?: ReadonlyArray<unknown>
}

const oneFile = {
  name: "add-teammate-invitations",
  files: [{ path: "src/api.ts", before: [], after: ["const first = 1"] }],
}

const tracedRun = async (): Promise<Traced> => {
  const path = join(await mkdtemp(join(tmpdir(), "adiff-trace-")), "trace.jsonl")
  process.env["ADIFF_TRACE"] = path
  {
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.branch.switchTo(branch, "other-work")
    await driver.screen.pressKeys(["m"])
  }
  const [line] = (await readFile(path, "utf8")).split("\n")
  return JSON.parse(line ?? "{}") as Traced
}

afterEach(() => {
  delete process.env["ADIFF_TRACE"]
})

describe("when a test switches the directory under review to another branch", () => {
  test("then the trace a recording replays checks out that branch between the keys before it and after it", async () => {
    // ARRANGE
    const keysBefore = ["enter"]

    // ACT
    const traced = await tracedRun()

    // ASSERT
    expect(traced.cannotReplay).toBeUndefined()
    expect(traced.steps.map((step) => step.keys)).toEqual([keysBefore, ["world:0"], ["text:m"]])
    expect(traced.changes).toEqual([{ checkout: "other-work" }])
  })
})
