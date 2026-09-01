import { preferences } from "../domain/preferences/index.ts"

export type Focus = "tree" | "diff" | "review"

export type StagedComment = {
  readonly id?: string
  readonly at?: string
  readonly file: string
  readonly side: "old" | "new"
  readonly start: number
  readonly end: number
  readonly body: string
  readonly snippet?: string
  readonly settled?: boolean
  readonly removed?: boolean
  readonly outside?: boolean
  readonly stale?: boolean
  readonly asks?: boolean
  readonly answers?: ReadonlyArray<string>
  readonly turns?: ReadonlyArray<{ readonly voice: "reviewer" | "agent"; readonly body: string }>
  readonly unread?: number
  readonly takenAt?: string
  readonly remark?: string
}
import { type Patch } from "../domain/patch/index.ts"
import { shownOf, type Reveal } from "./gaps.ts"
import type { BranchSummary, Match, Remark, ReportedLayer } from "../review/index.ts"
import type { Counted } from "../domain/search/index.ts"

export type LayerRow = {
  readonly index: number
  readonly kind: "title" | "dir" | "file" | "gap" | "count" | "note"
  readonly text: string
  readonly lead: boolean
  readonly fileIndex?: number
  readonly reviewed?: boolean
  readonly here?: boolean
}

export type Spot = { readonly row: number; readonly column: number }

export type Clicked = {
  readonly pane: Focus
  readonly file?: number | undefined
  readonly layer?: number | undefined
  readonly entry?: number | undefined
}

export type Picked = {
  readonly row: number
  readonly from: number
  readonly to: number
}

export type ScreenName =
  | "branches"
  | "review"
  | "compose"
  | "palette"
  | "report"
  | "search"
  | "keys"
  | "settings"
  | "base"
  | "editor"
  | "thread"
  | "settling"

const HOLDS: Readonly<Record<string, keyof TuiState>> = {
  wrap: "wrap",
  sticky: "sticky",
  panel: "panelOpen",
  hideReviewed: "hideReviewed",
  hideSettled: "hideSettled",
  newestFirst: "newestFirst",
  remarks: "remarksOn",
  hold: "hold",
}

export const chosenNow = (state: TuiState): Readonly<Record<string, boolean>> =>
  Object.fromEntries(
    Object.entries(HOLDS).map(([name, held]) => [name, state[held] === true]),
  )

export const withChosen = (state: TuiState, name: string, value: boolean): TuiState => {
  const held = HOLDS[name]
  return held === undefined ? state : { ...state, [held]: value }
}

export type PreferenceRow = {
  readonly name: string
  readonly title: string
  readonly about: string
  readonly on: boolean
  readonly here: boolean
}

export const preferenceRows = (state: TuiState): ReadonlyArray<PreferenceRow> => {
  const held = chosenNow(state)
  return preferences.map((one, at) => ({
    name: one.name,
    title: one.title,
    about: one.about,
    on: held[one.name] ?? one.byDefault,
    here: at === state.settingsIndex,
  }))
}

export type ForgeAnswer = "asking" | "answered" | "silent"

export type Asking = {
  readonly path: string
  readonly layer: string | undefined
  readonly threads: ReadonlyArray<string>
  readonly advance: boolean
}

