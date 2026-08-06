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

describe("adiff upgrade", () => {
  it("names the route it found and the one command that updates it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await served({ alpha: "9.9.9" })

    // ACT
    const result = await driver.app.run(["upgrade"], { ADIFF_REGISTRY: registry.url })
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
    const result = await driver.app.run(["upgrade"], { ADIFF_REGISTRY: registry.url })
    await registry.stop()

    // ASSERT
    expect(result.envelope).toMatchObject({ ok: true, upgrade: { current: true } })
  })

  it("answers offline rather than failing, saying it could not tell", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["upgrade"], { ADIFF_REGISTRY: NOWHERE })

    // ASSERT
    expect(result.code).toBe(0)
    const { upgrade } = result.envelope as { upgrade: Record<string, unknown> }
    expect(upgrade["checked"]).toBe(false)
    expect(upgrade).not.toHaveProperty("latest")
    expect(upgrade).not.toHaveProperty("current")
    expect(String(upgrade["note"])).toContain("could not reach the registry")
  })

  it("returns only the asked-for fields, so a caller pays for what it reads", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["upgrade", "--fields", "route"], {
      ADIFF_REGISTRY: NOWHERE,
    })

    // ASSERT
    expect(result.envelope).toEqual({ ok: true, upgrade: { route: "source" } })
  })

  it("leaves the upgrade to the person by default, naming the command it did not run", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["upgrade"], { ADIFF_REGISTRY: NOWHERE })

    // ASSERT
    const { upgrade } = result.envelope as { upgrade: { ran: boolean; command: string } }
    expect(upgrade.ran).toBe(false)
    expect(upgrade.command).toContain("git")
  })

  it("refuses to run a checkout's upgrade for you, and says so instead of pretending", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["upgrade", "--run"], { ADIFF_REGISTRY: NOWHERE })

    // ASSERT
    expect(result.code).toBe(0)
    const { upgrade } = result.envelope as { upgrade: { ran: boolean; note: string } }
    expect(upgrade.ran).toBe(false)
    expect(upgrade.note.length).toBeGreaterThan(0)
  })
})
