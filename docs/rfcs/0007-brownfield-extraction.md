# RFC 0007: Brownfield Semantic Extraction

**Status:** Complete  
**Target:** SEMIR extraction from existing code  
**Last updated:** 2026-09-09  
**Depends on:** RFC 0006, findings/0006-conformance

## 1. Summary

Experiment 006 proved SEMIR can connect semantic assertions to implementation evidence. This experiment asks the reverse:

> **Can SEMIR recover candidate semantic assertions from an existing implementation without already knowing the intended model?**

The goal is not "recover truth." It is "recover claims supported by evidence." Every extracted assertion must trace to actual code or test artifacts. Uncertainty is a feature, not a failure.

## 2. Architecture

Four passes:

```
1. Evidence extraction
   code + tests → implementation facts

2. Candidate interpretation
   implementation facts → candidate assertions

3. Identity reconciliation
   candidate concepts → shared semantic identities

4. Assertion consolidation
   duplicate / supporting / conflicting candidates → candidate SEMIR
```

## 3. Constraints

### 3.1 What is hidden

The authored `.semir` model. The extractor sees only:

```
src/
test/
```

### 3.2 What is frozen

The SEMIR representation (ADR 0006). Extraction produces candidates in existing types.

### 3.3 What is not frozen

The extraction logic itself. It may use regex, AST parsing, heuristics, or later LLM assistance.

## 4. Target predicate families

Start with four classes already understood:

| Pattern | Source evidence | Example |
|---|---|---|
| `causes` | function → event emission | PayReservation causes PaymentAccepted |
| `transitions_to` | state mutation + guard | ReservationExpired transitions Active → Expired |
| `forbids` | negative guard + test | Paid forbids Expired |
| `authorized_by` | equality check on actor | actor == reservation.owner |

## 5. Provisional identity

Extracted concepts use provisional IDs:

```
candidate://src/ExpiryWorker.processExpiry
candidate://test/ReservationExpiry.paidNeverExpires
```

Identity reconciliation maps provisional → canonical when a reference model exists.

## 6. Deliberate test artifacts

### 6.1 Ambiguous code

```ts
function canPay(user: User, reservation: Reservation) {
  return user.organisationId === reservation.organisationId;
}
```

Is the concept `ReservationOwner` or `MemberOfSameOrganisation`? Extraction should produce a hypothesis, not a confident assertion.

### 6.2 Contradictory artifacts

```ts
// code: paid guard prevents expiry
if (reservation.state === "paid") return;

// old documentation: paid reservations expire after 24h
```

Extraction should produce two conflicting candidates, not choose one.

### 6.3 Missing evidence

An assertion in the reference model with no corresponding code or test. Extraction should not recover it (measuring recall gap).

## 7. Acceptance criteria

1. **Assertion recall**: of reference assertions observable in artifacts, extraction recovers ≥ 70%
2. **Precision**: of extracted candidates, ≥ 75% are defensible
3. **Evidence fidelity**: every candidate traces to specific source artifacts
4. **Uncertainty honesty**: ambiguous cases produce `hypothesized`, not `validated`
5. **Contradiction preserved**: conflicting artifacts produce conflicting candidates
6. **Relational semantics survive**: `actor == reservation.owner` recovered, not just `authorized_by User`

## 8. Deliverables

1. `src/extract/` — extraction pipeline
2. `examples/extraction/` — deliberately crafted test artifacts
3. `examples/extraction/reference.semir` — hidden reference model
4. Findings: `docs/findings/0007-brownfield-extraction.md`
