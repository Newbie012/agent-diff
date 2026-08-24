export type Band = "file" | "branch" | "worktree"

export type Tier = "code" | "test" | "data"

export type Place = {
  readonly path: string
  readonly line: number
  readonly text: string
  readonly declares: boolean
  readonly band: Band
  readonly tier: Tier
}

export type Counted = {
  readonly file: number
  readonly branch: number
  readonly worktree: number
}

export type Found = {
  readonly places: ReadonlyArray<Place>
  readonly counted: Counted
  readonly left: number
}

export const MOST_PLACES = 200

export const MOST_PER_FILE = 20

const DATA_ENDS: ReadonlyArray<string> = [
  ".txt",
  ".csv",
  ".tsv",
  ".log",
  ".snap",
  ".lock",
  ".sum",
  ".golden",
  ".out",
  ".md",
  ".mdx",
  ".rst",
  ".adoc",
  ".yml",
  ".yaml",
  ".json",
  ".toml",
  ".ini",
  ".cfg",
  ".conf",
  ".env",
]

const DATA_NAMES: ReadonlySet<string> = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "go.sum",
  "cargo.lock",
  "poetry.lock",
  "codeowners",
  ".gitignore",
  ".dockerignore",
  "jenkinsfile",
  "procfile",
])

const DATA_STARTS: ReadonlyArray<string> = ["dockerfile", "makefile", "docker-compose"]

const DATA_PARTS: ReadonlySet<string> = new Set([
  "fixtures",
  "__fixtures__",
  "__snapshots__",
  "snapshots",
  "testdata",
  "test-data",
  "vendor",
  "third_party",
  "node_modules",
  "dist",
  "build",
  "coverage",
])

const TEST_PARTS: ReadonlySet<string> = new Set(["test", "tests", "__tests__", "spec"])

const TEST_ENDS = /(\.(spec|test)\.[a-z]+|_test\.[a-z]+|Test\.[a-z]+)$/

const partsOf = (path: string): ReadonlyArray<string> => path.toLowerCase().split("/")

const nameOf = (path: string): string => partsOf(path).at(-1) ?? ""

const isData = (path: string): boolean => {
  const name = nameOf(path)
  if (DATA_NAMES.has(name)) return true
  if (DATA_STARTS.some((start) => name.startsWith(start))) return true
  if (DATA_ENDS.some((end) => name.endsWith(end))) return true
  return partsOf(path).slice(0, -1).some((part) => DATA_PARTS.has(part))
}

const isTest = (path: string): boolean => {
  if (TEST_ENDS.test(path)) return true
  return partsOf(path).slice(0, -1).some((part) => TEST_PARTS.has(part))
}

export const tierOf = (path: string): Tier =>
  isData(path) ? "data" : isTest(path) ? "test" : "code"

const KEYWORDS = [
  "const",
  "let",
  "var",
  "function",
  "class",
  "interface",
  "type",
  "enum",
  "struct",
  "def",
  "func",
  "fn",
  "impl",
  "trait",
  "module",
  "namespace",
  "record",
  "readonly",
  "private",
  "public",
  "protected",
  "static",
  "val",
].join("|")

const escaped = (term: string): string => term.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)

const BORROWS = /^\s*(import|export\s.*\sfrom\s|from\s|require\b|#include|using\s|use\s)/

export const declaresIn = (text: string, term: string): boolean => {
  if (BORROWS.test(text)) return false
  return new RegExp(String.raw`\b(${KEYWORDS})\b[^=]{0,40}?\b${escaped(term)}\b`, "i").test(text)
}

export const bandOf = (
  path: string,
  reading: { readonly here: string; readonly changed: ReadonlySet<string> },
): Band => (path === reading.here ? "file" : reading.changed.has(path) ? "branch" : "worktree")

const TIERS: Readonly<Record<Tier, number>> = { code: 0, test: 100, data: 200 }

const BANDS: Readonly<Record<Band, number>> = { file: 0, branch: 10, worktree: 20 }

export const rankOf = (place: Place): number =>
  TIERS[place.tier] + BANDS[place.band] + (place.declares ? 0 : 1)

const inFile = (left: Place, right: Place): number => {
  if (left.declares !== right.declares) return left.declares ? -1 : 1
  return left.line - right.line
}

const byRank = (
  left: readonly [string, ReadonlyArray<Place>],
  right: readonly [string, ReadonlyArray<Place>],
): number => {
  const [leftPath, leftPlaces] = left
  const [rightPath, rightPlaces] = right
  const held = Math.min(...leftPlaces.map(rankOf)) - Math.min(...rightPlaces.map(rankOf))
  return held === 0 ? leftPath.localeCompare(rightPath) : held
}

const byFile = (places: ReadonlyArray<Place>): ReadonlyArray<readonly [string, Array<Place>]> => {
  const held = new Map<string, Array<Place>>()
  for (const place of places) {
    const kept = held.get(place.path)
    if (kept === undefined) held.set(place.path, [place])
    else kept.push(place)
  }
  return [...held.entries()]
}

export const countedIn = (places: ReadonlyArray<Place>): Counted => ({
  file: places.filter((place) => place.band === "file").length,
  branch: places.filter((place) => place.band !== "worktree").length,
  worktree: places.length,
})

export const ranked = (places: ReadonlyArray<Place>): Found => {
  const files = byFile(places)
    .map(([path, held]) => [path, held.toSorted(inFile)] as const)
    .toSorted(byRank)
  const kept: Array<Place> = []
  let left = 0
  for (const [, held] of files) {
    const room = Math.max(0, MOST_PLACES - kept.length)
    const taking = held.slice(0, Math.min(MOST_PER_FILE, room))
    kept.push(...taking)
    left += held.length - taking.length
  }
  return { places: kept, counted: countedIn(places), left }
}
