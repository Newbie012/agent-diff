import { createServer, type Server } from "node:http"
import { describe, expect, it } from "@effect/vitest"
import { routeOf } from "../cli/index.ts"
import { TestDriver } from "./index.ts"

type Registry = { readonly url: string; readonly stop: () => Promise<void> }

const served = async (tags: Readonly<Record<string, string>>): Promise<Registry> => {
  const server: Server = createServer((_, response) => {
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify(tags))
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  const port = typeof address === "object" && address !== null ? address.port : 0
  return {
    url: `http://127.0.0.1:${port}/dist-tags`,
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

const NOWHERE = "http://127.0.0.1:1/dist-tags"

describe("knowing how adiff was installed", () => {
  it("calls a Homebrew install brew, wherever the binary itself lives", () => {
    expect(routeOf("/opt/homebrew/Cellar/adiff/0.1.0-alpha.2/bin/adiff", "/$bunfs/root/main")).toBe(
      "brew",
    )
  })

  it("calls a global npm install npm", () => {
    expect(
      routeOf("/usr/local/bin/node", "/usr/local/lib/node_modules/@eliya-oss/agent-diff/dist"),
    ).toBe("npm")
  })

  it("tells a bun global install apart from an npm one", () => {
    expect(
      routeOf(
        "/usr/local/bin/bun",
        "/home/ada/.bun/install/global/node_modules/@eliya-oss/agent-diff/dist",
      ),
    ).toBe("bun")
  })

  it("calls a hand-downloaded binary a binary", () => {
    expect(routeOf("/home/ada/.local/bin/adiff", "/$bunfs/root/main")).toBe("binary")
  })

  it("calls a checkout a checkout", () => {
    expect(routeOf("/usr/local/bin/node", "/home/ada/projects/adiff/src/cli")).toBe("source")
  })
})

describe("what adiff upgrade does for the person who ran it", () => {
  it("says it is up to date, in one line, and runs nothing", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const manifest = await import("../../package.json", { with: { type: "json" } })
    const registry = await served({ alpha: manifest.default.version })
    const install = await driver.app.installedBy("npm")

    // ACT
    const result = await driver.app.run(["upgrade"], { ...install, ADIFF_REGISTRY: registry.url })
    await registry.stop()

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout.trim()).toBe(`adiff ${manifest.default.version} is the newest build.`)
    expect(result.envelope).toBeUndefined()
  })

  it("upgrades, shows the installer working, and ends on the version now installed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await served({ alpha: "9.9.9" })
    const install = await driver.app.installedBy("npm")

    // ACT
    const result = await driver.app.run(["upgrade"], { ...install, ADIFF_REGISTRY: registry.url })
    await registry.stop()

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("npm i -g @eliya-oss/agent-diff@alpha")
    expect(result.stdout).toContain("npm ran with i -g @eliya-oss/agent-diff@alpha")
    expect(result.stdout.trim().split("\n").at(-1)).toBe("adiff 9.9.9 is installed now.")
  })

  it("says the upgrade did not work, instead of claiming it did, and exits 1", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await served({ alpha: "9.9.9" })
    const install = await driver.app.installedBy("npm", { fails: true })

    // ACT
    const result = await driver.app.run(["upgrade"], { ...install, ADIFF_REGISTRY: registry.url })
    await registry.stop()

    // ASSERT
    expect(result.code).toBe(1)
    expect(result.stdout).toContain("did not work")
    expect(result.stdout).not.toContain("is installed now")
  })

  it("names the compressed asset, so a download is a quarter of the binary", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await served({ alpha: "9.9.9" })
    const install = await driver.app.installedBy("binary")

    // ACT
    const result = await driver.app.run(["upgrade", "--check"], {
      ...install,
      ADIFF_REGISTRY: registry.url,
    })
    await registry.stop()

    // ASSERT
    expect(result.stdout).toContain(".tar.gz")
    expect(result.stdout).toContain("tar -xzO")
  })

  it("explains a binary it cannot rewrite while it runs, and upgrades nothing", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await served({ alpha: "9.9.9" })
    const install = await driver.app.installedBy("binary")

    // ACT
    const result = await driver.app.run(["upgrade"], { ...install, ADIFF_REGISTRY: registry.url })
    await registry.stop()

    // ASSERT
    expect(result.code).toBe(1)
    expect(result.stdout).toContain("cannot rewrite itself")
    expect(result.stdout).toContain("curl")
    expect(result.stdout).not.toContain("ran with")
  })

  it("will not pull a checkout for you, and says what to run instead", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await served({ alpha: "9.9.9" })

    // ACT
    const result = await driver.app.run(["upgrade"], { ADIFF_REGISTRY: registry.url })
    await registry.stop()

    // ASSERT
    expect(result.code).toBe(1)
    expect(result.stdout).toContain("checkout")
    expect(result.stdout).toContain("git")
  })

  it("upgrades even when the registry never answered, since that is what was asked for", async () => {
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

  it("still takes --run, which asked for what now happens anyway", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await served({ alpha: "9.9.9" })
    const install = await driver.app.installedBy("brew")

    // ACT
    const result = await driver.app.run(["upgrade", "--run"], {
      ...install,
      ADIFF_REGISTRY: registry.url,
    })
    await registry.stop()

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("brew ran with upgrade Newbie012/tap/adiff")
    expect(result.stdout).toContain("adiff 9.9.9 is installed now.")
  })
})

