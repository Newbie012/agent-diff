# Operating — working in adiff

How to make a change here, in order. `AGENTS.md` is the short version; this is what it points at.

## The order

**PRD → ADR if needed → failing test → code.**

1. **Find the PRD that owns the behavior.** `.agents/prd/000-overview.md` maps every behavior to
   one. If none owns it, write one before writing code — that is what "PRD-driven" means here, and
   it is cheaper than discovering mid-implementation that the behavior conflicts with another PRD.
2. **Check the glossary.** `.agents/prd/CONTEXT.md`. If the thing being built needs a new word, add
   it there first. A synonym invented in passing is how a codebase ends up with lanes, chapters,
   and trays meaning the same thing.
3. **Write an ADR if the choice is durable.** Runtime, framework, testing strategy, anything a
   future reader would otherwise have to reverse-engineer from the code.
4. **Open a GitHub issue for the slice.** File paths, helper names, order of work, caveats. Link
   the PRD it implements.
5. **Write the failing test first.** It asserts what a reviewer or an agent can observe. Run it and
   watch it fail for the right reason — a test that passes before the code exists is testing
   something else.
6. **Write the code.** Then `npm run check`.

## Changing behavior that a PRD already describes

Update the PRD in the same change. A PRD that describes behavior the code no longer has is worse
than no PRD, because it is read as true.

If the PRD turns out to be wrong rather than incomplete, fix the PRD first, in its own commit. The
reasoning should be reviewable separately from the code that follows from it.

## What goes where

| It is… | It goes in… |
| --- | --- |
| What adiff does, observably | `.agents/prd/` |
| Why adiff is built this way | `.agents/adr/` |
| How to do this slice, now | A GitHub issue |
| A word adiff uses | `.agents/prd/CONTEXT.md` |
| How the code is laid out | `ARCHITECTURE.md` |
| What an agent in a worktree should do | `skills/adiff/SKILL.md` |

## Constraints that are not negotiable

These are enforced, not advised. Each exists because the alternative already caused a bug.

- **No comments in `src/`.** Only `// ARRANGE`, `// ACT`, `// ASSERT` in tests. A comment
  explaining code is a defect report against that code — fix the naming instead.
- **No import may reach past another module's `index.ts`.** This is what makes two agents in one
  worktree safe.
- **No constructor parameter properties.** Node strips types rather than compiling them, so the
  syntax does not run — even though `tsc` and vitest both accept it.
- **No unit tests.** See [ADR-003](adr/ADR-003-blackbox-testdriver.md).
- **Assert on outcomes.** The snippet the agent received, not that a function was called.

## Before saying it is done

```bash
npm run check
```

Typecheck, lint, style rules, and the full suite. Report what actually happened: if a test fails,
say so with the output; if part of the slice was skipped, say which part and why.
