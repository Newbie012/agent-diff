import { describe, expect, it } from "@effect/vitest"
import { series } from "./state.ts"
import { TestDriver } from "./index.ts"

const WIDE = { width: 150, height: 24 }

const oneFile = {
  name: "add-teammate-invitations",
  files: [
    {
      path: "src/api.ts",
      before: ["const a = 1"],
      after: ["const a = 1", "const b = 2", "const c = 3", "const d = 4"],
    },
  ],
}

const order = (frame: string): ReadonlyArray<string> =>
  frame
    .split("\n")
    .flatMap((line) => ["first one", "second one", "third one"].filter((body) => line.includes(body)))

const three = async (driver: TestDriver): Promise<void> => {
  const branch = await driver.branch.create(oneFile)
  const bodies = ["first one", "second one", "third one"]
  await series(bodies, (body) =>
    driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: bodies.indexOf(body) + 2,
      end: bodies.indexOf(body) + 2,
      body,
    }),
  )
  await driver.screen.open(WIDE)
  await driver.screen.pressKeys(["RETURN"])
}

describe("the order of the review panel", () => {
  it("puts the newest comment at the top", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await three(driver)

    // ASSERT
    expect(order(await driver.screen.getFrame())[0]).toBe("third one")
  })

  it("turns the order around when asked", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await three(driver)

    // ACT
    await driver.screen.pressKeys(["O"])

    // ASSERT
    expect(order(await driver.screen.getFrame())[0]).toBe("first one")
  })
})
