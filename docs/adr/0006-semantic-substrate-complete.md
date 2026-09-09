# ADR 0006: Semantic Substrate Architecture — Provisionally Complete

**Status:** Accepted  
**Date:** 2026-09-09  
**Depends on:** RFC 0001–0005, findings/0001–0005

## Context

Five experiments have tested the SEMIR representation:

1. One assertion drives multiple projections
2. Structural relationships transfer across domains
3. Independently authored models compose
4. Type-level primitives cannot express instance rules (useful failure)
5. Six relational constructs solve that class

Each failure produced layering, not vocabulary growth. The architecture has stabilized.

## Decision

The SEMIR general semantic substrate is provisionally complete. It consists of:

```
Identity / provenance
       │
Structural kernel (12 predicates)
       │
Relational semantics (6 constraint constructs)
       │
Specialist extensions (quantitative, concurrent, operational)
```

Each layer has a distinct job:

| Layer | Question it answers |
|---|---|
| Identity / provenance | What semantic fact is this? Where did it come from? How certain is it? |
| Structural kernel | What concepts are related? |
| Relational semantics | Under what bindings is that relationship valid? |
| Specialist extensions | What additional semantic domain governs the relationship? |

### What is frozen

- **Structural kernel**: 12 predicates (`causes`, `requires`, `forbids`, `transitions_to`, `reads`, `writes`, `produces`, `occurs_before`, `authorized_by`, `must_hold`, `observable_within`, `exactly_once`)
- **Relational semantics**: 6 constraint constructs (`var`, `prop`, `equals`, `forall`, `at_most`, `and`)
- **Assertion model**: `Assertion` with `subject`, `predicate`, `object`, `conditions`, `constraint`, `evidence`, `epistemicStatus`
- **Projection architecture**: slice → lower → IR → render

### What is not frozen

- Specialist extensions (quantitative, concurrent, operational) — designed when demanded by concrete domains
- Projection implementations — improved as needed
- Conformance and extraction — next phase of experimentation

### Burden of proof for future changes

Further semantic capabilities SHOULD NOT be added to the kernel or relational layers unless a concrete experiment demonstrates that they cannot be represented as a specialist extension.

New predicates require:
1. Usefulness in three unrelated domains
2. Concrete projection or verification failure without it
3. No composition of existing primitives that suffices

New constraint constructs require:
1. Expressiveness pressure from a concrete test case
2. Failure of the existing 6 constructs
3. Staying within relational logic (no arbitrary computation)

## Consequences

### Positive

- Architecture is stable and documented
- Clear separation of concerns across layers
- Burden of proof prevents vocabulary bloat
- Experiments can now focus on conformance, not representation

### Negative

- Freezing the substrate may miss important semantic dimensions
- The 12 predicates may prove insufficient for domains not yet tested
- The constraint layer may need arithmetic or quantifier extensions

### Risks

- Premature freezing could stall useful evolution
- Mitigation: the burden-of-proof rule allows additions when evidence demands them
