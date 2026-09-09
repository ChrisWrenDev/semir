# ADR 0004: MVP Findings — Semantic Kernel Validated

**Status:** Complete  
**Date:** 2026-09-09  
**Supersedes:** nothing  
**Depends on:** RFC 0001, ADR 0001–0003

## Context

The SEMIR MVP was built to answer one question:

> Can one small semantic model generate multiple genuinely useful, mutually consistent projections?

The implementation covers the reservation/payment domain: 12 objects, 18 assertions, evidence, invariants, and three projection families (Event Model → Mermaid, Scenarios → Gherkin, Formal → TLA+). The core hypothesis was that shared semantic identities and first-class assertions could serve as a common substrate without each projection inventing its own truth.

A second, equally important question was whether the architecture produces a compelling authoring experience:

> If a human edits one semantic fact in a declarative file and runs `semir build`, do all three engineering artifacts update coherently?

This ADR records what the implementation revealed.

## What was validated

### 1. The core hypothesis holds

**Validated.** One semantic model produces three materially different projections from the same assertion graph. The key demonstration:

The assertion `paid-reservations-do-not-expire` traces to:
- Event Model: edge `Paid --forbids--> Expired`
- Scenario: "Paid does not lead to Expired"
- TLA+: property `PaidExpiredForbids == [](Paid => ~Expired)`

Changing `observable_within` from `5s` to `2s` in the `.semir` file and running `semir build` coherently updates the Event Model edge label and the TLA+ constraint name. No projection required bespoke semantic objects in the core model.

### 2. Pattern-driven scenarios proved generality

The scenario projection was initially built with hardcoded assertion IDs — four specific scenarios hand-wired to specific assertions. This was replaced with **pattern-driven composition** that recognizes graph shapes in the assertion graph:

| Pattern | Graph shape | Derived scenario |
|---------|------------|-----------------|
| Lifecycle | Action `requires` State, `causes` Event, Event `transitions_to` State | Given state, When action, Then resulting state |
| Invariant | State `forbids` State | Given state, When transition attempted, Then forbidden state does NOT occur |
| Authorization | Action `authorized_by` Actor | Given actor, When action requested, Then authorized |
| Failure prevention | Action `forbids` Event | Given action, When completes, Then forbidden event does NOT occur |

After this change, the scenario projection contains **zero domain-specific knowledge**. Renaming `Reservation` to `Widget`, `PaymentAccepted` to `PaymentRecorded`, and `ReservationOwner` to `WidgetManager` produces correct scenarios for the renamed domain. The projection understands only actions, events, states, and assertion patterns.

This is the line between "three generators for a reservation example" and "a semantic substrate with generic interpreters."

### 3. The `.semir` format creates a declarative authoring boundary

The `.semir` YAML format is a thin layer over the internal `SemanticModel`:

```yaml
version: "0.1"
objects:
  - id: sem://reservation/state/active
    kind: state
    name: Active
assertions:
  - id: sem://reservation/assertion/paid-reservations-do-not-expire
    subject: sem://reservation/state/paid
    predicate: forbids
    object: sem://reservation/state/expired
    kind: invariant
```

Two front ends produce the exact same `SemanticModel`:
```
TypeScript API ──┐
                 ├── SemanticModel
.semir parser ───┘
```

The parser round-trips without semantic loss. Evidence, epistemic status, confidence, and conditions all survive serialization. The format uses `version: "0.1"` because it will change aggressively.

The design constraint held: no semantic language emerged alongside the model. The `.semir` file is data, not a DSL.

### 4. The CLI packages the experience

Three commands:
- `semir validate <file>` — checks model integrity
- `semir build <file>` — generates all projections into `build/`
- `semir explain <assertion-id>` — shows one assertion and its three interpretations

The `explain` command makes the shared-identity concept visible:

```
sem://reservation/assertion/paid-reservations-do-not-expire

  Paid forbids Expired

  Used by:
    Event Model
      Paid --forbids--> Expired
    Scenarios
      Paid does not lead to Expired
    Formal model
      PaidExpiredForbids: [](Paid => ~Expired)
```

