export type ThreadStand = "filed" | "waiting" | "answered" | "asked" | "settled" | "gone"

export type ThreadSection = "asked" | "filed" | "with" | "answered" | "movedOn" | "settled" | "removed"

export type StandFacts = {
  readonly removed: boolean
  readonly settled: boolean
  readonly asks: boolean
  readonly answeredLast: boolean
  readonly taken: boolean
}

export type PlaceFacts = {
  readonly outside: boolean
  readonly outdated: boolean
  readonly reworded: boolean
}

export const standOf = (facts: StandFacts): ThreadStand => {
  if (facts.removed) return "gone"
  if (facts.settled) return "settled"
  if (facts.asks) return "asked"
  if (facts.answeredLast) return "answered"
  return facts.taken ? "waiting" : "filed"
}

export const isMovedPast = (facts: PlaceFacts): boolean =>
  facts.outside || (facts.outdated && !facts.reworded)

const SECTION_OF: Readonly<Record<ThreadStand, ThreadSection>> = {
  filed: "filed",
  gone: "removed",
  settled: "settled",
  asked: "asked",
  answered: "answered",
  waiting: "with",
}

export const sectionOf = (stand: ThreadStand, movedPast: boolean): ThreadSection =>
  movedPast && stand !== "settled" && stand !== "gone" ? "movedOn" : SECTION_OF[stand]

export const STAND_WEIGHT: Readonly<Record<ThreadStand, number>> = {
  gone: 0,
  settled: 1,
  filed: 2,
  waiting: 2,
  answered: 3,
  asked: 4,
}

export const louderOf = (one: ThreadStand, other: ThreadStand): ThreadStand =>
  STAND_WEIGHT[one] > STAND_WEIGHT[other] ? one : other

export const isOpen = (stand: ThreadStand): boolean => stand !== "settled" && stand !== "gone"
