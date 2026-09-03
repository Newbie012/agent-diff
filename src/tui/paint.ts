import { RGBA } from "@opentui/core"
import type { RowKind } from "../domain/patch/index.ts"
import type { DiffView} from "./diffview.ts";
import { type LinePaint } from "./diffview.ts"
import { palette } from "./theme.ts"

type PaintFlags = {
  readonly cursor: boolean
  readonly selected: boolean
  readonly gap: boolean
}

export const pickPaint = (view: DiffView, kind: RowKind, flags: PaintFlags): LinePaint | undefined => {
  if (flags.cursor) return UNDER_CURSOR[kind] ?? PLAIN_CURSOR
  if (flags.selected) return PICKED[kind] ?? PLAIN_PICKED
  if (flags.gap) return GAP_PAINT
  return view.washOf(kind)
}

const PLAIN_PICKED: LinePaint = {
  gutter: RGBA.fromHex(palette.pickedGutter),
  content: RGBA.fromHex(palette.pickedOn),
}

const PICKED: Partial<Record<RowKind, LinePaint>> = {
  added: {
    gutter: RGBA.fromHex(palette.pickedGutterAdded),
    content: RGBA.fromHex(palette.pickedOnAdded),
  },
  removed: {
    gutter: RGBA.fromHex(palette.pickedGutterRemoved),
    content: RGBA.fromHex(palette.pickedOnRemoved),
  },
}

const PLAIN_CURSOR: LinePaint = {
  gutter: RGBA.fromHex(palette.cursorGutter),
  content: RGBA.fromHex(palette.cursorOn),
}

const UNDER_CURSOR: Partial<Record<RowKind, LinePaint>> = {
  added: {
    gutter: RGBA.fromHex(palette.cursorGutterAdded),
    content: RGBA.fromHex(palette.cursorOnAdded),
  },
  removed: {
    gutter: RGBA.fromHex(palette.cursorGutterRemoved),
    content: RGBA.fromHex(palette.cursorOnRemoved),
  },
}

const GAP_PAINT: LinePaint = {
  gutter: RGBA.fromHex(palette.overlay),
  content: RGBA.fromHex(palette.overlay),
}
