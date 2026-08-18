import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const body = ["const first = 1;", "const second = 2;", "const third = 3;"]

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

describe("copying from the diff", () => {
  it("takes the line the cursor is on when nothing is selected", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [{ path: "src/small.ts", before: [], after: body }] })
    await driver.screen.open({ width: 100, height: 20 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j", "j"])
    const clip = copied()

    // ACT
    await driver.screen.pressKeys(["y"])
    clip.stop()

    // ASSERT
    expect(clip.last()).toBe("const second = 2;\n")
    expect(await driver.screen.getFrame()).toContain("1 line copied")
  })

  it("takes what was dragged over as soon as the drag ends", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [{ path: "src/small.ts", before: [], after: body }] })
    await driver.screen.open({ width: 100, height: 20 })
    await driver.screen.pressKeys(["RETURN"])
    const clip = copied()

    // ACT
    await driver.screen.dragOverDiff(3, 5)
    clip.stop()

    // ASSERT
    expect(clip.last()).toContain("const second = 2;")
    expect(await driver.screen.getFrame()).toContain("lines copied")
  })

  it("takes the answer when the cursor is on one", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({
      files: [{ path: "src/small.ts", before: [], after: body }],
    })
    await driver.app.runComment({
      branch: branch.name,
      file: "src/small.ts",
      start: 1,
      end: 1,
      body: "the reason this exists is invisible in its body",
    })
    await driver.screen.open({ width: 100, height: 20 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j", "j"])
    const clip = copied()

    // ACT
    await driver.screen.pressKeys(["y"])
    clip.stop()

    // ASSERT
    expect(clip.last()).toContain("invisible in its body")
    expect(await driver.screen.getFrame()).toContain("comment copied")
  })
})
