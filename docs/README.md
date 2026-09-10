# SEMIR Engineering Documents

This directory contains the engineering documentation for **SEMIR**, a proposed semantic intermediate representation for software systems.

SEMIR is intended to represent **what an implementation must preserve** rather than how a particular implementation happens to be structured. The model is designed to support multiple projections—human-readable, executable, and formal—from the same semantic facts.

## Document map

| Document | Purpose | Status |
| --- | --- | --- |
| [`vision.md`](vision.md) | Long-term thesis, principles, scope, and conceptual architecture | Draft |
| [`plans/semir-mvp.md`](plans/semir-mvp.md) | Implementation plan for proving the core hypothesis with the reservation/payment example | Proposed |
| [`adr/0001-assertions-as-semantic-unit.md`](adr/0001-assertions-as-semantic-unit.md) | Why semantic assertions are the fundamental unit of the model | Proposed |
| [`adr/0002-projection-specific-ir.md`](adr/0002-projection-specific-ir.md) | Why projections lower through projection-specific intermediate representations | Proposed |
| [`adr/0003-storage-and-serialization-neutrality.md`](adr/0003-storage-and-serialization-neutrality.md) | Why the semantic model is independent of storage and surface syntax | Proposed |
| [`adr/0005-kernel-vs-extension-boundary.md`](adr/0005-kernel-vs-extension-boundary.md) | Where the kernel ends and specialist extensions begin | Accepted |
| [`adr/0006-semantic-substrate-complete.md`](adr/0006-semantic-substrate-complete.md) | Semantic substrate architecture — provisionally complete | Accepted |
| [`rfcs/0001-semir-v0.md`](rfcs/0001-semir-v0.md) | Normative technical design for the SEMIR v0 kernel and projection architecture | Proposed |
| [`rfcs/0002-second-domain-experiment.md`](rfcs/0002-second-domain-experiment.md) | Adversarial second-domain experiment to test kernel domain-independence | Complete |
| [`rfcs/0003-composition-experiment.md`](rfcs/0003-composition-experiment.md) | Can independently authored models compose while preserving identity? | Complete |
| [`rfcs/0004-instance-semantics-experiment.md`](rfcs/0004-instance-semantics-experiment.md) | Can SEMIR represent instance identity, bindings, and relational semantics? | Complete |
| [`rfcs/0005-constraint-calculus.md`](rfcs/0005-constraint-calculus.md) | Minimal relational constraint language for instance semantics | Complete |
| [`rfcs/0006-conformance-experiment.md`](rfcs/0006-conformance-experiment.md) | Can SEMIR connect meaning to implementation evidence? | Complete |
| [`rfcs/0007-brownfield-extraction.md`](rfcs/0007-brownfield-extraction.md) | Can SEMIR recover candidate assertions from existing code? | Complete |
| [`rfcs/0008-llm-interpretation.md`](rfcs/0008-llm-interpretation.md) | Can an LLM infer latent semantics from structured evidence? | Complete |
| [`rfcs/0009-identity-reconciliation.md`](rfcs/0009-identity-reconciliation.md) | Can inferred semantic concepts be reconciled into stable identities? | Complete |
| [`rfcs/0010-role-aware-identity.md`](rfcs/0010-role-aware-identity.md) | Can assertion identity be defined over semantic roles, not entity similarity? | Complete |
| [`findings/0010-role-aware-identity.md`](findings/0010-role-aware-identity.md) | Role-aware reconciliation — 0% false-collapse, deterministic structural matching | Complete |
| [`rfcs/0011-extracted-vs-intended.md`](rfcs/0011-extracted-vs-intended.md) | Can SEMIR compare extracted and intended models and classify differences? | Complete |
| [`findings/0011-extracted-vs-intended.md`](findings/0011-extracted-vs-intended.md) | Comparison — 0% false violation rate, evidence-first correspondences | Complete |
| [`findings/0001-mvp-validation.md`](findings/0001-mvp-validation.md) | What the MVP implementation revealed — evidence, not decisions | Complete |
| [`findings/0002-second-domain.md`](findings/0002-second-domain.md) | Rate limiter experiment — kernel gaps and specialist extensions | Complete |
| [`findings/0003-composition.md`](findings/0003-composition.md) | Composition experiment — cross-domain identity, slicing, contradictions | Complete |
| [`findings/0004-instance-semantics.md`](findings/0004-instance-semantics.md) | Instance semantics — type-level boundary, constraint layer hypothesis | Complete |
| [`findings/0005-constraint-calculus.md`](findings/0005-constraint-calculus.md) | Constraint calculus — 6 constructs express all instance-level pressure | Complete |
| [`findings/0006-conformance.md`](findings/0006-conformance.md) | Conformance — evidence-based implementation verification | Complete |
| [`findings/0007-brownfield-extraction.md`](findings/0007-brownfield-extraction.md) | Extraction — 50% recall, 82% precision, ambiguity preserved | Complete |
| [`findings/0008-llm-interpretation.md`](findings/0008-llm-interpretation.md) | LLM interpretation — 100% recall, 93% precision, latent synthesis | Complete |
| [`findings/0009-identity-reconciliation.md`](findings/0009-identity-reconciliation.md) | Reconciliation — merge precision 100%, false-collapse on shared state names | Complete |

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
