import { SemanticSlice } from "../../core/slice.ts";
import { Assertion, isRef, targetId } from "../../core/assertion.ts";
import { FormalIR, TLAState, TLAAction, TLAProperty, TLAConstraint } from "./ir.ts";
import { ProjectionCapabilities, ProjectionDiagnostics } from "../../core/predicates.ts";

export const FORMAL_CAPABILITIES: ProjectionCapabilities = {
  predicates: ["causes", "transitions_to", "requires", "forbids", "authorized_by", "observable_within"],
  assertionKinds: ["invariant", "temporal", "precondition", "postcondition", "security"],
  requiredRelationships: ["causes", "transitions_to", "requires", "forbids", "authorized_by", "observable_within"],
};

const SUPPORTED_PREDICATES = new Set<string>(FORMAL_CAPABILITIES.predicates);

function tlaName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "");
}

function buildStates(slice: SemanticSlice): TLAState[] {
  const states: TLAState[] = [];
  for (const [, obj] of slice.objects) {
    if (obj.kind === "state") {
      states.push({ name: tlaName(obj.name), semanticId: obj.id });
    }
  }
  return states;
}

function buildActions(slice: SemanticSlice, assertions: Assertion[]): TLAAction[] {
  const actionMap = new Map<string, TLAAction>();

  for (const a of assertions) {
    if (a.predicate === "causes" && a.object && isRef(a.object)) {
      const actionObj = slice.objects.get(a.subject);
      if (actionObj?.kind !== "action") continue;

      if (!actionMap.has(a.subject)) {
        actionMap.set(a.subject, {
          name: tlaName(actionObj.name),
          semanticId: a.subject,
          fromStates: [],
          toStates: [],
        });
      }
      const action = actionMap.get(a.subject)!;

      const transAssert = assertions.find(
        (t) => t.subject === a.object && t.predicate === "transitions_to"
      );
      if (transAssert?.object) {
        const toObj = slice.objects.get(targetId(transAssert.object));
        if (toObj) action.toStates.push(tlaName(toObj.name));
      }
    }

    if (a.predicate === "requires" && a.object && isRef(a.object)) {
      const action = actionMap.get(a.subject);
      if (action) {
        const reqObj = slice.objects.get(a.object);
        if (reqObj?.kind === "state") {
          action.fromStates.push(tlaName(reqObj.name));
        }
      }
    }
  }

  for (const action of actionMap.values()) {
    action.fromStates = [...new Set(action.fromStates)];
    action.toStates = [...new Set(action.toStates)];
  }

  return [...actionMap.values()];
}

function buildProperties(slice: SemanticSlice, assertions: Assertion[]): TLAProperty[] {
  const properties: TLAProperty[] = [];

  for (const a of assertions) {
    if (a.predicate === "forbids" && a.object && isRef(a.object)) {
      const subjectObj = slice.objects.get(a.subject);
      const objectObj = slice.objects.get(a.object);
      if (!subjectObj || !objectObj) continue;

      if (a.kind === "invariant" && !a.conditions?.length) {
        properties.push({
          name: tlaName(`${subjectObj.name}${objectObj.name}Forbids`),
          formula: `[](${tlaName(subjectObj.name)} => ~${tlaName(objectObj.name)})`,
          semanticId: a.id,
          kind: "invariant",
        });
      }

      if (a.conditions?.length) {
        const cond = a.conditions[0];
        if (cond.object && isRef(cond.object)) {
          const condObj = slice.objects.get(cond.object);
          if (condObj) {
            properties.push({
              name: tlaName(`${condObj.name}${objectObj.name}Forbids`),
              formula: `[](${tlaName(condObj.name)} => ~${tlaName(objectObj.name)})`,
              semanticId: a.id,
              kind: "invariant",
            });
          }
        }
      }
    }
  }

  return properties;
}

function buildConstraints(slice: SemanticSlice, assertions: Assertion[]): TLAConstraint[] {
  const constraints: TLAConstraint[] = [];

  for (const a of assertions) {
    if (a.predicate === "observable_within" && a.object) {
      const display = isRef(a.object)
        ? (slice.objects.get(a.object)?.name ?? a.object)
        : a.object.value;
      constraints.push({
        name: tlaName(`ObservedWithin${display}`),
        formula: `\\* Temporal constraint: observable within ${display}`,
        semanticId: a.id,
      });
    }
  }

  return constraints;
}

export function lower(slice: SemanticSlice): FormalIR {
  const assertions = [...slice.assertions];
  const unsupported: Array<{ assertionId: string; reason: string }> = [];

  for (const a of assertions) {
    if (!SUPPORTED_PREDICATES.has(a.predicate)) {
      unsupported.push({
        assertionId: a.id,
        reason: `Predicate "${a.predicate}" is not representable in formal model`,
      });
    }
  }

  const constraints = buildConstraints(slice, assertions);
  const hasTemporal = constraints.length > 0;

  return {
    module: "Reservation",
    states: buildStates(slice),
    actions: buildActions(slice, assertions),
    properties: buildProperties(slice, assertions),
    constraints,
    hasTemporal,
    unsupported,
  };
}

export function validate(ir: FormalIR): ProjectionDiagnostics {
  const unsupported = ir.unsupported.map((u) => ({
    assertionId: u.assertionId,
    reason: u.reason,
  }));

  const totalFormal = ir.properties.length + ir.constraints.length + unsupported.length;
  const represented = ir.properties.length + ir.constraints.length;
  const coverage = totalFormal > 0 ? represented / totalFormal : 1;

  return {
    unsupported,
    warnings: [],
    coverage,
  };
}
