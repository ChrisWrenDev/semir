import * as yaml from "js-yaml";
import { SemanticModel, createModel } from "./model.ts";
import { SemanticObject, SemanticValue } from "./object.ts";
import { Assertion, AssertionTarget, Condition, Evidence, isRef, isLiteral, LiteralValue } from "./assertion.ts";

export interface SemirFile {
  version: string;
  name?: string;
  description?: string;
  objects: SemirObject[];
  assertions: SemirAssertion[];
}

export interface SemirObject {
  id: string;
  kind: string;
  name: string;
  attributes?: Record<string, SemirValue>;
}

export type SemirValue =
  | string
  | number
  | boolean
  | { ref: string }
  | { text: string }
  | { duration: number; unit: string };

export type SemirTarget =
  | string
  | { ref: string }
  | { literal: string; datatype: string };

export interface SemirAssertion {
  id: string;
  subject: string;
  predicate: string;
  object?: SemirTarget;
  kind: string;
  conditions?: Array<{
    subject: string;
    predicate: string;
    object?: SemirTarget;
  }>;
  evidence?: Array<{
    type: string;
    source: string;
    stance?: string;
    detail?: string;
  }>;
  epistemicStatus?: string;
  confidence?: number;
}

function serializeValue(v: SemanticValue): SemirValue {
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return v;
  }
  if (typeof v === "object" && "kind" in v) {
    if (v.kind === "ref") return { ref: v.value as string };
    if (v.kind === "text") return { text: v.value as string };
    if (v.kind === "duration") {
      return { duration: v.value as number, unit: (v as { unit: string }).unit };
    }
  }
  return String(v);
}

function deserializeValue(v: SemirValue): SemanticValue {
  if (typeof v === "object" && v !== null) {
    if ("ref" in v) return { value: (v as { ref: string }).ref, kind: "ref" };
    if ("text" in v) return { value: (v as { text: string }).text, kind: "text" };
    if ("duration" in v) {
      const d = v as { duration: number; unit: string };
      return { value: d.duration, kind: "duration", unit: d.unit as "ms" | "s" | "m" | "h" };
    }
  }
  return v as SemanticValue;
}

function serializeTarget(target: AssertionTarget): SemirTarget {
  if (isRef(target)) return target;
  return { literal: target.value, datatype: target.datatype };
}

function deserializeTarget(target: SemirTarget): AssertionTarget {
  if (typeof target === "string") return target;
  if ("ref" in target) return target.ref;
  if ("literal" in target) return { kind: "literal", value: target.literal, datatype: target.datatype as LiteralValue["datatype"] };
  return String(target);
}

export function serializeToSemir(model: SemanticModel): SemirFile {
  const objects: SemirObject[] = [];
  for (const [, obj] of model.objects) {
    const serialized: SemirObject = {
      id: obj.id,
      kind: obj.kind,
      name: obj.name,
    };
    if (obj.attributes) {
      serialized.attributes = {};
      for (const [k, v] of Object.entries(obj.attributes)) {
        serialized.attributes[k] = serializeValue(v);
      }
    }
    objects.push(serialized);
  }

  objects.sort((a, b) => a.id.localeCompare(b.id));

  const assertions: SemirAssertion[] = model.assertions.map((a) => {
    const sa: SemirAssertion = {
      id: a.id,
      subject: a.subject,
      predicate: a.predicate,
      kind: a.kind,
    };
    if (a.object) sa.object = serializeTarget(a.object);
    if (a.conditions) {
      sa.conditions = a.conditions.map((c) => ({
        subject: c.subject,
        predicate: c.predicate,
        object: c.object ? serializeTarget(c.object) : undefined,
      }));
    }
    if (a.evidence) {
      sa.evidence = a.evidence.map((e) => {
        const se: { type: string; source: string; stance?: string; detail?: string } = {
          type: e.type,
          source: e.source,
        };
        if (e.stance) se.stance = e.stance;
        if (e.detail) se.detail = e.detail;
        return se;
      });
    }
    if (a.epistemicStatus) sa.epistemicStatus = a.epistemicStatus;
    if (a.confidence !== undefined) sa.confidence = a.confidence;
    return sa;
  });

  assertions.sort((a, b) => a.id.localeCompare(b.id));

  return {
    version: "0.1",
    name: model.name,
    description: model.description,
    objects,
    assertions,
  };
}

export function deserializeFromSemir(file: SemirFile): SemanticModel {
  const objects: SemanticObject[] = file.objects.map((o) => {
    const obj: SemanticObject = {
      id: o.id,
      kind: o.kind as SemanticObject["kind"],
      name: o.name,
    };
    if (o.attributes) {
      obj.attributes = {};
      for (const [k, v] of Object.entries(o.attributes)) {
        obj.attributes[k] = deserializeValue(v);
      }
    }
    return obj;
  });

  const assertions: Assertion[] = file.assertions.map((a) => {
    const assertion: Assertion = {
      id: a.id,
      subject: a.subject,
      predicate: a.predicate as Assertion["predicate"],
      kind: a.kind as Assertion["kind"],
    };
    if (a.object) assertion.object = deserializeTarget(a.object);
    if (a.conditions) {
      assertion.conditions = a.conditions.map((c) => ({
        subject: c.subject,
        predicate: c.predicate as Condition["predicate"],
        object: c.object ? deserializeTarget(c.object) : undefined,
      }));
    }
    if (a.evidence) {
      assertion.evidence = a.evidence.map((e) => ({
        type: e.type as Evidence["type"],
        source: e.source,
        stance: e.stance as Evidence["stance"],
        detail: e.detail,
      }));
    }
    if (a.epistemicStatus) assertion.epistemicStatus = a.epistemicStatus as Assertion["epistemicStatus"];
    if (a.confidence !== undefined) assertion.confidence = a.confidence;
    return assertion;
  });

  return createModel(objects, assertions, file.name, file.description);
}

export function toSemirYaml(model: SemanticModel): string {
  const file = serializeToSemir(model);
  return yaml.dump(file, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  });
}

export function fromSemirYaml(yamlContent: string): SemanticModel {
  const file = yaml.load(yamlContent) as SemirFile;
  if (!file.version) {
    throw new Error("Invalid .semir file: missing version field");
  }
  return deserializeFromSemir(file);
}
