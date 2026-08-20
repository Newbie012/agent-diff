import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const deep = {
  name: "add-teammate-invitations",
  files: [
    {
      path: "apps/web/src/hooks/use-it.ts",
      before: ["const a = 1"],
      after: ["const a = 1", "const b = 2"],
    },
    {
      path: "apps/web/src/pages/table.ts",
      before: ["const c = 1"],
      after: ["const c = 1", "const d = 2"],
    },
  ],
}

const listing = (frame: string): string =>
  frame
    .split("\n")
    .map((row) => row.split("\u2502")[1] ?? "")
    .join("\n")

describe("when the folders a file sits in are closed", () => {
  test("then the folder the file is in closes first", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(deep)
    await driver.screen.open({ review: true })
    expect(listing(await driver.screen.getFrame())).toContain("use-it.ts")

    // ACT
    await driver.screen.pressKeys(["h"])

    // ASSERT
    const frame = listing(await driver.screen.getFrame())
    expect(frame).not.toContain("use-it.ts")
    expect(frame).toContain("hooks")
  })

  test("then the folder above closes on the next press", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(deep)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["h", "h"])

    // ASSERT
    const frame = listing(await driver.screen.getFrame())
    expect(frame).not.toContain("hooks")
    expect(frame).toContain("web/src")
  })

  test("then closing stops at the outermost folder", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(deep)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["h", "h", "h", "h"])

    // ASSERT
    const frame = listing(await driver.screen.getFrame())
    expect(frame).toContain("web/src")
    expect(frame).not.toContain("pages")
  })

  test("then the outermost closed folder opens first", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(deep)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["h", "h"])
    expect(listing(await driver.screen.getFrame())).not.toContain("hooks")

    // ACT
    await driver.screen.pressKeys(["l"])

    // ASSERT
    expect(listing(await driver.screen.getFrame())).toContain("hooks")
  })
})
