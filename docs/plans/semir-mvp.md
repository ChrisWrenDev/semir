# SEMIR MVP Implementation Plan

**Status:** Proposed  
**Depends on:** [RFC 0001](../rfcs/0001-semir-v0.md)  
**Last updated:** 2026-09-09

## 1. Objective

The MVP exists to answer one question:

> **Can one small semantic model generate multiple genuinely useful, mutually consistent projections?**

The MVP does not need to prove a universal semantic IR for arbitrary software. It needs to demonstrate that shared semantic identities and assertions are a useful common substrate for independent engineering tools.

## 2. Success contract

The core pipeline is:

```text
reservation.semir / authored model
          │
          ▼
      Semantic IR
          │
      ┌───┼─────────────┐
      ▼   ▼             ▼
  Event  scenarios   verification
  Model
```

A semantic change MUST affect all relevant projections through shared semantics rather than manual duplication.

Example change:

```text
paid reservations cannot expire
```

Expected manifestations:

```text
Event-model view
    payment prevents expiry transition

Generated scenario
    paid reservation does not expire

Formal property
    G(paid -> !expired)
```

## 3. Hypothesis

The MVP hypothesis is:

> A small relational semantic kernel—centered on stable identities and assertions—can represent the reservation/payment domain without projection-specific concepts and can be lowered into at least three useful projection IRs.

The MVP should be considered unsuccessful if each projection requires its own special-case semantics in the core model.

## 4. Explicit non-goals

The MVP will not build:

- autonomous repository reverse engineering;
- production code generation;
- an IDE or editor plugin;
- a graphical modeling application;
- a web application;
- multi-user collaboration;
- an agent framework;
- a graph database;
- a universal ontology;
- sophisticated natural-language authoring;
- broad distributed-system semantics;
- dozens of semantic dimensions.

These are intentionally deferred because they obscure the primary research risk.

## 5. Canonical example

Use a small reservation/payment subsystem containing enough semantics to stress the kernel without becoming difficult to understand.

### 5.1 Domain concepts

```text
Reservation

states
  active
  paid
  expired

actions
  CreateReservation
  PayReservation
  ExpireReservation

events
  ReservationCreated
  PaymentAccepted
  ReservationExpired
```

### 5.2 Required semantic claims

At minimum, model:

- an unpaid reservation may expire after 30 minutes;
- a paid reservation must not expire;
- only the reservation owner may pay;
- payment causes `PaymentAccepted`;
- expiry causes `ReservationExpired`;
- expiry visibility must occur within 5 seconds;
- payment retry after timeout must not duplicate the charge.

### 5.3 Size budget

Keep the example near:

- 3 entities or entity-like concepts;
- 4–6 actions;
- 5–8 events;
- 10–20 assertions;
- 2–3 invariants.

If the demo requires hundreds of semantic objects, stop and simplify the abstraction.

## 6. Implementation strategy

The implementation order is deliberately designed to test the semantic abstraction before syntax, infrastructure, or AI extraction.

### 6.1 Start with the in-memory model

Do not start with a DSL, JSON Schema, or database.

Implement the minimum types required by RFC 0001 and hard-code the canonical reservation model.

The first objective is a fast edit-run-debug loop for the semantic model itself.

### 6.2 Make assertions first-class

Prefer relational facts:

```text
PayReservation authorized_by ReservationOwner
PayReservation causes PaymentAccepted
PaymentAccepted transitions_to Reservation.Paid
Reservation.Paid forbids Reservation.Expired
ReservationExpired observable_within 5s
```

Avoid a model in which `PayReservation` becomes a large object containing bespoke fields for every projection.

### 6.3 Add generic querying and semantic slicing

Implement query primitives before projections so that each projection consumes a well-defined semantic slice rather than learning to traverse internal storage independently.

### 6.4 Add projections one at a time

Build the human-readable Event Model first, then executable/readable scenarios, then formal verification.

The first projection helps inspect the model. The second adds executable backpressure. The third forces precision.

### 6.5 Add serialization after the model stabilizes

Only introduce YAML, JSON, or a DSL after core model types stop changing continuously.

