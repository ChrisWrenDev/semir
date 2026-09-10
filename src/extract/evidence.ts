export interface ImplementationFact {
  kind:
    | "function_call"
    | "state_write"
    | "state_read"
    | "guard_check"
    | "equality_check"
    | "event_emission"
    | "return_value"
    | "test_assertion"
    | "test_name"
    | "literal";
  source: string;
  line?: number;
  detail: string;
  symbols: string[];
}

export interface ExtractedEvidence {
  facts: ImplementationFact[];
  sourceFile: string;
}
