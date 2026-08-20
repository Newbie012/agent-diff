import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const body = Array.from({ length: 12 }, (_, at) => `const line${at} = ${at};`)

const shortFile = {
  name: "add-teammate-invitations",
  files: [{ path: "src/small.ts", before: [], after: body }],
}

const essay = [
  "A minimal documentation of what it does and why would be, I believe, quite useful here.",
  "Added, and it is the one comment in the change that earns its place, because the reason",
  "this hook exists is invisible in its body. Measuring inside the callback keeps the read",
  "in the commit phase, so a render that depends on the size still lands in the first paint.",
  "A later report shows as a flash whenever the measured value gates what renders, which is",
  "what the obvious next edit would cost, and what was tried first before settling on this.",
].join(" ")

const lastRow = (frame: string): string => {
  const lines = frame.split("\n")
  const top = lines.findIndex((line) => line.includes("╭"))
  const bottom = lines.findIndex((line) => line.includes("╰"))
  return (
    lines
      .slice(top + 1, bottom === -1 ? undefined : bottom)
      .map((line) => line.slice(33))
      .findLast((line) => /line\d+/.test(line)) ?? ""
  )
}

describe("when a comment fills the screen", () => {
  test("then scrolling still reaches the end of the file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(shortFile)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/small.ts",
      start: 3,
      end: 3,
      body: essay,
    })
    await driver.screen.open({ width: 120, height: 24, review: true })
    const before = lastRow(await driver.screen.getFrame())

    // ACT
    await driver.screen.scroll("down", 6)

    // ASSERT
    expect(before).not.toContain("line11")
    expect(lastRow(await driver.screen.getFrame())).toContain("line11")
  })
})
