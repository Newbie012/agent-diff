import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const cssThenTsx = {
  files: [
    {
      path: "src/Thing.module.css",
      before: ["/* nothing */"],
      after: [".root {", "  display: flex;", "  color: red;", "}"],
    },
    {
      path: "src/Thing.tsx",
      before: ["// nothing"],
      after: [
        "import { One } from 'one';",
        "import { Two } from 'two';",
        "import { Three } from 'three';",
        "export const Thing = () => null;",
      ],
    },
  ],
}

describe("when the reviewer moves to another file", () => {
  test("then the pin drops the scope of the file before it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(cssThenTsx)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j", "j"])
    const onCss = await driver.screen.getFrame()

    // ACT
    await driver.screen.pressKeys(["TAB"])
    await driver.screen.pressKeys(["j"])
    await driver.screen.pressKeys(["TAB"])
    await driver.screen.pressKeys(["j", "j"])

    // ASSERT
    expect(onCss).toContain(".root {")
    expect(await driver.screen.getFrame()).not.toContain(".root {")
  })
})
