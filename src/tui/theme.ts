export const palette = {
  ink: "#d8dee9",
  faint: "#6b7280",
  accent: "#7aa2f7",
  cursor: "#1f2430",
  selection: "#2c3a57",
  overlay: "#161922",
  added: "#7bc275",
  removed: "#e06c75",
  addedBg: "#12301c",
  removedBg: "#33161a",
} as const

export const syntaxTheme = {
  keyword: { fg: "#c678dd" },
  string: { fg: "#98c379" },
  number: { fg: "#d19a66" },
  comment: { fg: palette.faint, italic: true },
  function: { fg: "#61afef" },
  type: { fg: "#e5c07b" },
  variable: { fg: palette.ink },
  constant: { fg: "#d19a66" },
  operator: { fg: "#56b6c2" },
  punctuation: { fg: palette.faint },
  default: { fg: palette.ink },
}
