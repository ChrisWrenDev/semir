# Findings 0009: Semantic Identity Reconciliation

**Status:** Complete  
**Date:** 2026-09-10  
**Depends on:** RFC 0009, findings/0008-llm-interpretation  
**LLM:** MiMo V2.5 via OpenCode Go

## Context

Experiment 008 demonstrated that an effective LLM extractor synthesizes legitimate latent concepts — `ReservationPaid`, `PaymentCompleted`, `PaymentAccepted` — all grounded in evidence, all referring to overlapping semantic reality. Without identity reconciliation, the semantic graph fragments.

RFC 0009 asked whether independently inferred semantic concepts can be reconciled into stable identities without collapsing genuinely distinct concepts. The experiment uses four adversarial test categories plus the full reservation extraction pipeline.

## Results

### Adversarial test categories

| Category | Description | Merge Precision | Merge Recall | False-Collapse | Distinct Precision |
|---|---|---|---|---|---|
| 1 — Same meaning | Different names, same referent | 100% | 25% | 0% | 100% |
| 2 — Different meaning | Similar names, causally related | — | — | 0% | 100% |
| 3 — Same representation | Same syntax, different roles | 0% | — | **100%** | 50% |
| 4 — Abstraction levels | Chain, not collapse | — | — | 0% | 100% |

### Full pipeline reconciliation

| Metric | Value |
|---|---|
| Candidates (pre-reconciliation) | 35 |
| Proposals generated | 15 |
| Merged concept groups | 9 |
| Reconciled concepts | 32 |
| New `related` assertions | 5 |
| Correct `distinct` decisions | 1 |

The LLM correctly merged:
- `processExpiry causes expired` ↔ `processExpiry transitions_to expired` (same concept, different predicates)
- `paid forbids expired` from 2 sources → 1 consolidated
- `active forbids expired` from 3 sources → 1 consolidated
- `canPay authorized_by reservation.ownerId` ↔ `action authorized_by reservation.ownerId` ↔ `reservation_owner authorized_by ownerId` (3 → 1)

### What worked

**Category 1 — partial success.** The LLM merged `PaymentAccepted` ↔ `paymentStatus: accepted` (correct) but treated `payment-complete` and `result.paid` as `related` rather than `same`. The LLM is conservative about merges when evidence comes from different layers (service vs test vs audit log). Merge precision was 100% — no incorrect merges — but recall was 25%.

**Category 2 — correct preservation.** `PaymentAccepted` and `ReservationPaid` remained distinct. The LLM proposed a `related` relationship with a suggested `causes` assertion. This is the right answer: one causes the other, they are not the same concept.

**Category 4 — correct chain.** `RateLimitExceeded → RequestRejected → HTTP 429` formed a causal chain with `related` proposals. No collapse. The three abstraction levels stayed separate.

### What failed

**Category 3 — false collapse.** The LLM merged `payReservation requires active` and `processExpiry requires active` into a single concept because both reference the same state value `"active"`. This is the dangerous failure mode: two preconditions for different actions sharing a state name are not the same semantic concept. The 100% false-collapse rate on this category is the critical finding.

The root cause: the LLM conflates **shared state reference** with **semantic identity**. Two different functions requiring the same precondition are not the same concept — they are independent requirements that happen to reference the same state.

### What this means

Reconciliation works for the easy cases (merging duplicates, preserving causally related concepts, forming abstraction chains). The hard case is **referential ambiguity**: when two candidates reference the same entity but play different semantic roles.

This is not a prompt problem. The LLM correctly understands the distinction when the evidence is explicit. The problem is that the reconciliation prompt receives candidates without enough structural context to distinguish:

```
payReservation requires active    (precondition of action A)
processExpiry requires active     (precondition of action B)
```

from:

```
paid forbids expired    (invariant about state X)
paid forbids expired    (same invariant, different source)
```

Both pairs share syntactic structure. Only the second pair should merge.

## Pressure ledger

| Requirement | Result |
|---|---|
| Merge precision ≥ 90% | **passes** — 100% (no incorrect merges) |
| Merge recall ≥ 70% | **fails** — 25% (too conservative) |
| False-collapse rate ≤ 5% | **fails** — 25% overall, 100% on category 3 |
| Distinct precision ≥ 85% | **passes** — 88% |

## What needs investment

1. **Role-aware reconciliation.** The LLM needs to distinguish "same state referenced by different actions" from "same concept duplicated across sources." This likely requires including the full candidate assertion (subject + predicate + object) as structural context, not just the concept name.

2. **Merge recall.** The LLM is too conservative about merging across evidence layers. `PaymentAccepted` from the service layer and `result.paid` from tests should merge — the evidence is complementary, not contradictory.

3. **Evaluation framework refinement.** The current evaluation measures proposal-level accuracy. Concept-level evaluation (after apply) would give a clearer picture of the final model quality.

## Decision

### What worked

- Evidence-slice-based reconciliation (no raw code needed)
- 4-relationship vocabulary (`same`/`distinct`/`related`/`unknown`)
- Causal chain preservation (abstraction levels)
- Correct `distinct` decisions on causally related concepts

### What needs work

- Referential ambiguity: shared state names across different semantic roles
- Cross-layer merge recall (service vs test vs audit)
- Reconciliation prompt needs richer structural context

### What this means

The reconciliation architecture is validated in principle but the LLM needs better structural context to avoid false collapses. The next experiment should focus on **role-aware reconciliation** — giving the LLM the full assertion triple (subject + predicate + object) as the primary identity signal, not just the object concept name.

The 4-category adversarial test framework is reusable for measuring progress on this problem.
