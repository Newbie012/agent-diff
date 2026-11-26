import { fileURLToPath } from "node:url"
import { Context, Effect, Layer, Option } from "effect"
import { Language, Parser, type Node } from "web-tree-sitter"
import { GrammarUnreadable } from "./error.ts"
import type { Declaration } from "./model.ts"

type Found = { readonly runtime: string | undefined; readonly typescript: string; readonly tsx: string }

type Grammars = { readonly typescript: Language; readonly tsx: Language }

type Shape = {
  readonly functions: (path: string, lines: ReadonlyArray<string>) => Effect.Effect<ReadonlyArray<Declaration>>
}

export class Syntax extends Context.Service<Syntax, Shape>()("adiff/Syntax") {}

const TYPESCRIPT = /\.[mc]?ts$/

const TSX = /\.tsx$/

const NAMED_FUNCTIONS = new Set(["function_declaration", "generator_function_declaration", "method_definition"])

const HOLDING_A_FUNCTION = new Set(["variable_declarator", "public_field_definition"])

const FUNCTION_VALUES = new Set(["arrow_function", "function_expression", "generator_function"])

const besideThis = (path: string): string => fileURLToPath(new URL(`./grammars/${path}`, import.meta.url))

const onDisk: Effect.Effect<Found> = Effect.sync(() => ({
  runtime: undefined,
  typescript: besideThis("typescript/tree-sitter-typescript.wasm"),
  tsx: besideThis("tsx/tree-sitter-tsx.wasm"),
}))

const embedded: Effect.Effect<Found> = Effect.all({
  runtime: Effect.promise(() => import("web-tree-sitter/tree-sitter.wasm", { with: { type: "file" } })),
  typescript: Effect.promise(() =>
    import("./grammars/typescript/tree-sitter-typescript.wasm", { with: { type: "file" } }),
  ),
  tsx: Effect.promise(() => import("./grammars/tsx/tree-sitter-tsx.wasm", { with: { type: "file" } })),
}).pipe(
  Effect.map((loaded) => ({
    runtime: loaded.runtime.default,
    typescript: loaded.typescript.default,
    tsx: loaded.tsx.default,
  })),
)

const compiled = (): boolean => process.versions["bun"] !== undefined

const started = (found: Found): Promise<void> =>
  found.runtime === undefined ? Parser.init() : Parser.init({ locateFile: () => found.runtime ?? "" })

const readFrom = <A>(path: string, load: () => Promise<A>): Effect.Effect<A, GrammarUnreadable> =>
  Effect.tryPromise({ try: load, catch: (cause) => new GrammarUnreadable({ path, reason: String(cause) }) })

const loaded = Effect.fn("Syntax.loaded")(function* (found: Found) {
  yield* readFrom(found.runtime ?? "web-tree-sitter", () => started(found))
  const grammars: Grammars = yield* Effect.all(
    {
      typescript: readFrom(found.typescript, () => Language.load(found.typescript)),
      tsx: readFrom(found.tsx, () => Language.load(found.tsx)),
    },
    { concurrency: "unbounded" },
  )
  return grammars
})

const grammarsLoaded = Effect.suspend(() => (compiled() ? embedded : onDisk)).pipe(
  Effect.flatMap(loaded),
  Effect.option,
)

const grammarOf = (grammars: Grammars, path: string): Option.Option<Language> => {
  if (TSX.test(path)) return Option.some(grammars.tsx)
  if (TYPESCRIPT.test(path)) return Option.some(grammars.typescript)
  return Option.none()
}

const holdsFunction = (node: Node): boolean => {
  const value = node.childForFieldName("value")
  return value !== null && FUNCTION_VALUES.has(value.type)
}

const declared = (node: Node): Option.Option<Declaration> => {
  const named = NAMED_FUNCTIONS.has(node.type) || (HOLDING_A_FUNCTION.has(node.type) && holdsFunction(node))
  const name = named ? node.childForFieldName("name")?.text : undefined
  if (name === undefined) return Option.none()
  return Option.some({ name, start: node.startPosition.row + 1, end: node.endPosition.row + 1 })
}

const declarationsUnder = (node: Node): ReadonlyArray<Declaration> => [
  ...Option.toArray(declared(node)),
  ...node.namedChildren.flatMap((child) => (child === null ? [] : declarationsUnder(child))),
]

const parsed = (language: Language, lines: ReadonlyArray<string>): ReadonlyArray<Declaration> => {
  const parser = new Parser()
  parser.setLanguage(language)
  const tree = parser.parse(lines.join("\n"))
  const found = tree === null ? [] : declarationsUnder(tree.rootNode)
  tree?.delete()
  parser.delete()
  return found
}

const functionsWith =
  (grammars: Effect.Effect<Option.Option<Grammars>>) =>
  (path: string, lines: ReadonlyArray<string>): Effect.Effect<ReadonlyArray<Declaration>> =>
    Effect.map(grammars, (ready) =>
      Option.match(Option.flatMap(ready, (loadedGrammars) => grammarOf(loadedGrammars, path)), {
        onNone: (): ReadonlyArray<Declaration> => [],
        onSome: (language) => parsed(language, lines),
      }),
    )

const makeSyntax = Effect.fn("Syntax.make")(function* () {
  const grammars = yield* Effect.cached(grammarsLoaded)
  return { functions: functionsWith(grammars) } satisfies Shape
})

export const SyntaxLive: Layer.Layer<Syntax> = Layer.effect(Syntax)(makeSyntax())
