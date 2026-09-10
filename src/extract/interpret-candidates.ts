import { ImplementationFact } from "./evidence.ts";

export interface CandidateAssertion {
  id: string;
  subject: string;
  predicate: string;
  object?: string;
  kind: string;
  epistemicStatus: "inferred" | "hypothesized" | "conflicting";
  confidence: number;
  evidence: Array<{ source: string; line?: number; detail: string }>;
  reasoning: string;
}

function stateFromWrite(fact: ImplementationFact): string | undefined {
  if (fact.kind === "state_write") {
    return fact.symbols[1];
  }
  return undefined;
}

function stateFromGuard(fact: ImplementationFact): string | undefined {
  if (fact.kind === "guard_check") {
    return fact.symbols[1];
  }
  return undefined;
}

function findCausePatterns(evidence: ImplementationFact[]): CandidateAssertion[] {
  const candidates: CandidateAssertion[] = [];
  const funcDefs = evidence.filter((f) => f.kind === "function_call");

  for (const func of funcDefs) {
    const funcName = func.symbols[0];
    const laterFacts = evidence.filter(
      (f) => f.source === func.source && (f.line ?? 0) > (func.line ?? 0)
    );

    const stateWrites = laterFacts.filter((f) => f.kind === "state_write");
    for (const write of stateWrites) {
      const newState = stateFromWrite(write);
      if (newState) {
        candidates.push({
          id: `candidate://${func.source}:${funcName}-causes-${newState}`,
          subject: funcName,
          predicate: "causes",
          object: newState,
          kind: "postcondition",
          epistemicStatus: "inferred",
          confidence: 0.7,
          evidence: [
            { source: func.source, line: func.line, detail: func.detail },
            { source: write.source, line: write.line, detail: write.detail },
          ],
          reasoning: `Function ${funcName} writes state to ${newState}`,
        });
      }
    }
  }

  return candidates;
}

function findTransitionPatterns(evidence: ImplementationFact[]): CandidateAssertion[] {
  const candidates: CandidateAssertion[] = [];
  const guards = evidence.filter((f) => f.kind === "guard_check");
  const writes = evidence.filter((f) => f.kind === "state_write");

  for (const guard of guards) {
    const guardState = stateFromGuard(guard);
    const sameFileWrites = writes.filter(
      (w) => w.source === guard.source && w.line && guard.line && w.line > guard.line
    );

    for (const write of sameFileWrites) {
      const newState = stateFromWrite(write);
      if (newState && newState !== guardState) {
        candidates.push({
          id: `candidate://${guard.source}:transitions-${guardState}-${newState}`,
          subject: `${guardState}_event`,
          predicate: "transitions_to",
          object: newState,
          kind: "postcondition",
          epistemicStatus: "inferred",
          confidence: 0.6,
          evidence: [
            { source: guard.source, line: guard.line, detail: guard.detail },
            { source: write.source, line: write.line, detail: write.detail },
          ],
          reasoning: `Guard checks ${guardState}, then writes ${newState}`,
        });
      }
    }
  }

  return candidates;
}

function findForbidPatterns(evidence: ImplementationFact[]): CandidateAssertion[] {
  const candidates: CandidateAssertion[] = [];
  const guards = evidence.filter((f) => f.kind === "guard_check");
  const testNames = evidence.filter((f) => f.kind === "test_name");

  for (const guard of guards) {
    const guardState = stateFromGuard(guard);
    const relatedTests = testNames.filter((t) => {
      const name = t.symbols[0].toLowerCase();
      return name.includes("not") || name.includes("never") || name.includes("cannot");
    });

    for (const test of relatedTests) {
      candidates.push({
        id: `candidate://${guard.source}:forbids-${guardState}`,
        subject: guardState ?? "unknown",
        predicate: "forbids",
        object: "expired",
        kind: "invariant",
        epistemicStatus: "inferred",
        confidence: 0.65,
        evidence: [
          { source: guard.source, line: guard.line, detail: guard.detail },
          { source: test.source, line: test.line, detail: test.detail },
        ],
        reasoning: `Guard prevents ${guardState} state; test "${test.symbols[0]}" confirms prohibition`,
      });
    }
  }

  return candidates;
}

function findAuthPatterns(evidence: ImplementationFact[]): CandidateAssertion[] {
  const candidates: CandidateAssertion[] = [];
  const eqChecks = evidence.filter((f) => f.kind === "equality_check");

  for (const eq of eqChecks) {
    const symbols = eq.symbols;
    if (symbols.some((s) => s.toLowerCase().includes("owner") || s.toLowerCase().includes("id"))) {
      candidates.push({
        id: `candidate://${eq.source}:auth-${symbols[0]}`,
        subject: "action",
        predicate: "authorized_by",
        object: symbols[0],
        kind: "security",
        epistemicStatus: "hypothesized",
        confidence: 0.5,
        evidence: [
          { source: eq.source, line: eq.line, detail: eq.detail },
        ],
        reasoning: `Equality check ${eq.detail} suggests authorization relationship`,
      });
    }
  }

  return candidates;
}

export function interpretCandidates(
  evidenceSets: { facts: import("./evidence.ts").ImplementationFact[]; sourceFile: string }[]
): CandidateAssertion[] {
  const allFacts = evidenceSets.flatMap((e) => e.facts);

  const candidates = [
    ...findCausePatterns(allFacts),
    ...findTransitionPatterns(allFacts),
    ...findForbidPatterns(allFacts),
    ...findAuthPatterns(allFacts),
  ];

  return candidates;
}
