# RFC 0001: SEMIR v0 Semantic Kernel and Projection Architecture

**Status:** Proposed  
**Target:** SEMIR v0  
**Last updated:** 2026-09-09  
**Decision owners:** TBD

## 1. Summary

This RFC proposes the initial technical architecture for **SEMIR v0**.

SEMIR v0 is intentionally small. It defines:

- stable semantic identities;
- semantic objects;
- first-class semantic assertions;
- conditions and specialist constraints;
- evidence and epistemic status;
- semantic queries and slicing;
- projection contracts;
- projection capabilities and diagnostics;
- a minimal conformance vocabulary;
- storage- and syntax-neutral serialization boundaries.

The first implementation will use a reservation/payment subsystem to prove that one semantic model can generate multiple useful projections from the same underlying facts.

## 2. Motivation

The project needs to answer a narrow architectural question before attempting arbitrary software semantics:

> Can a small implementation-independent semantic model serve as the shared source for several engineering projections without each projection inventing its own truth?

If the answer is yes, the same architecture can later support richer extraction, verification, conformance, and implementation synthesis workflows.

## 3. Normative language

The terms **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are used normatively in this RFC.

## 4. Goals

SEMIR v0 MUST:

1. represent a small set of implementation-independent semantic concepts;
2. express semantics as independently addressable assertions;
3. preserve identity across multiple projections;
4. support relationships required by the reservation/payment proving ground;
5. attach evidence and epistemic status to assertions;
6. represent contradictions without silently resolving them;
7. support semantic slicing around one or more roots;
8. allow projections to declare which semantics they understand;
9. report unsupported semantics explicitly;
10. support at least three projection families:
    - an Event Modeling-style view,
    - executable/readable scenarios,
    - a formal verification model.

## 5. Non-goals

SEMIR v0 MUST NOT attempt to solve:

- arbitrary software semantics;
- autonomous whole-repository reverse engineering;
- production code generation;
- arbitrary distributed-system consistency models;
- ML quality semantics;
- numerical-algorithm equivalence;
- deployment and infrastructure modeling in full;
- a graphical editor;
- multi-user collaboration;
- a universal ontology;
- a graph-database architecture;
- a final surface syntax.

These may become future capabilities only if the kernel remains useful after the MVP.

## 6. Architectural laws

### 6.1 No projection owns semantic truth

The semantic model owns identities and assertions. A projection MAY reveal or operationalize a subset of semantics, but it MUST NOT become the authoritative store for those semantics.

### 6.2 Surface syntax is not the semantic model

YAML, JSON, a textual DSL, a GUI, LLM extraction, or static analysis MAY produce or serialize SEMIR, but no front end is canonical by virtue of its syntax.

### 6.3 Storage is an implementation detail

The conceptual model is graph-like. SEMIR v0 MUST NOT require a graph database, RDF store, ontology engine, or other specialized persistence technology.

### 6.4 Unsupported semantics are explicit

A projection MUST NOT silently omit a semantic assertion that falls within the selected semantic slice without recording a diagnostic explaining that the assertion was not represented.

### 6.5 Kernel growth is demand-driven

A new semantic primitive SHOULD be added to the kernel only when at least one real projection, conformance check, or extraction workflow requires it.

## 7. Terminology

### Semantic identity

A stable identifier for a semantic concept or assertion independent of how it is rendered or implemented.

### Semantic object

A named concept that may participate in assertions, such as an entity, state, action, event, observation, actor, or external system.

### Assertion

An independently identifiable semantic claim relating a subject to a predicate and optional object, possibly under conditions.

### Evidence

A source that supports, contradicts, or otherwise informs an assertion.

### Epistemic status

The model's current knowledge state for an assertion, such as asserted, inferred, validated, conflicting, or unknown.

### Semantic slice

A bounded subset of semantic objects and assertions selected around one or more roots for a specific query, projection, or conformance task.

### Projection

A transformation from a semantic slice into another engineering representation.

### Projection IR

A projection-specific intermediate representation produced by semantic lowering before rendering.

### Conformance

An evaluation of whether an implementation or artifact satisfies a semantic assertion or set of assertions.

## 8. Core data model

The first implementation SHOULD remain deliberately boring and in-memory.