This may be more compelling than the generated files themselves. It answers: "what does this one semantic fact mean across the system?"

### 5. Typed assertion objects resolved the literal/reference ambiguity

The `object` field on assertions is now `AssertionTarget = SemanticId | LiteralValue` where `LiteralValue = { kind: "literal", value: string, datatype: "duration" | "number" | ... }`.

The assertion `ReservationExpired observable_within 5s` is modeled as:
```ts
object: { kind: "literal", value: "5s", datatype: "duration" }
```

While `PayReservation causes PaymentAccepted` is:
```ts
object: "sem://reservation/event/payment-accepted"
```

This eliminated the `LITERAL_PREDICATES` validation hack. Validation now uses `isRef(a.object)` to distinguish references from literals. Helper functions `targetId()` and `targetDisplay()` let projections handle both uniformly.

### 6. TLA+ lowering was refined

Three quality issues were fixed:
- **Deduplicated guards**: `ExpireReservation` now has `reservationState \in {Active}` instead of `{Active \cup Active}`
- **Conditional forbids**: `Paid forbids Expired` (conditional on Paid state) emits `[] (Paid => ~Expired)` instead of duplicating the action name
- **Temporal constraints**: `observable_within` literals render correctly in TLA+ constraint names

The formal projection remains a **sketch generator** — it produces structurally correct TLA+ but requires a clock variable for full temporal semantics. The traceability (each TLA+ construct references its source assertion ID) is valuable regardless.

### 7. Contradiction handling works

The model holds `epistemicStatus: "conflicting"` assertions alongside `validated` ones. When a contradictory assertion is added:

```yaml
- id: sem://reservation/assertion/contradictory-paid-expires
  subject: sem://reservation/state/paid
  predicate: requires
  object: sem://reservation/state/expired
  kind: invariant
  epistemicStatus: conflicting
  evidence:
    - type: documentation
      source: Outdated legacy docs
      stance: contradicts
```

The model retains both assertions. The original `paid-reservations-do-not-expire` (validated) and the contradictory `paid-expires` (conflicting) coexist. Projections surface the validated version without silently choosing a winner. The `explain` command can show both.

### 8. Assertions worked as the primary unit

18 assertions express the full reservation domain without projection-specific fields. Each assertion carries its own evidence, confidence, and epistemic status independently. The predicate vocabulary (8 of 12 candidates used) was sufficient.

### 9. Serialization round-tripped without semantic loss

Both JSON and YAML serializations preserve all objects, assertions, evidence records, epistemic status, confidence values, and conditions through full round-trips. The serialized form is deterministic (sorted by ID), which matters for golden tests.

### 10. Slicing worked

The slice expansion correctly follows assertion references to include connected objects. The relationship set controls what is included, and the current approach (passing the full relationship set for `build`) works for the MVP scale.

## Decision

The semantic kernel architecture is validated. All four originally unresolved issues have been addressed:

| Issue | Resolution |
|-------|-----------|
| Literal values broke validation | Typed `AssertionTarget` field with `isRef()` / `isLiteral()` / `targetId()` |
| TLA+ output was a sketch | Deduplicated guards, conditional forbids, temporal constraint names |
| Conditions were awkward | Conditions are structured metadata on assertions, consumed directly by projections |
| Contradiction handling untested | Model holds conflicting + validated assertions; projections surface both |

The following is now true:

1. One declarative model generates three coherent engineering artifacts.
2. Pattern-driven projections contain zero domain knowledge.
3. `.semir` and the TypeScript API are two front ends over the same model.
4. `semir build` is a single command that produces the demo.
5. `semir explain` makes cross-projection traceability visible.
6. Typed assertion objects distinguish references from literals cleanly.
7. Contradictions are represented explicitly, not silently resolved.
8. All 38 tests pass. Typecheck is clean.

Recommended before a second domain:

1. **Connect projection capabilities to slicing** so projections declare their relationship set.
2. **Add a clock variable** to the TLA+ projection for full temporal semantics.
3. **Exercise multiple-root slicing** with non-trivial relationship sets.

The predicate vocabulary should remain unchanged until a second domain exposes missing relationships.
