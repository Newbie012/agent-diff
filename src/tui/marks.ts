export type ThreadStand = "waiting" | "answered" | "asked" | "settled" | "gone"

export type MarkSet = {
  readonly waiting: string
  readonly answered: string
  readonly asked: string
  readonly done: string
  readonly sent: string
  readonly rule: string
  readonly cursor: string
  readonly shut: string
  readonly open: string
  readonly space: string
  readonly tab: string
}

const shared = {
  done: "✓",
  sent: "→",
  cursor: "▎",
  shut: "▸",
  open: "▾",
  space: "·",
  tab: "→",
} as const

const ring: MarkSet = { ...shared, waiting: "○", answered: "◐", asked: "●", rule: "│" }

const sets: Readonly<Record<string, MarkSet>> = {
  ring,
  bubble: { ...shared, waiting: "◌", answered: "◑", asked: "◗", rule: "┃", cursor: "▌" },
  quote: { ...shared, waiting: "❞", answered: "❠", asked: "❝", rule: "┊" },
  diamond: { ...shared, waiting: "◇", answered: "◈", asked: "◆", rule: "╎" },
  dot: { ...shared, waiting: "○", answered: "◉", asked: "●", rule: "▏" },
}

export const markSetNames: ReadonlyArray<string> = Object.keys(sets)

let chosen: MarkSet = ring

export const useMarks = (name: string): void => {
  chosen = sets[name] ?? ring
}

export const marks = (): MarkSet => chosen

const STAND_KEY: Readonly<Record<ThreadStand, keyof MarkSet | undefined>> = {
  waiting: "waiting",
  answered: "answered",
  asked: "asked",
  settled: "done",
  gone: undefined,
}

export const standMark = (stand: ThreadStand): string => {
  const key = STAND_KEY[stand]
  return key === undefined ? " " : chosen[key]
}

useMarks(process.env["ADIFF_MARKS"] ?? "ring")
