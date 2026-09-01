import { hostname, platform } from "node:os"
import { absurd } from "effect"
import manifest from "../../package.json" with { type: "json" }
import type { RowKind } from "../domain/patch/index.ts"
import { preferences } from "../domain/preferences/index.ts"
import { treeWindow } from "./files.ts"
import { WHOLE_FILE } from "./layout.ts"
import { chosenNow, selectedBranch, selectedPatch, type TuiState } from "./state.ts"
import { counted } from "./words.ts"

export type Surroundings = {
  readonly repo: string
  readonly base: string
  readonly keys: ReadonlyArray<string>
  readonly trail: ReadonlyArray<string>
  readonly failure: string
  readonly failureKind: string
  readonly width: number
  readonly height: number
  readonly slowest: ReadonlyArray<{ readonly action: string; readonly ms: number }>
}

const AROUND_CURSOR = 8
const TREE_ROWS = 12

const sign = (kind: RowKind): string => {
  switch (kind) {
    case "added":
      return "+"
    case "removed":
      return "-"
    case "context":
      return " "
    default:
      return absurd(kind)
  }
}

const visibleRows = (state: TuiState): ReadonlyArray<string> => {
  const patch = selectedPatch(state)
  if (patch === undefined) return []
  const from = Math.max(0, state.cursor - AROUND_CURSOR)
  return patch.rows.slice(from, state.cursor + AROUND_CURSOR).map((row) => {
    const here = row.index === state.cursor ? ">" : " "
    return `${here} ${String(row.index).padStart(4)} ${sign(row.kind)} ${row.text}`
  })
}

const visibleTree = (state: TuiState): ReadonlyArray<string> =>
  treeWindow(state, TREE_ROWS).rows.map((row) => {
    const here = row.fileIndex === state.patchIndex ? ">" : " "
    return `${here} ${"  ".repeat(row.depth)}${row.name}${row.kind === "directory" ? "/" : ""}`
  })

const whereabouts = (state: TuiState, around: Surroundings): ReadonlyArray<string> => [
  `- repo \`${around.repo}\``,
  `- branch \`${selectedBranch(state)?.branch ?? "none"}\`, base \`${around.base.length === 0 ? "resolved by adiff" : around.base}\``,
  `- file \`${selectedPatch(state)?.path ?? "none"}\`, row ${state.cursor}`,
]

const chosenAway = (state: TuiState): string => {
  const held = chosenNow(state)
  const away = preferences.filter((one) => (held[one.name] ?? one.byDefault) !== one.byDefault)
  return away.length === 0 ? "every preference at its default" : away.map((one) => one.name).join(", ")
}

const standingOn = (state: TuiState): string => {
  if (!state.reportFull) return `standing on layer ${state.layerIndex + 1}`
  return `standing on \`${state.layers[state.layerIndex]?.title ?? "none"}\``
}

const layersLine = (state: TuiState): string => {
  if (state.layers.length === 0) return "- no reading order on this branch"
  const spans = state.layers.reduce((sum, layer) => sum + layer.spans.length, 0)
  return `- reading order: ${counted(state.layers.length, "layer")} over ${counted(spans, "span")}, rail on ${state.rail}, ${state.layersStale ? "stale" : "current"}, ${standingOn(state)}`
}

const remarksLine = (state: TuiState): string => {
  if (!state.remarksOn) return "- the pull request's remarks are off"
  const waiting = state.remarks.filter((one) => one.state === "waiting").length
  return `- remarks on: ${counted(state.remarks.length, "remark")}, ${waiting} waiting`
}

const shapeLine = (state: TuiState): string => {
  const patch = selectedPatch(state)
  const hunks = patch?.hunks.length ?? 0
  const whole = state.context >= WHOLE_FILE ? "the whole file" : `${state.context} lines of context`
  return `- this file: ${counted(hunks, "hunk")} shown, ${whole}, ${state.wrap ? "wrapped" : "not wrapped"}`
}

const tookLine = (around: Surroundings): ReadonlyArray<string> => {
  if (around.slowest.length === 0) return []
  return [`- slowest: ${around.slowest.map((one) => `${one.action} ${one.ms}ms`).join(", ")}`]
}

const facts = (state: TuiState, around: Surroundings): ReadonlyArray<string> => [
  `- adiff ${manifest.version} on Node ${process.version}, ${platform()}${state.reportFull ? `, ${hostname()}` : ""}`,
  `- terminal ${around.width}x${around.height}`,
  ...(state.reportFull ? whereabouts(state, around) : []),
  `- screen \`${state.screen}\`, focus \`${state.focus}\`, selecting ${String(state.selecting)}`,
  `- ${state.vouched.length} of ${state.patches.length} reviewed`,
  `- preferences away from default: ${chosenAway(state)}`,
  layersLine(state),
  remarksLine(state),
  shapeLine(state),
  ...tookLine(around),
]

const fenced = (title: string, lines: ReadonlyArray<string>): ReadonlyArray<string> => [
  `## ${title}`,
  "",
  "```",
  ...lines,
  "```",
  "",
]

const fully = (state: TuiState, around: Surroundings): ReadonlyArray<string> => [
  ...fenced("What led here", around.trail),
  ...fenced("Keys pressed", [around.keys.join(" ")]),
  ...fenced("Files", visibleTree(state)),
  ...fenced("Around the cursor", visibleRows(state)),
]

const minimal = (): ReadonlyArray<string> => [
  "_Sent as a minimal report: no machine, repo, branch or file name, no code, no key history, and nothing from a failure but its kind._",
  "",
]

const lastFailure = (state: TuiState, around: Surroundings): string => {
  if (around.failure.length === 0) return "none"
  return state.reportFull ? (around.failure.split("\n")[0] ?? "") : around.failureKind
}

export const buildReport = (state: TuiState, around: Surroundings): string => {
  const failure = lastFailure(state, around)
  return [
    "# adiff bug report",
    "",
    state.draft,
    "",
    "## Where",
    "",
    ...facts(state, around),
    `- last internal failure: ${failure}`,
    "",
    ...(state.reportFull ? fully(state, around) : minimal()),
  ].join("\n")
}
