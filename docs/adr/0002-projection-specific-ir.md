# ADR 0002: Lower Projections Through Projection-Specific IRs

**Status:** Proposed  
**Date:** 2026-09-09

## Context

SEMIR will support several representations of shared semantics: Event Models, scenarios/tests, formal verification models, and potentially later documentation, observability, load tests, or code generation.

A direct renderer that traverses the semantic graph and emits strings or SVG is initially simple but combines three concerns:

1. semantic selection;
2. semantic interpretation/lowering;
3. output rendering.

That coupling makes it difficult to validate projection semantics independently or support multiple renderers for one projection family.

## Decision

Every non-trivial projection will lower a semantic slice into a **projection-specific intermediate representation** before rendering.

The standard pipeline is:

```text
Semantic IR
    ↓
semantic selection / slice
    ↓
projection lowering
    ↓
Projection IR
    ↓
projection validation
    ↓
rendering / execution
```

Examples:

```text
Semantic IR → EventModelIR → Mermaid
Semantic IR → EventModelIR → interactive UI
Semantic IR → ScenarioIR → Gherkin
Semantic IR → ScenarioIR → Vitest
Semantic IR → FormalIR → TLA+
```

## Consequences

### Positive

- semantic lowering can be tested independently of presentation;
- one projection family can support multiple renderers;
- projection-specific validation becomes explicit;
- projection capability and fidelity can be measured before rendering;
- renderers do not need arbitrary access to the whole semantic graph;
- projection evolution is less likely to leak into the semantic kernel.

### Negative

- each projection requires additional types and lowering code;
- very small renderers may feel over-engineered initially;
- care is required to prevent a projection IR from becoming another source of semantic truth.

## Alternatives considered

### Direct renderers over Semantic IR

Rejected because rendering logic would accumulate semantic interpretation and graph traversal rules that are difficult to share or test.

### One universal projection IR

Rejected because different engineering representations require materially different structures. The shared layer is SEMIR itself, not another all-purpose rendering model.

## Guardrail

A projection IR is a transient lowered representation. If a semantic fact exists only in a projection IR and cannot be traced to SEMIR, that is a design smell unless it is purely presentational or mechanically derived metadata.
