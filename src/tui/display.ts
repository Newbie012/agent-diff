import type { CliRenderer } from "@opentui/core"
import { getTreeSitterClient, pathToFiletype } from "@opentui/core"
import { Context, Effect, Layer } from "effect"
import type { Screen as ScreenName, TuiState } from "./model.ts"
import { Screen, type Mouse } from "./render.ts"

const ASKING: ReadonlyArray<ScreenName> = ["palette", "keys", "search", "base"]

export type Shape = {
  readonly paint: (state: TuiState) => Effect.Effect<void>
  readonly rows: Effect.Effect<number>
  readonly room: Effect.Effect<number>
  readonly tallest: Effect.Effect<number>
  readonly rail: Effect.Effect<number>
  readonly onWritten: (told: (text: string) => void) => Effect.Effect<void>
  readonly written: Effect.Effect<string>
  readonly write: (text: string) => Effect.Effect<void>
  readonly writeIn: (text: string) => Effect.Effect<void>
  readonly writeOn: (on: boolean) => Effect.Effect<void>
  readonly askOn: (screen: ScreenName | undefined) => Effect.Effect<void>
  readonly onAsked: (told: (text: string) => void) => Effect.Effect<void>
  readonly askWith: (text: string) => Effect.Effect<void>
  readonly at: Effect.Effect<number>
  readonly rowAt: (visual: number) => Effect.Effect<number>
  readonly screenRowOf: (row: number) => Effect.Effect<number | undefined>
  readonly block: (
    row: number,
    stop: number,
  ) => Effect.Effect<{ readonly start: number; readonly rows: number }>
  readonly columns: Effect.Effect<number>
  readonly listen: (mouse: Mouse) => Effect.Effect<void>
  readonly light: (
    path: string,
    side: "new" | "old",
    lines: ReadonlyArray<string>,
  ) => Effect.Effect<void>
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

const lightWith = (
  screen: Screen,
  path: string,
  side: "new" | "old",
  lines: ReadonlyArray<string>,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const filetype = pathToFiletype(path) ?? "text"
    if (filetype === "text" || lines.length === 0) return
    const answer = yield* Effect.promise(() =>
      getTreeSitterClient().highlightOnce(lines.join("\n"), filetype),
    )
    const found = answer.highlights
    if (found !== undefined) screen.lit(path, side, lines, found)
  })

const shapeOf = (screen: Screen): Shape => ({
  paint: paintWith(screen),
  rows: Effect.sync(() => screen.viewportRows()),
  room: Effect.sync(() => screen.noteRoom()),
  tallest: Effect.sync(() => screen.tallestRows()),
  rail: Effect.sync(() => screen.railRows()),
  onWritten: (told) =>
    Effect.sync(() => {
      screen.writing().onContentChange = () => told(screen.writing().plainText)
    }),
  written: Effect.sync(() => screen.writing().plainText),
  write: (text) => Effect.sync(() => screen.writing().setText(text)),
  writeIn: (text) => Effect.sync(() => screen.writing().insertText(text)),
  writeOn: (on) =>
    Effect.sync(() => (on ? screen.writing().focus() : screen.writing().blur())),
  askOn: (which) =>
    Effect.sync(() => {
      for (const name of ASKING) {
        const box = screen.asking(name)
        if (box === undefined) continue
        if (name === which) {
          box.setText("")
          box.focus()
        } else box.blur()
      }
    }),
  askWith: (text) =>
    Effect.sync(() => {
      for (const name of ASKING) screen.asking(name)?.setText(text)
    }),
  onAsked: (told) =>
    Effect.sync(() => {
      for (const name of ASKING) {
        const box = screen.asking(name)
        if (box !== undefined) box.onContentChange = () => told(box.plainText)
      }
    }),
  at: Effect.sync(() => screen.scrolledAt()),
  rowAt: (visual) => Effect.sync(() => screen.rowAtScreen(visual)),
  screenRowOf: (row) => Effect.sync(() => screen.screenRowOf(row)),
  block: (row, stop) => Effect.sync(() => screen.blockAt(row, stop)),
  columns: Effect.sync(() => screen.columns()),
  listen: listenWith(screen),
  light: (path, side, lines) => lightWith(screen, path, side, lines),
})

export const displayOn = (renderer: CliRenderer, repo: string): Layer.Layer<Display> =>
  Layer.sync(Display)(() => shapeOf(new Screen(renderer, repo)))
