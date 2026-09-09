# Findings 0004: Instance Semantics Experiment

**Status:** Complete  
**Date:** 2026-09-09  
**Depends on:** RFC 0004, findings/0001–0003

## Context

RFC 0004 asked whether SEMIR can represent instance identity, bindings, and relational semantics. Three test cases were designed to pressure different aspects of identity:

- A. Payment idempotency (same PaymentIntent → at most one charge)
- B. Rate-limit ownership (request.client == bucket.owner)
- C. Reservation ownership (actor == reservation.owner)

The experiment tried to express all three with existing primitives before considering additions.

## Pressure ledger

### Test Case A: Payment idempotency

| Requirement | Existing model | Result |
|---|---|---|
| Duplicate charge prevention | `BlockDuplicate forbids ChargeCreated` with condition | works (type level) |
| Two attempts with same intent → one charge | requires variable binding | **fails** |
| Count charges per intent ≤ 1 | requires quantification | **fails** |
| Correlate AttemptCharge to PaymentIntent | requires equality check | **fails** |

The type-level statement `BlockDuplicate forbids ChargeCreated (when Charged)` is useful but incomplete. It prevents all duplicate charges, not just duplicates for the same intent. The meaningful property requires:

```text
for PaymentIntent P:
    count(Charge where intent == P) <= 1
```

This needs: variable binding (`P`), equality (`intent == P`), quantification (`count <= 1`).

### Test Case B: Rate-limit ownership

| Requirement | Existing model | Result |
|---|---|---|
| Client authorized to check rate limit | `CheckRateLimit authorized_by Client` | works (type level) |
| Request uses own client's bucket | requires cross-object equality | **fails** |
| request.client == bucket.owner | requires instance binding | **fails** |

The type-level `authorized_by` says "any Client can check any rate limit." The meaningful property requires:

```text
for Request r, Bucket b:
    r.client == b.owner → may_check(r, b)
```

### Test Case C: Reservation ownership

| Requirement | Existing model | Result |
|---|---|---|
| Owner authorized to pay | `PayReservation authorized_by ReservationOwner` | works (type level) |
| Authorization tied to reservation state | condition: `Reservation holds_when Active` | works (type level) |
| Actor IS the owner of THIS reservation | requires instance equality | **fails** |

The condition `Reservation holds_when Active` ties authorization to the reservation being active, but not to the actor owning that specific reservation. The meaningful property requires:

```text
for Reservation r, Actor a:
    owner(r) == a → may_pay(a, r)
```

### Summary

| Requirement | Result |
|---|---|
| Owner may pay own reservation | **fails** at instance level |
| Same payment intent charged once | **fails** — requires variable binding + quantification |
| Request uses own bucket | **fails** — requires cross-object equality |
| Two distinct clients isolated | **fails** — requires quantified relation |
| Rename all concepts | **works** — type-level patterns survive |

**0 of 4 instance-level requirements expressible with existing primitives.**

## What this means

### The model is type-level, not instance-level

SEMIR currently operates on semantic types: `Reservation`, `PayReservation`, `PaymentAccepted`. It cannot express relationships between instances of those types: "reservation #42 owned by actor #91."

This is not a bug. It is a boundary. The question is whether the boundary belongs in the kernel, in a constraint layer, or outside SEMIR entirely.

### Three distinct pressures, one missing abstraction

The three test cases all require the same underlying mechanism:

| Test case | What's needed |
|---|---|
| Idempotency | `for P: count(Charge where intent=P) <= 1` |
| Rate-limit ownership | `request.client == bucket.owner` |
| Reservation ownership | `owner(reservation) == actor` |

All three require: **variable binding + equality + scope**. This is not a predicate — it is a small constraint language.

### The missing abstraction is not another predicate

Adding `same_instance` or `instance_of` would not solve the problem. The idempotency case requires quantification (`count <= 1`), which is fundamentally different from a binary relationship.

The pressure points toward a **constraint layer**:

```
Semantic graph
    identities + assertions + relationships

Constraint layer
    variables + bindings + equality + quantification
```

### Conditions partially bridge the gap

The existing `Condition` type can express some instance-adjacent semantics:

```yaml
conditions:
  - subject: sem://instance/entity/reservation
    predicate: holds_when
    object: sem://instance/state/active
```

This ties an assertion to a state, which is closer to instance-level than bare type-level assertions. But it cannot express equality between two objects or quantify over instances.

## Decision

### What stays in the kernel

The existing 12 predicates and type-level assertion machinery. The experiment confirmed they handle the structural core of instance semantics (type-level ownership, authorization, lifecycle) without modification.

### What belongs in a constraint layer

Variable binding, equality, scope, and quantification. These are not domain-specific — they are fundamental to expressing instance-level properties across any domain.

### What belongs in specialist extensions

The three RFC 0002 gaps (quantitative, concurrent, operational) remain specialist. The instance gap is different: it is architectural, not domain-specific.

### Revised architecture

```
             ┌────────────────────────┐
             │      Identity layer    │
             │ types / assertions /   │
             │ evidence / provenance  │
             └────────────┬───────────┘
                          │
             ┌────────────▼───────────┐
             │    Structural kernel   │
             │ requires / causes /    │
             │ forbids / transitions  │
             └────────────┬───────────┘
                          │
             ┌────────────▼───────────┐
             │    Constraint layer    │
             │ variables / bindings / │
             │ equality / quantifiers │
             └────────────┬───────────┘
                          │
       ┌──────────────────┼──────────────────┐
       ▼                  ▼                  ▼
 Quantitative         Concurrent        Operational
 semantics            semantics         semantics
```

## Validated properties (updated)

| Property | Evidence |
|---|---|
| Shared assertion identity drives multiple projections | MVP |
| Structural kernel transfers across domains | Rate limiter (58%) |
| Cross-domain composition works | Composition experiment |
| Type-level ownership/authorization expressible | Instance experiment |
| **Instance-level identity requires constraint layer** | **Instance experiment** |

## Still unresolved

| Gap | Status |
|---|---|
| Constraint layer design | Hypothesis, not designed |
| Quantitative semantics | Specialist extension |
| Concurrency semantics | Specialist extension |
| Operational semantics | Specialist extension |
| Implementation conformance | Next major experiment |
