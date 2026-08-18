import { describe, expect, it } from "@effect/vitest"
import { failure } from "../cli/index.ts"

describe("reporting a failure nobody expected", () => {
  it("carries what went wrong rather than an empty envelope", () => {
    // ARRANGE
    const cause = new Error("node:ffi is not available on this runtime")

    // ACT
    const reported = failure(cause)

    // ASSERT
    expect(reported.line).toContain("node:ffi is not available")
  })

  it("still names the type it could not place", () => {
    // ARRANGE
    const cause = new Error("something gave way")

    // ACT
    const reported = failure(cause)

    // ASSERT
    expect(JSON.parse(reported.line).error.type).toBe("Unknown")
  })
})
