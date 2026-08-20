import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
  { path: "src/two.ts", before: ["const b = 1"], after: ["const b = 1", "const two = 2"] },
]

const SLOW_MS = 2000

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

describe("when two sends run at once", () => {
  test("then one review lands on the pull request", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create({ files })
    await drafted(driver, created.name, "src/one.ts", "the first point")
    await drafted(driver, created.name, "src/two.ts", "the second point")
    const head = await driver.branch.getHead(created)
    await driver.forge.holds([{ branch: created.name, head }], { slowMs: SLOW_MS })
    const send = (): Promise<{ readonly code: number; readonly stdout: string; readonly stderr: string }> =>
      driver.app.run(["draft", "send", "--repo", driver.repoPath, "--branch", created.name])

    // ACT
    const [first, second] = await Promise.all([send(), send()])

    // ASSERT
    expect(await driver.forge.posts()).toHaveLength(1)
    const both = [first, second]
    expect(both.filter((one) => one.code === 0)).toHaveLength(1)
    const refused = both.find((one) => one.code !== 0)
    expect(`${refused?.stdout}${refused?.stderr}`).toContain("Nothing is being held")
  })

  test("then each held comment sends once and nothing is left behind", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create({ files })
    await drafted(driver, created.name, "src/one.ts", "the first point")
    await drafted(driver, created.name, "src/two.ts", "the second point")
    const head = await driver.branch.getHead(created)
    await driver.forge.holds([{ branch: created.name, head }], { slowMs: SLOW_MS })
    const send = (): Promise<unknown> =>
      driver.app.run(["draft", "send", "--repo", driver.repoPath, "--branch", created.name])

    // ACT
    await Promise.all([send(), send()])

    // ASSERT
    const posts = await driver.forge.posts()
    const bodies = posts.flatMap((one) => one.comments).map((one) => one.body)
    expect(bodies).toEqual([
      "the first point",
      "the second point",
    ])
    const listed = await driver.app.run([
      "draft",
      "list",
      "--repo",
      driver.repoPath,
      "--branch",
      created.name,
    ])
    expect((JSON.parse(listed.stdout) as { drafts: ReadonlyArray<unknown> }).drafts).toHaveLength(0)
  })
})
