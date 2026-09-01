import { describe, expect, test } from "@effect/vitest"
import {
  failure,
} from "../cli/index.ts"

describe("when a failure nobody expected is reported", () => {
  test("then the report carries what went wrong", () => {
    // ARRANGE
    const cause = new Error("node:ffi is not available on this runtime")

    // ACT
    const reported = failure(cause)

    // ASSERT
    expect(reported.line).toContain("node:ffi is not available")
  })

  test("then the report names the type it could not place", () => {
    // ARRANGE
    const cause = new Error("something gave way")

    // ACT
    const reported = failure(cause)

    // ASSERT
    expect(JSON.parse(reported.line).error.type).toBe("Unknown")
  })
})
