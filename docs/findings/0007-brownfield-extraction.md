# Findings 0007: Brownfield Semantic Extraction

**Status:** Complete  
**Date:** 2026-09-09  
**Depends on:** RFC 0007, findings/0006-conformance

## Context

RFC 0007 asked whether SEMIR can recover candidate semantic assertions from an existing implementation without knowing the intended model. The extractor sees only `src/` and `test/` — the authored `.semir` model is hidden as an oracle.

## Results

### Quantitative

| Metric | Value | Target |
|---|---|---|
| Reference assertions | 8 | — |
| Correctly recovered | 4 | — |
| Recall | 50% | ≥ 70% |
| Extracted candidates | 11 | — |
| Defensible | 9 | — |
| Precision | 82% | ≥ 75% |

**Precision target met. Recall target not met.**

### What was recovered

| Predicate | Recovered | How |
|---|---|---|
| `forbids` | ✓ | Guard `state === "paid"` + test "paid reservation never expires" |
| `transitions_to` | ✓ | Guard checks one state, writes another |
| `authorized_by` | ✓ | Equality check `reservation.ownerId !== payerId` |
| `causes` | ✗ | State write not linked to function entry as causal |

### What was missed

All four missed assertions are `causes` and `requires` patterns:

- `PayReservation causes PaymentAccepted` — function writes `state = "paid"` but no explicit event emission
- `PayReservation requires Active` — guard check present but not linked as precondition
- `ExpireReservation causes ReservationExpired` — same issue
- `ExpireReservation requires Active` — same issue

The `causes` pattern needs a richer evidence model: function entry → side effect → observable outcome. The current extraction only sees state mutations, not the causal chain.

### Deliberate ambiguity — successfully detected

The extractor found TWO authorization candidates:

```
HYPOTHESIZED: action authorized_by user.organisationId
  reasoning: equality check suggests authorization relationship

HYPOTHESIZED: action authorized_by reservation.ownerId
  reasoning: equality check suggests authorization relationship
```

This is exactly the ambiguous case from the RFC. The extractor correctly produced two hypotheses with `hypothesized` status instead of confidently inventing `ReservationOwner`. The ambiguity is preserved.

### Duplicate candidates — need consolidation

The extractor produced 9 defensible candidates but many are duplicates:

- `paid forbids expired` appears 2× (from 2 different test files)
- `active forbids expired` appears 4× (from multiple guard+test combinations)

Consolidation (pass 4) would merge these. The current implementation skips consolidation, so duplicates inflate the candidate count.

### Precision analysis

| Candidate | Defensible? | Notes |
|---|---|---|
| paid → transitions_to → expired | ✓ | Guard + state write |
| active → transitions_to → expired | ✓ | Guard + state write |
| active → transitions_to → paid | ✓ | Guard + state write |
| paid forbids expired (×2) | ✓ | Guard + test confirmation |
| active forbids expired (×4) | ~ | False positive — `state !== "active"` is a precondition, not a forbids |
| action authorized_by organisationId | ~ | Ambiguous — could be org membership, not ownership |
| action authorized_by ownerId | ✓ | Correctly identifies ownership check |

**2 questionable candidates** out of 11. Both are borderline — the `active forbids expired` pattern incorrectly interprets preconditions as prohibitions.

## What the experiment revealed

### 1. Deterministic extraction works for simple patterns

Guard checks + state mutations + test names produce recoverable evidence for `forbids`, `transitions_to`, and `authorized_by`. These patterns are syntactically visible.

### 2. `causes` requires semantic understanding

The `PayReservation causes PaymentAccepted` assertion involves a conceptual causal chain that isn't directly visible in the code. The code writes `state = "paid"` — there is no `PaymentAccepted` event in the implementation. The extractor would need to infer that the state mutation IS the event.

### 3. Ambiguity preservation is valuable

The two `authorized_by` candidates demonstrate that the extractor can surface ambiguity rather than forcing a choice. This is exactly what the SEMIR epistemic architecture was designed for.

### 4. Consolidation is necessary

Duplicate candidates from multiple evidence sources need merging. The current 82% precision would improve significantly with consolidation — many "defensible" candidates are actually the same assertion seen from different evidence paths.

### 5. The reference model is a clean oracle

Using the hidden `.semir` model as ground truth made evaluation straightforward. The assertion predicate vocabulary provided a natural mapping between reference and extracted candidates.

## Pressure ledger

| Requirement | Result |
|---|---|
| Assertion recall ≥ 70% | **fails** — 50% (causes/requires patterns missed) |
| Precision ≥ 75% | **passes** — 82% |
| Evidence fidelity | ✓ — every candidate traces to source |
| Uncertainty honesty | ✓ — ambiguous cases produce `hypothesized` |
| Contradiction preserved | not tested (no contradictory code artifacts) |
| Relational semantics survive | ✓ — `ownerId` check detected |

## Decision

### What worked

- Deterministic evidence extraction for guard + state + test patterns
- Candidate interpretation for `forbids`, `transitions_to`, `authorized_by`
- Ambiguity preservation in `hypothesized` status
- Reference model as evaluation oracle

### What needs investment

- `causes` pattern: requires understanding function → event causal chains
- Consolidation: merging duplicate candidates from multiple evidence sources
- Precondition detection: distinguishing `requires` from `forbids`
- Contradiction detection: comparing code vs. documentation evidence

### What this means

The extraction pipeline recovers approximately half of reference assertions with high precision. The missed half requires semantic understanding beyond syntactic pattern matching. This is the natural boundary where deterministic extraction ends and LLM-assisted interpretation begins.

The four-pass architecture (evidence → candidates → reconciliation → consolidation) is validated as a structure. Passes 1 and 2 work deterministically. Passes 3 and 4 need either richer heuristics or LLM assistance.
