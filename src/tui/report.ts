import { hostname, platform } from "node:os"
import manifest from "../../package.json" with { type: "json" }
import { selectedBranch, selectedPatch, treeWindow, type TuiState } from "./model.ts"

export type Surroundings = {
  readonly repo: string
  readonly keys: ReadonlyArray<string>
  readonly trail: ReadonlyArray<string>
  readonly failure: string
  readonly width: number
  readonly height: number
}

const AROUND_CURSOR = 8
const TREE_ROWS = 12

const sign = (kind: string): string => (kind === "added" ? "+" : kind === "removed" ? "-" : " ")

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

const facts = (state: TuiState, around: Surroundings): ReadonlyArray<string> => [
  `- adiff ${manifest.version} on Node ${process.version}, ${platform()}, ${hostname()}`,
  `- terminal ${around.width}x${around.height}`,
  `- repo \`${around.repo}\``,
  `- branch \`${selectedBranch(state)?.branch ?? "none"}\``,
  `- file \`${selectedPatch(state)?.path ?? "none"}\`, row ${state.cursor + 1}`,
  `- screen \`${state.screen}\`, focus \`${state.focus}\`, selecting ${String(state.selecting)}`,
  `- ${state.vouched.length} of ${state.patches.length} reviewed`,
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
  "_Sent as a minimal report: no file names, no code, no key history._",
  "",
]

export const buildReport = (state: TuiState, around: Surroundings): string => {
  const failure = around.failure.length === 0 ? "none" : around.failure.split("\n")[0]
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
