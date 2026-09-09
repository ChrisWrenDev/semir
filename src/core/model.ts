import { SemanticId, SemanticObject } from "./object.ts";
import { Assertion } from "./assertion.ts";

export interface SemanticModel {
  objects: Map<SemanticId, SemanticObject>;
  assertions: Assertion[];
  name?: string;
  description?: string;
}

export function createModel(
  objects: SemanticObject[],
  assertions: Assertion[],
  name?: string,
  description?: string
): SemanticModel {
  const objectMap = new Map<SemanticId, SemanticObject>();
  for (const obj of objects) {
    objectMap.set(obj.id, obj);
  }
  return { objects: objectMap, assertions, name, description };
}

export function getModelObject(
  model: SemanticModel,
  id: SemanticId
): SemanticObject | undefined {
  return model.objects.get(id);
}

export function getModelAssertion(
  model: SemanticModel,
  id: string
): Assertion | undefined {
  return model.assertions.find((a) => a.id === id);
}
