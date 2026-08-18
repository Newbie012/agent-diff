export type MarkSet = {
  readonly comment: string
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
