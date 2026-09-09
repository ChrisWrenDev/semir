# Findings 0006: Semantic Conformance Experiment

**Status:** Complete  
**Date:** 2026-09-09  
**Depends on:** RFC 0006, findings/0005-constraint-calculus

## Context

RFC 0006 asked: can SEMIR connect semantic assertions to implementation evidence and distinguish supported, contradicted, and unverified semantics without domain-specific conformance logic?

A small TypeScript reservation implementation was built with explicit mappings from semantic assertions to code symbols and tests. Three variants tested the conformance model.

## Variant results

### Variant A: Correct implementation

```
✓ pay-causes-payment-accepted          supported
✓ pay-authorized-by-owner             supported
✓ paid-reservations-do-not-expire     supported
✓ pay-requires-active                  supported
✓ expire-causes-reservation-expired   supported

Summary: 5 supported, 0 contradicted, 0 partial
```

### Variant B: Paid-state guard removed

```
✓ pay-causes-payment-accepted          supported
✓ pay-authorized-by-owner             supported
✗ paid-reservations-do-not-expire     contradicted
✓ pay-requires-active                  supported
✓ expire-causes-reservation-expired   supported

Summary: 4 supported, 1 contradicted, 0 partial
```

The conformance correctly identified that removing the guard from `ExpiryWorker` contradicts the `Paid forbids Expired` invariant. Static symbols `paid_cannot_expire` and `reservation.state === "paid"` were no longer found.

### Variant C: Test deleted

```
~ pay-causes-payment-accepted          partially_supported
~ pay-authorized-by-owner             partially_supported
✓ paid-reservations-do-not-expire     supported
~ pay-requires-active                  partially_supported
~ expire-causes-reservation-expired   partially_supported

Summary: 1 supported, 0 contradicted, 4 partial
```

The conformance correctly distinguished absence of evidence (test not found → `neutral` stance) from contradiction. Assertions with static implementation evidence but no tests show as `partially_supported`.

## What the experiment validated

### 1. Evidence is multi-dimensional ✓

Conformance does not collapse into a single confidence number. Each assertion has independent static and test evidence with explicit stances.

### 2. Absence ≠ contradiction ✓

Variant C proved that missing tests produce `partially_supported`, not `contradicted`. This is critical for honest conformance reporting.

### 3. Contradiction is detectable ✓

Variant B proved that removing an implementation guard is detected as contradiction, not merely absence.

### 4. Conformance logic is domain-independent ✓

The analysis script contains no reservation/payment knowledge. It operates on generic symbol matching against explicit mappings.

### 5. Three evidence types distinguished ✓

- Static (code symbols): `supports` or `contradicts`
- Test (test names): `supports` or `neutral`
- Runtime: not yet implemented (all `unverified`)

## What the experiment revealed

### The mapping format is the bottleneck

The explicit mapping file (`conformance-map.yaml`) is the most labor-intensive artifact. Each assertion requires human identification of relevant code symbols and tests. This is intentional for the experiment — it tests the conformance abstraction, not code understanding.

### Missing test ≠ missing implementation

The `partially_supported` status correctly captures the common case: code exists but verification is incomplete. This is more useful than a binary conform/non-conform.

### Static evidence is stronger than test evidence

An assertion with 2 static supports is `supported` even without tests (variant C, `paid-reservations-do-not-expire`). This may be too lenient — the experiment should record this as a design decision for the next iteration.

### Runtime evidence is the next gap

No runtime traces were collected. The conformance model has a `runtime` evidence type but no mechanism to populate it. This is the natural next extension.

## Pressure ledger

| Requirement | Result |
|---|---|
| Assertion maps to multiple evidence sources | ✓ |
| Evidence retains traceability to assertion | ✓ |
| Absence ≠ contradiction | ✓ |
| Relational constraints survive into conformance | ✓ (type-level only — instance-level not tested) |
| Domain-independent analysis | ✓ |
| Three variants produce different states | ✓ |
| No confidence number collapse | ✓ |

## Summary

| Criterion | Result |
|---|---|
| Multi-dimensional evidence | ✓ |
| Absence vs contradiction | ✓ |
| Domain independence | ✓ |
| Traceability to assertion identity | ✓ |
| Three variant test | ✓ |
