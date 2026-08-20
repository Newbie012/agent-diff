import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
  { path: "src/two.ts", before: ["const b = 1"], after: ["const b = 1", "const two = 2"] },
  { path: "src/three.ts", before: ["const c = 1"], after: ["const c = 1", "const three = 2"] },
]

type Held = { readonly id: string; readonly body: string; readonly file: string }

const drafted = (driver: TestDriver, branch: string, file: string, body: string): Promise<unknown> =>
  driver.app.run([
    "draft",
    "add",
    "--repo",
    driver.repoPath,
    "--branch",
    branch,
    "--file",
    file,
    "--start",
    "2",
    "--end",
    "2",
    "--body",
    body,
  ])

const listed = async (driver: TestDriver, branch: string): Promise<ReadonlyArray<Held>> => {
  const result = await driver.app.run([
    "draft",
    "list",
    "--repo",
    driver.repoPath,
    "--branch",
    branch,
  ])
  return (JSON.parse(result.stdout) as { drafts: ReadonlyArray<Held> }).drafts
}

const sent = (driver: TestDriver, branch: string): Promise<{ readonly code: number; readonly stdout: string; readonly stderr: string }> =>
  driver.app.run(["draft", "send", "--repo", driver.repoPath, "--branch", branch])

describe("when the forge only partly takes a send", () => {
  test("then the comments the forge never confirmed are kept", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create({ files })
    await drafted(driver, created.name, "src/one.ts", "the first point")
    await drafted(driver, created.name, "src/two.ts", "the second point")
    await drafted(driver, created.name, "src/three.ts", "the third point")
    const head = await driver.branch.getHead(created)
    await driver.forge.holds([{ branch: created.name, head }], {
      accepts: [{ path: "src/two.ts", line: 2 }],
    })

    // ACT
    const result = await sent(driver, created.name)

    // ASSERT
    expect(result.code).not.toBe(0)
    expect((await listed(driver, created.name)).map((one) => one.body)).toEqual([
      "the first point",
      "the third point",
    ])
  })

  test("then the output counts what landed and what is still held", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create({ files })
    await drafted(driver, created.name, "src/one.ts", "the first point")
    await drafted(driver, created.name, "src/two.ts", "the second point")
    await drafted(driver, created.name, "src/three.ts", "the third point")
    const head = await driver.branch.getHead(created)
    await driver.forge.holds([{ branch: created.name, head }], {
      accepts: [{ path: "src/two.ts", line: 2 }],
    })

    // ACT
    const result = await sent(driver, created.name)

    // ASSERT
    const said = JSON.parse(`${result.stdout}${result.stderr}`.trim()) as {
      ok: boolean
      error: { sent: number; held: number; kept: ReadonlyArray<string> }
    }
    expect(said.ok).toBe(false)
    expect(said.error.sent).toBe(1)
    expect(said.error.held).toBe(2)
    expect(said.error.kept).toHaveLength(2)
  })

  test("then a second send carries only what did not go", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create({ files })
    await drafted(driver, created.name, "src/one.ts", "the first point")
    await drafted(driver, created.name, "src/two.ts", "the second point")
    await drafted(driver, created.name, "src/three.ts", "the third point")
    const head = await driver.branch.getHead(created)
    await driver.forge.holds([{ branch: created.name, head }], {
      accepts: [{ path: "src/two.ts", line: 2 }],
    })
    await sent(driver, created.name)
    await driver.forge.holds([{ branch: created.name, head }])

    // ACT
    const again = await sent(driver, created.name)

    // ASSERT
    expect(again.code).toBe(0)
    const posts = await driver.forge.posts()
    expect(posts.at(-1)?.comments.map((one) => one.body)).toEqual([
      "the first point",
      "the third point",
    ])
    expect(await listed(driver, created.name)).toHaveLength(0)
  })

  test("then every draft is kept when adiff cannot tell what the forge took", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create({ files })
    await drafted(driver, created.name, "src/one.ts", "the first point")
    const head = await driver.branch.getHead(created)
    await driver.forge.holds([{ branch: created.name, head }], { answers: "not json at all" })

    // ACT
    const result = await sent(driver, created.name)

    // ASSERT
    expect(result.code).not.toBe(0)
    expect(`${result.stdout}${result.stderr}`).toContain('"ok":false')
    expect(await listed(driver, created.name)).toHaveLength(1)
  })
})
