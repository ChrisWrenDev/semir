# RFC 0010: Role-Aware Semantic Identity

**Status:** Proposed  
**Target:** Assertion identity over semantic roles, not entity similarity  
**Last updated:** 2026-09-10  
**Depends on:** RFC 0009, findings/0009-identity-reconciliation

## 1. Summary

Experiment 0009 discovered that "similar concepts" and "same semantic assertion" are different equivalence relations. The LLM incorrectly merged `payReservation requires active` and `processExpiry requires active` because both reference the same state — conflating shared referent with shared identity.

The root cause: 0009 reconciliation operated on concept names. But assertion identity is not defined by which entities appear in the assertion — it is defined by the semantic roles those entities play.

> **Can SEMIR reconcile candidate assertions using the semantic roles of their subject, predicate, object, constraints, and scope rather than similarity among the entities they reference?**

## 2. Three identity levels

Experiment 0009 conflated three distinct identity problems. They must be separated:

### 2.1 Referent identity

Is `PaymentSucceeded` the same semantic concept as `PaymentAccepted`?

This is concept reconciliation — mapping different names to the same semantic entity.

### 2.2 Assertion identity

Are these two claims the same semantic claim?

```
Paid forbids Expired
PaidState prevents ExpiredState
```

After concept reconciliation determines `Paid ≈ PaidState` and `Expired ≈ ExpiredState` and `forbids ≈ prevents`, these become the same assertion.

But:

```
PayReservation requires Active
ProcessExpiry requires Active
```

remain distinct regardless of concept reconciliation, because the subjects differ.

### 2.3 Evidence identity

```
Test A ─┐
        │
Guard B ├── evidence for ──> [Paid forbids Expired]
        │
Guard C ┘
```

The three evidence records are independent observations. They should not merge. The assertion they support should.

### 2.4 Architecture

```
Evidence
   ↓ supports / contradicts
Assertion
   ↓ subject / object
Semantic referents
```

Each layer has different identity semantics. Evidence identity is about independent observation. Assertion identity is about semantic role structure. Referent identity is about naming.

## 3. Assertion signature

Assertion identity is defined over a structured signature, not a bag of entity names:

```ts
interface AssertionSignature {
  subject: string;       // canonical subject identity
  predicate: string;     // SEMIR predicate
  object?: string;       // canonical object identity
  constraint?: string;   // normalized constraint
  scope?: string;        // environment/version/path
}
```

Two assertions are candidates for the same identity when their signatures match on all fields. They are candidates for distinct identity when any role differs.

Example:

```
(PayReservation, requires, Active)
(ProcessExpiry, requires, Active)
```

Different subject → obviously distinct. No LLM needed.

```
(PaymentAccepted, causes, Paid)
(SuccessfulPayment, causes, Paid)
```

Same signature shape → LLM adjudicates whether `PaymentAccepted ≈ SuccessfulPayment`.

## 4. Pipeline change

```
candidate concepts
      ↓
concept reconciliation (pass 5a)
      ↓
canonical concept identities
      ↓
candidate assertions (with canonical referents)
      ↓
deterministic assertion matching (pass 5b)
      ↓
obvious duplicates removed
obvious distinct flagged
ambiguous pairs extracted
      ↓
LLM role-aware reconciliation (pass 5c)
      ↓
canonical assertions
```

### Pass 5a — Concept reconciliation

Same as 0009 category 1: merge `PaymentAccepted` ↔ `payment-complete` ↔ `result.paid` into a single canonical referent.

### Pass 5b — Deterministic assertion matching

Compute assertion signatures using canonical referents. Then:

- **Exact signature match** → duplicate, merge automatically
- **Different subject, same predicate, same object** → normally distinct, flag as such
- **Same subject, different object** → normally distinct
- **Same triple, different constraint** → ambiguous, send to LLM
- **Same triple and constraint, different scope** → distinct if scope changes meaning

This prevents the 0009 failure deterministically. The LLM never sees structurally obvious cases.

### Pass 5c — LLM role-aware reconciliation

Only pairs that survived deterministic filtering reach the LLM. The prompt presents structured role information:

```
Candidate A
  subject:    PayReservation [action]
  predicate:  requires
  object:     Active [state]

Candidate B
  subject:    ProcessExpiry [action]
  predicate:  requires
  object:     Active [state]

Shared referents:
  object = Active

Differing roles:
  subject identity differs

Question:
  same assertion, distinct assertion,
  related assertion, or unknown?
```

The LLM adjudicates semantic ambiguity. It does not rediscover tuple equality.

## 5. Reconciliation vocabulary for 0010

For assertion reconciliation, three relationships suffice:

```ts
type AssertionRelationship =
  | "same"      // same semantic claim
  | "distinct"  // different semantic claims
  | "unknown";  // insufficient evidence
```

`related` is removed from assertion reconciliation. Once two assertions are marked `distinct`, their domain relationship is expressed through ordinary SEMIR predicates (`causes`, `requires`, etc.), not meta-semantic labels.

The expanded vocabulary (`causally_related`, `specialization_of`, `representation_of`, `supports_same_assertion`) is reserved for cases where the simplified vocabulary proves insufficient.

## 6. Adversarial test categories for 0010

Retain 0009 categories 1, 2, 4 (which passed). Add structural traps:

### 6.1 Same object, different subjects

```
PayReservation requires Active
ProcessExpiry requires Active
```

Must remain `distinct`. This is the 0009 category 3 failure.

### 6.2 Same subject, different objects

```
PayReservation requires Active
PayReservation requires Authenticated
```

Must remain `distinct`.

### 6.3 Same triple, different predicates

```
PaymentAccepted causes Paid
PaymentAccepted requires Paid
```

Must remain `distinct`. Structurally identical triple, semantically different claim.

### 6.4 Same triple, different constraints

```
PayReservation authorized_by User
  where user == reservation.owner

PayReservation authorized_by User
  where user.organisation == reservation.organisation
```

Structurally identical triple. Relationally distinct. Constraint identity participates in assertion identity (experiment 0005).

### 6.5 Same triple, different scope

If scope exists (environment, version, path), assertions with different scope should remain distinguishable where scope changes meaning.

### 6.6 True duplicates (category 1 retained)

```
PaymentAccepted causes Paid
SuccessfulPayment causes Paid
  where PaymentAccepted ≈ SuccessfulPayment
```

Should merge after concept reconciliation determines referent equivalence.

## 7. Acceptance criteria

| Metric | Target | Priority |
|---|---|---|
| Merge precision | ≥ 95% | highest |
| Merge recall | ≥ 80% | high |
| False-collapse rate | ≤ 2% | highest |
| Distinct precision | ≥ 90% | high |
| **Role-confusion false merges** | **0** | **highest** |

Role-confusion false merges = assertions merged solely because they share a referent in any role, while differing in another role.

Merge precision is prioritized because duplicate assertions are annoying but false identity is corrupting. If SEMIR wrongly merges `PayReservation requires Active` with `ProcessExpiry requires Active`, all provenance, conformance, slicing, and impact analysis become contaminated.

## 8. Deliverables

1. `src/extract/reconcile.ts` — updated with `AssertionSignature`, deterministic matching, role-aware prompt
2. `examples/extraction/reconcile-test-cases/` — expanded adversarial categories
3. `examples/extraction/analyze-reconciliation.ts` — updated pipeline with 5a/5b/5c passes
4. Findings: `docs/findings/0010-role-aware-identity.md`
