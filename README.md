# SEMIR

Semantic System Intermediate Representation. One declarative model, multiple engineering artifacts.

## What it does

SEMIR represents **what a system must preserve** rather than how it happens to be implemented. A single semantic model generates:

- **Event Model** — Mermaid diagram of commands, events, and state transitions
- **Scenarios** — Gherkin tests derived from assertion patterns
- **Formal model** — TLA+ spec with invariants and state machine

Change one semantic fact, run `semir build`, all three artifacts update.

## Quick start

```sh
npm install
npm test
```

## Usage

```sh
# Validate a model
semir validate examples/reservations/reservation.semir

# Build all projections
semir build examples/reservations/reservation.semir

# Explain what an assertion means across projections
semir explain sem://reservation/assertion/paid-reservations-do-not-expire \
  --file examples/reservations/reservation.semir
```

## The `.semir` format

A `.semir` file is YAML with `version`, `objects`, and `assertions`:

```yaml
version: "0.1"

objects:
  - id: sem://example/state/active
    kind: state
    name: Active

assertions:
  - id: sem://example/assertion/active-forbids-expired
    subject: sem://example/state/active
    predicate: forbids
    object: sem://example/state/expired
    kind: invariant
```

Objects are semantic concepts (entities, states, actions, events, actors). Assertions relate them with predicates (`causes`, `requires`, `forbids`, `transitions_to`, `authorized_by`, `observable_within`, ...).

The format round-trips: file → model → file without semantic loss.

## How projections work

Projections consume a **semantic slice** — a bounded subset of the model selected around roots — and lower it through a projection-specific IR before rendering.

```
.semir file
    ↓ parse
SemanticModel
    ↓ slice
SemanticSlice
    ↓ lower
ProjectionIR (EventModelIR | ScenarioIR | FormalIR)
    ↓ render
Mermaid | Gherkin | TLA+
```

Projections declare which predicates and assertion kinds they support. Unsupported semantics emit diagnostics instead of silently disappearing.

## Pattern-driven scenarios

The scenario projection recognizes graph shapes in the assertion graph:

| Pattern | Derived scenario |
|---------|-----------------|
| Action → Event → State | Given state, When action, Then resulting state |
| State forbids State | Given state, Then forbidden state does NOT occur |
| Action authorized_by Actor | Given actor, When action, Then authorized |
| Action forbids Event | Given action, Then forbidden event does NOT occur |

No hardcoded domain knowledge. Rename `Reservation` to `Widget` and the scenarios still work.

## Cross-projection traceability

Every assertion has a stable semantic ID. The `explain` command shows how one fact manifests across projections:

```
Paid forbids Expired

  Event Model      Paid --forbids--> Expired
  Scenarios        Paid does not lead to Expired
  Formal model     PaidExpiredForbids: [](Paid => ~Expired)
```

## Typed assertion objects

Assertion targets distinguish references from literals:

```yaml
# Reference — points to another semantic object
object: sem://reservation/state/active

# Literal — a concrete value
object:
  literal: "5s"
  datatype: duration
```

## Contradictions

The model holds conflicting assertions without silent resolution:

```yaml
- id: assertion-1
  subject: state/paid
  predicate: forbids
  object: state/expired
  epistemicStatus: validated

- id: assertion-2
  subject: state/paid
  predicate: requires
  object: state/expired
  epistemicStatus: conflicting
  evidence:
    - type: documentation
      source: Outdated legacy docs
      stance: contradicts
```

Both assertions remain. Projections surface the validated version.

## Project structure

```
src/
  core/
    assertion.ts      Assertion, AssertionTarget, predicates, evidence
    model.ts          SemanticModel, createModel
    object.ts         SemanticObject, SemanticObjectKind
    query.ts          assertions, effectsOf, preconditionsOf, slice
    slice.ts          Semantic slicing
    validation.ts     Model validation
    semir-format.ts   .semir YAML parser/serializer
    serialize.ts      JSON serialization
  projections/
    event-model/      Mermaid diagram
    scenarios/        Gherkin scenarios
    formal/           TLA+ spec
  cli.ts              semir validate | build | explain
examples/
  reservations/       Canonical reservation/payment domain
    reservation.semir Model in .semir format
    model.ts          Same model in TypeScript
test/
  semir.test.ts       38 tests
  golden/             Deterministic golden outputs
```

## Tests

```sh
npm test              # run all tests
npm run typecheck     # type check
```

## Status

MVP complete. See [`docs/findings/0001-mvp-validation.md`](docs/findings/0001-mvp-validation.md) for what was validated and what remains.
