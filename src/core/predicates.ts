import { Predicate, AssertionKind } from "./assertion.ts";

export interface ProjectionCapabilities {
  predicates: Predicate[];
  assertionKinds: AssertionKind[];
  requiredRelationships: Predicate[];
}

export interface ProjectionDiagnostics {
  unsupported: Array<{
    assertionId: string;
    reason: string;
  }>;
  warnings: string[];
  coverage: number;
}

export function unionRelationships(...caps: ProjectionCapabilities[]): Predicate[] {
  const set = new Set<Predicate>();
  for (const c of caps) {
    for (const r of c.requiredRelationships) {
      set.add(r);
    }
  }
  return [...set];
}
