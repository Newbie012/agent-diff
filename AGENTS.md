# AGENTS.md

adiff is a terminal for reviewing the work an agent did in a git worktree, and for handing the
review comments back to that agent.

Talk tachles: be concise, direct, and practical.

## Order of work

**PRD → failing test → code.** Runtime behavior is specified before it is built.

1. `.agents/prd/000-overview.md` maps every behavior to its PRD. Read the one that owns yours, and
   update it in the same change. If none owns it, write one first.
2. `.agents/prd/CONTEXT.md` is the glossary. Never invent a word it already has.
3. Write the failing test first, and watch it fail for the right reason. It asserts what a reviewer
   or an agent can observe — never an internal call, an intermediate value, or a private function.
   `describe("when …")` and `test("then …")`, each naming its subject rather than leaning on "it",
   "them" or "that way": the title is read on a PR page and on a recording's title card, with
   nothing beside it. `adiff/test-title` enforces it.
4. Then the code. Then `pnpm check`.

`.agents/prd/` holds behavior contracts, `.agents/adr/` durable decisions, GitHub issues the work.

## Commands

```bash
pnpm install        # needs pnpm 12: npm i -g --allow-scripts=pnpm pnpm@next-12
pnpm check          # typecheck, lint, build, tests — run before saying it is done
pnpm review         # the terminal, on this repo
pnpm simulate       # the terminal, on a synthetic repo (--probe for headless)
pnpm pr-summary     # the `## What changed` block for this branch
pnpm shot --keys "enter text:l" --label "a layer opened"   # screenshot the terminal
```

Node 26 or newer, always started with `--experimental-ffi` (ADR-001). Every entry point passes it.

## Rules the linter enforces

- **No comments in `src/`.** Only `// ARRANGE`, `// ACT`, `// ASSERT`, only in `*.test.ts`. A
  comment explaining code is a defect report against the code.
- **No import reaches past another module's `index.ts`.** This is what lets two agents work in two
  modules of one worktree without colliding.
- **No unit tests.** Assert on outcomes through the driver (ADR-003).
- **A test title opens `when …` or `then …` and names its subject.** No pronoun standing where the
  subject belongs, no "says so", no "that way", and never "adiff says" — name the surface that
  shows it: the footer, the header, the diff, the rail, the output.
- **No constructor parameter properties.** Node strips types rather than compiling them, so the
  syntax never runs even though `tsc` and vitest both accept it.

`tools/oxlint-adiff.ts` owns them, and `pnpm lint` proves each rule still fires before it checks
the code. `.agents/EFFECT.md` is the full contract.

## Shipping

A change a reviewer would notice needs a change intent in `.changeset/`; a refactor, a test or a
doc does not. A release consumes its intents and deletes them, so that directory holds only what
has not shipped. Read `.claude/skills/release-notes/SKILL.md` before writing one and before opening a
PR — it holds the entry format, the PR template, and the rule that nothing private ever reaches a
public PR.

## More

| Need | Read |
| --- | --- |
| How to make a change here, in order | `.agents/OPERATING.md` |
| What adiff is for | `.agents/prd/000-overview.md` |
| How the code is laid out | `ARCHITECTURE.md` |
| What an agent in a worktree should do | `skills/adiff/SKILL.md` |
