# RFC 0009: Semantic Identity Reconciliation

**Status:** Proposed  
**Target:** Reconcile independently inferred semantic concepts into stable identities  
**Last updated:** 2026-09-10  
**Depends on:** RFC 0008, findings/0008-llm-interpretation

## 1. Summary

Experiment 008 demonstrated that an LLM can infer latent semantic assertions from structured evidence, achieving 100% recall and 93% precision. But the LLM freely synthesizes concepts — `ReservationPaid`, `PaymentCompleted`, `PaymentAccepted`, `SuccessfulPayment` — all grounded in legitimate evidence, all referring to overlapping but potentially distinct semantic reality.

As extraction becomes effective, the system accumulates a cloud of evidence-backed hypotheses. Without identity reconciliation, the semantic graph explodes and precision becomes superficially high while the model fragments.

> **Can independently inferred semantic concepts be reconciled into stable identities without collapsing genuinely distinct concepts or relying on source names?**

The critical constraint: no canonical identities exist yet. The extractor creates them. Reconciliation must work bottom-up from evidence, not top-down from an authored model.

## 2. The problem

An effective extractor produces candidates like:

```
candidate://extraction/184/PaymentAccepted
candidate://extraction/191/ReservationPaid
candidate://extraction/203/payment-complete
candidate://extraction/217/PaymentCompleted
```

These may represent:

| Candidate A | Candidate B | Relationship |
|---|---|---|
| PaymentAccepted | payment-complete | **same** — different names for the same referent |
| PaymentAccepted | ReservationPaid | **related** — causally connected but distinct |
| ReservationPaid | active_forbidden | **unrelated** — different semantic content |
| HTTP 429 | RateLimitExceeded | **related** — one is a representation of the other |

Collapse is not always correct. `PaymentAccepted` and `ReservationPaid` are causally related but semantically distinct:

```
PaymentAccepted
       │
       causes
       ▼
ReservationPaid
```

Merging them would contaminate evidence and corrupt meaning.

## 3. Architecture

```
candidate assertions (from 0008)
        │
        │  each with unique candidate ID
        ▼
identity reconciliation (pass 5)
        │
        │  proposes relationships between candidates
        ▼
reconciliation proposals
        │
        │  same / distinct / related / unknown
        ▼
resolved semantic graph
```

Reconciliation is an explicit, separate operation. It does not happen silently during extraction.

## 4. Reconciliation vocabulary

Four relationships, orthogonal to the 12 semantic predicates:

```ts
type ReconciliationRelationship =
  | "same"        // same semantic referent, different names/representations
  | "distinct"    // genuinely different semantic content
  | "related"     // causally or structurally connected, not identical
  | "unknown";    // insufficient evidence to decide
```

This is meta-semantics about model construction, not system behavior. It does not belong in the 12 predicates.

## 5. Reconciliation proposal structure

```ts
interface ReconciliationProposal {
  candidateA: string;      // candidate ID
  candidateB: string;      // candidate ID
  relationship: ReconciliationRelationship;
  confidence: "high" | "medium" | "low";
  rationale: string;
  evidence: string[];       // why this relationship holds
  suggestedAssertion?: {    // only for "related" — new assertion to create
    subject: string;
    predicate: Predicate;
    object?: string;
  };
}
```

For `same` proposals, the system selects a canonical identity and merges evidence.

For `related` proposals, the system suggests a new assertion linking the two concepts (e.g., `PaymentAccepted causes ReservationPaid`).

For `distinct` proposals, the system records that these are separate concepts with no action needed.

For `unknown`, the system defers the decision.

## 6. Adversarial test categories

### 6.1 Different names, same meaning

```
PaymentService.ts:    reservation.status = "paid"
PaymentController:    expect(result.paid).toBe(true)
AuditLogger:          record("payment-complete")
database migration:   payment_completed_at
API response:         paymentStatus: "accepted"
```

Extraction may produce `ReservationPaid`, `PaymentCompleted`, `PaymentAccepted`, `SuccessfulPayment`. All should converge to a single identity via `same` proposals.

### 6.2 Similar names, different meaning

```
PaymentAccepted    (event: payment succeeded)
ReservationPaid    (state: reservation is paid)
```

These should remain `distinct` or `related` (one causes the other), never `same`.

### 6.3 Same representation, different meaning

Two separate boolean fields both stored as `"active"` in different contexts. Should not merge because syntax matches.

### 6.4 Different abstraction levels

```
HTTP 429           (wire protocol)
RequestRejected    (application layer)
RateLimitExceeded  (domain concept)
```

These form a chain, not a single identity:

```
RateLimitExceeded
       │
       causes
       ▼
RequestRejected
       │
       represented_as
       ▼
   HTTP 429
```

## 7. Acceptance criteria

Measure merge and split quality separately. A single "identity accuracy" hides dangerous failures.

| Metric | Target | Priority |
|---|---|---|
| Merge precision | ≥ 90% | **highest** — false merges corrupt meaning |
| Merge recall | ≥ 70% | important — missed merges cause duplication |
| False-collapse rate | ≤ 5% | **highest** — merging distinct concepts is catastrophic |
| Distinct precision | ≥ 85% | high — correctly keeping separate things separate |

**Merge precision is the top priority.** Once `A == B` is accepted, evidence and assertions from both concepts contaminate each other. Missing a merge mostly causes duplication. Incorrectly merging can corrupt meaning.

## 8. Deliberate test cases

### 8.1 Reference: same identity, different names

The reservation system uses `reservation.state = "paid"` in source, `result.paid` in tests, `payment-complete` in logging. All three should reconcile to one identity.

### 8.2 Reference: causally related, distinct

`PaymentAccepted` and `ReservationPaid` — one causes the other. Reconciliation should produce a `related` proposal with a suggested `causes` assertion, not a `same` proposal.

### 8.3 Reference: unrelated concepts

`ReservationPaid` and `ExpiryWorker` — different semantic content entirely. Should be `distinct`.

### 8.4 Reference: abstraction chain

`RateLimitExceeded → RequestRejected → HTTP 429` — three levels of abstraction, should not collapse.

### 8.5 Reference: ambiguous

Two concepts with overlapping but incomplete evidence. Should be `unknown`, not forced into `same` or `distinct`.

## 9. Deliverables

1. `src/extract/reconcile.ts` — reconciliation interface and LLM prompt
2. `examples/extraction/reconcile-test-cases/` — adversarial test inputs
3. `examples/extraction/analyze-reconciliation.ts` — reconciliation pipeline runner
4. Findings: `docs/findings/0009-identity-reconciliation.md`
