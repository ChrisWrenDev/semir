# RFC 0003: Composition Experiment — Reservation × Rate Limiter

**Status:** Proposed  
**Target:** SEMIR compositionality validation  
**Last updated:** 2026-09-09  
**Depends on:** RFC 0001, RFC 0002, ADR 0005

## 1. Summary

The MVP validated that one model produces multiple projections. The rate-limiter experiment validated that the kernel transfers across materially different domains. Neither experiment tested whether independently authored semantic models can compose.

This RFC defines that experiment.

The question is:

> **Can independently meaningful semantic models interact without collapsing into one global graph or losing identity?**

If the answer is yes, SEMIR can scale from toy domains to real software systems. Compositionality is what determines whether the architecture is a modeling technique or a genuine intermediate representation.

## 2. Motivation

Real software systems are not monolithic semantic graphs. They are composed of subsystems:

- a reservation service depends on a rate limiter
- a payment service depends on a fraud detector
- an API gateway depends on authentication and rate limiting

Each subsystem has its own semantic model, authored independently, owned by different teams, evolving at different rates.

If SEMIR cannot compose these models while preserving identity, locality, and projection behavior, it cannot represent real systems. It would be limited to single-subsystem modeling, which is useful but not transformative.

## 3. Experiment contract

### 3.1 What is frozen

The same items frozen in RFC 0002:

- Predicate vocabulary (12 predicates)
- AssertionKind vocabulary (10 kinds)
- Core types
- Projection architecture

### 3.2 What is not frozen

- The `.semir` format (can add composition syntax)
- Slicing (may need cross-boundary traversal)
- Test infrastructure

### 3.3 Composition scenario

Build a system where:

```
Client
  │
  ▼
RateLimitCheck
  │
  ├── allowed ───────► PayReservation
  │
  └── rejected ──────► HTTP 429
```

The models are authored independently:

```
reservation.semir       — the reservation domain
rate-limiter.semir      — the rate limiting domain
```

A composition file or mechanism brings them together:

```
reservation-service.semir  — or a composition directive
```

## 4. Acceptance criteria

All five must be met:

### 4.1 Stable identities survive composition

```
sem://reservation/action/pay
sem://ratelimit/action/check
```

remain independently addressable. No rewriting into synthetic global IDs. No namespace collision.

### 4.2 Cross-model assertions are possible

Without either subsystem knowing the internals of the other:

```yaml
- id: composition/pay-requires-rate-limit
  subject: sem://reservation/action/pay
  predicate: requires
  object: sem://ratelimit/state/request-allowed
  kind: precondition
```

This assertion lives in the composition layer, not in either subsystem model.

### 4.3 Projections can traverse boundaries

A scenario should be derivable:

```
Given the client has exhausted its request allowance
When it attempts to pay a reservation
Then the request is rejected
And no payment is attempted
```

Without hardcoding "reservation + rate limiter" in the scenario builder.

### 4.4 Slicing remains local

```
semir explain sem://reservation/action/pay
```

should include relevant rate-limit semantics because they are dependencies, but not pull in every rate-limiter implementation fact (refill timing, bucket capacity, etc.).

This puts serious pressure on the slicing model.

### 4.5 Contradictions can cross subsystem boundaries

Suppose:

```
Reservation model:
    PayReservation requires authenticated owner

API gateway model:
    unauthenticated requests may reach PayReservation
```

SEMIR should represent that semantic mismatch explicitly.

## 5. What this will likely expose

### 5.1 Semantic binding

The rate limiter doesn't just relate to PayReservation as a type. It applies to a particular request/client instance. Composition will likely reveal a distinction between:

- **semantic type**: `PayReservation` (the concept)
- **semantic occurrence**: `this payment attempt` (a specific instance)
- **semantic binding**: `PayReservation for client X` (type + context)

This connects to the "instance-level relationships" gap from RFC 0002. Composition may reveal it belongs in the kernel, not an extension.

### 5.2 Cross-boundary slicing

The slicer currently follows assertion references within one model. Composition requires following references across model boundaries. This may need a new slicing primitive:

```yaml
composition:
  imports:
    - rate-limiter.semir
  bindings:
    - from: sem://reservation/action/pay
      requires: sem://ratelimit/state/request-allowed
```

### 5.3 Projection boundary awareness

Projections currently operate on a single slice. With composition, a projection may need to know which subsystem a semantic object belongs to in order to render correctly. The Event Model might show rate limiting as a separate swim lane.

## 6. What NOT to do

- Do not design the specialist extensions yet — composition may change which gaps belong where
- Do not add a third standalone domain — composition is the higher-value risk
- Do not implement code generation — not where SEMIR's differentiation lies
- Do not add LLM extraction — the IR must survive on its own merits

## 7. Deliverables

1. `examples/composition/reservation-service.semir` — the composed model
2. `examples/composition/reservation.semir` — independent reservation model
3. `examples/composition/rate-limiter.semir` — independent rate limiter model
4. Updated findings: `docs/findings/0003-composition.md`
5. Decision: does instance-level identity belong in kernel or extension?

## 8. After this experiment

If composition works:

1. Revisit the four extension gaps with three-domain evidence
2. Investigate semantic diff / impact analysis
3. Investigate implementation conformance
4. Then — and only then — brownfield semantic extraction

If composition fails:

1. Record exactly where it failed
2. Determine whether the failure is architectural (kernel incomplete) or mechanical (slicing/projection limitation)
3. Design minimal additions that address the failures
4. Re-run the experiment