A TypeScript-like reference model is:

```ts
export type SemanticId = string;

export interface SemanticModel {
  objects: Map<SemanticId, SemanticObject>;
  assertions: Assertion[];
}

export interface SemanticObject {
  id: SemanticId;
  kind: SemanticObjectKind;
  name: string;
  attributes?: Record<string, SemanticValue>;
}

export type SemanticObjectKind =
  | "entity"
  | "state"
  | "action"
  | "event"
  | "observation"
  | "actor"
  | "external_system";
```

SEMIR v0 MAY introduce convenience collections for entities, states, actions, and events, but those conveniences MUST NOT change the assertion-centric semantics.

## 9. Semantic identities

Every semantic object and assertion MUST have a stable `SemanticId`.

The implementation SHOULD support human-readable identifiers such as:

```text
sem://reservation/entity/reservation
sem://reservation/action/pay-reservation
sem://reservation/event/payment-accepted
sem://reservation/assertion/paid-reservations-do-not-expire
```

### 9.1 Requirements

A semantic identity:

- MUST be unique within a model;
- MUST remain stable across projections;
- SHOULD remain stable across serialization round-trips;
- MUST NOT encode projection-specific representation details;
- SHOULD survive source-code renames when semantic identity has not changed.

Identity resolution across independently extracted sources is explicitly out of scope for v0, but the ID design MUST leave room for later aliases and reconciliation metadata.

## 10. Assertions

Assertions are the fundamental semantic unit of SEMIR v0.

```ts
export interface Assertion {
  id: SemanticId;

  subject: SemanticId;
  predicate: Predicate;
  object?: SemanticValue;

  conditions?: Condition[];
  kind: AssertionKind;

  evidence?: Evidence[];
  epistemicStatus?: EpistemicStatus;
  confidence?: number;
}
```

An assertion SHOULD be understandable independently of any projection.

Examples:

```text
PayReservation authorized_by ReservationOwner
PayReservation causes PaymentAccepted
PaymentAccepted transitions_to Reservation.Paid
Reservation.Paid forbids Reservation.Expired
ReservationExpired observable_within 5s
PaymentRetry forbids DuplicateCharge
```

### 10.1 Assertion invariants

- `id` MUST resolve uniquely.
- `subject` MUST resolve to a semantic object or another explicitly allowed semantic target.
- semantic IDs referenced by structured objects SHOULD resolve before validation succeeds;
- `confidence`, when present, MUST be in the range `0.0..1.0`;
- an assertion with `epistemicStatus = "unknown"` MAY omit an object when the unknown itself is the modeled fact;
- projections MUST preserve assertion IDs in traceability metadata when practical.

## 11. Predicate set

The initial predicate set SHOULD be small enough that the reservation model can be expressed naturally with approximately 10–15 primitive relationships.

The initial candidate set is:

```ts
export type Predicate =
  | "causes"
  | "requires"
  | "forbids"
  | "transitions_to"
  | "reads"
  | "writes"
  | "produces"
  | "occurs_before"
  | "authorized_by"
  | "must_hold"
  | "observable_within"
  | "exactly_once";
```

This list is provisional. A predicate SHOULD be removed, renamed, or decomposed if the MVP reveals that it has ambiguous semantics.

The kernel MUST NOT add predicates merely because they seem theoretically desirable.

## 12. Conditions

Assertions MAY be conditional.

```ts
export interface Condition {
  subject: SemanticId;
  predicate: Predicate | ConditionPredicate;
  object?: SemanticValue;
}
```

For example:

```yaml
subject: PaymentAttempt
predicate: forbids
object: DuplicateCharge
conditions:
  - subject: PaymentAttempt
    predicate: occurs_after
    object: ProviderTimeout
```

The implementation SHOULD prefer explicit conditions over embedding scenario-specific semantics into predicate names.

## 13. Assertion kinds

`AssertionKind` provides coarse classification without replacing predicates.

```ts
export type AssertionKind =
  | "fact"
  | "precondition"
  | "postcondition"
  | "invariant"
  | "temporal"
  | "security"
  | "failure"
  | "quantitative"
  | "operational"
  | "algorithmic";
```

