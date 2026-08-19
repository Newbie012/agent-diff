const ink = "#c8d0dc"
const inkMuted = "#8b95a7"
const inkFaint = "#5b6577"

const blue = "#7aa2f7"
const green = "#7bc275"
const red = "#e06c75"
const amber = "#e0af68"
const violet = "#bb9af7"

export const palette = {
  ink,
  muted: inkMuted,
  faint: inkFaint,
  accent: blue,
  attention: amber,
  added: green,
  removed: red,

  panel: "#0e1117",
  overlay: "#181c26",
  scrim: "#000000a0",
  rule: "#262b37",

  note: "#9aa7c7",
  cursor: "#232936",
  selection: "#2b3854",
  resting: "#243043",
  marker: blue,

  addedBg: "#0f2a19",
  removedBg: "#2e1418",
  addedGutter: "#1d4a2b",
  removedGutter: "#4a1f26",

  pickedOn: "#2b3854",
  pickedOnAdded: "#22432f",
  pickedOnRemoved: "#4a2733",
  pickedGutter: "#38496b",
  pickedGutterAdded: "#2d5c3f",
  pickedGutterRemoved: "#63323f",

  cursorOn: "#243a4f",
  cursorOnAdded: "#1a3d26",
  cursorOnRemoved: "#40202a",
  cursorGutter: "#2f4a68",
  cursorGutterAdded: "#27573a",
  cursorGutterRemoved: "#5a2b36",
} as const

export const syntaxTheme = {
  keyword: { fg: violet },
  "keyword.function": { fg: violet },
  "keyword.return": { fg: violet },
  string: { fg: green },
  number: { fg: amber },
  boolean: { fg: amber },
  comment: { fg: inkFaint, italic: true },
  function: { fg: blue },
  "function.call": { fg: blue },
  method: { fg: blue },
  type: { fg: "#7dcfff" },
  constructor: { fg: "#7dcfff" },
  property: { fg: ink },
  variable: { fg: ink },
  "variable.parameter": { fg: "#e0d5b7" },
  constant: { fg: amber },
  operator: { fg: inkMuted },
  punctuation: { fg: inkFaint },
  "punctuation.bracket": { fg: inkFaint },
  "punctuation.delimiter": { fg: inkFaint },
  gap: { fg: inkFaint },
  picked: { bg: "#2b3854" },
  note: { fg: "#c8d0dc" },
  prose: { fg: "#8b95a7" },
  "note.sent": { fg: "#c8d0dc" },
  "note.label": { fg: "#7aa2f7" },
  default: { fg: ink },
}
