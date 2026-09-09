# RFC 0004: Instance Semantics Experiment

**Status:** Complete  
**Target:** SEMIR instance/binding semantics  
**Last updated:** 2026-09-09  
**Depends on:** RFC 0001–0003, findings/0001–0003

## 1. Summary

Three experiments have validated SEMIR at the type level:

1. One model drives multiple projections
2. The structural kernel transfers across domains
3. Independently authored models compose

All three operate on semantic types: `Reservation`, `PayReservation`, `PaymentAccepted`. Real software behavior operates on instances: "payment request #8172 for reservation #42 from customer #91."

This experiment asks:

> **Can SEMIR represent the semantics of concrete instances and their relationships, or does type-level identity become insufficient at execution scope?**

The hypothesis to falsify is: type-level semantic assertions are sufficient for all engineering projections.

## 2. Motivation

Instance identity sits underneath several things SEMIR eventually needs:

- runtime traces
- concurrency and race conditions
- causality and event correlation
- exactly-once behavior
- idempotency
- resource ownership
- multi-tenancy
- distributed tracing

Consider payment idempotency:

```text
Type level:
    PaymentRetry forbids DuplicateCharge

Instance level:
    For the same payment intent P:
    Charge(P) may happen at most once
```

The type-level statement is useful but incomplete. The meaningful property requires binding a variable `P` and quantifying over it.

Similarly, rate-limit ownership:

```text
Type level:
    Client owns TokenBucket

Instance level:
    request.client == bucket.owner
```

This requires equality over instance references, not just type relationships.

The experiment determines whether these pressures require kernel changes, a constraint layer, or remain outside SEMIR's scope.

## 3. Experiment contract

### 3.1 What is frozen

- Predicate vocabulary (12 predicates)
- AssertionKind vocabulary (10 kinds)
- Core types
- Projection architecture

### 3.2 What is not frozen

- The `.semir` format (can add instance notation)
- Conditions (may need extension)
- Test infrastructure

### 3.3 Three test cases

Each tests a different aspect of instance identity:

#### A. Payment idempotency

```text
Two attempts with the same PaymentIntent
must cause at most one successful charge.
```

Tests: variable binding, quantification (count ≤ 1), correlation across events.

#### B. Rate-limit ownership

```text
A request consumes tokens only from
the bucket associated with its client.
```

Tests: cross-object equality, instance-level authorization, relational binding.

#### C. Reservation ownership

```text
The actor authorizing PayReservation
must be the owner of that specific reservation.
```

Tests: instance-level precondition, identity comparison, owner-of relationship.

### 3.4 Pressure ledger

| Requirement | Existing model | Result |
|---|---|---|
| owner may pay own reservation | conditional assertion | **fails** at instance level |
| same payment intent charged once | type-level forbids with condition | **fails** — needs variable binding + quantification |
| request uses own bucket | type-level authorized_by | **fails** — needs cross-object equality |
| two distinct clients isolated | type-level security assertion | **fails** — needs quantified relation |
| rename all domain concepts | pattern-driven projections | **works** |

**0 of 4 instance-level requirements expressible. 1 of 5 checks pass.**

## 4. What to try before adding primitives

### 4.1 Existing conditions

The current `Condition` type can express some instance relationships:

```yaml
conditions:
  - subject: sem://reservation/action/pay-reservation
    predicate: holds_when
    object: sem://reservation/state/paid
```

Try expressing instance ownership through conditions before adding new predicates.

### 4.2 Assertion targets

The `AssertionTarget` type already supports literals and references. Try expressing instance identity as structured metadata on assertions.

### 4.3 Specialist metadata

Try attaching instance-binding information as evidence or attributes rather than as kernel predicates.

## 5. What the experiment might reveal

### 5.1 Hypothesis: predicate addition is the wrong solution

If the pressure response is "add `same_instance`", that's probably wrong. The deeper requirement may be:

```text
for Reservation r
for Actor a

PayReservation(r, a)
    requires owner(r) == a
```

That's not a predicate — it's a variable binding with equality and scope. It suggests a constraint layer:

```
Semantic graph
    identities + assertions + relationships

Constraint layer
    variables + bindings + equality + quantification
```

### 5.2 Hypothesis: instances are projection metadata

If the pressure response is "instances don't belong in the semantic model at all," that's also worth knowing. It would mean SEMIR is purely a type-level IR and instance semantics belong in projections or implementations.

### 5.3 Hypothesis: one missing abstraction covers all three cases

If payment idempotency, rate-limit ownership, and reservation ownership all require the same mechanism, that mechanism is probably fundamental. If they require different mechanisms, the pressure is probably specialist.

## 6. Acceptance criteria

All five must be met:

### 6.1 Concrete identity can be represented

SEMIR can distinguish Reservation A from Reservation B within one semantic statement without domain-specific predicates.

### 6.2 Relationships can bind identities

It can express `actor == reservation.owner` rather than merely `PayReservation authorized_by ReservationOwner`.

### 6.3 Correlation survives projections

A scenario can derive:

```text
Given Alice owns reservation A
And Bob owns reservation B
When Alice attempts to pay reservation B
Then payment is rejected
```

from generic semantics.

### 6.4 Formal projection preserves meaning

TLA+ retains the relationship rather than collapsing to `Owner may pay`.

### 6.5 No domain-specific machinery

Rename Reservation → Document, Owner → Editor, PayReservation → ModifyDocument. The same mechanism still works.

## 7. What NOT to do

- Do not build arbitrary runtime modeling
- Do not add `instance_of`, `same_instance`, `correlates_by` preemptively
- Do not add a constraint language yet — first determine if one is needed
- Do not add code generation
- Do not add LLM extraction

## 8. Deliverables

1. `examples/instances/instances.semir` — the model
2. Updated pressure ledger in this RFC
3. Findings: `docs/findings/0004-instance-semantics.md`
4. Decision: does SEMIR need a constraint layer, kernel additions, or nothing?

## 9. After this experiment

If instances work:

1. Pivot to implementation conformance (Experiment 05)
2. The constraint layer, if needed, becomes a first-class architectural component

If instances fail:

1. Record whether the failure is architectural (kernel incomplete) or principled (instances don't belong in semantic graphs)
2. Design minimal additions
3. Re-run the experiment
