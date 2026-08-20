import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const long =
  "const invitation = `a team invitation for the address given could not be sent because the seat count is already spent`"

const wide = {
  name: "add-teammate-invitations",
  files: [
    {
      path: "src/api.ts",
      before: ["const a = 1"],
      after: ["const a = 1", long, "const c = 3"],
    },
  ],
}

const buried = (mark: string): ReadonlyArray<string> => [
  ...Array.from({ length: 30 }, (_, at) => `const settled${at} = ${at}`),
  `export const run = () => ${mark}()`,
  long,
]

describe("when the code pans past the edge of a line", () => {
  test("then a thread holds still while the code moves", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(wide)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 2,
      end: 2,
      body: "why is this here",
    })
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys([">", ">", ">"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("why is this here")
    expect(frame).not.toContain("const invitation = `a team")
  })

  test("then a gap row holds still while the code moves", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({
      name: "resend-expired-invites",
      files: [{ path: "src/deep.ts", before: buried("settle"), after: buried("resolve") }],
    })
    await driver.screen.open({ review: true })
    expect(await driver.screen.rowWith("opens")).toContain("27 lines hidden")

    // ACT
    await driver.screen.pressKeys([">", ">", ">"])

    // ASSERT
    expect(await driver.screen.rowWith("opens")).toContain("27 lines hidden")
  })
})
