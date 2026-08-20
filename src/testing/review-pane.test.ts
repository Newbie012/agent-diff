import { chmod, mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, test } from "@effect/vitest"
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

describe("when the review is opened in a pane", () => {
  test("then the pane the reviewer is looking at splits", async () => {
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

  test("then adiff hands back the command when nothing can be split", async () => {
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

  test("then adiff reports the command it would run either way", async () => {
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

  test("then the output reports the multiplexer failed", async () => {
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
