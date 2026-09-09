# Semantic System IR: Vision and Principles

**Status:** Draft  
**Last updated:** 2026-09-09  
**Audience:** Engineers, architects, researchers, and contributors working on SEMIR

## 1. Purpose

This document describes the long-term vision for a **Semantic System Intermediate Representation (Semantic System IR / SEMIR)**: a representation of what a software system means and what properties any equivalent implementation must preserve.

The vision is deliberately broader than a code model, an event model, or a requirements document. It treats those artifacts as different views over shared system semantics.

## 2. Thesis

A software system can be described by a semantic model that is independent of any one implementation language, architecture, or representation.

The core relationship is:

```text
                 Existing implementation
                          │
                    semantic extraction
                          ▼
              ┌──────────────────────┐
              │   SEMANTIC SYSTEM    │
              │        MODEL         │
              └──────────────────────┘
                    │           │
             human reasoning    machine reasoning
                    │           │
                    └─────┬─────┘
                          ▼
                    implementation
                  /        |        \
              Rust       Java      FPGA
```

The middle representation should not primarily describe **how the current program happens to work**. It should describe **what any implementation claiming semantic equivalence must do**.

## 3. Problem

Today, source code is usually treated as the canonical artifact and other representations orbit it:

- tests,
- API descriptions,
- architecture diagrams,
- runbooks,
- event models,
- formal specifications,
- performance requirements,
- threat models,
- telemetry,
- production traces.

Each captures part of system meaning, but their identities and claims are usually duplicated and only loosely connected. This creates several problems:

1. a rewrite can preserve tests while violating an unstated temporal, security, or operational requirement;
2. documentation can disagree with code without representing the disagreement explicitly;
3. one semantic change must be manually reflected across several artifacts;
4. reverse engineering is measured by how much source has been inspected rather than how much system meaning is understood;
5. code generation starts from prose or implementation structure rather than a precise acceptance envelope.

SEMIR proposes a shared semantic layer between intent, evidence, engineering tools, and implementations.

## 4. Semantic surface

Different systems care about different dimensions. A useful model must be able to represent or attach semantics from several categories without forcing every system to use all of them.

### 4.1 Functional semantics

Inputs, outputs, state transitions, commands, events, queries, workflows, invariants, errors, and observable effects.

### 4.2 Algorithmic semantics

Computational properties that are themselves part of correctness: ordering, search strategy, numerical methods, optimization objectives, approximation guarantees, and convergence conditions.

### 4.3 Temporal and concurrent semantics

Ordering, deadlines, retries, races, atomicity, consistency, causality, idempotency, and synchronization requirements.

### 4.4 Quantitative semantics

Latency, throughput, memory, CPU, storage, energy, availability, durability, and scalability bounds.

### 4.5 Security and trust semantics

Authentication, authorization, information-flow restrictions, isolation boundaries, and threat assumptions.

### 4.6 Operational semantics

Startup, shutdown, recovery, deployment constraints, migrations, observability, and degradation modes.

### 4.7 Probabilistic semantics

Distributions, confidence/error bounds, stochastic behavior, and ML quality criteria.

### 4.8 Environmental assumptions

Hardware, networks, external APIs, physical-world assumptions, and regulatory constraints.

The goal is **not** to encode every category in a single universal notation. The universal layer is shared semantic identity, relationships, assertions, evidence, and uncertainty.

## 5. Multiple views over shared semantics

Event Modeling is an especially useful projection for information-centric workflows:

```text
intent → command → state change/event → consequence/read model
```

But it is one projection rather than the complete intermediate representation.

For example, a single semantic slice around reservation expiry might contain:

```text
ENTITY
    Reservation

STATE
    active
    paid
    expired

TRANSITION
    active -> expired

PRECONDITION
    reservation unpaid

TRIGGER
    elapsed_time >= 30 minutes

INVARIANT
    paid reservations cannot expire

OBSERVABLE EFFECT
    reservation no longer available

TEMPORAL REQUIREMENT
    expiry visible within 5 seconds

SECURITY
    only reservation owner may pay

FAILURE SEMANTICS
    provider timeout must not duplicate charge
```

Different consumers can project the same semantics differently.

### Event-model projection

```text
ReservationCreated
       ↓
 [wait 30 mins]
       ↓
ExpireReservation
       ↓
ReservationExpired
```

### Test projection

```gherkin
Given an unpaid reservation created 30 minutes ago
When expiry processing executes
Then the reservation becomes expired
And the seat becomes available
And no charge is made
```

### Formal projection

```text
G(paid -> !expired)
```

### Performance projection

```text
p99(expiry_visibility) < 5s
```

These artifacts differ in syntax and fidelity, but the relevant claims should share semantic identity.

## 6. Compiler analogy

The architecture is intentionally compiler-like.

Traditional compilers separate parsing, semantic analysis, intermediate representations, optimization, and lowering. That separation works because later transformations operate on an intermediate representation whose semantics they must preserve.

SEMIR applies the same idea to software engineering:

```text
natural-language intent
existing code
existing tests
production traces
documentation
architecture
      │
      ▼
SEMANTIC IR
      │
      ├─────────> executable tests
      ├─────────> formal verification
      ├─────────> documentation
      ├─────────> threat models
      ├─────────> load tests
      └─────────> observability mappings
      │
      ▼
implementation IR / synthesis
      │
      ▼
code
```

In this framing:

- reverse engineering is analogous to **decompilation into semantic IR**;
- implementation synthesis is analogous to **compilation from semantic IR**;
- conformance checks determine whether an implementation satisfies the semantic contract.

## 7. Core principles