describe("adiff upgrade --check", () => {
  it("names the newer build and the command, and runs nothing", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await served({ alpha: "9.9.9" })
    const install = await driver.app.installedBy("npm")

    // ACT
    const result = await driver.app.run(["upgrade", "--check"], {
      ...install,
      ADIFF_REGISTRY: registry.url,
    })
    await registry.stop()

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("9.9.9 is out")
    expect(result.stdout).toContain("npm i -g @eliya-oss/agent-diff@alpha")
    expect(result.stdout).toContain("Run `adiff upgrade`")
    expect(result.stdout).not.toContain("ran with")
  })

  it("exits 0 on a route adiff cannot upgrade, because the report is the answer", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await served({ alpha: "9.9.9" })
    const install = await driver.app.installedBy("binary")

    // ACT
    const result = await driver.app.run(["upgrade", "--check"], {
      ...install,
      ADIFF_REGISTRY: registry.url,
    })
    await registry.stop()

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("cannot rewrite itself")
  })
})

describe("adiff upgrade --json", () => {
  it("upgrades and keeps the installer's output off stdout", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await served({ alpha: "9.9.9" })
    const install = await driver.app.installedBy("npm")

    // ACT
    const result = await driver.app.run(["upgrade", "--json"], {
      ...install,
      ADIFF_REGISTRY: registry.url,
    })
    await registry.stop()

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).not.toContain("ran with")
    const { upgrade } = result.envelope as { upgrade: Record<string, unknown> }
    expect(upgrade).toMatchObject({ route: "npm", latest: "9.9.9", current: false, ran: true })
    expect(String(upgrade["note"])).toContain("adiff 9.9.9 is installed now.")
  })

  it("names the route it found and the one command that updates it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await served({ alpha: "9.9.9" })

    // ACT
    const result = await driver.app.run(["upgrade", "--json", "--check"], {
      ADIFF_REGISTRY: registry.url,
    })
    await registry.stop()

    // ASSERT
    expect(result.code).toBe(0)
    const { upgrade } = result.envelope as { upgrade: Record<string, unknown> }
    expect(upgrade).toMatchObject({ route: "source", latest: "9.9.9", current: false, ran: false })
    expect(String(upgrade["command"]).length).toBeGreaterThan(0)
  })

  it("says it is current when the registry names the version it is running", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const manifest = await import("../../package.json", { with: { type: "json" } })
    const registry = await served({ alpha: manifest.default.version })

    // ACT
    const result = await driver.app.run(["upgrade", "--json"], { ADIFF_REGISTRY: registry.url })
    await registry.stop()

    // ASSERT
    expect(result.envelope).toMatchObject({ ok: true, upgrade: { current: true } })
  })

  it("puts what happened in the note, not generic advice", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const manifest = await import("../../package.json", { with: { type: "json" } })
    const registry = await served({ alpha: manifest.default.version })

    // ACT
    const result = await driver.app.run(["upgrade", "--json"], { ADIFF_REGISTRY: registry.url })
    await registry.stop()

    // ASSERT
    const { upgrade } = result.envelope as { upgrade: { note: string } }
    expect(upgrade.note).toBe(`adiff ${manifest.default.version} is the newest build.`)
  })

  it("answers offline rather than failing, saying it could not tell", async () => {
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

  it("returns only the asked-for fields, so a caller pays for what it reads", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["upgrade", "--json", "--check", "--fields", "route"], {
      ADIFF_REGISTRY: NOWHERE,
    })

    // ASSERT
    expect(result.envelope).toEqual({ ok: true, upgrade: { route: "source" } })
  })

  it("keeps the envelope contract when nothing was upgraded, and still exits 0", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await served({ alpha: "9.9.9" })

    // ACT
    const result = await driver.app.run(["upgrade", "--json"], { ADIFF_REGISTRY: registry.url })
    await registry.stop()

    // ASSERT
    expect(result.code).toBe(0)
    const { upgrade } = result.envelope as { upgrade: { ran: boolean; note: string } }
    expect(upgrade.ran).toBe(false)
    expect(upgrade.note).toContain("checkout")
  })
})
