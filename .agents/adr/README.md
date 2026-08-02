# ADRs — adiff

An ADR records a durable technical decision: why adiff runs on the runtime it does, why it is built
the way it is, why it is tested the way it is. ADRs explain choices that outlive any one feature.

- `.agents/prd/` — behavior contracts. What adiff does.
- `.agents/adr/` — durable technical decisions. Why it is built this way.
- GitHub issues — implementation work items. How to do a slice now.

## Index

| ADR | Decision |
| --- | --- |
| [ADR-001](ADR-001-node-26-runtime.md) | Node 26 with `--experimental-ffi` as the runtime |
| [ADR-002](ADR-002-effect-v4-and-module-boundaries.md) | Effect v4, and modules sealed behind `index.ts` |
| [ADR-003](ADR-003-blackbox-testdriver.md) | Black-box tests through a TestDriver, and no unit tests |

## Writing one

Copy `TEMPLATE.md` to `ADR-NNN-short-title.md`. Every section is required.

**Alternatives Considered** is the section that makes an ADR worth writing. An ADR without serious
alternatives is a description of what happened, not a decision — and it gives a future reader
nothing to reason with when the context changes.

**Revisit When** names the signal that should reopen the question. An ADR with no revisit condition
is a decision nobody can ever safely revisit.

## Status

`proposed`, `accepted`, or `superseded by ADR-NNN`. Do not delete a superseded ADR; the reasoning
that was replaced is part of the record.
