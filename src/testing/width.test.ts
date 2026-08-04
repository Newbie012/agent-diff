import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const NARROW = 80
const ROOMY = 120
const HEIGHT = 24

const long =
  "export const handler = async (request: IncomingRequest, context: HandlerContext) => request.body"

const wordy = {
  files: [
    {
      path: "src/api/incidents/very/deeply/nested/handler-for-incidents.ts",
      before: ["const before = 1"],
      after: ["const before = 1", long, `${long} ${long}`],
    },
    { path: "docs/notes.md", before: ["one"], after: ["one", "two"] },
  ],
}

const spilling = (frame: string, width: number): ReadonlyArray<string> =>
  frame.split("\n").filter((line) => line.length > width || line.trimEnd().length >= width)

const tour = async (driver: TestDriver): Promise<ReadonlyArray<string>> => {
  const home = await driver.screen.getFrame()
  await driver.screen.pressKeys(["RETURN", "]"])
  const review = await driver.screen.getFrame()
  await driver.screen.pressKeys(["z"])
  const zoomed = await driver.screen.getFrame()
  await driver.screen.pressCtrl("p")
  const commands = await driver.screen.getFrame()
  return [home, review, zoomed, commands]
}

describe("fitting the terminal it is given", () => {
  it("draws nothing past the edge of an eighty column window", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(wordy)
    await driver.screen.open({ width: NARROW, height: HEIGHT })

    // ACT
    const shots = await tour(driver)

    // ASSERT
    expect(shots.flatMap((frame) => spilling(frame, NARROW))).toEqual([])
  })

  it("draws nothing past the edge of a hundred and twenty column window", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(wordy)
    await driver.screen.open({ width: ROOMY, height: HEIGHT })

    // ACT
    const shots = await tour(driver)

    // ASSERT
    expect(shots.flatMap((frame) => spilling(frame, ROOMY))).toEqual([])
  })
})