export type TuiState = {
  readonly screen: ScreenName
  readonly branches: ReadonlyArray<BranchSummary>
  readonly branchIndex: number
  readonly patches: ReadonlyArray<Patch>
  readonly patchIndex: number
  readonly cursor: number
  readonly stop: number
  readonly opened: ReadonlyArray<string>
  readonly replyTo?: string | undefined
  readonly answerTo?: string | undefined
  readonly anchorRow: number
  readonly selecting: boolean
  readonly draft: string
  readonly draftAt: string
  readonly notice: string
  readonly waiting: string
  readonly query: string
  readonly paletteIndex: number
  readonly returnTo: ScreenName
  readonly closed: ReadonlyArray<string>
  readonly vouched: ReadonlyArray<string>
  readonly partsRead: ReadonlyArray<string>
  readonly openMoved: boolean
  readonly refSaid: Readonly<Record<string, string>>
  readonly sent: ReadonlyArray<StagedComment>
  readonly remarks: ReadonlyArray<Remark>
  readonly held: ReadonlyArray<StagedComment>
  readonly viewport: number
  readonly context: number
  readonly contextWas: number
  readonly top: number
  readonly source: ReadonlyArray<string>
  readonly full: ReadonlyArray<Patch>
  readonly revealed: ReadonlyArray<Reveal>
  readonly focus: Focus
  readonly navOpen: boolean
  readonly wrap: boolean
  readonly sticky: boolean
  readonly pan: number
  readonly layers: ReadonlyArray<ReportedLayer>
  readonly layersStale: boolean
  readonly summary: string
  readonly pulls: Readonly<Record<string, string>>
  readonly forge: ForgeAnswer
  readonly layerIndex: number
  readonly openLayers: ReadonlyArray<number>
  readonly rail: "tree" | "layers"
  readonly term: string
  readonly matches: ReadonlyArray<Match>
  readonly refs: ReadonlyArray<string>
  readonly refIndex: number
  readonly editorNow: string
  readonly counted: Counted
  readonly leftOut: number
  readonly around: ReadonlyArray<string>
  readonly matchIndex: number
  readonly arrived: ReadonlyArray<StagedComment>
  readonly panelOpen: boolean
  readonly panelWas: boolean
  readonly panelIndex: number
  readonly columns: number
  readonly reportFull: boolean
  readonly hideReviewed: boolean
  readonly hideSettled: boolean
  readonly picked: Picked | undefined
  readonly newestFirst: boolean
  readonly remarksOn: boolean
  readonly hold: boolean
  readonly tallest: number
  readonly scroll: number
  readonly railRows: number
  readonly railScroll: number
  readonly settingsIndex: number
  readonly asking: Asking | undefined
  readonly askIndex: number
  readonly now: number
  readonly focusWas: Focus
}

const nothingReviewed = {
  held: [] as ReadonlyArray<StagedComment>,
  arrived: [] as ReadonlyArray<StagedComment>,
  panelOpen: true,
  panelWas: true,
  panelIndex: 0,
  columns: 0,
  reportFull: true,
  hideReviewed: false,
  hideSettled: false,
  picked: undefined,
  newestFirst: true,
  remarksOn: false,
  hold: false,
  tallest: 0,
  scroll: -1,
  railRows: 12,
  railScroll: -1,
  settingsIndex: 0,
  asking: undefined,
  askIndex: 0,
  now: 0,
  focusWas: "diff" as Focus,
}

const nothingFound = {
  matches: [] as ReadonlyArray<Match>,
  refs: [] as ReadonlyArray<string>,
  refIndex: 0,
  editorNow: "",
  matchIndex: 0,
  term: "",
  query: "",
  paletteIndex: 0,
}

export const initialState = (branches: ReadonlyArray<BranchSummary>): TuiState => ({
  ...nothingReviewed,
  screen: "branches",
  branches,
  branchIndex: 0,
  patches: [],
  patchIndex: 0,
  cursor: 0,
  stop: 0,
  opened: [],
  anchorRow: 0,
  selecting: false,
  draft: "",
  draftAt: "",
  notice: "",
  waiting: "",
  returnTo: "branches",
  closed: [],
  vouched: [],
  partsRead: [],
  openMoved: false,
  refSaid: {},
  sent: [],
  remarks: [],
  viewport: 20,
  context: 3,
  contextWas: 3,
  top: 0,
  source: [],
  full: [],
  revealed: [],
  focus: "diff",
  navOpen: true,
  wrap: false,
  sticky: true,
  pan: 0,
  layers: [],
  layersStale: false,
  summary: "",
  pulls: {},
  forge: "asking",
  layerIndex: 0,
  openLayers: [],
  ...nothingFound,
  counted: { file: 0, branch: 0, worktree: 0 },
  leftOut: 0,
  around: [],
  rail: "tree",
})

export const selectedBranch = (state: TuiState): BranchSummary | undefined =>
  state.branches[state.branchIndex]

export const selectedPatch = (state: TuiState): Patch | undefined => shownOf(state)?.patch

export const pullHere = (state: TuiState): string =>
  state.pulls[selectedBranch(state)?.branch ?? ""] ?? ""

export const knownToHaveNoPull = (state: TuiState): boolean =>
  state.forge === "answered" && pullHere(state).length === 0

export const onLayers = (state: TuiState): boolean =>
  state.rail === "layers" && state.layers.length > 0

export const selectedLayer = (state: TuiState): ReportedLayer | undefined => state.layers[state.layerIndex]
