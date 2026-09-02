import {
  BoxRenderable,
  type CliRenderer,
  defaultTextareaKeyBindings,
  TextRenderable,
} from "@opentui/core"
import {
  ASCIIFontRenderable,
  TextareaRenderable,
  fonts,
  type ASCIIFontName,
  type KeyBinding,
} from "@opentui/core"
import { BRANCH_WIDTH } from "./home.ts"
import { FRAME_PAD } from "./layout.ts"
import { COMPOSE_CHROME } from "./notespane.ts"
import { palette } from "./theme.ts"
import { CRAMPED_ROWS, GUTTER_X, PALETTE_WIDTH, PANEL_FLOOR, ROW_HEIGHT } from "./chrome.ts"

const COMPOSE_WIDTH = 72

export const frameRoot = (renderer: CliRenderer): void => {
  renderer.root.flexDirection = "column"
  renderer.root.paddingLeft = FRAME_PAD
  renderer.root.paddingRight = FRAME_PAD
  renderer.root.paddingTop = 0
  renderer.root.paddingBottom = 0
}

export const crampedBar = (renderer: CliRenderer): TextRenderable => {
  const made = bar(renderer, "cramped", palette.muted)
  made.wrapMode = "word"
  made.height = CRAMPED_ROWS
  return made
}

export const bar = (renderer: CliRenderer, id: string, color: string): TextRenderable =>
  new TextRenderable(renderer, {
    id,
    content: "",
    fg: color,
    height: ROW_HEIGHT,
    flexShrink: 0,
    marginLeft: GUTTER_X,
    marginRight: GUTTER_X,
  })

const makeList = (renderer: CliRenderer): BoxRenderable => {
  const box = new BoxRenderable(renderer, {
    id: "list-pane",
    width: BRANCH_WIDTH,
    flexShrink: 0,
    flexDirection: "column",
    minHeight: 0,
    overflow: "hidden",
    borderColor: palette.rule,
  })
  return box
}

export const makeDiffPane = (renderer: CliRenderer): BoxRenderable =>
  new BoxRenderable(renderer, {
    id: "diff-pane",
    flexGrow: 1,
    flexDirection: "column",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    visible: false,
  })

export const makePanel = (renderer: CliRenderer): { pane: BoxRenderable; text: TextRenderable } => {
  const pane = new BoxRenderable(renderer, {
    id: "panel-pane",
    width: 0,
    flexShrink: 0,
    flexDirection: "column",
    minHeight: 0,
    overflow: "hidden",
    borderColor: palette.rule,
    visible: false,
  })
  const text = new TextRenderable(renderer, {
    id: "panel",
    content: "",
    fg: palette.ink,
    flexGrow: 1,
    wrapMode: "none",
  })
  pane.add(text)
  return { pane, text }
}

export const makeListParts = (renderer: CliRenderer): { pane: BoxRenderable; text: TextRenderable } => {
  const pane = makeList(renderer)
  const text = makeListText(renderer)
  pane.add(text)
  return { pane, text }
}

const makeListText = (renderer: CliRenderer): TextRenderable =>
  new TextRenderable(renderer, {
    id: "list",
    content: "",
    fg: palette.ink,
    flexGrow: 1,
    wrapMode: "none",
  })

export const makeGutter = (renderer: CliRenderer): TextRenderable =>
  new TextRenderable(renderer, {
    id: "gutter",
    content: "",
    fg: palette.marker,
    width: 2,
    flexShrink: 0,
    wrapMode: "none",
  })

export const makeScroller = (
  renderer: CliRenderer,
  gutter: TextRenderable,
  scroll: BoxRenderable,
): BoxRenderable => {
  const box = new BoxRenderable(renderer, {
    id: "scroller",
    flexGrow: 1,
    flexDirection: "row",
    minHeight: 0,
  })
  box.add(gutter)
  box.add(scroll)
  return box
}

export const makeScrim = (renderer: CliRenderer): BoxRenderable =>
  new BoxRenderable(renderer, {
    id: "scrim",
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    zIndex: 90,
    visible: false,
    backgroundColor: palette.scrim,
  })

