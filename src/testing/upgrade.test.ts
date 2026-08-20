import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const NOWHERE = "http://127.0.0.1:1/dist-tags"

describe("when a person runs adiff upgrade", () => {
  test("then adiff says it is up to date in one line and runs nothing", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const manifest = await import("../../package.json", { with: { type: "json" } })
    const registry = await driver.app.setRegistry({ alpha: manifest.default.version })
    const install = await driver.app.installedBy("npm")

    // ACT
    const result = await driver.app.run(["upgrade"], { ...install, ADIFF_REGISTRY: registry })

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout.trim()).toBe(`adiff ${manifest.default.version} is the newest build.`)
    expect(result.envelope).toBeUndefined()
  })

  test("then adiff upgrades, shows the installer working, and ends on the version now installed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await driver.app.setRegistry({ alpha: "9.9.9" })
    const install = await driver.app.installedBy("npm")

    // ACT
    const result = await driver.app.run(["upgrade"], { ...install, ADIFF_REGISTRY: registry })

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("npm i -g @eliya-oss/agent-diff@alpha")
    expect(result.stdout).toContain("npm ran with i -g @eliya-oss/agent-diff@alpha")
    expect(result.stdout.trim().split("\n").at(-1)).toBe("adiff 9.9.9 is installed now.")
  })

  test("then adiff says the upgrade did not work and exits 1", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await driver.app.setRegistry({ alpha: "9.9.9" })
    const install = await driver.app.installedBy("npm", { fails: true })

    // ACT
    const result = await driver.app.run(["upgrade"], { ...install, ADIFF_REGISTRY: registry })

    // ASSERT
    expect(result.code).toBe(1)
    expect(result.stdout).toContain("did not work")
    expect(result.stdout).not.toContain("is installed now")
  })

  test("then adiff names the compressed asset", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await driver.app.setRegistry({ alpha: "9.9.9" })
    const install = await driver.app.installedBy("binary")

    // ACT
    const result = await driver.app.run(["upgrade", "--check"], {
      ...install,
      ADIFF_REGISTRY: registry,
    })

    // ASSERT
    expect(result.stdout).toContain(".tar.gz")
    expect(result.stdout).toContain("tar -xzO")
  })

  test("then adiff explains a binary it cannot rewrite while it runs", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await driver.app.setRegistry({ alpha: "9.9.9" })
    const install = await driver.app.installedBy("binary")

    // ACT
    const result = await driver.app.run(["upgrade"], { ...install, ADIFF_REGISTRY: registry })

    // ASSERT
    expect(result.code).toBe(1)
    expect(result.stdout).toContain("cannot rewrite itself")
    expect(result.stdout).toContain("curl")
    expect(result.stdout).not.toContain("ran with")
  })

  test("then adiff leaves a checkout alone and says what to run", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await driver.app.setRegistry({ alpha: "9.9.9" })

    // ACT
    const result = await driver.app.run(["upgrade"], { ADIFF_REGISTRY: registry })

    // ASSERT
    expect(result.code).toBe(1)
    expect(result.stdout).toContain("checkout")
    expect(result.stdout).toContain("git")
  })

  test("then adiff upgrades even when the registry never answered", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const install = await driver.app.installedBy("bun")

    // ACT
    const result = await driver.app.run(["upgrade"], { ...install, ADIFF_REGISTRY: NOWHERE })

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("The registry did not answer")
    expect(result.stdout).toContain("bun ran with add -g")
    expect(result.stdout).toContain("adiff --version")
  })

  test("then adiff still takes --run", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await driver.app.setRegistry({ alpha: "9.9.9" })
    const install = await driver.app.installedBy("brew")

    // ACT
    const result = await driver.app.run(["upgrade", "--run"], {
      ...install,
      ADIFF_REGISTRY: registry,
    })

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("brew ran with upgrade Newbie012/tap/adiff")
    expect(result.stdout).toContain("adiff 9.9.9 is installed now.")
  })
})

