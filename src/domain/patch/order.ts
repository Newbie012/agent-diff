export type TreeEntry = { readonly name: string; readonly kind: "directory" | "file" }

export const compareEntries = (left: TreeEntry, right: TreeEntry): number => {
  if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1
  return left.name.localeCompare(right.name)
}

type Folder = {
  readonly folders: Map<string, Folder>
  readonly files: Array<{ readonly name: string; readonly path: string }>
}

const folder = (): Folder => ({ folders: new Map(), files: [] })

const folderAt = (root: Folder, segments: ReadonlyArray<string>): Folder =>
  segments.reduce((at, segment) => {
    const found = at.folders.get(segment)
    if (found !== undefined) return found
    const made = folder()
    at.folders.set(segment, made)
    return made
  }, root)

const walk = (at: Folder): ReadonlyArray<string> => [
  ...[...at.folders]
    .toSorted(([left], [right]) => compareEntries({ name: left, kind: "directory" }, { name: right, kind: "directory" }))
    .flatMap(([, inner]) => walk(inner)),
  ...at.files
    .toSorted((left, right) => compareEntries({ ...left, kind: "file" }, { ...right, kind: "file" }))
    .map((file) => file.path),
]

export const treeOrder = (paths: ReadonlyArray<string>): ReadonlyArray<string> => {
  const root = folder()
  for (const path of paths) {
    const segments = path.split("/").filter((segment) => segment.length > 0)
    const name = segments.at(-1)
    if (name !== undefined) folderAt(root, segments.slice(0, -1)).files.push({ name, path })
  }
  return walk(root)
}
