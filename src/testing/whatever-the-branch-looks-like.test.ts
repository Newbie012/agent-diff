import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { shapes } from "./shapes.ts"

const WIDTH = 120
const HEIGHT = 24

const header = (frame: string): string => frame.split("\n")[0] ?? ""

const fileIn = (frame: string): string => header(frame).split(/\s{2,}/)[2] ?? ""

const opened = async (driver: TestDriver, files: number): Promise<ReadonlyArray<string>> => {
  const seen: Array<string> = []
  const walking = async (): Promise<void> => {
    seen.push(fileIn(await driver.screen.getFrame()))
    await driver.screen.pressKeys(["]"])
  }
  await Array.from({ length: files }, (_, at) => at).reduce<Promise<void>>(
    (waiting) => waiting.then(walking),
    Promise.resolve(),
  )
  return seen
}

describe("when a branch takes any shape", () => {
  for (const shape of shapes) {
    test(`walks every file of ${shape.name}`, async () => {
      // ARRANGE
      await using driver = await TestDriver.create()
      await driver.branch.create({ files: [...shape.files] })
      await driver.screen.open({ width: WIDTH, height: HEIGHT, review: true })

      // ACT
      const seen = await opened(driver, shape.files.length)

      // ASSERT
      expect(new Set(seen).size).toBe(shape.files.length)
      expect(driver.screen.renderCrashes()).toEqual([])
    })

    test(`can comment on the row every file of ${shape.name} opens on`, async () => {
      // ARRANGE
      await using driver = await TestDriver.create()
      await driver.branch.create({ files: [...shape.files] })
      await driver.screen.open({ width: WIDTH, height: HEIGHT, review: true })
      const refused: Array<string> = []

      // ACT
      const asking = async (): Promise<void> => {
        const where = fileIn(await driver.screen.getFrame())
        await driver.screen.pressKeys(["c"])
        const asked = await driver.screen.getFrame()
        if (!asked.includes("Comment on")) refused.push(where)
        await driver.screen.pressEscape()
        await driver.screen.pressKeys(["]"])
      }
      await shape.files.reduce(
        (waiting) => waiting.then(asking),
        Promise.resolve(),
      )

      // ASSERT
      expect(refused).toEqual([])
    })
  }
})
