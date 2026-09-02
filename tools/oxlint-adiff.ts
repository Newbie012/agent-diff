const SECTION = /^ (ARRANGE|ACT|ASSERT)$/

const MODULE_ROOTS = new Set(["domain", "service", "tui"])

const relative = (context) => {
  const parts = context.filename.split("/")
  const at = parts.lastIndexOf("src")
  return at < 0 ? context.filename : parts.slice(at).join("/")
}

const moduleOf = (path) => {
  const parts = path.split("/")
  const at = parts.lastIndexOf("src")
  if (at < 0) return undefined
  const inside = parts.slice(at)
  if (!MODULE_ROOTS.has(inside[1])) return undefined
  return inside.slice(0, 3).join("/")
}

const resolved = (from, specifier) => {
  const dir = from.slice(0, from.lastIndexOf("/"))
  return new URL(specifier, `file:///${dir}/`).pathname.slice(1)
}

const noComments = {
  meta: {
    schema: [
      {
        type: "object",
        properties: { sections: { type: "boolean" } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const sections = context.options[0]?.sections === true
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (sections && SECTION.test(comment.value)) continue
          context.report({ loc: comment.loc, message: "code explains itself; a comment is a defect report against it" })
        }
      },
    }
  },
}

const moduleBoundary = {
  create(context) {
    const here = relative(context)
    const mine = moduleOf(here)
    return {
      ImportDeclaration(node) {
        const specifier = node.source.value
        if (typeof specifier !== "string" || !specifier.startsWith(".")) return
        const target = moduleOf(resolved(here, specifier))
        if (target === undefined || target === mine) return
        if ([target, `${target}/index`, `${target}/index.ts`].includes(resolved(here, specifier))) return
        context.report({ node, message: `${specifier} reaches past ${target}/index.ts` })
      },
    }
  },
}

const noParameterProperties = {
  create(context) {
    return {
      MethodDefinition(node) {
        if (node.kind !== "constructor") return
        for (const param of node.value.params) {
          if (param.type !== "TSParameterProperty") continue
          context.report({ node: param, message: "node strips types only; a parameter property does not run" })
        }
      },
    }
  },
}

const isBlank = (line) => line.trim().length === 0

const oneBlankLine = {
  create(context) {
    return {
      Program() {
        const lines = context.sourceCode.lines
        for (const [index, line] of lines.entries()) {
          if (index === 0 || !isBlank(line) || !isBlank(lines[index - 1] ?? "x")) continue
          context.report({
            loc: { start: { line: index + 1, column: 0 }, end: { line: index + 1, column: 1 } },
            message: "one blank line separates, never two",
          })
        }
      },
    }
  },
}

const blankAtEdges = {
  create(context) {
    return {
      Program() {
        const lines = context.sourceCode.lines
        for (const [index, line] of lines.entries()) {
          const previous = lines[index - 1] ?? ""
          const next = lines[index + 1] ?? ""
          if (!isBlank(line)) continue
          const opens = previous.trimEnd().endsWith("{")
          const closes = next.trimStart().startsWith("}")
          if (!opens && !closes) continue
          context.report({
            loc: { start: { line: index + 1, column: 0 }, end: { line: index + 1, column: 1 } },
            message: opens ? "a block does not open on a blank line" : "a block does not close after a blank line",
          })
        }
      },
    }
  },
}

const rankOf = (specifier) => {
  if (specifier.startsWith("node:")) return 0
  if (!specifier.startsWith(".")) return 1
  return 2
}

const importOrder = {
  create(context) {
    let rank = 0
    return {
      ImportDeclaration(node) {
        const specifier = node.source.value
        if (typeof specifier !== "string") return
        const next = rankOf(specifier)
        if (next < rank) {
          context.report({ node, message: `${specifier} belongs above the imports before it` })
        }
        rank = Math.max(rank, next)
      },
    }
  },
}

