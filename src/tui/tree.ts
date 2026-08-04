export type TreeNode = {
  readonly id: number
  readonly name: string
  readonly path: string
  readonly parent: number | undefined
  readonly children: Array<number>
  readonly kind: "directory" | "file"
  readonly fileIndex: number | undefined
}

export type Tree = {
  readonly roots: Array<number>
  readonly nodes: Array<TreeNode>
}

export type TreeRow = {
  readonly id: number
  readonly depth: number
  readonly kind: "directory" | "file"
  readonly name: string
  readonly path: string
  readonly fileIndex: number | undefined
  readonly files: number
}

const add = (tree: Tree, input: Omit<TreeNode, "id" | "children">): number => {
  const id = tree.nodes.length
  tree.nodes.push({ ...input, id, children: [] })
  const parent = input.parent === undefined ? undefined : tree.nodes[input.parent]
  if (parent === undefined) tree.roots.push(id)
  else parent.children.push(id)
  return id
}

const directoryOf = (tree: Tree, seen: Map<string, number>, segments: ReadonlyArray<string>): number | undefined =>
  segments.reduce<{ id: number | undefined; path: string }>(
    (state, segment) => {
      const path = state.path.length === 0 ? segment : `${state.path}/${segment}`
      const existing = seen.get(path)
      if (existing !== undefined) return { id: existing, path }
      const id = add(tree, {
        name: segment,
        path,
        parent: state.id,
        kind: "directory",
        fileIndex: undefined,
      })
      seen.set(path, id)
      return { id, path }
    },
    { id: undefined, path: "" },
  ).id

const compare = (tree: Tree, left: number, right: number): number => {
  const a = tree.nodes[left]
  const b = tree.nodes[right]
  if (a === undefined || b === undefined) return 0
  if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1
  return a.name.localeCompare(b.name)
}

export const buildTree = (paths: ReadonlyArray<string>): Tree => {
  const tree: Tree = { roots: [], nodes: [] }
  const seen = new Map<string, number>()
  paths.forEach((path, fileIndex) => {
    const segments = path.split("/").filter((segment) => segment.length > 0)
    const name = segments.at(-1)
    if (name === undefined) return
    const parent = directoryOf(tree, seen, segments.slice(0, -1))
    add(tree, { name, path, parent, kind: "file", fileIndex })
  })
  tree.roots.sort((left, right) => compare(tree, left, right))
  for (const node of tree.nodes) node.children.sort((left, right) => compare(tree, left, right))
  return tree
}

const chain = (tree: Tree, id: number): ReadonlyArray<TreeNode> => {
  const node = tree.nodes[id]
  if (node === undefined) return []
  const only = node.children.length === 1 ? tree.nodes[node.children[0] ?? -1] : undefined
  if (only === undefined || only.kind !== "directory") return [node]
  return [node, ...chain(tree, only.id)]
}

type Walk = {
  readonly tree: Tree
  readonly closed: ReadonlyArray<string>
  readonly rows: Array<TreeRow>
}

const visit = (walk: Walk, id: number, depth: number): void => {
  const node = walk.tree.nodes[id]
  if (node === undefined) return
  if (node.kind === "file") {
    walk.rows.push({
      id,
      depth,
      kind: "file",
      name: node.name,
      path: node.path,
      fileIndex: node.fileIndex,
      files: 1,
    })
    return
  }
  const collapsed = chain(walk.tree, id)
  const last = collapsed.at(-1) ?? node
  const name = collapsed.map((item) => item.name).join("/")
  walk.rows.push({
    id,
    depth,
    kind: "directory",
    name,
    path: last.path,
    fileIndex: undefined,
    files: filesUnder(walk.tree, last.id),
  })
  if (collapsed.some((step) => walk.closed.includes(step.path))) return
  for (const child of last.children) visit(walk, child, depth + 1)
}

export const flattenTree = (tree: Tree, closed: ReadonlyArray<string>): ReadonlyArray<TreeRow> => {
  const walk: Walk = { tree, closed, rows: [] }
  for (const root of tree.roots) visit(walk, root, 0)
  return walk.rows
}

const directFiles = (tree: Tree, id: number): number => {
  const node = tree.nodes[id]
  if (node === undefined) return 0
  return node.children.filter((child) => tree.nodes[child]?.kind === "file").length
}

export const filesUnder = (tree: Tree, id: number): number => {
  const node = tree.nodes[id]
  if (node === undefined) return 0
  if (node.kind === "file") return 1
  return node.children.reduce((total, child) => total + filesUnder(tree, child), 0)
}

export const crowdedDirectories = (tree: Tree, limit: number): ReadonlyArray<string> =>
  tree.nodes
    .filter((node) => node.kind === "directory" && directFiles(tree, node.id) > limit)
    .map((node) => node.path)



export const rowOfFile = (rows: ReadonlyArray<TreeRow>, fileIndex: number): number =>
  rows.findIndex((row) => row.fileIndex === fileIndex)
