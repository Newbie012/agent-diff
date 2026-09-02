import type { MouseEvent } from "@opentui/core"
import type { TuiState } from "./state.ts"
import type { Clicked, Spot } from "./state.ts"

export const ROW_HEIGHT = 1

export const GUTTER_X = 2

export const MODAL_ROOM = 8

export const PALETTE_WIDTH = 76

export const PANEL_SHARE = 0.62

export const PANEL_MAX = 120

export const PANEL_FLOOR = 6

export const PANEL_FOOT = 2

export const PANEL_QUARTER = 4

export const PANEL_FIFTH = 5

export const PANE_CHROME = 3

export const PANE_EDGES = 2

export const PANE_INSET = 1

export const DIFF_FLOOR = 24

export const COMPOSE_EDGE = 4

export const CRAMPED = "adiff needs more room than this"

export const CRAMPED_ROWS = 4

export const DIFF_CHROME_MOST = 16

export const MODAL_MARGIN = 4

export const shareOf = (width: number, least: number): number =>
  Math.max(least, Math.min(PANEL_MAX, Math.floor(width * PANEL_SHARE)))

export const modalWidth = (width: number, wanted: number): number =>
  Math.max(0, Math.min(wanted, width - MODAL_MARGIN))

export const panelWidth = (width: number): number => modalWidth(width, shareOf(width, PALETTE_WIDTH))

export const panelTop = (height: number, part: number): number => Math.max(2, Math.floor(height / part))

export const panelRows = (height: number, part: number): number =>
  Math.max(PANEL_FLOOR, height - panelTop(height, part) - PANEL_FOOT)

export const STICKY_MAX = 4

export const notchOf = (event: MouseEvent): number | undefined => {
  const way = event.scroll?.direction
  if (way !== "up" && way !== "down") return undefined
  return way === "down" ? 1 : -1
}

export type Screened = TuiState["screen"]

export const ASKING: ReadonlyArray<Screened> = ["palette", "keys", "search", "base", "editor"]

export type Mouse = {
  readonly onClick: (what: Clicked) => void
  readonly onScroll: (delta: number) => void
  readonly onPan: (delta: number) => void
  readonly onDrag: (from: Spot, to: Spot, done: boolean) => void
  readonly onChip: (key: string) => void
  readonly onRail: (delta: number) => void
}
