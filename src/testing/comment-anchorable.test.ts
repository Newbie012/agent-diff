import { describe, expect, test } from "@effect/vitest"
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

describe("when a comment is written where there is no line", () => {
  test("then adiff refuses on a row of hidden lines and says why", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(branch)
    await driver.screen.open({ width: 100, height: 30, review: true })
    await driver.screen.pressKeys(["k"])

    // ACT
    await driver.screen.pressKeys(["c"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("Comment on")
    expect(frame).toContain("no line here to comment on")
  })

  test("then the compose box still opens on a line of code", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(branch)
    await driver.screen.open({ width: 100, height: 30, review: true })

    // ACT
    await driver.screen.pressKeys(["c"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("Comment on src/invitations.ts:22")
  })

  test("then a refusal leaves no draft behind", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create(branch)
    await driver.screen.open({ width: 100, height: 30, review: true })
    await driver.screen.pressKeys(["k"])

    // ACT
    await driver.screen.writeComment("this should never be sent")

    // ASSERT
    const threads = await driver.app.runThreads(created.name)
    expect(threads.stdout).toContain('"comments":[]')
  })
})
