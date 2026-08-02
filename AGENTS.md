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
pnpm install
pnpm check          # typecheck, lint, style rules, tests
pnpm typecheck
pnpm lint           # oxlint + scripts/check-style.ts
pnpm test
pnpm review         # adiff review --repo .
```

Node 26 or newer, always started with `--experimental-ffi` (ADR-001). Every entry point in the
repo passes it.

## Two rules the linter owns, and why

- **No comments in `src/`.** `// ARRANGE`, `// ACT`, `// ASSERT` in `*.test.ts` are the only
  exceptions. A comment explaining code is a defect report against the code.
- **No import may reach past another module's `index.ts`.** This is what lets two agents work in
  two modules of one worktree without colliding.

Both are enforced by `scripts/check-style.ts`, alongside a third rule `tsc` cannot see: Node runs
TypeScript by stripping types, so syntax that needs emit — constructor parameter properties —
never runs, even though `tsc` and vitest both accept it.

## More Detail

- Agent workflow: `.agents/OPERATING.md`
- PRD workflow: `.agents/prd/README.md`
- Runtime overview for humans: `ARCHITECTURE.md`
- What adiff is for: `.agents/prd/000-overview.md`
