export type SemanticId = string;

export type SemanticObjectKind =
  | "entity"
  | "state"
  | "action"
  | "event"
  | "observation"
  | "actor"
  | "external_system";

export type SemanticValue =
  | string
  | number
  | boolean
  | SemanticId
  | { value: SemanticId; kind: "ref" }
  | { value: string; kind: "text" }
  | { value: number; kind: "duration"; unit: "ms" | "s" | "m" | "h" };

export interface SemanticObject {
  id: SemanticId;
  kind: SemanticObjectKind;
  name: string;
  attributes?: Record<string, SemanticValue>;
}
