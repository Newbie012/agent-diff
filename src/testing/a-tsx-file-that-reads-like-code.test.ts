import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const CONSTANT = "#e0af68"
const KEYWORD = "#bb9af7"

const before = [
  "import { clsx } from 'clsx'",
  "",
  "export const RoleBadge = ({ variant }: BadgeProps) => {",
  "  return <span className={clsx(variant)} />",
  "}",
]

const after = [
  "import { clsx } from 'clsx'",
  "",
  "export const RoleBadge = ({ variant }: BadgeProps) => {",
  "  return <span className={clsx(variant)} data-part='role' />",
  "}",
]

const files = [{ path: "src/RoleBadge.tsx", before, after }]

describe("when a file of TypeScript with markup in it is read", () => {
  test("then a name in it is not painted as a number", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })

    // ACT
    await driver.screen.open({ width: 150, height: 30, review: true })

    // ASSERT
    const amber = (await driver.screen.findForeground(CONSTANT)).join(" ")
    expect(amber).not.toContain("span")
    expect(amber).not.toContain("clsx")
    expect(amber).not.toContain("RoleBadge")
  })

  test("then a keyword in it is still painted as a keyword", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })

    // ACT
    await driver.screen.open({ width: 150, height: 30, review: true })

    // ASSERT
    expect((await driver.screen.findForeground(KEYWORD)).join(" ")).toContain("const")
  })
})
