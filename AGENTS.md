# AGENTS.md

adiff is a terminal for reviewing the work an agent did in a git worktree, and for handing the
review comments back to that agent.

Talk tachles: be concise, direct, and practical.

## Start Here

This repo is PRD-driven. Runtime behavior must be specified in `.agents/prd/` before code changes.

Before changing behavior:

1. Read `.agents/prd/000-overview.md`.
2. Read `.agents/prd/CONTEXT.md`. Never invent a word for something the glossary already names.
3. Read the PRD that owns the behavior.
4. Read the linked GitHub issue and `.agents/adr/` files when implementation scope or durable
   decisions matter.
5. Write the failing test first. It asserts what a reviewer or an agent can observe — never an
   internal call, an intermediate value, or a private function.

Keep the split clean:

- `.agents/prd/` — behavior contracts.
- GitHub issues — implementation work items.
- `.agents/adr/` — durable technical decisions.

## Commands

```bash
npm install -g --allow-scripts=pnpm pnpm@next-12   # corepack cannot install pnpm 12 yet
pnpm install
pnpm check          # typecheck, lint, style rules, build, tests
pnpm build          # bundle the CLI into dist/main.js, which is what an install runs
pnpm typecheck
pnpm lint           # oxlint, custom rules included, then proves each rule fires
pnpm test
pnpm review            # the terminal, on this repo
pnpm simulate          # the terminal, on a synthetic repo (--probe for headless)
```

Node 26 or newer, always started with `--experimental-ffi` (ADR-001). Every entry point in the
repo passes it.

## Two rules the linter owns, and why

- **No comments in `src/`.** `// ARRANGE`, `// ACT`, `// ASSERT` in `*.test.ts` are the only
  exceptions. A comment explaining code is a defect report against the code.
- **No import may reach past another module's `index.ts`.** This is what lets two agents work in
  two modules of one worktree without colliding.

Both are oxlint rules, in the plugin at `tools/oxlint-adiff.ts`, alongside a third rule `tsc`
cannot see: Node runs TypeScript by stripping types, so syntax that needs emit, such as constructor
parameter properties, never runs even though `tsc` and vitest both accept it.

`.agents/EFFECT.md` is the whole contract, and `pnpm lint` proves every custom rule still fires
before it checks the code.

## More Detail

- Agent workflow: `.agents/OPERATING.md`
- PRD workflow: `.agents/prd/README.md`
- Runtime overview for humans: `ARCHITECTURE.md`
- What adiff is for: `.agents/prd/000-overview.md`