Only kinds required by the MVP need full projection support.

## 14. Specialist constraints

Specialist semantics SHOULD attach to shared identities rather than extend the core object hierarchy.

Examples include:

```text
TemporalConstraint
QuantitativeConstraint
SecurityConstraint
FailureConstraint
AlgorithmConstraint
```

A specialist constraint MAY be represented as:

1. a specialized assertion kind;
2. a typed semantic value attached to an assertion;
3. a future extension record keyed by assertion or semantic object identity.

The MVP SHOULD choose the simplest representation that preserves meaning and projection traceability.

## 15. Evidence and provenance

Evidence is first-class because future brownfield extraction will produce candidate semantics rather than guaranteed truth.

```ts
export interface Evidence {
  id?: string;
  type:
    | "human"
    | "test"
    | "code"
    | "documentation"
    | "trace"
    | "api"
    | "schema"
    | "experiment";

  source: string;
  stance?: "supports" | "contradicts" | "neutral";
  detail?: string;
}
```

Example:

```yaml
id: sem://reservation/assertion/no-duplicate-charge
subject: PaymentRetry
predicate: forbids
object: DuplicateCharge
kind: invariant
confidence: 0.97
epistemicStatus: validated
evidence:
  - type: test
    source: PaymentRetryTest#retryDoesNotChargeTwice
    stance: supports
  - type: code
    source: StripeAdapter.java:122-149
    stance: supports
```

## 16. Epistemic status and contradiction

The model MUST be able to distinguish uncertainty from contradiction.

A candidate status set is:

```ts
export type EpistemicStatus =
  | "asserted"
  | "inferred"
  | "validated"
  | "conflicting"
  | "unknown";
```

If documentation and tests support an assertion while implementation evidence contradicts it, the system SHOULD preserve all evidence and mark the assertion `conflicting` rather than choosing a winner silently.

SEMIR SHOULD support queries such as:

```text
show assertions contradicted by implementation
show unverified security constraints
show semantic claims supported only by documentation
show invariants with no generated checks
```

## 17. Semantic queries

The core library SHOULD expose both convenience queries and generic assertion queries.

Examples:

```ts
model.effectsOf("PayReservation")
model.preconditionsOf("PayReservation")
model.eventsCausedBy("PayReservation")
model.constraintsOn("PaymentAccepted")
```

Generic queries SHOULD remain available:

```ts
model.assertions({
  subject: "PayReservation",
  predicate: "causes",
});
```

Projection code SHOULD prefer semantic queries/slices over direct traversal of internal storage structures.

## 18. Semantic slicing

Whole-system graphs will not remain usable at scale. SEMIR therefore treats slicing as a core capability rather than a visualization optimization.

Example API:

```ts
model.slice({
  roots: ["PayReservation"],
  relationships: [
    "requires",
    "causes",
    "transitions_to",
    "forbids",
    "authorized_by",
  ],
});
```

A slice around `PaymentAccepted` might include:

```text
AuthorisePayment
      │
      ▼
PaymentAccepted
      │
      ├── changes Reservation.Paid
      ├── forbids Reservation.Expired
      ├── requires ReservationOwner
      ├── latency < 500ms
      ├── emitted exactly once
      └── observed by payments.accepted
```

A projection SHOULD operate on a semantic slice unless it has an explicit reason to consume the whole model.

## 19. Projection architecture

Projections MUST be implemented as compiler-like passes.

The required conceptual pipeline is:

```text
Semantic IR
    ↓
semantic slice / selection
    ↓
projection-specific lowering
    ↓
Projection IR
    ↓
validation
    ↓
rendering / execution
```

The architecture MUST NOT collapse semantic lowering and rendering into one renderer that arbitrarily traverses the whole model.

A reference interface is:

```ts
export interface Projection<TProjectionIR, TArtifact> {
  select(model: SemanticModel): SemanticSlice;
  lower(slice: SemanticSlice): TProjectionIR;
  validate(ir: TProjectionIR): ProjectionDiagnostics;
  render(ir: TProjectionIR): TArtifact;
}
```

## 20. Projection capabilities

Each projection MUST declare which semantic predicates and assertion kinds it understands.

