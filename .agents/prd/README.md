# PRDs — adiff

Every runtime behavior in adiff is specified as a PRD before code is written. The PRD is the single
source of truth for what adiff does, what it accepts, what it refuses, and how that is verified.

PRDs are not the place for every implementation detail. Use the split below:

- `.agents/prd/` — stable behavior contracts.
- GitHub issues — implementation work items: file paths, helper names, test names, order.
- `.agents/adr/` — durable technical decisions: runtime, framework, testing strategy.

## How to read these PRDs

- Start with `000-overview.md`. It states the problem adiff exists for, maps every PRD onto the
  module that owns the behavior, and lists the cross-cutting concerns every PRD inherits.
- Read `CONTEXT.md` next. The glossary defines the vocabulary every PRD reuses. adiff has a short
  language on purpose; a synonym invented in a PRD is a defect.
- Read the PRD that owns the behavior. Follow its links to ADRs for durable choices and issues for
  implementation steps.

## How to write a new PRD

1. Copy `TEMPLATE.md` to the next free slot, for example `010-tool-something.md`.
2. Use the glossary from `CONTEXT.md`. Add new terms there instead of inventing them in the PRD.
3. Fill in every section. "None, because …" is a valid answer; a blank section is not.
4. Keep detail that will change quickly — file paths, helper names, function signatures, rollout
   order — out of the PRD. Put it in GitHub issues.
5. Keep durable runtime or architecture rationale out of the PRD. Put it in `.agents/adr/`.
6. If the PRD defers a decision, say so in **Implementation Decisions** and name the trigger that
   resolves it.
7. Add the PRD to the index in `000-overview.md`.

## What a PRD is, and isn't

A PRD **is**:

- A description of the observable behavior of one slice of adiff.
- A statement of contracts: inputs, outputs, errors, what reaches the agent.
- A list of acceptance tests framed as behavior, not implementation.
- A statement of what is out of scope.

A PRD **isn't**:

- A design document for internal helpers. Those evolve; pin them in code.
- A line-by-line description of the current implementation. Each decision is justified by the
  problem it solves, never by "this is how it works today".
- A schedule or a backlog. Those live in GitHub issues.
- An ADR. Runtime and framework rationale lives in `.agents/adr/`.

## Conventions

- 3-digit zero-padded prefixes. Gaps are allowed when PRDs merge, split, or retire. Renaming
  breaks cross-links; do not renumber an existing PRD.
- One PRD per orthogonal concern. Past ~200 lines, move implementation detail to an issue or
  durable rationale to an ADR.
- Active voice, in terms of "adiff …", "the terminal …", "the agent …" — never "we".
- Inline domain terms link to `CONTEXT.md` on first use: `[anchor](CONTEXT.md#anchor)`.
- Every PRD ends with `## Out of Scope` and `## Further Notes`, even when short. They signal
  completeness.

## Review checklist

Before treating a PRD as ready:

- [ ] Problem stated from the reviewer's or the agent's perspective, not the code's.
- [ ] Solution stated as observable behavior, before any implementation choice is named.
- [ ] User stories cover the happy path, the empty result, the refusal, and the stale case.
- [ ] Implementation Decisions are concrete enough that two engineers would build interchangeable
      implementations.
- [ ] File paths, helper names, and rollout order live in GitHub issues.
- [ ] Durable runtime or framework rationale lives in `.agents/adr/`.
- [ ] Testing Decisions describe behavior observable at one of the two boundaries in PRD 008.
- [ ] Out of Scope names behaviors a reader might expect but this PRD does not cover.
- [ ] All cross-references resolve.
