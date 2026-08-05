import type { CliRenderer } from "@opentui/core"
import { Context, Effect, Layer } from "effect"
import type { TuiState } from "./model.ts"
import { Screen, type Mouse } from "./render.ts"

export type Shape = {
  readonly paint: (state: TuiState) => Effect.Effect<void>
  readonly rows: Effect.Effect<number>
  readonly listen: (mouse: Mouse) => Effect.Effect<void>
}

export class Display extends Context.Service<Display, Shape>()("adiff/Display") {}

export const displayOn = (renderer: CliRenderer, repo: string): Layer.Layer<Display> =>
  Layer.sync(Display)(() => {
    const screen = new Screen(renderer, repo)

    const paint = Effect.fn("Display.paint")(function* (state: TuiState) {
      yield* Effect.sync(() => screen.update(state))
    })

    const listen = Effect.fn("Display.listen")(function* (mouse: Mouse) {
      yield* Effect.sync(() => screen.listen(mouse))
    })

    return { paint, rows: Effect.sync(() => screen.viewportRows()), listen }
  })
