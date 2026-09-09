# ADR 0003: Keep SEMIR Independent of Storage and Surface Syntax

**Status:** Proposed  
**Date:** 2026-09-09

## Context

SEMIR is conceptually graph-like: semantic objects have stable identities and assertions relate them. This makes graph databases, RDF, ontologies, Datalog, and custom DSLs attractive early choices.

However, the initial research risk is whether the semantic abstraction itself is useful. Choosing persistence or syntax too early risks allowing the capabilities and limitations of one technology to shape the semantics.

SEMIR also needs to support multiple future front ends: human-authored DSL, YAML/JSON, GUI authoring, LLM-assisted extraction, static analysis, API/schema import, and runtime evidence.

## Decision

SEMIR will remain **storage-neutral and serialization-neutral** at the conceptual level.

For the MVP:

- the core model will use ordinary in-memory data structures;
- persistence may use simple JSON or equivalent;
- no graph database is required;
- no textual DSL is canonical;
- serialization will be introduced only after the in-memory model stabilizes;
- any serialization format must round-trip through the semantic model without semantic loss.

The relationship is:

```text
DSL ───────────┐
YAML/JSON ─────┤
GUI ───────────┤
LLM extraction ├──→ Semantic IR
code analysis ─┤
OpenAPI ───────┘
```

## Consequences

### Positive

- the semantic model can evolve without migrations tied to a premature database schema;
- multiple authoring and extraction front ends remain possible;
- storage can later be selected based on real query and scale requirements;
- syntax cannot accidentally become the definition of semantics.

### Negative

- early persistence/query performance will be less sophisticated;
- a later migration to specialized storage may require additional engineering;
- contributors must resist treating one convenient YAML/DSL form as canonical.

## Alternatives considered

### Neo4j or another graph database first

Rejected because graph storage is not required to test the semantic hypothesis and may bias model design.

### RDF/OWL ontology first

Rejected for v0 because ontology mechanics add complexity before the required semantic primitives are proven.

### DSL first

Rejected because syntax stabilization before model stabilization creates unnecessary churn.

## Future decision trigger

Revisit storage when the implementation has concrete evidence for one or more of:

- graph queries that are impractical in-memory;
- model sizes that exceed simple persistence approaches;
- incremental update/indexing requirements;
- multi-user or transactional editing;
- evidence lineage queries requiring specialized indexing.

Revisit the textual DSL when the semantic core has remained stable across several meaningful projection changes.
