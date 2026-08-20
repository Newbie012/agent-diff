import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const change = (path: string) => ({
  path,
  before: ["const before = 1"],
  after: ["const before = 1", "const after = 2"],
})

const deep = {
  files: [
    change("apps/console/src/pages/invitations/components/InviteList/InviteListRow.tsx"),
    change("apps/console/src/pages/invitations/components/InviteList/InviteListHeader.tsx"),
    change("apps/console/src/pages/invitations/invitations.mutations.ts"),
    change("apps/console/src/pages/invitations/invitation-defaults.utils.ts"),
  ],
}

const pane = (frame: string): ReadonlyArray<string> =>
  frame
    .split("\n")
    .map((line) => line.slice(0, 44))
    .filter((line) => line.trim().length > 0)

const rowWith = (frame: string, text: string): string =>
  pane(frame).find((line) => line.includes(text)) ?? ""

describe("when the tree draws the file names", () => {
  test("then the end of a name a reader needs is kept", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(deep)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowWith(frame, "InviteListRow")).toContain("InviteListRow.tsx")
    expect(rowWith(frame, "InviteListHeader")).toContain("InviteListHeader.tsx")
  })

  test("then two names sharing a beginning are told apart", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(deep)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    const mutations = rowWith(frame, "tations.ts")
    const utils = rowWith(frame, ".utils.ts")
    expect(mutations).toContain("invitation")
    expect(utils).toContain("invitation")
    expect(mutations).not.toBe(utils)
  })

  test("then a folded directory keeps its last segments", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(deep)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.rowWith("pages")).toContain("/pages")
  })

  test("then the names still fit the pane at eighty columns", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(deep)

    // ACT
    await driver.screen.open({ width: 80, height: 30, review: true })

    // ASSERT
    const rows = (await driver.screen.getFrame()).split("\n")
    expect(rows.every((row) => row.length <= 80)).toBe(true)
    expect(rows.some((row) => row.includes(".tsx"))).toBe(true)
  })
})
