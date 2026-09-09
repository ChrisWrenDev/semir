export interface Clause {
  text: string;
  semanticId?: string;
}

export interface Scenario {
  name: string;
  semanticIds: string[];
  given: Clause[];
  when: Clause[];
  then: Clause[];
}

export interface ScenarioIR {
  scenarios: Scenario[];
  unsupported: Array<{ assertionId: string; reason: string }>;
}
