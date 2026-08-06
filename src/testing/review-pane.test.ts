import { chmod, mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

type PaneEnvelope = {
  readonly opened: boolean
  readonly pane: string
  readonly command: string
}

const envelopeOf = (result: { readonly envelope: unknown }): PaneEnvelope =>
  result.envelope as PaneEnvelope

const fakeMultiplexer = async (driver: TestDriver, name: string): Promise<string> => {
  const bin = join(driver.repoPath, "fake-bin")
  const log = join(bin, `${name}.log`)
  await mkdir(bin, { recursive: true })
  await writeFile(join(bin, name), `#!/bin/sh\nprintf '%s\\n' "$@" > "${log}"\n`, "utf8")
  await chmod(join(bin, name), 0o755)
  return bin
}

describe("putting the review in front of the reviewer", () => {
  it("splits the pane the reviewer is already looking at", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const bin = await fakeMultiplexer(driver, "tmux")

    // ACT
    const result = await driver.app.runPane({
      env: { TMUX: "/tmp/tmux-501/default,1,0", PATH: `${bin}:${process.env["PATH"]}` },
    })

    // ASSERT
    expect(result.code).toBe(0)
    const envelope = envelopeOf(result)
    expect(envelope.opened).toBe(true)
    expect(envelope.pane).toBe("tmux")
    const asked = await readFile(join(bin, "tmux.log"), "utf8")
    expect(asked).toContain("split-window")
    expect(asked).toContain(driver.repoPath)
  })

  it("hands back the command when nothing can be split", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.runPane({ env: { TMUX: "", ZELLIJ: "" } })

    // ASSERT
    expect(result.code).toBe(0)
    const envelope = envelopeOf(result)
    expect(envelope.opened).toBe(false)
    expect(envelope.pane).toBe("none")
    expect(envelope.command).toBe(`adiff review open --repo ${driver.repoPath}`)
  })

  it("reports the command it would run whether or not it split", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const bin = await fakeMultiplexer(driver, "zellij")

    // ACT
    const result = await driver.app.runPane({
      env: { ZELLIJ: "0", PATH: `${bin}:${process.env["PATH"]}` },
    })

    // ASSERT
    const envelope = envelopeOf(result)
    expect(envelope.pane).toBe("zellij")
    expect(envelope.command).toBe(`adiff review open --repo ${driver.repoPath}`)
    const asked = await readFile(join(bin, "zellij.log"), "utf8")
    expect(asked).toContain("new-pane")
  })

  it("says a multiplexer failed rather than claiming a pane opened", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const bin = join(driver.repoPath, "broken-bin")
    await mkdir(bin, { recursive: true })
    await writeFile(join(bin, "tmux"), "#!/bin/sh\nexit 1\n", "utf8")
    await chmod(join(bin, "tmux"), 0o755)

    // ACT
    const result = await driver.app.runPane({
      env: { TMUX: "/tmp/tmux-501/default,1,0", PATH: `${bin}:${process.env["PATH"]}` },
    })

    // ASSERT
    expect(result.code).toBe(0)
    const envelope = envelopeOf(result)
    expect(envelope.opened).toBe(false)
    expect(envelope.command).toBe(`adiff review open --repo ${driver.repoPath}`)
  })
})
