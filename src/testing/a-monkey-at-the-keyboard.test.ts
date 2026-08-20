import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { shapes } from "./shapes.ts"
import { commandsFor } from "../tui/index.ts"
import type { ScreenName } from "../tui/index.ts"

const WIDTH = 120
const HEIGHT = 24
const PRESSES = Number(process.env["ADIFF_MONKEY_PRESSES"] ?? 60)
const SEEDS = (process.env["ADIFF_MONKEY_SEEDS"] ?? "1,2,3").split(",").map(Number)

const LEAVES = new Set(["q", "ctrl+c"])

const typing = ["a", "why", "look at this"]

const keysOf = (): ReadonlyArray<string> =>
  [
    ...new Set(
      (["review", "search"] satisfies ReadonlyArray<ScreenName>).flatMap((screen) =>
        commandsFor(screen).flatMap((one) => one.keys),
      ),
    ),
  ]
    .filter((key) => !LEAVES.has(key))

const rolling = (seed: number): (() => number) => {
  let held = seed * 2654435761
  return () => {
    held = (held * 1103515245 + 12345) % 2147483648
    return held / 2147483648
  }
}

const wider = (frame: string, room: number): ReadonlyArray<string> =>
  frame.split("\n").filter((row) => row.trimEnd().length > room)

const asKeys = (key: string): ReadonlyArray<string> =>
  key === "return" ? ["escape"] : [key]

describe("a monkey at the keyboard", () => {
  for (const seed of SEEDS) {
    it(`leaves the screen standing after ${PRESSES} presses, seed ${seed}`, async () => {
      // ARRANGE
      await using driver = await TestDriver.create()
      const roll = rolling(seed)
      const shape = shapes[Math.floor(roll() * shapes.length)] ?? shapes[0]
      const keys = keysOf()
      await driver.branch.create({ files: [...(shape?.files ?? [])] })
      await driver.screen.open({ width: WIDTH, height: HEIGHT, review: true })
      const pressed: Array<string> = []

      // ACT
      const pressing = async (): Promise<void> => {
        const key = keys[Math.floor(roll() * keys.length)] ?? "j"
        pressed.push(key)
        await driver.screen.pressKeys([...asKeys(key)])
        if (roll() <= 0.9) return
        const said = typing[Math.floor(roll() * typing.length)] ?? "a"
        pressed.push(`type:${said}`)
        await driver.screen.typeText(said)
      }
      await Array.from({ length: PRESSES }, (_, at) => at).reduce<Promise<void>>(
        (waiting) => waiting.then(pressing),
        Promise.resolve(),
      )

      // ASSERT
      const frame = await driver.screen.getFrame()
      const trail = pressed.join(" ")
      expect(driver.screen.renderCrashes(), trail).toEqual([])
      expect(wider(frame, WIDTH), trail).toEqual([])
      expect(frame.trim().length, trail).toBeGreaterThan(0)
    })
  }
})
