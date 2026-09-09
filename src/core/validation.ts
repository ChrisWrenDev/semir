import { SemanticModel } from "./model.ts";
import { isRef, targetId } from "./assertion.ts";

export interface ValidationError {
  type:
    | "duplicate_id"
    | "dangling_reference"
    | "invalid_confidence"
    | "malformed_condition";
  message: string;
  id?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export function validateModel(model: SemanticModel): ValidationResult {
  const errors: ValidationError[] = [];

  const seenIds = new Set<string>();
  for (const [id] of model.objects) {
    if (seenIds.has(id)) {
      errors.push({
        type: "duplicate_id",
        message: `Duplicate object ID: ${id}`,
        id,
      });
    }
    seenIds.add(id);
  }

  for (const a of model.assertions) {
    if (seenIds.has(a.id)) {
      errors.push({
        type: "duplicate_id",
        message: `Duplicate assertion ID: ${a.id}`,
        id: a.id,
      });
    }
    seenIds.add(a.id);
  }

  for (const a of model.assertions) {
    if (!model.objects.has(a.subject)) {
      errors.push({
        type: "dangling_reference",
        message: `Assertion ${a.id} references unknown subject: ${a.subject}`,
        id: a.id,
      });
    }
    if (a.object && isRef(a.object) && !model.objects.has(a.object)) {
      errors.push({
        type: "dangling_reference",
        message: `Assertion ${a.id} references unknown object: ${a.object}`,
        id: a.id,
      });
    }
    if (a.confidence !== undefined && (a.confidence < 0 || a.confidence > 1)) {
      errors.push({
        type: "invalid_confidence",
        message: `Assertion ${a.id} has invalid confidence: ${a.confidence}`,
        id: a.id,
      });
    }
    if (a.conditions) {
      for (const c of a.conditions) {
        if (!c.subject) {
          errors.push({
            type: "malformed_condition",
            message: `Assertion ${a.id} has condition with no subject`,
            id: a.id,
          });
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
