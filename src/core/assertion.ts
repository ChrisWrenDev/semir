export type Predicate =
  | "causes"
  | "requires"
  | "forbids"
  | "transitions_to"
  | "reads"
  | "writes"
  | "produces"
  | "occurs_before"
  | "authorized_by"
  | "must_hold"
  | "observable_within"
  | "exactly_once";

export type AssertionKind =
  | "fact"
  | "precondition"
  | "postcondition"
  | "invariant"
  | "temporal"
  | "security"
  | "failure"
  | "quantitative"
  | "operational"
  | "algorithmic";

export type EpistemicStatus =
  | "asserted"
  | "inferred"
  | "validated"
  | "conflicting"
  | "unknown";

export interface Evidence {
  id?: string;
  type:
    | "human"
    | "test"
    | "code"
    | "documentation"
    | "trace"
    | "api"
    | "schema"
    | "experiment";
  source: string;
  stance?: "supports" | "contradicts" | "neutral";
  detail?: string;
}

export type SemanticId = string;

export interface LiteralValue {
  kind: "literal";
  value: string;
  datatype: "duration" | "number" | "string" | "boolean";
}

export type AssertionTarget = SemanticId | LiteralValue;

export interface Condition {
  subject: SemanticId;
  predicate: Predicate | "occurs_after" | "holds_when";
  object?: AssertionTarget;
}

export interface Assertion {
  id: SemanticId;
  subject: SemanticId;
  predicate: Predicate;
  object?: AssertionTarget;
  conditions?: Condition[];
  kind: AssertionKind;
  evidence?: Evidence[];
  epistemicStatus?: EpistemicStatus;
  confidence?: number;
}

export function isLiteral(target: AssertionTarget): target is LiteralValue {
  return typeof target === "object" && "kind" in target && target.kind === "literal";
}

export function isRef(target: AssertionTarget): target is SemanticId {
  return typeof target === "string";
}

export function targetId(target: AssertionTarget): string {
  return isRef(target) ? target : target.value;
}

export function targetDisplay(target: AssertionTarget): string {
  if (isRef(target)) return target;
  return `${target.value}${target.datatype === "duration" ? "" : ""}`;
}
