export type FileTestModel = {
  readonly path: string
  readonly before: ReadonlyArray<string>
  readonly after: ReadonlyArray<string>
  readonly gone?: boolean
}

export type BranchTestModel = {
  readonly name: string
  readonly files: ReadonlyArray<FileTestModel>
}

export const generateFileTestModel = (overrides: Partial<FileTestModel> = {}): FileTestModel => ({
  path: overrides.path ?? "src/api.ts",
  before: overrides.before ?? [
    "export function api() {",
    "  const first = 1",
    "  const second = 2",
    "  return first + second",
    "}",
  ],
  after: overrides.after ?? [
    "export function api() {",
    "  const first = 1",
    "  const second = 2",
    "  const third = 3",
    "  return first + second + third",
    "}",
  ],
  ...(overrides.gone === true ? { gone: true } : {}),
})

export type BranchOverrides = {
  readonly name?: string
  readonly files?: ReadonlyArray<Partial<FileTestModel>>
}

export const generateBranchTestModel = (overrides: BranchOverrides = {}): BranchTestModel => ({
  name: overrides.name ?? "cdr-1-add-third",
  files: (overrides.files ?? [{}]).map(generateFileTestModel),
})
