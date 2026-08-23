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
pnpm shot --local --keys "enter" --label "a branch open"   # the same, kept in shots/ and not uploaded
```

Node 26 or newer, always started with `--experimental-ffi` (ADR-001). Every entry point passes it.

## Rules the linter enforces

- **No comments in `src/`.** Only `// ARRANGE`, `// ACT`, `// ASSERT`, only in `*.test.ts`. A
  comment explaining code is a defect report against the code.
- **No import reaches past another module's `index.ts`.** This is what lets two agents work in two
  modules of one worktree without colliding.
- **No unit tests.** Assert on outcomes through the driver (ADR-003).
- **A test title opens `when …` or `then …` and names its subject.** The linter checks the shape
  and the subject slot. It cannot check the voice, which is the part that actually goes wrong: see
  **How to write here**.
- **No constructor parameter properties.** Node strips types rather than compiling them, so the
  syntax never runs even though `tsc` and vitest both accept it.

`tools/oxlint-adiff.ts` owns them, and `pnpm lint` proves each rule still fires before it checks
the code. `.agents/EFFECT.md` is the full contract.

## How to write here

Write for the reader, not for the sentence. Load the `plain-english` skill and follow it, for PR
bodies, change intents, PRD contracts, test titles and commit messages alike.

Three things that skill leaves out, which this repo gets wrong most often:

- Name the subject. "says so" and "that way" borrow a noun the reader cannot see.
- A pane shows, lists, marks, counts or reads. A command prints, names or exits.
- Give the reason in the plain case. An aphorism sounds like a reason and carries none.

A sentence you are pleased with is worth rereading.

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
