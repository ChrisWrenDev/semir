# RFC 0011: Extracted vs Intended Semantic Reconciliation

**Status:** Proposed  
**Target:** Compare extracted and intended semantic models, classify differences  
**Last updated:** 2026-09-10  
**Depends on:** RFC 0010, findings/0010-role-aware-identity

## 1. Summary

Experiments 0007–0010 built a pipeline from implementation code to reconciled semantic assertions. The extracted model now has stable identity architecture (referent, assertion, evidence). The intended model exists as authored SEMIR.

The missing capability is comparison:

> **Can SEMIR compare an independently extracted semantic model with an independently authored intended model and correctly classify their differences?**

This is where SEMIR stops being a representation research project and starts answering questions engineering teams actually care about:

- What behavior changed?
- Which intended semantics no longer have implementation evidence?
- What does the implementation do that isn't represented in intent?
- Which semantic assertions are contradicted by code or tests?

## 2. Architecture

```
Intended SEMIR (authored)
        │
        │
        ▼
Implementation → extraction → reconciliation → Extracted SEMIR
        │                   │
        └───── compare ─────┘
                  │
                  ▼
          semantic differences
```

## 3. Comparison vocabulary

Six classifications, ordered by evidence strength:

```ts
type ComparisonClassification =
  | "match"                // exact semantic equivalence
  | "semantic_drift"       // same identity, changed literal/constraint
  | "contradicted"         // intended assertion violated by evidence
  | "unverified_intent"    // intended assertion, no implementation evidence found
  | "undocumented_behaviour" // extracted assertion, no corresponding intent
  | "unknown";             // insufficient evidence to classify
```

### Why `unverified_intent` instead of `unimplemented_intent`

"Not found in Extracted SEMIR" ≠ "not implemented." Extraction is lossy. A guard may exist but the extractor missed it. A test may exist under a different name. Absence of extraction evidence is not proof of absence in implementation.

`unverified_intent` honestly represents: "we intended this, but we cannot confirm it from the implementation evidence we have."

### Why `undocumented_behaviour` matters

Implementations contain real semantics that nobody deliberately modeled. A retry limit of 3, a timeout of 30 minutes, an authorization check that was added in a refactor — these are real semantic facts that the intended model never captured.

`undocumented_behaviour` is not a bug. It is information.

## 4. Semantic correspondence

Comparing two independently created models is not always identity equality. The comparison produces a correspondence artifact:

```ts
interface SemanticCorrespondence {
  intendedAssertion: string;    // intended assertion ID
  extractedAssertion?: string;  // extracted assertion ID (undefined if unverified)
  classification: ComparisonClassification;
  relationship?: "equivalent" | "refines" | "overlaps" | "contradicts";
  confidence: "high" | "medium" | "low";
  rationale: string;
  evidence: string[];
}
```

The `relationship` field captures that the extracted model may be a lower-resolution description of the same behavior:

```
Intended:  PaymentAccepted causes ReservationPaid
Extracted: PayReservation transitions Active → Paid
Relationship: refines (extracted is more specific about mechanism)
```

This distinction matters as models diverge in resolution.

## 5. Comparison pipeline

### Pass 6a: Deterministic signature comparison

Canonicalize both models using the same concept normalization and assertion signatures from 0010. Then:

- **Exact signature match** → `match`
- **Same identity, different literal/constraint** → candidate `semantic_drift`
- **Intended only** → candidate `unverified_intent`
- **Extracted only** → candidate `undocumented_behaviour`

### Pass 6b: LLM adjudication for ambiguous pairs

Only pairs that survived deterministic filtering reach the LLM. The prompt presents structured role information for both assertions and asks for classification.

The LLM handles cases like:

```
Intended:  PaymentAccepted causes ReservationPaid
Extracted: successful payment transitions Reservation Active → Paid
```

These may be semantically equivalent even though their structures differ.

### Why this follows 0010's principle

Use structural semantics to eliminate ambiguity before involving an LLM. Deterministic comparison handles obvious matches and mismatches. The LLM adjudicates genuine semantic ambiguity.

## 6. Controlled implementation variants

Reuse the reservation example from 0006/0007/0008 with five variants:

### Variant A — Exact implementation

No changes. All recoverable semantics should produce `match`.

### Variant B — Changed business rule

Change expiry timeout from 30 minutes to 10 minutes.

Expected: `semantic_drift` on the observable_within assertion.

### Variant C — Removed enforcement

Remove owner authorization check in `payReservation`.

Expected: `contradicted` or `unverified_intent` depending on evidence remaining.

### Variant D — Implementation-only behaviour

Add maximum payment retries = 3 without adding it to intended SEMIR.

Expected: `undocumented_behaviour`.

### Variant E — Stale intended model

Change the implementation deliberately and update tests accordingly, but leave intended SEMIR old.

Expected: SEMIR should recognize the model might be stale rather than automatically assuming the code is wrong. This tests whether the system produces `unknown` or `semantic_drift` instead of `contradicted`.

## 7. Acceptance criteria

| Metric | Target | Priority |
|---|---|---|
| Match precision | ≥ 95% | highest |
| Drift classification precision | ≥ 90% | high |
| False violation rate | ≤ 5% | **highest** |
| Undocumented-behaviour precision | ≥ 85% | high |
| Unknown/ambiguous preserved | 100% on adversarial cases | high |

**False violation rate is the top priority.** A tool that frequently tells engineers "your implementation violates intent" when it merely lacks evidence will rapidly lose trust.

## 8. Evidence-first output

Every classification produces evidence, not verdicts:

```
Assertion:
    only reservation owner may pay

Intended:
    validated

Extracted implementation:
    no equivalent enforcement discovered

Evidence searched:
    ReservationService.ts
    PaymentAuthorization.test.ts

Classification:
    UNVERIFIED_INTENT

Confidence:
    medium

Note:
    Extraction found ownership check (ownerId !== payerId) but did not
    produce an authorized_by assertion. This may be an extraction gap
    rather than an implementation gap.
```

## 9. Deliverables

1. `src/extract/compare.ts` — comparison types, deterministic matching, LLM prompt
2. `examples/extraction/compare-test-cases/` — five variant test cases
3. `examples/extraction/analyze-comparison.ts` — comparison pipeline runner
4. Findings: `docs/findings/0011-extracted-vs-intended.md`