### 6.6 Add provenance immediately after basic projection viability

Even though the MVP starts with authored semantics, evidence and epistemic status should be introduced before any substantial extraction work.

### 6.7 Add LLM assistance only as candidate authoring

The first LLM workflow, if included after the MVP core, should convert bounded prose or test evidence into **candidate assertions** requiring review. It should not own semantic truth.

## 7. Milestones

### Milestone 0 — Repository skeleton and golden-test harness

#### Deliverables

- source package and test package;
- canonical reservation example location;
- golden-output test utility;
- deterministic output ordering.

#### Acceptance criteria

- `npm test` or equivalent can compare checked-in generated artifacts against regenerated output;
- generated output is stable across repeated runs with no semantic change.

---

### Milestone 1 — Semantic kernel

#### Implement

```text
SemanticId
SemanticObject
Entity
State
Action
Event
Assertion
Predicate
Condition
```

Hard-code the reservation example in source.

#### Acceptance criteria

> The entire canonical reservation example can be represented without projection-specific concepts.

Additional checks:

- all IDs are unique;
- no dangling references exist;
- the predicate vocabulary remains small and understandable;
- every required semantic claim has an assertion ID.

---

### Milestone 2 — Queries and semantic slicing

#### Implement

```text
assertions()
neighbors()
assertionsAbout()
effectsOf()
preconditionsOf()
eventsCausedBy()
constraintsOn()
slice()
```

#### Acceptance criteria

> `slice(PayReservation)` returns exactly the semantics needed to understand the payment operation for the supported relationship set.

The slice must include authorization, caused events, relevant state transition, and applicable invariants while excluding unrelated expiry-only semantics unless connected through configured relationships.

---

### Milestone 3 — Event Model projection

#### Implement

```text
Semantic IR
    ↓
SemanticSlice
    ↓
EventModelIR
    ↓
Mermaid or deterministic text renderer
```

#### Acceptance criteria

- a human can recognize the reservation workflow from the generated representation;
- changing a supported causal or transition assertion changes the generated Event Model;
- unsupported selected assertions produce diagnostics rather than disappearing silently;
- semantic assertion IDs are traceable through lowering where practical.

---

### Milestone 4 — Scenario/Test projection

#### Implement

A projection-specific scenario representation:

```ts
interface Scenario {
  name: string;
  given: Clause[];
  when: Clause[];
  then: Clause[];
}
```

First render deterministic Gherkin-like scenarios. Optionally add a Vitest/Jest backend from the same `ScenarioIR`.

#### Acceptance criteria

> Changing a semantic precondition, effect, or invariant changes the generated scenario behavior.

Required scenarios should include at least:

- unpaid reservation expires after the configured timeout;
- paid reservation does not expire;
- only the reservation owner can pay;
- retry semantics prevent duplicate charge where the scenario backend can represent it.

---

### Milestone 5 — Formal verification projection

#### Implement

Choose Alloy or TLA+ as the first formal backend.

Lower supported state transitions and invariants through a formal projection IR before rendering.

#### Acceptance criteria

> Deliberately introduce an invalid transition that allows a paid reservation to expire and obtain a failing check/counterexample.

The same assertion identity for `PaidReservationsDoNotExpire` must be traceable to the generated formal property and to the corresponding test/scenario projection.

---

### Milestone 6 — Serialization and provenance

#### Implement

- one `.semir` serialization format, initially YAML/JSON or a small DSL;
- `Evidence`;
- `EpistemicStatus`;
- optional confidence;
- round-trip parser/serializer;
- provenance retained across projection diagnostics.

#### Acceptance criteria

The model round-trips:

```text
file → Semantic IR → file
```

without semantic loss.

At least one assertion must retain multiple evidence records.

A synthetic contradiction must be representable without the system silently choosing one source as true.

## 8. Repository shape

A target repository structure is:

