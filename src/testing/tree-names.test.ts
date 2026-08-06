import { describe, expect, it } from "@effect/vitest"
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

describe("telling the files apart", () => {
  it("keeps the end of a name a reader needs", async () => {
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

  it("tells two names apart when they share a beginning", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(deep)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowWith(frame, "mutations")).toContain(".mutations.ts")
    expect(rowWith(frame, "utils")).toContain(".utils.ts")
  })

  it("keeps the last segments of a folded directory", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(deep)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(rowWith(await driver.screen.getFrame(), "pages")).toContain("/pages")
  })

  it("still fits the pane at eighty columns", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(deep)

    // ACT
    await driver.screen.open({ width: 80, height: 30 })
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const rows = (await driver.screen.getFrame()).split("\n")
    expect(rows.every((row) => row.length <= 80)).toBe(true)
    expect(rows.some((row) => row.includes(".tsx"))).toBe(true)
  })
})
