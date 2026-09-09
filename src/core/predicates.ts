export type PredicateCapability = import("./assertion").Predicate;
export type AssertionKindCapability = import("./assertion").AssertionKind;

export interface ProjectionCapabilities {
  predicates: PredicateCapability[];
  assertionKinds: AssertionKindCapability[];
}

export interface ProjectionDiagnostics {
  unsupported: Array<{
    assertionId: string;
    reason: string;
  }>;
  warnings: string[];
  coverage: number;
}
