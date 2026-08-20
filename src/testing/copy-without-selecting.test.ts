import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const body = ["const first = 1;", "const second = 2;", "const third = 3;"]

describe("when the reviewer copies from the diff", () => {
  test("then the line the cursor is on is copied", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [{ path: "src/small.ts", before: [], after: body }] })
    await driver.screen.open({ width: 100, height: 20, review: true })
    await driver.screen.pressKeys(["j", "j"])

    // ACT
    await driver.screen.pressKeys(["y"])

    // ASSERT
    expect(await driver.screen.copied()).toBe("const second = 2;\n")
    expect(await driver.screen.getFrame()).toContain("1 line copied")
  })

  test("then what was dragged over is copied as the drag ends", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [{ path: "src/small.ts", before: [], after: body }] })
    await driver.screen.open({ width: 100, height: 20, review: true })

    // ACT
    await driver.screen.dragOverDiff(3, 5)

    // ASSERT
    expect(await driver.screen.copied()).toContain("const second = 2;")
    expect(await driver.screen.getFrame()).toContain("lines copied")
  })

  test("then the answer under the cursor is copied", async () => {
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
    await driver.screen.open({ width: 100, height: 20, review: true })
    await driver.screen.pressKeys(["j", "j"])

    // ACT
    await driver.screen.pressKeys(["y"])

    // ASSERT
    expect(await driver.screen.copied()).toContain("invisible in its body")
    expect(await driver.screen.getFrame()).toContain("comment copied")
  })
})