export const makeScroll = (renderer: CliRenderer): BoxRenderable =>
  new BoxRenderable(renderer, {
    id: "diff-scroll",
    flexGrow: 1,
    flexDirection: "column",
    minHeight: 0,
    minWidth: 0,
    overflow: "hidden",
  })

const makePalette = (renderer: CliRenderer): BoxRenderable => {
  const box = makeCompose(renderer)
  box.id = "palette"
  box.height = PANEL_FLOOR
  box.width = PALETTE_WIDTH
  return box
}

type PaletteParts = {
  readonly box: BoxRenderable
  readonly title: TextRenderable
  readonly query: TextareaRenderable
  readonly choices: TextRenderable
}

type KeysParts = PaletteParts & { readonly legend: TextRenderable }

export type FoundParts = {
  readonly box: BoxRenderable
  readonly title: TextRenderable
  readonly query: TextareaRenderable
  readonly peek: TextRenderable
  readonly choices: TextRenderable
}

export const asking = (renderer: CliRenderer, id: string, placeholder = "Type to filter…"): TextareaRenderable =>
  new TextareaRenderable(renderer, {
    id,
    height: ROW_HEIGHT,
    wrapMode: "none",
    flexShrink: 0,
    marginLeft: GUTTER_X,
    marginRight: GUTTER_X,
    placeholder,
    placeholderColor: palette.faint,
    backgroundColor: palette.panel,
    focusedBackgroundColor: palette.panel,
    textColor: palette.ink,
    focusedTextColor: palette.ink,
    cursorColor: palette.ink,
  })

const makePaletteParts = (renderer: CliRenderer): PaletteParts => {
  const box = makePalette(renderer)
  const title = bar(renderer, "palette-title", palette.faint)
  const query = asking(renderer, "palette-query")
  const choices = makeChoices(renderer)
  box.add(title)
  box.add(query)
  box.add(choices)
  return { box, title, query, choices }
}

const makeChoices = (renderer: CliRenderer): TextRenderable =>
  new TextRenderable(renderer, {
    id: "palette-choices",
    content: "",
    flexGrow: 1,
    fg: palette.ink,
    selectable: true,
  })

export const makeBody = (renderer: CliRenderer): BoxRenderable =>
  new BoxRenderable(renderer, {
    id: "body",
    flexGrow: 1,
    flexDirection: "row",
    minHeight: 0,
    minWidth: 0,
    overflow: "hidden",
  })

export const makeHome = (renderer: CliRenderer) => ({
  logo: makeLogo(renderer),
  path: makeLanding(renderer, "landing", palette.muted, 0),
  keys: makeLanding(renderer, "landing-keys", palette.faint, 2),
})

export const makeModals = (renderer: CliRenderer) => ({
  palette: makePaletteParts(renderer),
  found: makeFoundParts(renderer),
  keys: makeKeysParts(renderer),
  settings: makeSettingsParts(renderer),
  reader: makeReaderParts(renderer),
  bases: makeBaseParts(renderer),
  ask: makeAskParts(renderer),
})

export type BaseParts = {
  readonly box: BoxRenderable
  readonly title: TextRenderable
  readonly query: TextareaRenderable
  readonly choices: TextRenderable
}

const makeBaseParts = (renderer: CliRenderer): BaseParts => {
  const box = makePalette(renderer)
  const title = bar(renderer, "base-title", palette.faint)
  const query = asking(renderer, "base-query", "Type a branch, a tag or a commit…")
  const choices = makeChoices(renderer)
  box.id = "base"
  box.add(title)
  box.add(query)
  box.add(choices)
  return { box, title, query, choices }
}

const makeAskParts = (renderer: CliRenderer) => {
  const box = makePalette(renderer)
  const title = bar(renderer, "ask-title", palette.faint)
  const choices = makeChoices(renderer)
  box.id = "ask"
  box.add(title)
  box.add(choices)
  return { box, title, choices }
}

const makeReaderParts = (renderer: CliRenderer) => {
  const box = makePalette(renderer)
  const title = bar(renderer, "reader-title", palette.faint)
  const choices = makeChoices(renderer)
  box.id = "reader"
  box.add(title)
  box.add(choices)
  return { box, title, choices }
}

