# Findings 0005: Minimal Constraint Calculus

**Status:** Complete  
**Date:** 2026-09-09  
**Depends on:** RFC 0005, findings/0004-instance-semantics

## Context

RFC 0005 asked: what is the smallest general constraint language that can express the three failed Experiment 04 cases without turning SEMIR into a programming language?

Three test cases were designed:
- A. Payment idempotency (count ≤ 1 per intent)
- B. Rate-limit ownership (request.client == bucket.owner)
- C. Reservation ownership (actor == reservation.owner)

## Constraint constructs used

| Construct | Used by | Count |
|---|---|---|
| variable (`var`) | all three | 3 |
| property access (`prop`) | all three | 6 |
| equality (`equals`) | all three | 4 |
| `forall` quantification | all three | 3 |
| `at_most` cardinality | idempotency | 1 |
| logical `and` | idempotency | 1 |

**Total: 6 distinct construct kinds.** Below the 10-construct target.

Not used: `not_equals`, `lt`, `lte`, `gt`, `gte`, `or`, `not`, `exists`, `at_least`, `literal` (as standalone — only inside `eq`).

## Rendered constraints

### Reservation ownership (Test Case C)

```text
∀r: a == r.owner
```

Meaning: for every reservation `r`, the actor `a` must equal `r.owner`.

Structural assertion: `PayReservation authorized_by ReservationOwner`  
Constraint refinement: `actor == reservation.owner`

### Idempotency (Test Case A)

```text
∀p: at_most 1 c [(c.intent == p ∧ c.status == "successful")]
```

Meaning: for every payment intent `p`, there is at most one charge `c` where `c.intent == p` and `c.status == "successful"`.

Structural assertion: `AttemptCharge forbids ChargeCreated`  
Constraint refinement: `at most one successful charge per intent`

### Rate-limit ownership (Test Case B)

Not modeled in the TypeScript example (would require the rate-limiter entities), but the same pattern applies:

```text
∀b: q.client == b.owner
```

## What the experiment validated

### 1. Constraints are subordinate to assertions ✓

The assertion `PayReservation authorized_by ReservationOwner` retains its structural meaning. The constraint `∀r: a == r.owner` refines it. Projections see both layers.

### 2. Six constructs express all three cases ✓

The minimal vocabulary is: `var`, `prop`, `equals`, `forall`, `at_most`, `and`. This is smaller than a typical SQL WHERE clause and far smaller than a programming language.

### 3. Constraints survive round-trip ✓

The constraint AST serializes to JSON and deserializes without loss. The `.semir` format can represent constraints as structured YAML.

### 4. No new structural predicates needed ✓

The existing 12 predicates handle the structural assertions. Constraints add relational refinement without modifying the predicate vocabulary.

### 5. Domain independence ✓

Rename Reservation → Document, Owner → Editor, PayReservation → ModifyDocument. The constraint machinery (`∀r: a == r.owner`) is domain-independent.

## What the experiment revealed

### The constraint layer is orthogonal to the structural kernel

Structural assertions describe what concepts are related. Constraints describe under what bindings that relationship is valid. These are independent concerns that compose cleanly.

### Cardinality is the hardest construct

`at_most` was the only construct used by exactly one test case (idempotency). But it is essential — without it, the model cannot express "at most one charge per intent." The pressure suggests cardinality belongs in the core constraint vocabulary, not as a specialist extension.

### Arithmetic is not needed yet

None of the three test cases required addition, subtraction, or comparison of numeric values. The constraint layer stays in relational logic, not computational algebra.

## Pressure ledger

| Construct | Reservation ownership | Rate-limit ownership | Idempotency | Decision |
|---|---|---|---|---|
| variables | needed | needed | needed | **core** |
| property access | needed | needed | needed | **core** |
| equality | needed | needed | needed | **core** |
| forall | maybe | maybe | needed | **core** |
| at_most | no | no | needed | **core** |
| and | no | no | needed | **core** |
| arithmetic | no | no | not yet | **deferred** |
| user functions | no | no | no | **out of scope** |
| exists | maybe | maybe | no | **deferred** |
| or | no | no | no | **deferred** |
| not | no | no | no | **deferred** |

## Architecture (final)

```
Identity / provenance
       │
Structural kernel
requires / causes / forbids / transitions / ...
       │
Relational semantics (constraint layer)
variables / binding / equality / quantification / cardinality
       │
Specialist extensions
quantitative / concurrent / operational
```

## Summary

| Criterion | Result |
|---|---|
| Three Experiment 04 failures expressible | ✓ |
| No new structural predicates | ✓ |
| Constraints attach to assertions | ✓ |
| Constraints survive round-trip | ✓ |
| Domain independent | ✓ |
| Cannot express arbitrary computation | ✓ |
| Primitive vocabulary small (6 constructs) | ✓ |