```ts
export interface ProjectionCapabilities {
  predicates: Predicate[];
  assertionKinds: AssertionKind[];
}
```

Example:

```yaml
projection: event-model
supports:
  predicates:
    - causes
    - transitions_to
    - reads
    - writes
ignores_or_cannot_represent:
  - p99_latency
  - durability
```

This makes projection fidelity explicit.

## 21. Projection diagnostics and coverage

Unsupported semantics MUST fail loudly at the projection boundary.

Example diagnostic:

```text
TLA+ projection:
  warning: quantitative assertion not represented
  assertion: PaymentAccepted p99_latency < 500ms
```

A projection MAY report coverage metrics such as:

```text
Event model:      61%
Generated tests:  78%
Formal model:     72%
Load-test model:  12%
```

Coverage MUST NOT be interpreted as proof of semantic completeness. It is a measure of how much of the selected model the projection can represent.

## 22. Initial projection contracts

SEMIR v0 targets exactly three projection families.

### 22.1 Event Model projection

The Event Model projection SHOULD represent:

- actions/commands;
- events;
- state transitions;
- causal relationships;
- selected waits or temporal triggers when meaningful.

It MAY lower to:

```ts
export interface EventModelIR {
  commands: CommandNode[];
  events: EventNode[];
  states: StateNode[];
  edges: Edge[];
}
```

Renderers MAY then emit Mermaid, text, SVG, or an interactive UI without changing semantic lowering.

### 22.2 Scenario/Test projection

The scenario projection SHOULD lower to a generic executable/readable scenario representation before rendering to Gherkin or a test framework.

```ts
export interface Scenario {
  name: string;
  given: Clause[];
  when: Clause[];
  then: Clause[];
}
```

The MVP SHOULD first produce deterministic Gherkin-like output. Executable TypeScript tests MAY follow from the same `ScenarioIR`.

### 22.3 Formal verification projection

The formal projection SHOULD translate supported invariants and state-transition semantics into a precise formal model suitable for automated checking.

The implementation MAY choose Alloy or TLA+ for the first backend.

The key requirement is not language sophistication; it is that the **same assertion identity** can contribute to both human-readable scenarios and formal verification.

## 23. Conformance vocabulary

SEMIR v0 SHOULD define a stable result vocabulary even if full implementation conformance is postponed.

```ts
export type ConformanceStatus =
  | "satisfied"
  | "violated"
  | "unknown"
  | "unverified";
```

Intended semantics:

- `satisfied`: available evidence/checks establish the assertion within the checker’s declared scope;
- `violated`: available evidence/checks demonstrate a counterexample or incompatible observation;
- `unknown`: the model or evidence is insufficient to decide;
- `unverified`: the assertion is understood but no relevant checker was run or available.

A checker MUST identify the scope and mechanism that produced the result.

## 24. Serialization

Serialization is intentionally deferred until the in-memory model stabilizes.

When introduced, the serialization format MUST round-trip without semantic loss:

```text
file → Semantic IR → file
```

The project MAY support multiple front ends:

```text
DSL ───────────┐
YAML/JSON ─────┤
GUI ───────────┤
LLM extraction ├──→ Semantic IR
code analysis ─┤
OpenAPI ───────┘
```

No surface format may define semantics that the core model itself cannot represent.

## 25. Persistence

The MVP SHOULD use an in-memory representation such as:

```ts
interface SemanticStore {
  objects: Map<SemanticId, SemanticObject>;
  assertions: Assertion[];
}
```

Persistence MAY initially be JSON.

The project MUST defer a commitment to SQLite, RDF, Datalog, Neo4j, or a custom database until real query and scale requirements justify it.

## 26. Canonical MVP domain

The reservation/payment subsystem is the canonical v0 proving ground.

Minimum concepts include:

```text
Reservation

states
  active
  paid
  expired

actions
  create
  pay
  expire

events
  ReservationCreated
  PaymentAccepted
  ReservationExpired

constraints
  unpaid before expiry
  paid reservations cannot expire
  only owner can pay
  expiry visible within 5s
  payment retries cannot duplicate charge
```

The example SHOULD remain small enough that one engineer can manually inspect every semantic assertion.

Target scale:

