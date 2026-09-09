export interface TLAState {
  name: string;
  semanticId: string;
}

export interface TLAAction {
  name: string;
  semanticId: string;
  fromStates: string[];
  toStates: string[];
}

export interface TLAProperty {
  name: string;
  formula: string;
  semanticId: string;
  kind: "invariant" | "temporal" | "safety" | "liveness";
}

export interface TLAConstraint {
  name: string;
  formula: string;
  semanticId: string;
}

export interface FormalIR {
  module: string;
  states: TLAState[];
  actions: TLAAction[];
  properties: TLAProperty[];
  constraints: TLAConstraint[];
  unsupported: Array<{ assertionId: string; reason: string }>;
}