const makeSettingsParts = (renderer: CliRenderer) => {
  const box = makePalette(renderer)
  const title = bar(renderer, "settings-title", palette.faint)
  const choices = makeChoices(renderer)
  box.id = "settings"
  box.add(title)
  box.add(choices)
  return { box, title, choices }
}

const makeKeysParts = (renderer: CliRenderer): KeysParts => {
  const parts = makePaletteParts(renderer)
  parts.box.id = "keys"
  const legend = bar(renderer, "keys-legend", palette.faint)
  parts.box.add(legend)
  return { ...parts, legend }
}

const makeFoundParts = (renderer: CliRenderer): FoundParts => {
  const box = makePalette(renderer)
  const title = bar(renderer, "found-title", palette.faint)
  const query = asking(renderer, "found-query", "Type what to look for…")
  const peek = bar(renderer, "found-peek", palette.muted)
  const choices = makeChoices(renderer)
  box.id = "found"
  box.add(title)
  box.add(query)
  box.add(choices)
  box.add(peek)
  return { box, title, query, peek, choices }
}

const isFont = (name: string): name is ASCIIFontName => name in fonts

const logoFont = (): ASCIIFontName => {
  const wanted = process.env["ADIFF_FONT"] ?? ""
  return isFont(wanted) ? wanted : "tiny"
}

const makeLanding = (
  renderer: CliRenderer,
  id: string,
  color: string,
  top: number,
): TextRenderable =>
  new TextRenderable(renderer, {
    id,
    content: "",
    fg: color,
    alignSelf: "center",
    marginTop: top,
    marginBottom: top === 0 ? 2 : 0,
    flexShrink: 0,
  })

const makeLogo = (renderer: CliRenderer): ASCIIFontRenderable =>
  new ASCIIFontRenderable(renderer, {
    id: "logo",
    text: "adiff",
    font: logoFont(),
    color: palette.accent,
    alignSelf: "center",
    marginBottom: 2,
    flexShrink: 0,
  })

const MAC_KEYS: ReadonlyArray<KeyBinding> = [
  { name: "left", super: true, action: "line-home" },
  { name: "right", super: true, action: "line-end" },
  { name: "left", super: true, shift: true, action: "select-line-home" },
  { name: "right", super: true, shift: true, action: "select-line-end" },
  { name: "up", super: true, action: "buffer-home" },
  { name: "down", super: true, action: "buffer-end" },
  { name: "backspace", super: true, action: "delete-to-line-start" },
  { name: "backspace", meta: true, action: "delete-word-backward" },
  { name: "return", shift: true, action: "newline" },
  { name: "return", meta: true, action: "newline" },
]

export const makeComposeParts = (
  renderer: CliRenderer,
): {
  readonly title: TextRenderable
  readonly quoted: TextRenderable
  readonly body: TextareaRenderable
  readonly actions: TextRenderable
} => ({
  title: new TextRenderable(renderer, {
    id: "compose-title",
    content: "",
    fg: palette.ink,
    wrapMode: "none",
  }),
  quoted: new TextRenderable(renderer, {
    id: "compose-quoted",
    content: "",
    fg: palette.muted,
    wrapMode: "none",
  }),
  body: new TextareaRenderable(renderer, {
    id: "compose-body",
    wrapMode: "word",
    keyBindings: [...defaultTextareaKeyBindings, ...MAC_KEYS],
    backgroundColor: palette.panel,
    focusedBackgroundColor: palette.panel,
    textColor: palette.ink,
    focusedTextColor: palette.ink,
    cursorColor: palette.ink,
    placeholder: "",
  }),
  actions: new TextRenderable(renderer, {
    id: "compose-actions",
    content: "",
    fg: palette.muted,
    marginTop: 1,
    wrapMode: "none",
  }),
})

export const makeCompose = (renderer: CliRenderer): BoxRenderable =>
  new BoxRenderable(renderer, {
    id: "compose",
    position: "absolute",
    width: COMPOSE_WIDTH,
    height: COMPOSE_CHROME,
    zIndex: 100,
    visible: false,
    backgroundColor: palette.panel,
    border: ["left"],
    borderStyle: "heavy",
    borderColor: palette.accent,
    paddingLeft: GUTTER_X,
    paddingRight: GUTTER_X,
    paddingTop: 1,
    paddingBottom: 1,
    flexDirection: "column",
  })
