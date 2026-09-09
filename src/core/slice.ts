import { SemanticModel } from "./model.ts";
import { SemanticId, SemanticObject } from "./object.ts";
import { Assertion, Predicate, isRef, targetId } from "./assertion.ts";
import { assertionsAbout } from "./query.ts";

export interface SliceOptions {
  roots: SemanticId[];
  relationships: Predicate[];
  maxDepth?: number;
}

export interface SemanticSlice {
  objects: Map<SemanticId, SemanticObject>;
  assertions: Assertion[];
  roots: SemanticId[];
}

export function slice(model: SemanticModel, options: SliceOptions): SemanticSlice {
  const { roots, relationships, maxDepth = 10 } = options;
  const includedObjects = new Map<SemanticId, SemanticObject>();
  const includedAssertions: Assertion[] = [];
  const visited = new Set<string>();

  function expand(id: SemanticId, depth: number): void {
    if (depth > maxDepth) return;
    const obj = model.objects.get(id);
    if (!obj) return;
    includedObjects.set(id, obj);

    const related = assertionsAbout(model, id);
    for (const a of related) {
      if (!relationships.includes(a.predicate)) continue;
      const key = a.id;
      if (visited.has(key)) continue;
      visited.add(key);
      includedAssertions.push(a);

      if (a.subject !== id && a.subject) expand(a.subject, depth + 1);
      if (a.object) {
        const objId = targetId(a.object);
        if (objId !== id) expand(objId, depth + 1);
      }
    }
  }

  for (const root of roots) {
    expand(root, 0);
  }

  return {
    objects: includedObjects,
    assertions: includedAssertions,
    roots,
  };
}
