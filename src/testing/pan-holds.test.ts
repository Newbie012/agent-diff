import { describe, expect, it } from "@effect/vitest"
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

const rowWith = (frame: string, text: string): string =>
  frame.split("\n").find((line) => line.includes(text)) ?? ""

describe("panning past the edge of a line", () => {
  it("holds a thread still while the code moves", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(wide)
    await driver.app.runStage({
      branch: branch.name,
      file: "src/api.ts",
      start: 2,
      end: 2,
      body: "why is this here",
    })
    await driver.app.runSubmit(branch.name)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys([">", ">", ">"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("why is this here")
    expect(frame).not.toContain("const invitation = `a team")
  })

  it("holds a gap row still while the code moves", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({
      name: "resend-expired-invites",
      files: [{ path: "src/deep.ts", before: buried("settle"), after: buried("resolve") }],
    })
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    expect(rowWith(await driver.screen.getFrame(), "press l")).toContain("27 lines hidden")

    // ACT
    await driver.screen.pressKeys([">", ">", ">"])

    // ASSERT
    expect(rowWith(await driver.screen.getFrame(), "press l")).toContain("27 lines hidden")
  })
})