describe("when adiff upgrade --check runs", () => {
  test("then it names the newer build and the command, and runs nothing", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await driver.app.setRegistry({ alpha: "9.9.9" })
    const install = await driver.app.installedBy("npm")

    // ACT
    const result = await driver.app.run(["upgrade", "--check"], {
      ...install,
      ADIFF_REGISTRY: registry,
    })

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("9.9.9 is out")
    expect(result.stdout).toContain("npm i -g @eliya-oss/agent-diff@alpha")
    expect(result.stdout).toContain("Run `adiff upgrade`")
    expect(result.stdout).not.toContain("ran with")
  })

  test("then it exits 0 on a route adiff cannot upgrade", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await driver.app.setRegistry({ alpha: "9.9.9" })
    const install = await driver.app.installedBy("binary")

    // ACT
    const result = await driver.app.run(["upgrade", "--check"], {
      ...install,
      ADIFF_REGISTRY: registry,
    })

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("cannot rewrite itself")
  })
})

describe("when adiff upgrade --json runs", () => {
  test("then it upgrades and keeps the installer's output off stdout", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await driver.app.setRegistry({ alpha: "9.9.9" })
    const install = await driver.app.installedBy("npm")

    // ACT
    const result = await driver.app.run(["upgrade", "--json"], {
      ...install,
      ADIFF_REGISTRY: registry,
    })

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).not.toContain("ran with")
    const { upgrade } = result.envelope as { upgrade: Record<string, unknown> }
    expect(upgrade).toMatchObject({ route: "npm", latest: "9.9.9", current: false, ran: true })
    expect(String(upgrade["note"])).toContain("adiff 9.9.9 is installed now.")
  })

  test("then it names the route it found and the command that updates it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await driver.app.setRegistry({ alpha: "9.9.9" })

    // ACT
    const result = await driver.app.run(["upgrade", "--json", "--check"], {
      ADIFF_REGISTRY: registry,
    })

    // ASSERT
    expect(result.code).toBe(0)
    const { upgrade } = result.envelope as { upgrade: Record<string, unknown> }
    expect(upgrade).toMatchObject({ route: "source", latest: "9.9.9", current: false, ran: false })
    expect(String(upgrade["command"]).length).toBeGreaterThan(0)
  })

  test("then it says it is current when the registry names the running version", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const manifest = await import("../../package.json", { with: { type: "json" } })
    const registry = await driver.app.setRegistry({ alpha: manifest.default.version })

    // ACT
    const result = await driver.app.run(["upgrade", "--json"], { ADIFF_REGISTRY: registry })

    // ASSERT
    expect(result.envelope).toMatchObject({ ok: true, upgrade: { current: true } })
  })

  test("then the note carries what happened", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const manifest = await import("../../package.json", { with: { type: "json" } })
    const registry = await driver.app.setRegistry({ alpha: manifest.default.version })

    // ACT
    const result = await driver.app.run(["upgrade", "--json"], { ADIFF_REGISTRY: registry })

    // ASSERT
    const { upgrade } = result.envelope as { upgrade: { note: string } }
    expect(upgrade.note).toBe(`adiff ${manifest.default.version} is the newest build.`)
  })

  test("then it answers offline, saying it could not tell", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["upgrade", "--json"], { ADIFF_REGISTRY: NOWHERE })

    // ASSERT
    expect(result.code).toBe(0)
    const { upgrade } = result.envelope as { upgrade: Record<string, unknown> }
    expect(upgrade["checked"]).toBe(false)
    expect(upgrade).not.toHaveProperty("latest")
    expect(upgrade).not.toHaveProperty("current")
    expect(String(upgrade["note"])).toContain("The registry did not answer")
  })

  test("then only the asked-for fields come back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["upgrade", "--json", "--check", "--fields", "route"], {
      ADIFF_REGISTRY: NOWHERE,
    })

    // ASSERT
    expect(result.envelope).toEqual({ ok: true, upgrade: { route: "source" } })
  })

  test("then the envelope holds when nothing was upgraded, and it exits 0", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await driver.app.setRegistry({ alpha: "9.9.9" })

    // ACT
    const result = await driver.app.run(["upgrade", "--json"], { ADIFF_REGISTRY: registry })

    // ASSERT
    expect(result.code).toBe(0)
    const { upgrade } = result.envelope as { upgrade: { ran: boolean; note: string } }
    expect(upgrade.ran).toBe(false)
    expect(upgrade.note).toContain("checkout")
  })
})
