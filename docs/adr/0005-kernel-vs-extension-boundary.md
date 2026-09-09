# ADR 0005: Kernel vs. Specialist Extension Boundary

**Status:** Accepted  
**Date:** 2026-09-09  
**Depends on:** RFC 0001, RFC 0002, findings/0002-second-domain

## Context

The rate-limiter experiment (RFC 0002) produced 58% clean predicate transfer and identified four coherent gaps: continuous quantitative state, concurrency/atomicity, instance-level relationships, and operational semantics. All four gaps point outward from the structural kernel rather than arguing for kernel changes.

The question is where to draw the boundary.

## Decision

A semantic concept belongs in the **kernel** only if it expresses structural relationships that recur across materially different domains.

Semantics that require specialist interpretation, algebra, execution models, or verification machinery belong in **named extensions**.

### What stays in the kernel

The existing 12 predicates and 10 assertion kinds. The rate-limiter experiment confirmed they handle the structural core of two materially different domains (reservation workflow, rate limiter) without projection-specific rules.

### What belongs in extensions

| Concept | Extension | Observed in | Second example needed |
|---|---|---|---|
| Continuous quantitative state | Quantitative semantics | rate limiting | yes |
| Concurrency / atomicity | Concurrent semantics | rate limiting | yes |
| Instance-level relationships | Relational semantics | rate limiting | yes |
| Operational semantics | Operational semantics | rate limiting | yes |

Each gap is a hypothesis, not a confirmed extension. The extension vocabulary remains undecided until a second independent example confirms the gap is reusable.

### What the boundary means architecturally

```
             ┌────────────────────────┐
             │      Identity layer    │
             │ types / instances /    │
             │ assertions / evidence  │
             └────────────┬───────────┘
                          │
             ┌────────────▼───────────┐
             │    Structural kernel   │
             │ requires / causes /    │
             │ forbids / transitions  │
             └────────────┬───────────┘
                          │
       ┌──────────────────┼──────────────────┐
       ▼                  ▼                  ▼
 Quantitative         Concurrent        Operational
 semantics            semantics         semantics
```

The kernel provides identity, assertions, evidence, projection machinery, and structural relationships. Extensions add domain-specific semantics that preserve the same identity and projection contracts.

## Consequences

### Positive

- The kernel remains small and verifiable
- Extensions can be added, removed, or revised independently
- Projection diagnostics correctly report what each extension can and cannot represent
- The 58% transfer rate is a measurable baseline for future experiments

### Negative

- Four gaps remain unresolved hypotheses pending second examples
- The extension mechanism itself is not yet implemented
- Composition (next experiment) may reveal that instance-level identity belongs in the kernel, not an extension

### Risks

- Implementing extensions too early risks moving domain-specific overfitting one layer outward
- The instance-level identity gap may be more fundamental than the other three
