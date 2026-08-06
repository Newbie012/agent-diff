import { createServer, type Server } from "node:http"
import { describe, expect, it } from "@effect/vitest"
import { routeOf, sayUpgrade } from "../cli/index.ts"
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

describe("what adiff upgrade tells the person who ran it", () => {
  it("says it is up to date, in a sentence, and prints no JSON", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const manifest = await import("../../package.json", { with: { type: "json" } })
    const registry = await served({ alpha: manifest.default.version })

    // ACT
    const result = await driver.app.run(["upgrade"], { ADIFF_REGISTRY: registry.url })
    await registry.stop()

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout.trim()).toBe(`adiff ${manifest.default.version} is the newest build.`)
    expect(result.envelope).toBeUndefined()
  })

  it("names the newer build and the command that fetches it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await served({ alpha: "9.9.9" })

    // ACT
    const result = await driver.app.run(["upgrade"], { ADIFF_REGISTRY: registry.url })
    await registry.stop()

    // ASSERT
    expect(result.stdout).toContain("9.9.9 is out")
    expect(result.stdout).toContain("git")
    expect(result.envelope).toBeUndefined()
  })

  it("says the registry never answered rather than guessing", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["upgrade"], { ADIFF_REGISTRY: NOWHERE })

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("The registry did not answer")
    expect(result.stdout).not.toContain("9.9.9")
  })

  it("tells you it will not upgrade a checkout for you, and what to run", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await served({ alpha: "9.9.9" })

    // ACT
    const result = await driver.app.run(["upgrade", "--run"], { ADIFF_REGISTRY: registry.url })
    await registry.stop()

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("will not run this one for you")
    expect(result.stdout).toContain("git")
  })

  it("says what it ran and what the next adiff will be", () => {
    // ARRANGE
    const done = {
      route: "npm",
      version: "1.0.0",
      checked: true,
      latest: "1.1.0",
      current: false,
      command: "npm i -g pkg@alpha",
      ran: true,
      note: "",
    } as const

    // ACT
    const said = sayUpgrade(done, true)

    // ASSERT
    expect(said).toContain("Ran `npm i -g pkg@alpha`")
    expect(said).toContain("the next adiff you run will be 1.1.0")
  })

  it("says the upgrade it ran did not work, instead of claiming it did", () => {
    // ARRANGE
    const failed = {
      route: "npm",
      version: "1.0.0",
      checked: true,
      latest: "1.1.0",
      current: false,
      command: "npm i -g pkg@alpha",
      ran: false,
      note: "",
    } as const

    // ACT
    const said = sayUpgrade(failed, true)

    // ASSERT
    expect(said).toContain("did not work")
    expect(said).toContain("npm i -g pkg@alpha")
  })
})

describe("adiff upgrade --json", () => {
  it("names the route it found and the one command that updates it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await served({ alpha: "9.9.9" })

    // ACT
    const result = await driver.app.run(["upgrade", "--json"], { ADIFF_REGISTRY: registry.url })
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
    const result = await driver.app.run(["upgrade", "--json", "--fields", "route"], {
      ADIFF_REGISTRY: NOWHERE,
    })

    // ASSERT
    expect(result.envelope).toEqual({ ok: true, upgrade: { route: "source" } })
  })

  it("leaves the upgrade to the person by default, naming the command it did not run", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["upgrade", "--json"], { ADIFF_REGISTRY: NOWHERE })

    // ASSERT
    const { upgrade } = result.envelope as { upgrade: { ran: boolean; command: string } }
    expect(upgrade.ran).toBe(false)
    expect(upgrade.command).toContain("git")
  })

  it("refuses to run a checkout's upgrade for you, and says so instead of pretending", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["upgrade", "--json", "--run"], {
      ADIFF_REGISTRY: NOWHERE,
    })

    // ASSERT
    expect(result.code).toBe(0)
    const { upgrade } = result.envelope as { upgrade: { ran: boolean; note: string } }
    expect(upgrade.ran).toBe(false)
    expect(upgrade.note).toContain("will not run this one for you")
  })
})
