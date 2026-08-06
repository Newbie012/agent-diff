import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const filler = (count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `const kept${index} = ${index}`)

const buried = (mark: string): ReadonlyArray<string> => [
  ...filler(24),
  `export const invite = () => ${mark}()`,
  "const tail = 1",
]

const branch = {
  files: [{ path: "src/invitations.ts", before: buried("settle"), after: buried("resolve") }],
}

describe("writing a comment where there is no line", () => {
  it("refuses on a row of hidden lines and says why", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(branch)
    await driver.screen.open({ width: 100, height: 30 })
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["c"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("Comment on")
    expect(frame).toContain("no line here to comment on")
  })

  it("still opens on a line of code", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(branch)
    await driver.screen.open({ width: 100, height: 30 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["c"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("Comment on src/invitations.ts:22")
  })

  it("leaves nothing behind when it refuses", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create(branch)
    await driver.screen.open({ width: 100, height: 30 })
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("this should never be sent")
    await driver.screen.pressCtrl("s")

    // ASSERT
    const threads = await driver.app.runThreads(created.name)
    expect(threads.stdout).toContain('"comments":[]')
  })
})
