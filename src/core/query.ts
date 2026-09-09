import { SemanticModel } from "./model.ts";
import { Assertion, Predicate, isRef, targetId } from "./assertion.ts";
import { SemanticId } from "./object.ts";

export interface AssertionFilter {
  subject?: SemanticId;
  predicate?: Predicate;
  object?: SemanticId;
  kind?: Assertion["kind"];
}

export function assertions(
  model: SemanticModel,
  filter?: AssertionFilter
): Assertion[] {
  if (!filter) return [...model.assertions];
  return model.assertions.filter((a) => {
    if (filter.subject && a.subject !== filter.subject) return false;
    if (filter.predicate && a.predicate !== filter.predicate) return false;
    if (filter.object && a.object && targetId(a.object) !== filter.object) return false;
    if (filter.kind && a.kind !== filter.kind) return false;
    return true;
  });
}

export function assertionsAbout(
  model: SemanticModel,
  id: SemanticId
): Assertion[] {
  return model.assertions.filter(
    (a) => a.subject === id || (a.object && targetId(a.object) === id)
  );
}

export function effectsOf(model: SemanticModel, id: SemanticId): Assertion[] {
  return assertions(model, { subject: id, predicate: "causes" });
}

export function preconditionsOf(
  model: SemanticModel,
  id: SemanticId
): Assertion[] {
  return assertions(model, { subject: id, predicate: "requires" });
}

export function eventsCausedBy(
  model: SemanticModel,
  id: SemanticId
): Assertion[] {
  return assertions(model, { subject: id, predicate: "causes" }).filter(
    (a) => {
      if (!a.object || !isRef(a.object)) return false;
      const obj = model.objects.get(a.object);
      return obj?.kind === "event";
    }
  );
}

export function constraintsOn(
  model: SemanticModel,
  id: SemanticId
): Assertion[] {
  return model.assertions.filter(
    (a) =>
      (a.subject === id || (a.object && targetId(a.object) === id)) &&
      (a.kind === "invariant" ||
        a.kind === "temporal" ||
        a.kind === "security" ||
        a.kind === "failure" ||
        a.kind === "quantitative")
  );
}

export function neighbors(
  model: SemanticModel,
  id: SemanticId
): SemanticId[] {
  const related = new Set<SemanticId>();
  for (const a of model.assertions) {
    if (a.subject === id && a.object) related.add(targetId(a.object));
    if (a.object && targetId(a.object) === id) related.add(a.subject);
  }
  return [...related];
}
