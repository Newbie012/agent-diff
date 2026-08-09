import type { CliRenderer } from "@opentui/core"
import { Context, Effect, Layer } from "effect"
import type { TuiState } from "./model.ts"
import { Screen, type Mouse } from "./render.ts"

export type Shape = {
  readonly paint: (state: TuiState) => Effect.Effect<void>
  readonly rows: Effect.Effect<number>
  readonly room: Effect.Effect<number>
  readonly columns: Effect.Effect<number>
  readonly listen: (mouse: Mouse) => Effect.Effect<void>
}

export class Display extends Context.Service<Display, Shape>()("adiff/Display") {}

const paintWith = (screen: Screen): Shape["paint"] =>
  Effect.fn("Tui.paint")(function* (state: TuiState) {
    yield* Effect.sync(() => screen.update(state))
  })

const listenWith = (screen: Screen): Shape["listen"] =>
  Effect.fn("Tui.listen")(function* (mouse: Mouse) {
    yield* Effect.sync(() => screen.listen(mouse))
  })

const shapeOf = (screen: Screen): Shape => ({
  paint: paintWith(screen),
  rows: Effect.sync(() => screen.viewportRows()),
  room: Effect.sync(() => screen.noteRoom()),
  columns: Effect.sync(() => screen.columns()),
  listen: listenWith(screen),
})

export const displayOn = (renderer: CliRenderer, repo: string): Layer.Layer<Display> =>
  Layer.sync(Display)(() => shapeOf(new Screen(renderer, repo)))
