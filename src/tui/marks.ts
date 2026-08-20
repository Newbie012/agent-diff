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
  readonly space: string
  readonly tab: string
}

const ring: MarkSet = {
  comment: "○",
  sent: "✓",
  rule: "│",
  cursor: "▎",
  tally: "•",
  reviewed: "✓",
  folder: "",
  folderOpen: "",
  file: "",
  space: "·",
  tab: "→",
}

const plain: MarkSet = { ...ring, folder: "▸", folderOpen: "▾", file: "·" }

const sets: Readonly<Record<string, MarkSet>> = {
  ring,
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
    space: "·",
    tab: "→",
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
    space: "·",
    tab: "→",
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
    space: "·",
    tab: "→",
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
    space: "·",
    tab: "→",
  },
  plain,
}

export const markSetNames: ReadonlyArray<string> = Object.keys(sets)

let chosen: MarkSet = ring

export const useMarks = (name: string): void => {
  chosen = sets[name] ?? ring
}

export const marks = (): MarkSet => chosen

useMarks(process.env["ADIFF_MARKS"] ?? "ring")
