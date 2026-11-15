import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import type { CreatedBranch } from "./domains/branch/index.ts"

type Listed = {
  readonly id: string
  readonly start: number
  readonly end: number
  readonly snippet: string
  readonly outdated: boolean
  readonly outside: boolean
}

const service = [
  "export class IncidentService {",
  "  async updateStatus(clientId: string, incidentId: string, status: string) {",
  "    await this.findVisible(clientId, incidentId);",
  "    await this.repository.update(incidentId, { status });",
  "    return this.get(clientId, incidentId);",
  "  }",
  "",
  "  async get(clientId: string, incidentId: string) {",
  "    return Promise.all([",
  "      await this.findVisible(clientId, incidentId),",
  "      this.repository.count(incidentId),",
  "    ]);",
  "  }",
  "}",
]

const withoutTheCheck = service.filter(
  (line) =>
    line !== "    await this.findVisible(clientId, incidentId);" &&
    line !== "    await this.repository.update(incidentId, { status });",
)

const files = [{ path: "src/incidents.ts", before: ["export class IncidentService {", "}"], after: service }]

const listed = async (driver: TestDriver, branch: CreatedBranch): Promise<ReadonlyArray<Listed>> => {
  const result = await driver.app.runThreads(branch.name)
  return (result.envelope as { comments: ReadonlyArray<Listed> }).comments
}

const commentOnTheCheck = async (driver: TestDriver, branch: CreatedBranch): Promise<void> => {
  await driver.app.runComment({
    branch: branch.name,
    file: "src/incidents.ts",
    start: 3,
    end: 4,
    body: "the visibility check runs twice",
  })
}

describe("when lines are added above a commented line", () => {
  test("then comment list names the commented line at its new number, not outdated", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await commentOnTheCheck(driver, branch)
    await driver.branch.commitAll(branch, "the service")
    await driver.branch.setFile(branch, "src/incidents.ts", [
      "import { Repository } from './repository';",
      "",
      ...service,
    ])
    await driver.branch.commitAll(branch, "an import")

    // ACT
    const [thread] = await listed(driver, branch)

    // ASSERT
    expect(thread).toMatchObject({ start: 5, end: 6, outdated: false, outside: false })
  })
})

describe("when the agent deletes both commented lines", () => {
  test("then comment list places the thread where the lines were, outdated, with the old snippet", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await commentOnTheCheck(driver, branch)
    await driver.branch.commitAll(branch, "the service")
    await driver.branch.setFile(branch, "src/incidents.ts", withoutTheCheck)
    await driver.branch.commitAll(branch, "one check is enough")

    // ACT
    const [thread] = await listed(driver, branch)

    // ASSERT
    expect(thread).toMatchObject({
      start: 3,
      end: 3,
      outdated: true,
      outside: false,
      snippet:
        "    await this.findVisible(clientId, incidentId);\n    await this.repository.update(incidentId, { status });",
    })
  })

  test("then comment list never places the thread on a look-alike line in another method", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await commentOnTheCheck(driver, branch)
    await driver.branch.setFile(branch, "src/incidents.ts", withoutTheCheck)

    // ACT
    const [thread] = await listed(driver, branch)

    // ASSERT
    const lookAlike = withoutTheCheck.indexOf("      await this.findVisible(clientId, incidentId),") + 1
    expect(thread?.start).not.toBe(lookAlike)
    expect(thread).toMatchObject({ start: 3, outdated: true, outside: false })
  })
})

describe("when the commented file is deleted", () => {
  test("then comment list marks the thread outside the diff", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({
      files: [...files, { path: "src/other.ts", before: ["const keep = 0"], after: ["const keep = 1"] }],
    })
    await commentOnTheCheck(driver, branch)
    await driver.branch.removeFile(branch, "src/incidents.ts")

    // ACT
    const [thread] = await listed(driver, branch)

    // ASSERT
    expect(thread).toMatchObject({ outside: true, outdated: false })
  })
})

describe("when a comment written on uncommitted lines is committed and then edited around", () => {
  test("then comment list follows the commented lines through both", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await commentOnTheCheck(driver, branch)
    await driver.branch.commitAll(branch, "the service")
    await driver.branch.setFile(branch, "src/incidents.ts", [
      "// incidents",
      ...service.slice(0, 2),
      "    const started = Date.now();",
      ...service.slice(2),
    ])

    // ACT
    const [thread] = await listed(driver, branch)

    // ASSERT
    expect(thread).toMatchObject({ start: 5, end: 6, outdated: false, outside: false })
  })
})

describe("when a comment carries no version adiff can still read", () => {
  test("then comment list looks for the snippet only inside the same method, and calls it outdated", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.agent.seedAnswered({
      worktree: branch.worktree,
      head: await driver.branch.getHead(branch),
      file: "src/incidents.ts",
      line: 3,
      snippet: "    await this.findVisible(clientId, incidentId);",
      comment: "the visibility check runs twice",
      answer: "removed it",
    })
    await driver.branch.setFile(branch, "src/incidents.ts", withoutTheCheck)

    // ACT
    const [thread] = await listed(driver, branch)

    // ASSERT
    expect(thread).toMatchObject({ outside: true })
  })

  test("then comment list finds the snippet again when it still stands in that method", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.agent.seedAnswered({
      worktree: branch.worktree,
      head: await driver.branch.getHead(branch),
      file: "src/incidents.ts",
      line: 3,
      snippet: "    await this.findVisible(clientId, incidentId);",
      comment: "the visibility check runs twice",
      answer: "moved it down a line",
    })
    await driver.branch.setFile(branch, "src/incidents.ts", [
      ...service.slice(0, 2),
      "    const started = Date.now();",
      ...service.slice(2),
    ])

    // ACT
    const [thread] = await listed(driver, branch)

    // ASSERT
    expect(thread).toMatchObject({ start: 4, end: 4, outdated: true, outside: false })
  })
})

describe("when the agent rewords the line a comment was written on", () => {
  test("then the review terminal marks the thread outdated and quotes the line it was written on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({
      files: [{ path: "src/seed.ts", before: ["export const world = {"], after: ["export const world = {", "  seed: (driver, network) => {"] }],
    })
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("take the world object")
    await driver.branch.setFile(branch, "src/seed.ts", ["export const world = {", "  seed: ({ driver, network }) => {"])

    // ACT
    await driver.screen.pressKeys(["r"])
    await driver.screen.pressTab()

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("· outdated")
    expect(frame).toContain("the code it was written on")
    expect(frame).toContain("│ seed: (driver, network) => {")
  })
})
