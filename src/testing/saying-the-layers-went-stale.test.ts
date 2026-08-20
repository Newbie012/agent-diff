import { describe, expect, it } from "@effect/vitest"
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

describe("saying the layers went stale", () => {
  it("says so from the file tree, not only from the layers rail", async () => {
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
    expect(await driver.screen.getFrame()).toContain("layers stale")
  })
})

describe("the key that swaps the rail", () => {
  it("names what it would switch to, not what you are looking at", async () => {
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