const pascal = (word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`

const areaOf = (path) => {
  const parts = path.split("/")
  if (parts[1] === "main.ts") return "Main"
  if (parts[1] === "cli") return "Cli"
  if (parts[1] === "review") return "Review"
  if (parts[1] === "tui") return "Tui"
  if (parts[1] === "domain" || parts[1] === "service") return pascal(parts[2] ?? "")
  return undefined
}

const isEffectFn = (node) =>
  node.callee.type === "MemberExpression" &&
  node.callee.object.name === "Effect" &&
  ["fn", "fnUntraced"].includes(node.callee.property.name)

const spanName = {
  create(context) {
    const area = areaOf(relative(context))
    return {
      CallExpression(node) {
        if (area === undefined || !isEffectFn(node)) return
        const first = node.arguments[0]
        if (first?.type !== "Literal" || typeof first.value !== "string") return
        if (first.value.startsWith(`${area}.`)) return
        context.report({ node: first, message: `"${first.value}" should read "${area}.something"` })
      },
    }
  },
}

const isServiceTag = (node) =>
  node.callee.type === "CallExpression" &&
  node.callee.callee.type === "MemberExpression" &&
  node.callee.callee.object.name === "Context" &&
  node.callee.callee.property.name === "Service"

const serviceTag = {
  create(context) {
    return {
      CallExpression(node) {
        if (!isServiceTag(node)) return
        const first = node.arguments[0]
        if (first?.type !== "Literal" || typeof first.value !== "string") return
        if (first.value.startsWith("adiff/")) return
        context.report({ node: first, message: `"${first.value}" should read "adiff/${first.value}"` })
      },
    }
  },
}

const effectNotPromises = {
  create(context) {
    const report = (node, what) =>
      context.report({ node, message: `${what} belongs in an Effect here, not a promise` })
    return {
      AwaitExpression: (node) => report(node, "await"),
      FunctionDeclaration: (node) => (node.async ? report(node, "async") : undefined),
      FunctionExpression: (node) => (node.async ? report(node, "async") : undefined),
      ArrowFunctionExpression: (node) => (node.async ? report(node, "async") : undefined),
      NewExpression: (node) => (node.callee.name === "Promise" ? report(node, "new Promise") : undefined),
    }
  },
}

const NO_SUBJECT = /^(?:when|then) (it|its|they|them|that|those|this)\b/
const HOLLOW = /\b(says so|that way|adiff says)\b/

const titleOf = (node) => {
  if (node.callee.type !== "Identifier") return undefined
  if (node.callee.name !== "describe" && node.callee.name !== "test") return undefined
  const first = node.arguments[0]
  return first?.type === "Literal" && typeof first.value === "string" ? first : undefined
}

const faultIn = (said, lead) => {
  if (!said.startsWith(lead)) return `a title here opens "${lead}…"`
  const hollow = HOLLOW.exec(said)
  if (hollow !== null) return `"${hollow[0]}" leaves out the noun it stands for; name it`
  const bare = NO_SUBJECT.exec(said)
  return bare === null ? undefined : `"${bare[1]}" stands where the subject should be; name it`
}

const testTitle = {
  create(context) {
    return {
      CallExpression(node) {
        const said = titleOf(node)
        if (said === undefined) return
        const fault = faultIn(said.value, node.callee.name === "describe" ? "when " : "then ")
        if (fault !== undefined) context.report({ node: said, message: fault })
      },
    }
  },
}

export default {
  meta: { name: "adiff" },
  rules: {
    "no-comments": noComments,
    "module-boundary": moduleBoundary,
    "no-parameter-properties": noParameterProperties,
    "one-blank-line": oneBlankLine,
    "blank-at-edges": blankAtEdges,
    "import-order": importOrder,
    "span-name": spanName,
    "service-tag": serviceTag,
    "effect-not-promises": effectNotPromises,
    "test-title": testTitle,
  },
}
