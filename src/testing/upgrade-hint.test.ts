import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const AGES_AGO = "2020-01-01T00:00:00.000Z"

const remember = async (
  driver: TestDriver,
  check: Readonly<Record<string, unknown>>,
): Promise<void> => {
  await mkdir(driver.storeRoot, { recursive: true })
  await writeFile(join(driver.storeRoot, "upgrade.json"), JSON.stringify(check), "utf8")
}

const recalled = async (driver: TestDriver): Promise<Record<string, unknown>> =>
  JSON.parse(await readFile(join(driver.storeRoot, "upgrade.json"), "utf8")) as Record<
    string,
    unknown
  >

describe("hearing about a new version without being nagged", () => {
  it("says one quiet line in the footer when a newer version was seen last time", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ name: "add-a-third-line" })
    await remember(driver, { checkedAt: new Date().toISOString(), latest: "9.9.9" })

    // ACT
    await driver.screen.open({ upgrades: true })

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("9.9.9")
  })

  it("says nothing when the version it saw is the one running", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ name: "add-a-third-line" })
    const manifest = await import("../../package.json", { with: { type: "json" } })
    await remember(driver, {
      checkedAt: new Date().toISOString(),
      latest: manifest.default.version,
    })

    // ACT
    await driver.screen.open({ upgrades: true })

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("adiff upgrade")
  })

  it("mentions a version once, not on every run", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ name: "add-a-third-line" })
    await remember(driver, { checkedAt: new Date().toISOString(), latest: "9.9.9" })
    await driver.screen.open({ upgrades: true })

    // ACT
    await driver.screen.restart({ upgrades: true })

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("9.9.9")
  })

  it("writes down that it mentioned it, where a person would find it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ name: "add-a-third-line" })
    await remember(driver, { checkedAt: new Date().toISOString(), latest: "9.9.9" })

    // ACT
    await driver.screen.open({ upgrades: true })

    // ASSERT
    const held = await recalled(driver)
    expect(held["told"]).toBe("9.9.9")
    expect(String(held["note"])).toContain("ADIFF_NO_UPGRADE_CHECK")
  })

  it("stays quiet, and touches nothing, when the check is turned off", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ name: "add-a-third-line" })
    await remember(driver, { checkedAt: AGES_AGO, latest: "9.9.9" })

    // ACT
    await driver.screen.open()
    const frame = await driver.screen.getFrame()

    // ASSERT
    expect(frame).not.toContain("9.9.9")
    expect((await recalled(driver))["told"]).toBeUndefined()
  })
})
