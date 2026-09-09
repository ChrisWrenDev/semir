import { SemanticSlice } from "../../core/slice.ts";
import { ProjectionCapabilities, ProjectionDiagnostics } from "../../core/predicates.ts";
import { targetId } from "../../core/assertion.ts";
import { EventModelIR, CommandNode, EventNode, StateNode, Edge, EdgeKind } from "./ir.ts";

export const EVENT_MODEL_CAPABILITIES: ProjectionCapabilities = {
  predicates: ["causes", "transitions_to", "requires", "forbids", "authorized_by", "observable_within"],
  assertionKinds: ["fact", "precondition", "postcondition", "invariant", "temporal", "security"],
  requiredRelationships: ["causes", "transitions_to", "requires", "forbids", "authorized_by", "observable_within"],
};

const SUPPORTED_PREDICATES = new Set<string>(EVENT_MODEL_CAPABILITIES.predicates);

const PREDICATE_TO_EDGE_KIND: Record<string, EdgeKind> = {
  causes: "causes",
  transitions_to: "transitions_to",
  requires: "requires",
  forbids: "forbids",
  authorized_by: "authorized_by",
  observable_within: "observable_within",
};

export function lower(slice: SemanticSlice): EventModelIR {
  const commands: CommandNode[] = [];
  const events: EventNode[] = [];
  const states: StateNode[] = [];
  const edges: Edge[] = [];
  const unsupported: Array<{ assertionId: string; reason: string }> = [];

  for (const [, obj] of slice.objects) {
    switch (obj.kind) {
      case "action":
        commands.push({ id: obj.id, name: obj.name, semanticId: obj.id });
        break;
      case "event":
        events.push({ id: obj.id, name: obj.name, semanticId: obj.id });
        break;
      case "state":
        states.push({ id: obj.id, name: obj.name, semanticId: obj.id });
        break;
    }
  }

  for (const a of slice.assertions) {
    if (!SUPPORTED_PREDICATES.has(a.predicate)) {
      unsupported.push({
        assertionId: a.id,
        reason: `Predicate "${a.predicate}" is not supported by Event Model projection`,
      });
      continue;
    }

    const kind = PREDICATE_TO_EDGE_KIND[a.predicate];
    if (a.object) {
      edges.push({
        from: a.subject,
        to: targetId(a.object),
        kind,
        assertionId: a.id,
        label: a.conditions?.length ? "[conditional]" : undefined,
      });
    }
  }

  return { commands, events, states, edges, unsupported };
}

export function validate(ir: EventModelIR): ProjectionDiagnostics {
  const unsupported = ir.unsupported.map((u) => ({
    assertionId: u.assertionId,
    reason: u.reason,
  }));

  const totalAssertions =
    ir.edges.length + unsupported.length;
  const coverage = totalAssertions > 0 ? ir.edges.length / totalAssertions : 1;

  return {
    unsupported,
    warnings: [],
    coverage,
  };
}
