import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const filler = (count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, at) => `const kept${at} = ${at}`)

const client = (mark: string): ReadonlyArray<string> => [
  ...filler(8),
  `export const invite = () => ${mark}()`,
]

const branch = {
  files: [{ path: "src/invitations.ts", before: client("settle"), after: client("resolve") }],
}

const layers = {
  summary: "Say why an invitation was refused",
  layers: [
    {
      title: "Name the invitations a refusal mentions",
      spans: [{ path: "src/invitations.ts", start: 9, end: 9 }],
    },
  ],
}

describe("when the layers go stale", () => {
  test("then the file tree carries the stale mark too", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create(branch)
    await driver.app.runLayersSet(created.worktree, layers)
    await driver.branch.setFile(created, "src/invitations.ts", [...client("resolve"), "const extra = 2"])
    await driver.branch.commitAll(created, "one more line")
    await driver.screen.open({ width: 130, height: 30, review: true })

    // ACT
    await driver.screen.pressKeys(["s"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("layers stale · L for a new one")
  })
})

describe("when the footer offers the key that swaps the rail", () => {
  test("then the key names what it would switch to", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create(branch)
    await driver.app.runLayersSet(created.worktree, layers)
    await driver.screen.open({ width: 130, height: 30, review: true })

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("s file tree")

    // ACT
    await driver.screen.pressKeys(["s"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("s layers")
  })
})

describe("when the footer offers the key that asks for a new reading order", () => {
  test("then the key is offered while the reading order is stale", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create(branch)
    await driver.app.runLayersSet(created.worktree, layers)
    await driver.branch.setFile(created, "src/invitations.ts", [...client("resolve"), "const extra = 2"])
    await driver.branch.commitAll(created, "one more line")

    // ACT
    await driver.screen.open({ width: 150, height: 30 })
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("L new order")
  })

  test("then the key is absent while the reading order still describes the branch", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create(branch)
    await driver.app.runLayersSet(created.worktree, layers)

    // ACT
    await driver.screen.open({ width: 150, height: 30 })
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("L new order")
  })
})