```text
semir/
  src/
    core/
      model.ts
      object.ts
      assertion.ts
      predicates.ts
      evidence.ts
      query.ts
      slice.ts
      validation.ts

    projections/
      event-model/
        ir.ts
        lower.ts
        validate.ts
        render-mermaid.ts

      scenarios/
        ir.ts
        lower.ts
        validate.ts
        render-gherkin.ts

      formal/
        ir.ts
        lower.ts
        validate.ts
        render-tla.ts

  examples/
    reservations/
      model.ts
      reservation.semir

  test/
    golden/
      reservation.event-model.md
      reservation.feature
      reservation.tla
```

Exact naming may change. The separation between `core` and `projections` is the important boundary.

## 9. Golden-test strategy

Projection drift should be visible immediately.

For the reservation model, check in deterministic golden outputs for every projection.

A test run should:

1. load or construct the semantic model;
2. validate it;
3. lower each projection;
4. validate each projection IR;
5. render deterministic output;
6. diff against checked-in golden files.

A semantic change should produce an intentional multi-artifact diff.

## 10. The key semantic-change demo

The first compelling demonstration should be deliberately small.

Start with:

```text
expiry timeout: 30m
```

Change it to:

```text
expiry timeout: 15m
```

Then run one command, for example:

```text
semir build
```

Expected result:

- the Event Model wait/trigger changes;
- generated expiry scenarios change;
- the formal model changes if the temporal semantics are represented by that backend;
- projection diagnostics remain clean for supported semantics;
- the semantic diff identifies one changed contract rather than unrelated textual edits.

## 11. Semantic diff

Semantic diff should be implemented before production code generation.

A useful output shape is:

```text
Semantic diff

~ Reservation expiry
    30 minutes → 15 minutes

Affected assertions
    ExpiryTimeout
    ExpiryVisibility

Affected projections
    Event Model
    ExpiryScenario
    ReservationSpec
```

The objective is to answer:

> **What behavior or contract changed?**

rather than only what source text changed.

Semantic diff is not required for the earliest milestone but should be treated as a near-term post-MVP capability.

## 12. Projection fidelity and diagnostics

Each projection must declare its capabilities.

Example:

```text
Event Model supports
    causes
    transitions_to
    reads
    writes

Event Model does not represent
    p99_latency
    durability
```

If a selected semantic slice contains:

```text
PaymentAccepted p99_latency < 500ms
```

and the formal/event projection cannot represent it, the build should emit a diagnostic instead of silently dropping the assertion.

This behavior is required to prevent users from treating any one projection as a complete system specification.

## 13. Definition of done

The MVP is complete when all of the following are true:

- [ ] one engineer can inspect the complete reservation semantic model manually;
- [ ] the model contains stable IDs and first-class assertions;
- [ ] the reservation model contains no projection-specific concepts;
- [ ] semantic slicing is implemented and covered by tests;
- [ ] three projection families consume the shared model;
- [ ] all three projections lower through their own projection IRs;
- [ ] unsupported semantics emit diagnostics;
- [ ] golden tests catch projection drift;
- [ ] the paid-reservation invariant is represented in both scenario and formal projections;
- [ ] a deliberately invalid model or transition produces a failing formal check;
- [ ] changing one semantic fact coherently changes all relevant generated artifacts;
- [ ] serialization round-trips without semantic loss;
- [ ] provenance and epistemic status can be attached to assertions;
- [ ] contradictions can be represented explicitly.

## 14. Stop conditions

Pause expansion and revisit the semantic model if any of the following occur:

- each projection requires many core fields used by no other projection;
- the predicate vocabulary grows rapidly before the reservation example is complete;
- projection lowering repeatedly depends on renderer-specific details;
- semantic slices cannot be expressed without whole-model traversal;
- assertion IDs are unstable under ordinary refactors;
- serialization choices begin dictating the conceptual model;
- the team cannot explain whether a new concept is semantic truth, evidence, or projection metadata.

## 15. After the MVP

If the MVP validates the core abstraction, the next likely sequence is:

1. semantic diff;
2. richer provenance and contradiction queries;
3. candidate assertion generation from natural-language statements;
4. candidate extraction from existing tests;
5. human review/reconciliation workflows;
6. active semantic discovery of high-value unknowns;
7. implementation conformance checking;
8. broader semantic dimensions only when demanded by real domains.

Autonomous repository reverse engineering and code generation should remain downstream of a proven semantic model.
