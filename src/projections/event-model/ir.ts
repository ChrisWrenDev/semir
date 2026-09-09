export interface CommandNode {
  id: string;
  name: string;
  semanticId: string;
}

export interface EventNode {
  id: string;
  name: string;
  semanticId: string;
}

export interface StateNode {
  id: string;
  name: string;
  semanticId: string;
}

export type EdgeKind =
  | "causes"
  | "transitions_to"
  | "requires"
  | "forbids"
  | "authorized_by"
  | "observable_within";

export interface Edge {
  from: string;
  to: string;
  kind: EdgeKind;
  assertionId: string;
  label?: string;
}

export interface EventModelIR {
  commands: CommandNode[];
  events: EventNode[];
  states: StateNode[];
  edges: Edge[];
  unsupported: Array<{ assertionId: string; reason: string }>;
}
