import type { FileTestModel } from "./domains/branch/model.ts"

export type Shape = {
  readonly name: string
  readonly files: ReadonlyArray<FileTestModel>
}

const spread = <Held,>(count: number, make: (at: number) => Held): ReadonlyArray<Held> =>
  Array.from({ length: count }, (_, at) => make(at))

const lines = (count: number, make: (at: number) => string): ReadonlyArray<string> =>
  spread(count, make)

const body = (count: number, mark: string): ReadonlyArray<string> =>
  lines(count, (at) => `  const ${mark}${at} = ${at};`)

const changed = (path: string, count: number): FileTestModel => ({
  path,
  before: ["export function held() {", ...body(count, "step"), "}"],
  after: ["export function held() {", ...body(count, "step"), "  const added = 1;", "}"],
})

const crowded: Shape = {
  name: "a folder holding more files than the tree opens",
  files: spread(14, (at) => changed(`src/parts/module${String(at).padStart(2, "0")}.ts`, 4)),
}

const deep: Shape = {
  name: "a path further down than the tree indents",
  files: [
    changed("services/platform/telemetry/collectors/pipelines/stages/reduce-windows.ts", 4),
    changed("services/platform/telemetry/collectors/pipelines/stages/reduce-batches.ts", 4),
    changed("services/platform/telemetry/receivers/http-receiver.ts", 4),
  ],
}

const buried: Shape = {
  name: "a change a long way below the top of the file",
  files: [changed("src/deep.ts", 120)],
}

const wide: Shape = {
  name: "a line wider than any terminal",
  files: [
    {
      path: "src/wide.ts",
      before: ["const short = 1;"],
      after: ["const short = 1;", `const long = "${"payload ".repeat(40)}";`],
    },
  ],
}

const removals: Shape = {
  name: "a file that only loses lines",
  files: [
    {
      path: "src/gone.ts",
      before: ["export const kept = 0", ...body(12, "gone"), "export const also = 1"],
      after: ["export const kept = 0", "export const also = 1"],
    },
  ],
}

const single: Shape = {
  name: "one file with one changed line",
  files: [changed("src/one.ts", 3)],
}

const many: Shape = {
  name: "files spread over several folders",
  files: [
    changed("src/api/one.ts", 6),
    changed("src/api/two.ts", 6),
    changed("src/web/three.ts", 6),
    changed("docs/notes.md", 6),
    changed("README.md", 6),
  ],
}

export const shapes: ReadonlyArray<Shape> = [
  single,
  many,
  crowded,
  deep,
  buried,
  wide,
  removals,
]
