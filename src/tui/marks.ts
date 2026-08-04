export type MarkSet = {
  readonly comment: string
  readonly staged: string
  readonly sent: string
  readonly rule: string
  readonly cursor: string
  readonly tally: string
  readonly reviewed: string
  readonly folder: string
  readonly folderOpen: string
  readonly file: string
}

const sets: Readonly<Record<string, MarkSet>> = {
  ring: {
    comment: "○",
    staged: "○",
    sent: "✓",
    rule: "│",
    cursor: "▎",
    tally: "•",
    reviewed: "✓",
    folder: "",
    folderOpen: "",
    file: "",
  },
  bubble: {
    comment: "◗",
    staged: "◗",
    sent: "◖",
    rule: "┃",
    cursor: "▌",
    tally: "◗",
    reviewed: "✓",
    folder: "",
    folderOpen: "",
    file: "",
  },
  quote: {
    comment: "❞",
    staged: "❝",
    sent: "✓",
    rule: "┊",
    cursor: "▎",
    tally: "❞",
    reviewed: "✓",
    folder: "",
    folderOpen: "",
    file: "",
  },
  diamond: {
    comment: "◆",
    staged: "◇",
    sent: "◈",
    rule: "╎",
    cursor: "▎",
    tally: "◆",
    reviewed: "✓",
    folder: "",
    folderOpen: "",
    file: "",
  },
  dot: {
    comment: "●",
    staged: "●",
    sent: "✓",
    rule: "▏",
    cursor: "▎",
    tally: "•",
    reviewed: "✓",
    folder: "",
    folderOpen: "",
    file: "",
  },
}

export const markSetNames: ReadonlyArray<string> = Object.keys(sets)

const ring: MarkSet = {
  folder: "",
  folderOpen: "",
  file: "",
  comment: "○",
  staged: "○",
  sent: "✓",
  rule: "│",
  cursor: "▎",
  tally: "•",
  reviewed: "✓",
}

const plain: MarkSet = { ...ring, folder: "▸", folderOpen: "▾", file: "·" }

let chosen: MarkSet = ring

export const useMarks = (name: string): void => {
  chosen = name === "plain" ? plain : (sets[name] ?? ring)
}

export const marks = (): MarkSet => chosen

useMarks(process.env["ADIFF_MARKS"] ?? "ring")
