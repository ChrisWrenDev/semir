# RFC 0002: Second-Domain Experiment — API Rate Limiter

**Status:** Complete  
**Target:** SEMIR kernel validation  
**Last updated:** 2026-09-09  
**Depends on:** RFC 0001, findings/0001-mvp-validation

## 1. Summary

This RFC defines an experiment to test whether the SEMIR kernel is genuinely domain-independent or accidentally well-fitted to workflow/state-machine systems.

The MVP validated the mechanics using a reservation/payment domain — a workflow system with discrete states, actions, and transitions. That domain may have been too kind. A rate limiter introduces concurrency, time windows, quantitative limits, algorithmic semantics, and fairness — pressures the current model has not experienced.

The experiment is not "can SEMIR describe a rate limiter?" — anything can be described if you add enough fields. The experiment is:

> **Can the existing semantic primitives compose naturally to describe a rate limiter without smuggling rate-limiter concepts into the kernel?**

## 2. Motivation

The reservation domain shares structural properties with many business systems:

- discrete states (active, paid, expired)
- actions that cause events
- events that trigger transitions
- authorization constraints
- temporal timeouts

A rate limiter is structurally different:

- continuous quantitative state (available tokens)
- concurrent access to shared state
- time-dependent behavior (refill)
- algorithmic identity (token bucket vs. sliding window)
- fairness across independent actors
- operational properties (restart behavior)
- performance requirements (p99 latency)

If the kernel handles both without new primitives, the abstraction is more likely to be real. If it collapses, the failure modes tell us exactly where the kernel is incomplete.

## 3. Experiment contract

### 3.1 What is frozen

The following are frozen for the duration of this experiment:

- **Predicate vocabulary**: the 12 existing predicates (`causes`, `requires`, `forbids`, `transitions_to`, `reads`, `writes`, `produces`, `occurs_before`, `authorized_by`, `must_hold`, `observable_within`, `exactly_once`)
- **AssertionKind vocabulary**: the 10 existing kinds
- **Core types**: `SemanticObject`, `Assertion`, `AssertionTarget`, `Condition`, `Evidence`
- **Projection architecture**: slice → lower → IR → render

### 3.2 What is not frozen

- The `.semir` format (can be extended)
- Projection implementations (can be improved)
- Test infrastructure
- Documentation

### 3.3 What counts as evidence

Every point where the model becomes **unnatural, ambiguous, duplicated, or projection-specific** must be recorded in the pressure ledger (§5).

A new primitive MUST NOT be introduced unless the inability to express a semantic distinction causes a **concrete projection or verification failure** — not merely aesthetic discomfort.

### 3.4 What counts as a new kernel primitive

A proposed addition passes the kernel test only if:

1. It cannot be expressed by composing existing primitives
2. It is plausibly useful in three unrelated domains
3. Its absence causes a projection to produce wrong output or emit a false diagnostic

If it fails any of these, it belongs in a specialist extension (§7), not the kernel.

## 4. Domain: API rate limiter

### 4.1 Semantic claims to model

At minimum, model:

```text
Rule:
    A client may make at most 100 requests per minute.

Concurrent semantics:
    Two requests arriving simultaneously must not both
    consume the final available token.

Algorithm:
    Token bucket with capacity 100 and refill rate 100/min.

Invariant:
    availableTokens >= 0

Temporal:
    tokens refill according to elapsed time.

Observable effect:
    rejected request returns HTTP 429.

Operational:
    restart must not unexpectedly reset limits.

Quantitative:
    decision latency p99 < 2ms.

Fairness:
    one client cannot consume another client's allocation.
```

### 4.2 Size budget

Keep the example near:

- 2–3 entities (Client, Request, TokenBucket)
- 4–6 actions (AllowRequest, RejectRequest, RefillTokens, ResetBucket)
- 5–8 events (RequestAllowed, RequestRejected, TokensRefilled, BucketReset)
- 10–20 assertions
- 2–3 invariants

### 4.3 What to avoid

Do NOT model the rate limiter as a workflow. The point is not to find states and transitions — it is to discover whether the kernel can represent continuous quantitative state, concurrency, and temporal refill without adding domain-specific predicates.

## 5. Pressure ledger

