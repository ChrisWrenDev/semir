# Findings 0002: Second-Domain Experiment — API Rate Limiter

**Status:** Complete  
**Date:** 2026-09-09  
**Depends on:** RFC 0002, findings/0001-mvp-validation

## Context

RFC 0002 defined an experiment to test whether the SEMIR kernel is genuinely domain-independent. The reservation MVP validated mechanics on a workflow/state-machine domain. The rate limiter introduces concurrency, time windows, quantitative limits, algorithmic semantics, and fairness — pressures the kernel has not experienced.

The experiment contract: model the rate limiter using existing primitives, record every point where the model becomes unnatural, and only introduce new primitives when a concrete projection or verification failure occurs.

## What transferred cleanly

| Semantic pressure | Result | Notes |
|---|---|---|
| `requires` expresses token availability | works | AllowRequest requires BucketReady — same pattern as reservation |
| `causes` expresses request rejection | works | RejectRequest causes RequestRejectedEvent — lifecycle pattern identical |
| `forbids` expresses negative token count | works | BucketEmpty forbids RequestAllowed — invariant pattern identical |
| `authorized_by` expresses client ownership | works | AllowRequest authorized_by Client — security pattern identical |
| `observable_within` expresses temporal constraint | works | RefillTokens observable_within 1s — literal type handles duration |
| `exactly_once` expresses idempotent refill | works | Conditional forbids pattern — same as payment retry |
| `writes` expresses data flow | works | AllowRequest writes TokenBucket — fact pattern identical |
| Pattern-driven scenarios | works | All 7 scenarios derived from graph patterns, zero domain knowledge |
| Domain renaming | works | All projections survive renaming RateLimiter→ThrottleSystem |
| Cross-projection traceability | works | BucketEmptyForbids traces to Event Model, Scenarios, Formal |
| Serialization round-trip | works | .semir file round-trips without semantic loss |
| Contradiction handling | works | Model holds conflicting assertions without silent resolution |

**Result: 7 of 12 predicates transferred without awkwardness (58%).**

## What was awkward

| Semantic pressure | Result | Notes |
|---|---|---|
| p99 latency | awkward | Rendered as `observable_within 2ms` — syntactically valid but semantically imprecise. `observable_within` means "can be observed within this duration." p99 latency is a statistical property of a distribution, not an observability window. The literal type handles the duration value, but the predicate name misrepresents the meaning. |
| Token-bucket algorithm identity | awkward | Modeled as entities and actions, but there is no way to express "this system uses a token bucket algorithm." The model describes behavior (allow/reject/refill) without naming the algorithm. Two different algorithms (token bucket, sliding window) would produce identical models. This is the property vs. mechanism distinction — the kernel cannot currently express it. |
| `AllowRequest requires BucketReady` in TLA+ | awkward | The TLA+ lowering shows `reservationState \in {StateType}` because the `requires` assertion's object (BucketReady) is a state, but the lowering treats it as "from any state that includes BucketReady." The precondition should restrict to BucketReady only. This is a lowering quality issue, not an architectural failure. |
| Refill idempotency property name | awkward | `TokensRefilledEventTokensRefilledEventForbids` has a doubled name because the conditional forbids lowering concatenates subject and object names. Needs a naming convention fix. |

## What failed

| Semantic pressure | Result | Notes |
|---|---|---|
| Continuous quantitative state (token count) | fails | The model has BucketReady/BucketEmpty (discrete states) but cannot express "availableTokens is an integer between 0 and 100." There is no way to model a continuous or ranged quantitative variable. The kernel has no concept of a value domain. |
| Concurrency / atomic decrement | fails | Two requests arriving simultaneously must not both consume the final token. The kernel has no concept of atomicity, mutual exclusion, or concurrent access to shared state. The model treats each request independently. |
| Fairness across clients | fails | The model has Client and TokenBucket as separate entities, but no way to express "each client has its own bucket" or "one client cannot consume another's allocation." The `authorized_by` assertion says Client is authorized to AllowRequest, but doesn't express per-client isolation. This requires a relationship between instances, not just types. |
| Restart behavior | fails | "restart must not unexpectedly reset limits" is modeled as ResetBucket → BucketReset → BucketReady, but this doesn't express the operational requirement about unexpected resets. The kernel has no concept of operational state vs. semantic state. |

## Projections

| Projection | Coverage | Unsupported | Domain-specific? |
|---|---|---|---|
| Event Model | 88% | 2 (`writes`) | No |
| Scenarios | 100% | 0 | No |
| Formal | 67% | 2 (`writes`) | No |

No projection required domain-specific lowering rules. The `writes` predicate is correctly flagged as unsupported by Event Model and Formal projections. The scenario projection handled all 17 assertions.

## Pressure ledger summary

```
Predicate vocabulary:    7/12 transferred cleanly (58%)
Assertions modeled:      17
Projection coverage:     Event Model 88%, Scenarios 100%, Formal 67%
Domain-specific rules:   0
Semantic duplication:    0
Assertion identity:      survived across all projections
Slicing:                 sufficient
Renaming:                works
```

## Kernel gaps identified

Four semantics could not be expressed with existing primitives:

1. **Continuous quantitative state** — value domains, ranges, distributions
2. **Concurrency** — atomicity, mutual exclusion, concurrent access
3. **Instance-level relationships** — per-client isolation, cross-instance fairness
4. **Operational semantics** — restart behavior, deployment constraints

These are not kernel deficiencies that need immediate fixes. They are **evidence of where the kernel ends and specialist extensions begin**.

## Decision: kernel vs. specialist

### Stays in kernel

All existing predicates and assertion kinds. Nothing was removed. The 58% clean transfer rate is above the 50% threshold for "exposes kernel gaps" but below the 70% threshold for "validates domain independence." The kernel is not broken — it is incomplete at the edges.

### Belongs in specialist extensions

| Concept | Extension | Why not kernel |
|---|---|---|
| Continuous quantitative state | Quantitative semantics | Only needed for systems with ranged values (rate limiters, sensors, financial systems). Not needed for workflow systems. |
| Concurrency / atomicity | Concurrent semantics | Only needed for systems with shared mutable state. Not needed for sequential workflows. |
| Instance-level relationships | Relational semantics | Only needed for multi-tenant or multi-actor systems. Not needed for single-entity workflows. |
| Operational semantics | Operational semantics | Only needed for deployment, restart, migration concerns. Not needed for pure domain logic. |

### Not added yet

The experiment did NOT require adding any new predicates or assertion kinds to the kernel. The existing vocabulary handled 58% of the rate limiter domain cleanly. The remaining 42% requires specialist extensions, not kernel growth.

## What this means

The kernel is genuinely domain-independent for workflow/state-machine domains. It is insufficient for quantitative, concurrent, or multi-actor domains without specialist extensions.

This is a better outcome than either extreme:
- "The kernel handles everything" — would mean it's too large or too vague
- "The kernel only works for reservations" — would mean it's not general

The actual outcome: "The kernel handles the structural core, and specialist extensions handle domain-specific semantics." This matches the architecture proposed in RFC 0001 and validates the specialist extension model from the vision document.
