# RFC 0006: Semantic Conformance Experiment

**Status:** Complete  
**Target:** SEMIR implementation conformance  
**Last updated:** 2026-09-09  
**Depends on:** ADR 0006, findings/0005-constraint-calculus

## 1. Summary

Five experiments validated SEMIR as a representation of system meaning. This experiment asks a different question:

> **Can SEMIR connect that meaning to actual software and tell us whether the implementation does what we think it means?**

The experiment is not "prove correctness." It is "gather and structure evidence." The output is not a binary conform/non-conform — it is a per-assertion evidence profile:

```text
Assertion: Paid forbids Expired
  Intent evidence:    validated (product requirement)
  Static evidence:    supports (ExpiryWorker guards paid state)
  Test evidence:      supports (PaidExpiryTest)
  Runtime evidence:   unavailable
  Conformance:        SUPPORTED
```

## 2. Motivation

Representation without connection to implementation is a modeling exercise. The engineering value of SEMIR depends on whether semantic assertions can be tied to code, tests, and traces — and whether that connection produces useful understanding.

The conformance model should be:
- **Evidence-based**: every conformance claim has sources
- **Multi-dimensional**: code, tests, traces, formal verification are separate evidence types
- **Honest**: distinguishes absence of evidence from contradiction
- **Domain-independent**: no reservation/payment/rate-limit knowledge in the conformance logic

## 3. Experiment contract

### 3.1 What is frozen

- The semantic substrate (ADR 0006)
- The assertion model with evidence and epistemic status

### 3.2 What is not frozen

- The conformance model itself (designed in this experiment)
- Implementation mapping format
- Evidence query mechanisms

### 3.3 Implementation target

A small, deliberately structured TypeScript reservation implementation:

```text
src/
  ReservationService.ts    — pay, expire actions
  ExpiryWorker.ts          — expiry processing
  PaymentService.ts        — payment processing
  types.ts                 — Reservation, PaymentIntent
test/
  ReservationExpiry.test.ts
  PaymentAuthorization.test.ts
  PaymentIdempotency.test.ts
```

The implementation is intentionally simple. The experiment tests the conformance abstraction, not code understanding.

### 3.4 Three assertion classes

Each tests a different aspect of conformance:

#### A. Structural: PayReservation causes PaymentAccepted

Can implementation/test evidence establish a causal relationship?

#### B. Relational: ∀r: actor == r.owner

Can SEMIR identify whether enforcement applies to the same bound instance?

#### C. Negative: Paid forbids Expired

Can SEMIR gather evidence for a prohibition rather than a positive path?

### 3.5 Deliberate variants

After initial conformance, modify the implementation:

| Variant | Change | Expected shift |
|---|---|---|
| A (correct) | No change | SUPPORTED for all |
| B (remove guard) | Delete paid-state check in ExpiryWorker | Paid forbids Expired → CONTRADICTED |
| C (delete test) | Remove PaidExpiryTest | Test evidence absent → PARTIALLY SUPPORTED |

## 4. Conformance vocabulary

```ts
type ConformanceStatus =
  | "supported"       // multiple evidence sources confirm
  | "contradicted"    // evidence demonstrates violation
  | "partially_supported" // some evidence, gaps remain
  | "unverified"      // assertion understood, no evidence
  | "unknown";        // insufficient data to assess

interface EvidenceRecord {
  type: "static" | "test" | "runtime" | "formal" | "documentation";
  source: string;
  stance: "supports" | "contradicts" | "neutral";
  detail?: string;
}

interface ConformanceResult {
  assertionId: string;
  status: ConformanceStatus;
  evidence: EvidenceRecord[];
}
```

## 5. Implementation mappings

Explicit, human-authored mappings (no AI inference yet):

```yaml
implementation:
  mappings:
    sem://reservation/action/pay-reservation:
      symbols:
        - ReservationService.pay

    sem://reservation/event/payment-accepted:
      symbols:
        - PaymentAccepted

    sem://reservation/assertion/paid-reservations-do-not-expire:
      tests:
        - ReservationExpiry.paidReservationNeverExpires
      code:
        - ExpiryWorker.processExpiry:81

    sem://reservation/assertion/pay-authorized-by-owner:
      tests:
        - PaymentAuthorization.onlyOwnerMayPay
      code:
        - ReservationService.authorize
```

## 6. Acceptance criteria

1. Semantic assertion maps to multiple evidence sources (code, tests, traces)
2. Evidence retains traceability back to assertion identity
3. Absence of evidence distinguished from contradiction
4. Relational constraints survive into conformance (same bound instance)
5. Conformance logic is domain-independent (rename test passes)
6. Three variants (correct, removed guard, deleted test) produce different conformance states

## 7. What NOT to do

- Do not implement semantic extraction (use explicit mappings)
- Do not collapse evidence into one confidence number
- Do not attempt full correctness proofs
- Do not add runtime tracing infrastructure
- Do not add AI-powered code understanding

## 8. Deliverables

1. `examples/conformance/` — TypeScript implementation
2. `examples/conformance/conformance-map.yaml` — explicit mappings
3. `src/core/conformance.ts` — conformance model types
4. Findings: `docs/findings/0006-conformance.md`
5. Updated `semir explain` to show implementation evidence

## 9. After this experiment

If conformance works:

1. Introduce semantic extraction (Experiment 007)
2. Build investigation workflows for unverified assertions
3. Develop semantic verification coverage metrics