| Semantic pressure | Result | Notes |
|---|---|---|
| `requires` expresses token availability | works | AllowRequest requires BucketReady — same pattern as reservation |
| `causes` expresses request rejection | works | RejectRequest causes RequestRejectedEvent — lifecycle pattern identical |
| `forbids` expresses negative token count | works | BucketEmpty forbids RequestAllowed — invariant pattern identical |
| `authorized_by` expresses client ownership | works | AllowRequest authorized_by Client — security pattern identical |
| `observable_within` expresses temporal constraint | works | RefillTokens observable_within 1s — literal type handles duration |
| `exactly_once` expresses idempotent refill | works | Conditional forbids pattern — same as payment retry |
| `writes` expresses data flow | works | AllowRequest writes TokenBucket — fact pattern identical |
| p99 latency | awkward | Rendered as `observable_within 2ms` — syntactically valid but semantically imprecise. `observable_within` means observability window, not statistical latency. Predicate name misrepresents meaning. |
| Token-bucket algorithm identity | awkward | No way to express "uses token bucket algorithm." Model describes behavior without naming the algorithm. Two algorithms produce identical models. Property vs. mechanism distinction unsupported. |
| `AllowRequest requires BucketReady` in TLA+ | awkward | Lowering shows `reservationState \in {StateType}` instead of restricting to BucketReady. Lowering quality issue. |
| Refill idempotency property name | awkward | `TokensRefilledEventTokensRefilledEventForbids` doubled name. Naming convention fix needed. |
| Continuous quantitative state (token count) | fails | Cannot express "availableTokens is integer 0..100." No concept of value domain or ranged variable. |
| Concurrency / atomic decrement | fails | Cannot express "two requests must not both consume final token." No atomicity or mutual exclusion. |
| Fairness across clients | fails | Cannot express "each client has own bucket" or "one client cannot consume another's allocation." No instance-level relationships. |
| Restart behavior | fails | Cannot express "restart must not unexpectedly reset limits." No operational vs. semantic state distinction. |

The awkward and fails entries are the primary output of this experiment.

## 6. Success criteria

The experiment is **informative** (not necessarily successful) if it produces a clear ledger of what transferred, what was awkward, and what failed.

The experiment **validates domain independence** if:

- At least 70% of existing predicates transferred without awkwardness
- No projection required domain-specific knowledge
- No semantic fact needed duplication across projections
- Stable assertion identity survived across all three projections
- Slicing remained sufficient for each projection
- The domain could be renamed completely without breaking projection behavior

The experiment **exposes kernel gaps** if:

- Fewer than 50% of predicates transferred cleanly
- Any projection needed domain-specific lowering rules
- Semantic facts needed duplication
- Slicing could not isolate relevant semantics

## 7. Specialist extensions

The experiment may reveal semantics that belong outside the kernel. These go into named specialist modules:

```
                    Semantic Kernel

      identity / assertions / relationships / evidence
                          │
          ┌───────────────┼────────────────┐
          ▼               ▼                ▼
      Temporal        Concurrent      Quantitative
      semantics       semantics       semantics
```

Each specialist extension:

- imports kernel types
- adds domain-specific predicates or assertion kinds
- declares which projections can consume it
- emits diagnostics in projections that cannot

The kernel MUST NOT grow to accommodate specialist semantics. If a concept cannot be expressed by composing kernel primitives and specialist extensions, that is evidence the kernel is incomplete — not that the specialist should be promoted.

## 8. Distinction: property vs. mechanism

The experiment must force a distinction between:

**Required semantic property:**
```
No client may exceed 100 requests per minute.
```

**Required implementation mechanism:**
```
Rate limiting uses a token bucket with
capacity 100 and refill rate 100/minute.
```

Two implementations could satisfy the first while using entirely different algorithms. The IR must eventually distinguish these because:

- sometimes the algorithm itself matters (mechanism is semantic)
- sometimes only the observable behavior matters (property is semantic)

The pressure ledger should record which semantic claims are properties, which are mechanisms, and which the current model cannot distinguish.

## 9. What NOT to do

- Do not add another projection (benchmark, load test, etc.) — let existing projections fail and report coverage
- Do not add predicates preemptively — wait for concrete projection failures
- Do not model the rate limiter as a workflow — model the quantitative and concurrent semantics
- Do not add LLM extraction — the IR must survive on its own merits first
- Do not add code generation — not where SEMIR's differentiation lies

## 10. Deliverables

1. `examples/rate-limiter/rate-limiter.semir` — the model
2. `examples/rate-limiter/model.ts` — TypeScript equivalent (if needed)
3. Updated pressure ledger in this RFC
4. Findings document: `docs/findings/0002-second-domain.md`
5. Decision: which new concepts belong in kernel vs. specialist extensions

## 11. After this experiment

If the kernel survives:

1. Compose the two domains (reservation + rate limiter)
2. Investigate semantic diff / impact analysis
3. Investigate implementation conformance
4. Then — and only then — brownfield semantic extraction

If the kernel does not survive:

1. Record exactly where it failed
2. Design minimal additions that address the failures
3. Re-run the experiment with the extended kernel
4. Repeat until the kernel either generalizes or the project discovers its actual boundaries
