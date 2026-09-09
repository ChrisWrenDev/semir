# RFC 0005: Minimal Constraint Calculus

**Status:** Complete  
**Target:** SEMIR relational semantics  
**Last updated:** 2026-09-09  
**Depends on:** RFC 0004, findings/0004-instance-semantics

## 1. Summary

Experiment 04 discovered that instance-level semantics fail because type-level assertions cannot bind values across occurrences or state constraints over those failures. All four failures collapsed onto one missing abstraction: a relational constraint layer.

This RFC defines the experiment to design that layer. The goal is not "implement instance semantics." It is:

> **What is the smallest general constraint language that can express the three failed cases without turning SEMIR into a programming language?**

## 2. Design principles

### Constraints are subordinate to assertions

An assertion remains the primary unit:

```text
Assertion
  subject
  predicate
  object
  conditions
  constraint        ← NEW
  evidence
  epistemicStatus
```

The constraint qualifies the assertion. It does not replace it. The structural meaning stays:

```text
PayReservation authorized_by ReservationOwner
```

The constraint refines it:

```text
actor == reservation.owner
```

### No arbitrary computation

The constraint language should stay closer to first-order relational logic than to TypeScript. No functions, recursion, mutation, loops, or dynamic dispatch.

### Every construct earns its place

Add only what the three test cases force. The pressure ledger determines the vocabulary.

## 3. The three test cases

### A. Reservation ownership

```text
for Reservation r, Actor a:
    PayReservation(r, a) requires a == owner(r)
```

### B. Rate-limit ownership

```text
for Request q, Bucket b:
    Consumes(q, b) requires client(q) == owner(b)
```

### C. Payment idempotency

```text
for PaymentIntent p:
    count(Charge c where intent(c) == p and status(c) == successful) <= 1
```

## 4. Constraint AST

The in-memory representation (no surface syntax yet):

```ts
type ConstraintExpr =
  | { kind: "var"; name: string }
  | { kind: "prop"; subject: string; property: string }
  | { kind: "literal"; value: string | number | boolean }
  | { kind: "equals"; left: ConstraintExpr; right: ConstraintExpr }
  | { kind: "not_equals"; left: ConstraintExpr; right: ConstraintExpr }
  | { kind: "lt" | "lte" | "gt" | "gte"; left: ConstraintExpr; right: ConstraintExpr }
  | { kind: "and" | "or"; left: ConstraintExpr; right: ConstraintExpr }
  | { kind: "not"; expr: ConstraintExpr }
  | { kind: "forall"; binding: Binding; where?: ConstraintExpr; body: ConstraintExpr }
  | { kind: "exists"; binding: Binding; where?: ConstraintExpr; body: ConstraintExpr }
  | { kind: "at_most"; count: number; bindingName: string; targetType: SemanticId; where?: ConstraintExpr }
  | { kind: "at_least"; count: number; bindingName: string; targetType: SemanticId; where?: ConstraintExpr };
```

## 5. Pressure ledger

| Construct | Reservation ownership | Rate-limit ownership | Idempotency |
|---|---|---|---|
| variables | needed | needed | needed |
| property access | needed | needed | needed |
| equality | needed | needed | needed |
| quantification (forall) | maybe | maybe | needed |
| at_most | no | no | needed |
| arithmetic | no | no | no |
| user functions | no | no | no |

Target: 5–8 constructs express all three cases.

## 6. Acceptance criteria

1. All three Experiment 04 failures become expressible
2. No new structural predicates introduced
3. Same constraint representation drives scenarios and formal projection
4. Constraints attach to assertion identity and preserve provenance
5. Renaming domains does not change constraint machinery
6. Language cannot express arbitrary computation
7. Primitive vocabulary stays small (≤ 10 constructs)

## 7. What NOT to do

- Do not add arithmetic, functions, or recursion
- Do not design surface syntax
- Do not implement quantitative, concurrent, or operational semantics
- Do not add code generation

## 8. Deliverables

1. `src/core/constraint.ts` — constraint AST and renderer
2. `examples/constraints/constraints.semir` — three test cases with constraints
3. Updated projections to surface constraints
4. Findings: `docs/findings/0005-constraint-calculus.md`
5. Updated RFC pressure ledger
