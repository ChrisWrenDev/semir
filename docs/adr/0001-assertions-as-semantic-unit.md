# ADR 0001: Use Assertions as the Fundamental Semantic Unit

**Status:** Proposed  
**Date:** 2026-09-09

## Context

SEMIR needs a representation that can serve multiple projections with different interests. An Event Model cares about causal flow and state transitions. A test generator cares about preconditions, effects, and invariants. A security projection cares about authorization. A formal checker cares about properties and ordering.

A conventional object hierarchy tends to collect all semantics inside domain-specific objects, for example putting authorization, effects, timing, and output events directly on a `PaymentAction` class. That makes semantics difficult to address independently and encourages projection-specific object shapes.

SEMIR must also support provenance, uncertainty, contradiction, and future extraction from heterogeneous evidence.

## Decision

SEMIR will treat **semantic assertions** as the fundamental unit of semantic meaning.

An assertion has its own stable identity and relates a subject to a predicate and optional object, possibly under conditions.

Examples:

```text
PayReservation authorized_by ReservationOwner
PayReservation causes PaymentAccepted
Reservation.Paid forbids Reservation.Expired
PaymentAccepted observable_within 500ms
```

Evidence and epistemic state attach to assertions rather than being implicit properties of an object.

## Consequences

### Positive

- different projections can select different combinations of shared facts;
- assertions can carry independent provenance and confidence;
- contradictory evidence can be represented explicitly;
- semantic diffs can identify changed claims rather than only changed objects;
- conformance can report status per assertion;
- the model remains more compositional than a large class hierarchy.

### Negative

- the model may be more verbose than strongly typed domain-specific classes;
- predicates require careful definitions to avoid ambiguity;
- higher-level ergonomic APIs may be needed for authoring common patterns;
- some semantics will require structured values or conditions rather than simple triples.

## Alternatives considered

### Giant domain class hierarchy

Rejected because it couples the semantic model to anticipated semantic dimensions and makes independent evidence/projection support awkward.

### Projection-specific models as sources of truth

Rejected because semantics would be duplicated across event models, tests, formal models, and other tools.

## Notes

Convenience domain objects and builders are still allowed. They are APIs over the assertion model, not alternative owners of semantic truth.
