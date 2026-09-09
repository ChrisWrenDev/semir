# SEMIR Engineering Documents

This directory contains the engineering documentation for **SEMIR**, a proposed semantic intermediate representation for software systems.

SEMIR is intended to represent **what an implementation must preserve** rather than how a particular implementation happens to be structured. The model is designed to support multiple projections—human-readable, executable, and formal—from the same semantic facts.

## Document map

| Document | Purpose | Status |
| --- | --- | --- |
| [`vision.md`](vision.md) | Long-term thesis, principles, scope, and conceptual architecture | Draft |
| [`rfcs/0001-semir-v0.md`](rfcs/0001-semir-v0.md) | Normative technical design for the SEMIR v0 kernel and projection architecture | Proposed |
| [`plans/semir-mvp.md`](plans/semir-mvp.md) | Implementation plan for proving the core hypothesis with the reservation/payment example | Proposed |
| [`adr/0001-assertions-as-semantic-unit.md`](adr/0001-assertions-as-semantic-unit.md) | Why semantic assertions are the fundamental unit of the model | Proposed |
| [`adr/0002-projection-specific-ir.md`](adr/0002-projection-specific-ir.md) | Why projections lower through projection-specific intermediate representations | Proposed |
| [`adr/0003-storage-and-serialization-neutrality.md`](adr/0003-storage-and-serialization-neutrality.md) | Why the semantic model is independent of storage and surface syntax | Proposed |
| [`adr/0005-kernel-vs-extension-boundary.md`](adr/0005-kernel-vs-extension-boundary.md) | Where the kernel ends and specialist extensions begin | Accepted |
| [`rfcs/0002-second-domain-experiment.md`](rfcs/0002-second-domain-experiment.md) | Adversarial second-domain experiment to test kernel domain-independence | Complete |
| [`rfcs/0003-composition-experiment.md`](rfcs/0003-composition-experiment.md) | Can independently authored models compose while preserving identity? | Complete |
| [`findings/0001-mvp-validation.md`](findings/0001-mvp-validation.md) | What the MVP implementation revealed — evidence, not decisions | Complete |
| [`findings/0002-second-domain.md`](findings/0002-second-domain.md) | Rate limiter experiment — kernel gaps and specialist extensions | Complete |
| [`findings/0003-composition.md`](findings/0003-composition.md) | Composition experiment — cross-domain identity, slicing, contradictions | Complete |

## Recommended reading order

1. Read the **vision** to understand the problem and intended destination.
2. Read **RFC 0001** for the proposed v0 semantics and architectural contracts.
3. Read the **MVP plan** for implementation order and acceptance criteria.
4. Read the **MVP findings** for what the implementation actually revealed.
5. Consult the **ADRs** for the rationale behind decisions that should remain stable even as implementation details evolve.

## Document ownership

The documents intentionally have different rates of change:

- `vision.md` should change rarely and only when the underlying thesis changes.
- RFCs define proposed or accepted engineering contracts and should change through review.
- plans are operational and may change as implementation reveals new information.
- ADRs record durable decisions and should normally be superseded rather than rewritten after acceptance.
- findings record empirical evidence and should be updated when new evidence contradicts or extends existing findings.

## Working rule

> **No projection owns semantic truth.**

The SEMIR model owns semantic identities and assertions. Event models, tests, formal specifications, documentation, telemetry mappings, and future code generators are projections or consumers of subsets of that model.
