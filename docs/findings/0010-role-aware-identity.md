# Findings 0010: Role-Aware Semantic Identity

**Status:** Complete  
**Date:** 2026-09-10  
**Depends on:** RFC 0010, findings/0009-identity-reconciliation  
**LLM:** MiMo V2.5 via OpenCode Go

## Context

Experiment 0009 conflated concept identity with assertion identity. The LLM merged `payReservation requires active` with `processExpiry requires active` because both reference the same state — conflating shared referent with shared identity.

RFC 0010 separated three identity levels (referent, assertion, evidence) and defined assertion identity over semantic roles — subject, predicate, object, constraint, scope — rather than entity similarity. The experiment tests whether role-aware reconciliation eliminates false collapses.

## Results

### Adversarial test categories

| Category | Description | How resolved | Result |
|---|---|---|---|
| 1 — Same meaning | Different names, same referent | LLM (ambiguous) | **4→1 merge, 100% precision/recall** |
| 2 — Different meaning | Similar names, causally related | LLM (ambiguous) | Correctly distinct |
| 3 — Same object, different subjects | Role-confusion trap | **Deterministic** | **Correctly distinct** |
| 4 — Abstraction levels | Chain, not collapse | LLM (ambiguous) | Correctly distinct |
| 5 — Same subject, different objects | Different preconditions | **Deterministic** | Correctly distinct |
| 6 — Same triple, different predicates | causes vs requires | **Deterministic** | Correctly distinct |
| 7 — Same triple, different constraints | owner vs organisation | LLM (ambiguous) | Correctly distinct |

| Metric | Result |
|---|---|
| False-collapse rate | **0%** |
| Role-confusion merges | **0** |
| Distinct precision | **100%** |

### What the deterministic matcher handles

Four of seven categories are resolved without the LLM:

- **Different subjects, same predicate/object** — signature mismatch on subject role. Category 3 (the 0009 failure) is now impossible structurally.
- **Same subject, different objects** — signature mismatch on object role.
- **Same triple, different predicates** — signature mismatch on predicate role.
- **Exact signature match** — automatic merge (used in category 1 after concept normalization).

The deterministic matcher is the primary safeguard. The LLM adjudicates only genuine semantic ambiguity.

### What the LLM handles

Three categories require semantic judgment:

- **Category 1** — `processPayment` vs `handlePayment` vs `recordPayment` vs `PaymentController` normalized to `PaymentAction` via concept aliases, then merged deterministically. All 4 candidates collapsed into 1 assertion with signature `(PaymentAction, causes, PaymentAccepted)`.
- **Category 2** — `PaymentAccepted` and `ReservationPaid` correctly preserved as distinct. The LLM proposed `related` with a suggested `causes` assertion.
- **Category 4** — `RateLimitExceeded → RequestRejected → HTTP 429` preserved as a chain. All three remained distinct.
- **Category 7** — `authorized_by User where owner` vs `authorized_by User where organisation` correctly distinguished. The LLM recognized the constraint difference.

### Concept normalization

The 0009 failure required no LLM intervention. Adding subject-level aliases (`processPayment`/`handlePayment`/`PaymentController` → `PaymentAction`) and pattern-based fallback (`process` + `payment` → `PaymentAction`) resolved category 1 deterministically after normalization.

This confirms that concept reconciliation (naming) and assertion reconciliation (role structure) are separable concerns, as RFC 0010 proposed.

### Three identity levels validated

| Level | What it resolves | Example |
|---|---|---|
| Referent identity | `PaymentAccepted` ≈ `payment-complete` | Concept normalization |
| Assertion identity | `(Pay, requires, Active)` ≠ `(Expiry, requires, Active)` | Deterministic signature matching |
| Evidence identity | Test A + Guard B = same evidence for one assertion | Not tested in 0010 (deferred) |

Each level has different identity semantics. 0009 conflated the first two. 0010 separates them cleanly.

## What the experiment validated

### 1. Assertion identity is defined over roles, not entities ✓

Two assertions sharing an object but having different subjects are distinct. The signature-based matcher enforces this deterministically.

### 2. Deterministic structure prevents obvious false collapses ✓

Four of seven adversarial categories are resolved without the LLM. The 0009 failure (category 3) is now a structural impossibility.

### 3. LLM adjudicates genuine semantic ambiguity only ✓

The LLM receives only pairs that survived deterministic filtering. It makes correct `distinct` decisions on causally related concepts (category 2), abstraction chains (category 4), and constraint differences (category 7).

### 4. Concept normalization is separable from assertion reconciliation ✓

Category 1 resolved after subject-level concept normalization. Naming and role structure are independent concerns.

## Pressure ledger

| Requirement | Result |
|---|---|
| False-collapse rate ≤ 2% | **passes** — 0% |
| Role-confusion false merges = 0 | **passes** — 0 |
| Merge precision ≥ 95% | **passes** — 100% (category 1) |
| Merge recall ≥ 80% | **passes** — 100% (category 1) |
| Distinct precision ≥ 90% | **passes** — 100% |

## What needs investment

1. **Concept normalization coverage.** The alias map is手工 curated. Production use requires either a broader alias strategy or a concept reconciliation pass before assertion reconciliation.

2. **Evidence identity.** 0010 did not test evidence deduplication (multiple observations supporting one assertion). This is the third identity level from RFC 0010.

3. **Full pipeline validation.** The adversarial tests use synthetic candidates. The role-aware reconciler needs testing on real extraction output to verify it handles the noise and variety of LLM-generated candidates.

## Decision

### What worked

- `AssertionSignature` over (subject, predicate, object, constraint, scope)
- Deterministic matching for structural cases (4/7 categories)
- LLM only for genuinely ambiguous pairs
- Zero false-collapse across all categories
- Separation of concept identity and assertion identity

### What needs work

- Concept normalization at scale
- Evidence identity level
- Real-world candidate noise

### What this means

The 0009 failure was a structural problem, not a prompt problem. Role-aware signature matching makes false collapses structurally impossible for cases where the assertion triple differs in any role. The LLM is reserved for cases that genuinely require semantic judgment.

The architecture is now:

```
candidate concepts → concept normalization → canonical referents
                                                    ↓
candidate assertions → deterministic signature matching → obvious merges/distincts
                                                    ↓
                                        ambiguous pairs → LLM role-aware reconciliation
                                                    ↓
                                              canonical assertions
```

This is the pipeline that RFC 0010 specified, and it works.
