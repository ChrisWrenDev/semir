# Findings 0003: Composition Experiment — Reservation × Rate Limiter

**Status:** Complete  
**Date:** 2026-09-09  
**Depends on:** RFC 0003, findings/0001-mvp-validation, findings/0002-second-domain

## Context

RFC 0003 asked: can independently authored semantic models compose while preserving identity, locality, traceability, and generic projection behavior?

Two independent models were authored:
- `reservation.semir` — 9 objects, 9 assertions (workflow domain)
- `rate-limiter.semir` — 9 objects, 8 assertions (quantitative domain)

A composition model `reservation-service.semir` combines both with 6 cross-boundary assertions, including a deliberate contradiction.

## Acceptance criteria results

### 1. Stable identities survive composition ✓

All IDs from both domains remain independently addressable:

```
sem://reservation/action/pay-reservation
sem://ratelimit/action/check-rate-limit
```

No namespace collision. No rewriting into synthetic global IDs. The `sem://` prefix already provides namespace isolation.

### 2. Cross-model assertions are possible ✓

Six cross-boundary assertions were authored without either subsystem knowing the internals of the other:

```yaml
# PayReservation requires rate limit approval
subject: sem://reservation/action/pay-reservation
predicate: requires
object: sem://ratelimit/state/bucket-ready

# Rate limit rejection blocks payment
subject: sem://ratelimit/event/request-rejected
predicate: forbids
object: sem://reservation/event/payment-accepted
```

These assertions live in the composition layer (`sem://composition/...`), not in either subsystem.

### 3. Projections traverse boundaries ✓

The scenario projection derived cross-boundary scenarios:

```
Scenario: RequestRejected does not lead to PaymentAccepted
  Given the system is in RequestRejected state
  When a transition is attempted
  Then the system does NOT transition to PaymentAccepted
```

This scenario was not hand-coded. It was derived from the cross-boundary `forbids` assertion using the same pattern-driven machinery as single-domain scenarios.

The Event Model shows cross-boundary edges:
- `PayReservation --requires--> BucketReady`
- `RequestRejected --forbids--> PaymentAccepted`
- `PayWithRateLimit --causes--> CheckRateLimit`

### 4. Slicing remains local ✓

`semir explain` on `PayReservation requires Active` shows:
- Event Model: `PayReservation --requires--> Active`
- Scenarios: `PayReservation lifecycle`

It does NOT pull in every rate-limiter fact (refill timing, bucket capacity, etc.). Slicing follows assertion references and stops at boundaries unless a cross-boundary assertion connects them.

### 5. Contradictions cross subsystem boundaries ✓

The model holds:
- `PayReservation authorized_by ReservationOwner` (validated)
- `CheckRateLimit authorized_by ReservationOwner` (conflicting)

The conflicting assertion represents: the reservation model requires owner auth, but the API gateway allows unauthenticated requests through the rate limit layer. Both assertions coexist. Projections surface the validated version.

## What this reveals

### Composition works with existing primitives

No new predicates, assertion kinds, or core types were needed. The 12 existing predicates handled cross-boundary relationships naturally:

- `requires` across domains: `PayReservation requires BucketReady`
- `forbids` across domains: `RequestRejected forbids PaymentAccepted`
- `causes` across domains: `PayWithRateLimit causes CheckRateLimit`
- `authorized_by` across domains: `CheckRateLimit authorized_by ReservationOwner`

### The `sem://` prefix provides implicit namespace isolation

IDs like `sem://reservation/action/pay` and `sem://ratelimit/action/check` are inherently disambiguated by their namespace. No additional namespacing mechanism was needed.

### Pattern-driven scenarios handle cross-boundary patterns

The `RequestRejected does not lead to PaymentAccepted` scenario was derived from the same invariant pattern (State `forbids` State) as single-domain scenarios. The pattern matcher does not care which domain the states belong to.

### The composition layer is thin

Only 6 cross-boundary assertions were needed to connect two 8-9 assertion domains. The composition is additive, not transformative — it adds relationships between existing concepts without modifying either domain.

## What remains unresolved

### Instance-level binding

The composition models types (`PayReservation`, `CheckRateLimit`) but not instances (`this payment for client X`). The cross-boundary assertion `PayReservation requires BucketReady` says "every payment requires rate limit approval" but doesn't express "this specific payment for this specific client."

This is the same "instance-level relationships" gap identified in RFC 0002. Composition did not resolve it — it made it more visible.

### Slicing depth across boundaries

The current slicing follows references to a fixed depth. With deep cross-boundary chains (A requires B requires C requires D), slicing may either pull in too much or stop too early. This was not tested at scale.

### Projection boundary awareness

The Event Model shows all cross-boundary edges in one flat graph. For large compositions, this would benefit from swim lanes or subsystem grouping. This is a rendering concern, not an architectural one.

## Decision: instance-level identity

Composition did NOT reveal that instance-level identity belongs in the kernel. The gap remains visible but unresolved. The current model handles type-level composition cleanly. Instance-level binding may require:

- A `binding` concept: `PayReservation for client X`
- Or an `instance` concept: `this PaymentAttempt`

But one experiment is not enough to decide. The hypothesis stands:

> Instance-level identity/binding is a reusable semantic dimension, observed in rate limiting and composition. Needs a second independent example before design.

## Summary

| Criterion | Result |
|---|---|
| Stable identities survive | ✓ |
| Cross-model assertions | ✓ |
| Projections traverse boundaries | ✓ |
| Slicing remains local | ✓ |
| Cross-boundary contradictions | ✓ |
| New primitives needed | 0 |
| Domain-specific projection rules | 0 |

**Composition works with existing primitives.** The kernel handles cross-domain relationships without modification. The architecture scales from single domains to composed systems.

## Validated properties

The following are now validated across three experiments (MVP, rate limiter, composition):

| Property | Evidence |
|---|---|
| Shared assertion identity drives multiple projections | MVP: one model → Mermaid, Gherkin, TLA+ |
| Structural kernel transfers across domains | Rate limiter: 58% clean predicate transfer |
| Cross-domain composition preserves identity and locality | Composition: 6 cross-boundary assertions, zero new primitives |
| Pattern-driven projections contain zero domain knowledge | All three experiments: rename test passes |
| Contradictions are represented explicitly | All three experiments: conflicting assertions coexist |
| Slicing isolates relevant semantics | All three experiments: explain shows dependencies only |

## Still unresolved

| Gap | Observed in | Hypothesis |
|---|---|---|
| Instance/binding semantics | Rate limiter, composition | May require constraint layer |
| Continuous quantitative state | Rate limiter | Belongs in specialist extension |
| Concurrency/atomicity | Rate limiter | Belongs in specialist extension |
| Operational semantics | Rate limiter | Belongs in specialist extension |
