import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const line = "const alpha = 'bravo charlie';"

const CLIP = /\]52;c;([A-Za-z0-9+/=]*)/g

const copied = (): { readonly last: () => string; readonly stop: () => void } => {
  const written: Array<string> = []
  const original = process.stdout.write.bind(process.stdout)
  const spy = (chunk: unknown, ...rest: ReadonlyArray<unknown>): boolean => {
    written.push(String(chunk))
    return (original as (...args: ReadonlyArray<unknown>) => boolean)(chunk, ...rest)
  }
  process.stdout.write = spy
  return {
    last: () => {
      const found = [...written.join("").matchAll(CLIP)].at(-1)?.[1] ?? ""
      return Buffer.from(found, "base64").toString("utf8")
    },
    stop: () => {
      process.stdout.write = original
    },
  }
}

const whereIs = (frame: string, text: string): { row: number; column: number } => {
  const rows = frame.split("\n")
  const row = rows.findIndex((held) => held.includes(text))
  return { row, column: (rows[row] ?? "").indexOf(text) }
}

describe("dragging across part of one line", () => {
  it("copies the characters covered, not the whole line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [{ path: "src/api.ts", before: [], after: [line] }] })
    await driver.screen.open({ width: 100, height: 12 })
    await driver.screen.pressKeys(["RETURN"])
    const at = whereIs(await driver.screen.getFrame(), "bravo charlie")
    const clip = copied()

    // ACT
    await driver.screen.dragAcrossDiff(at.row, at.column, at.column + "bravo charlie".length)
    clip.stop()

    // ASSERT
    expect(clip.last()).toBe("bravo charlie")
    expect(await driver.screen.getFrame()).toContain("13 characters copied")
  })
})
