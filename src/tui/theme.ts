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
  resting: "#1b2233",
  marker: blue,

  addedBg: "#0f2a19",
  removedBg: "#2e1418",
  addedGutter: "#1d4a2b",
  removedGutter: "#4a1f26",
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
  note: { fg: "#9aa7c7", italic: true },
  prose: { fg: "#a9b4cc" },
  "note.sent": { fg: "#6d7893", italic: true },
  "note.label": { fg: "#7aa2f7" },
  default: { fg: ink },
}
