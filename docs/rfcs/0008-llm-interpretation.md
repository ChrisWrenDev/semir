# RFC 0008: LLM-Assisted Semantic Interpretation

**Status:** Complete  
**Target:** SEMIR extraction with LLM interpretation  
**Last updated:** 2026-09-09  
**Depends on:** RFC 0007, findings/0007-brownfield-extraction

## 1. Summary

Experiment 007 established that deterministic extraction achieves 82% precision but only 50% recall. The recall gap is dominated by semantic interpretation — inferring concepts not explicitly named in code.

This experiment adds an LLM as a semantic interpreter over deterministic evidence. The question:

> **Can an LLM infer latent semantic assertions from structured implementation evidence while preserving evidence, uncertainty, and precision?**

The critical constraint: the LLM receives evidence slices, not raw source code. It proposes meanings; the deterministic layer establishes what happened.

## 2. Architecture

```
code + tests
    ↓
deterministic extraction (pass 1-2)
    ↓
evidence graph + candidate assertions
    ↓
LLM semantic interpretation (pass 3)
    ↓
candidate assertions with epistemic status
    ↓
consolidation (pass 4)
    ↓
candidate SEMIR
```

## 3. What the LLM receives

### Mode A: Evidence only

```json
{
  "function": "payReservation",
  "inputs": ["reservation", "paymentResult"],
  "guards": ["reservation.state !== 'active'"],
  "writes": ["reservation.state = 'paid'"],
  "tests": ["marks reservation paid after successful payment"],
  "existing_candidates": [
    {"subject": "payReservation", "predicate": "transitions_to", "object": "paid"}
  ]
}
```

### Mode B: Evidence + source context

Same as Mode A, plus the actual function source code and test code.

## 4. What the LLM must emit

Structured propositions only. No prose. No new predicates.

```ts
interface LLMCandidate {
  subject: string;
  predicate: Predicate;
  object?: string;
  constraint?: { description: string };
  epistemicStatus: "inferred" | "hypothesized";
  confidence: "high" | "medium" | "low";
  rationale: string;
  evidenceRefs: string[];
}
```

The LLM must use the existing 12 predicates. If evidence cannot be expressed, it must say so.

## 5. Consolidation (pass 4)

Before measuring, consolidate duplicates:

```ts
interface ConsolidatedAssertion {
  canonicalSubject: string;
  predicate: Predicate;
  canonicalObject?: string;
  evidenceCount: number;
  supportingEvidence: EvidenceRecord[];
  contradictingEvidence: EvidenceRecord[];
  epistemicStatus: EpistemicStatus;
  confidence: number;
}
```

Group by normalized (subject, predicate, object). Merge evidence. Resolve status from evidence balance.

## 6. Deliberate test cases

### 6.1 Latent concept synthesis

Code writes `state = "paid"` but never names `PaymentAccepted`. LLM should infer the semantic event.

### 6.2 Ambiguous authorization

Two equality checks: `ownerId` and `organisationId`. LLM should produce two candidates, not choose one.

### 6.3 Constraint recovery

If evidence shows `actor.id == reservation.ownerId`, LLM should produce a constraint `actor == reservation.owner`, not just `authorized_by User`.

## 7. Acceptance criteria

| Metric | Target |
|---|---|
| Recall | ≥ 70% |
| Precision (overall) | ≥ 80% |
| Precision (high confidence) | ≥ 90% |
| Ambiguity preserved | no silent collapses |
| Constraint recovery | `actor == reservation.owner` detected |
| Calibration | high-confidence ≥ 90%, hypothesized ≤ 60% |

## 8. Deliverables

1. `src/extract/consolidate.ts` — pass 4 consolidation
2. `src/extract/llm-interpret.ts` — LLM interpretation interface
3. `examples/extraction/evidence-slices/` — Mode A inputs
4. Findings: `docs/findings/0008-llm-interpretation.md`
