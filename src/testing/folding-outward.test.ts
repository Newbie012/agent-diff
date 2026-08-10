import { describe, expect, it } from "@effect/vitest"
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

const opened = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create(deep)
  await driver.screen.open()
  await driver.screen.pressKeys(["RETURN"])
}

describe("closing the folders a file sits in", () => {
  it("closes the folder the file is in first", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    expect(listing(await driver.screen.getFrame())).toContain("use-it.ts")

    // ACT
    await driver.screen.pressKeys(["h"])

    // ASSERT
    const frame = listing(await driver.screen.getFrame())
    expect(frame).not.toContain("use-it.ts")
    expect(frame).toContain("hooks")
  })

  it("closes the folder above it on the next press", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)

    // ACT
    await driver.screen.pressKeys(["h", "h"])

    // ASSERT
    const frame = listing(await driver.screen.getFrame())
    expect(frame).not.toContain("hooks")
    expect(frame).toContain("web/src")
  })

  it("stops once the outermost folder it can close is shut", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)

    // ACT
    await driver.screen.pressKeys(["h", "h", "h", "h"])

    // ASSERT
    const frame = listing(await driver.screen.getFrame())
    expect(frame).toContain("web/src")
    expect(frame).not.toContain("pages")
  })

  it("opens the outermost closed folder first, so the way back in is the way out", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    await driver.screen.pressKeys(["h", "h"])
    expect(listing(await driver.screen.getFrame())).not.toContain("hooks")

    // ACT
    await driver.screen.pressKeys(["l"])

    // ASSERT
    expect(listing(await driver.screen.getFrame())).toContain("hooks")
  })
})