- approximately 3 entities;
- 4–6 actions;
- 5–8 events;
- 10–20 assertions;
- 2–3 invariants.

## 27. Required demonstration

The defining demo is:

```text
                    ┌── Event Model
                    │
Reservation SEMIR ──┼── Executable scenarios
                    │
                    └── Formal model
```

Changing one semantic fact, for example:

```text
expiry timeout: 30m → 15m
```

MUST coherently change every relevant projection.

Likewise, the assertion:

```text
paid reservations cannot expire
```

SHOULD manifest as:

```text
Event-model view
    payment prevents expiry transition

Generated test
    paid reservation does not expire

Formal property
    G(paid -> !expired)
```

## 28. Validation rules

The core validator SHOULD detect at least:

- duplicate semantic IDs;
- dangling subject/object references;
- invalid confidence ranges;
- malformed condition references;
- predicates used with unsupported value shapes;
- projection capability mismatches;
- assertion IDs lost during a projection where traceability is expected.

Validation SHOULD be deterministic.

## 29. Repository architecture

A plausible initial structure is:

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
        lower.ts
        validate.ts
        render-mermaid.ts

      scenarios/
        lower.ts
        validate.ts
        render-gherkin.ts

      formal/
        lower.ts
        validate.ts
        render-tla.ts

  examples/
    reservations/
      model.ts

  test/
    golden/
      reservation.event-model.md
      reservation.feature
      reservation.tla
```

Exact package layout is non-normative.

## 30. Alternatives considered

### 30.1 Giant class hierarchy

Rejected for v0. Embedding every semantic dimension into specialized object classes makes it difficult for projections to combine facts differently and makes provenance harder to attach uniformly.

### 30.2 Projection-owned domain models

Rejected. If the Event Model, test generator, and formal verifier each own a separate model, semantic truth becomes duplicated and drift becomes unavoidable.

### 30.3 Direct rendering from the semantic graph

Rejected. A projection-specific IR creates a stable boundary between semantic lowering and output syntax and supports multiple renderers for one projection family.

### 30.4 Graph database first

Rejected. The conceptual model is graph-like, but early storage decisions risk shaping semantics around a database rather than the problem.

### 30.5 DSL first

Rejected for the earliest implementation. Syntax design should follow stabilization of the in-memory semantic abstraction.

### 30.6 Tests as the canonical specification

Rejected. Tests are valuable semantic backpressure but do not necessarily represent performance, security, temporal, algorithmic, or operational requirements completely.

## 31. Risks

### 31.1 Predicate ambiguity

A small relation vocabulary can become deceptively vague. Predicates need operational definitions and examples as the project matures.

### 31.2 False generality

The reservation domain may fit the model while other domains expose structural flaws. The team must distinguish “works for the proving ground” from “universal.”

### 31.3 Projection leakage

Projection-specific concepts may leak into the semantic kernel. Reviews should reject additions that exist solely to simplify one renderer.

### 31.4 Accidental certainty

Evidence-backed extraction may later tempt the system to collapse inferred behavior into asserted truth. Epistemic status must remain explicit.

### 31.5 Identity instability

Poor semantic IDs will make diffs, evidence, and cross-projection traceability brittle.

## 32. Open questions

The following questions are deliberately unresolved in RFC 0001:

1. What exact predicate vocabulary survives the MVP?
2. Should state transitions be a primitive predicate or structured semantic value?
3. How should temporal expressions be represented canonically?
4. How much proposition/expression syntax belongs in v0 invariants?
5. Which formal backend should be first: Alloy or TLA+?
6. When should contradictions exist as multiple assertions versus one assertion with conflicting evidence?
7. What stable-ID policy best supports refactors and extracted aliases?
8. How should semantic diffs distinguish identity changes from meaning changes?

## 33. Decision summary

If accepted, this RFC establishes the following design direction:

- SEMIR v0 is assertion-centric.
- Shared semantic identity is independent of projections.
- Projections lower through projection-specific IRs.
- Provenance and epistemic status are core concepts.
- Contradictions are represented explicitly.
- Semantic slicing is a core API.
- Unsupported projection semantics produce diagnostics.
- Storage and serialization remain non-canonical implementation choices.
- The MVP proves the architecture using one reservation/payment model and three projections.