### 7.1 Preserve meaning, not incidental structure

The IR describes required behavior and properties. It must avoid elevating implementation accidents into semantic requirements unless they are themselves required for equivalence.

### 7.2 Shared identity, multiple representations

A semantic concept such as `PaymentAccepted` should have one stable identity while appearing in event models, tests, formal properties, telemetry, implementation mappings, and other projections.

### 7.3 Assertions are explicit claims

Semantics should be represented as explicit claims such as:

```text
PayReservation authorized_by ReservationOwner
PayReservation causes PaymentAccepted
Reservation.Paid forbids Reservation.Expired
PaymentAccepted observable_within 500ms
```

The model should make it possible to query, validate, support, contradict, or project these claims independently.

### 7.4 Provenance and uncertainty are first-class

Brownfield semantic reconstruction is epistemically different from compiler parsing. The system will contain facts that are known, inferred, conflicting, or unknown.

A semantic assertion should be able to retain:

- evidence,
- confidence,
- validation status,
- contradictory evidence,
- stale or superseded evidence.

The model should never silently convert inference into certainty.

### 7.5 Unknowns are representable

An incomplete model is expected. Unknown behavior should be explicit and may include a suggested experiment or investigation needed to resolve it.

Reverse-engineering progress can therefore be framed as reduction of **semantic uncertainty**, rather than completion of file inspection.

### 7.6 Semantics should be executable or verifiable where possible

A useful semantic claim should be capable of producing engineering backpressure when an appropriate projection exists.

Correctness may eventually mean:

```text
functional equivalence
AND invariants hold
AND temporal constraints hold
AND performance envelope holds
AND security properties hold
AND algorithmic/numerical tolerances hold
```

Tests are one mechanism, not the definition of correctness.

### 7.7 Compositionality is required

Subsystem semantics should be understandable, queryable, and projectable without requiring the entire global system to be loaded or understood.

Semantic slicing is therefore a core architectural requirement.

### 7.8 The kernel should remain small

SEMIR should have a small semantic kernel with specialist extensions rather than a single language that attempts to model all software semantics directly.

The kernel should grow only when a real projection, conformance check, or extraction workflow demonstrates that a missing concept is necessary.

## 8. Semantic knowledge graph

The conceptual model is graph-like even if the implementation does not use a graph database.

A semantic entity can join many requirements and artifacts:

```text
semantic object:
    PaymentAccepted

related requirements:
    caused_by: AuthorisePayment
    exactly_once: true
    p99_latency: < 500ms
    authorization: reservation-owner
    invariant: chargedAmount == quotedAmount
    audit_retention: 7 years
    implementation: PaymentService.accept()
    tests: PaymentAcceptanceTest#...
    telemetry: payments.accepted
```

The important property is shared identities and relationships, not a specific storage technology.

## 9. Provenance model

Every reverse-engineered semantic assertion should be able to retain its evidence.

```text
ASSERTION
    Retrying payment must not create another charge

CONFIDENCE
    0.97

EVIDENCE
    - PaymentRetryTest.java:43-81
    - StripeAdapter.java:122
    - API documentation section 4.3
    - production trace cluster #617

STATUS
    human-validated

TYPE
    invariant
```

This allows the system to distinguish:

```text
KNOWN
HYPOTHESIZED
CONFLICTING
UNKNOWN
```

Contradictions should be represented, not silently reconciled.

## 10. Conformance as the long-term API

The most important future operation is likely not code generation:

```text
generateCode(model)
```

but conformance:

```text
checkConformance(model, implementation)
```

with a result such as:

```yaml
satisfied:
  - reservation_owner_authorization
  - paid_reservation_cannot_expire

violated:
  - expiry_visible_within_5s

unknown:
  - payment_retry_exactly_once

unverified:
  - crash_recovery_preserves_payment_state
```

Code generation can become one client of the semantic model rather than its defining purpose.

## 11. Relationship to adjacent concepts

One useful positioning is:

```text
Ralph
    convergence / execution mechanism

Reverse Ralph
    semantic discovery mechanism

Event Modeling
    domain and information-flow projection

Semantic System IR
    canonical representation of system meaning

Tests / model checkers / benchmarks
    semantic backpressure

Forward Ralph
    implementation synthesis mechanism
```

The broader research question is:

> **What is the right intermediate representation between human intent, existing systems, and machine-generated implementations?**

## 12. Non-goals

The vision does not require SEMIR to become:

- one universal diagramming notation;
- a replacement for all domain-specific formal methods;
- a general-purpose programming language;
- a graph database product;
- a claim that every semantic dimension can be fully formalized;
- an autonomous AI system that treats inferred behavior as ground truth.

## 13. Research questions

The most important unresolved questions include:

- **Identity:** when two sources refer to similar concepts, when are they semantically identical?
- **Composition:** how can subsystem semantics compose without requiring global understanding?
- **Contradiction:** how should conflicting evidence and claims affect projection and conformance?
- **Projection fidelity:** what meaning is lost in each projection?
- **Completeness:** how can important missing semantics be identified?
- **Equivalence:** what precisely means that two implementations satisfy the same semantic model?
- **Evolution:** which semantic claims become stale when implementations or evidence change?

## 14. Success characteristics

A general-purpose Semantic System IR is likely to require three properties above all others:

1. **Compositionality** — pieces can be understood and checked independently.
2. **Executable/verifiable semantics** — claims can generate checks or other backpressure.
3. **Provenance and uncertainty** — the model distinguishes knowledge, inference, contradiction, and absence of knowledge.

If these properties hold, implementations can increasingly be treated as projections satisfying a semantic contract rather than as the canonical definition of the system.
