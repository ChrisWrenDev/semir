import { CandidateAssertion } from "./interpret-candidates.ts";

export interface ConsolidatedEvidence {
  source: string;
  line?: number;
  detail: string;
  stance: "supports" | "contradicts";
}

export interface ConsolidatedAssertion {
  id: string;
  subject: string;
  predicate: string;
  object?: string;
  evidenceCount: number;
  evidence: ConsolidatedEvidence[];
  epistemicStatus: "inferred" | "hypothesized" | "validated" | "conflicting";
  confidence: number;
  derivationCount: number;
}

function normalizeId(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function candidateKey(c: CandidateAssertion): string {
  const obj = c.object ?? "";
  return `${normalizeId(c.subject)}:${c.predicate}:${normalizeId(obj)}`;
}

function resolveStatus(
  supporting: number,
  contradicting: number
): ConsolidatedAssertion["epistemicStatus"] {
  if (contradicting > 0 && supporting > 0) return "conflicting";
  if (contradicting > 0) return "conflicting";
  if (supporting >= 3) return "validated";
  if (supporting >= 2) return "inferred";
  return "hypothesized";
}

function resolveConfidence(
  supporting: number,
  contradicting: number,
  statuses: CandidateAssertion["epistemicStatus"][]
): number {
  const base = supporting / (supporting + contradicting + 1);
  const hasHigh = statuses.some((s) => s === "inferred");
  const hasLow = statuses.every((s) => s === "hypothesized");
  const adjustment = hasHigh ? 0.1 : hasLow ? -0.1 : 0;
  return Math.min(1, Math.max(0, base + adjustment));
}

export function consolidate(candidates: CandidateAssertion[]): ConsolidatedAssertion[] {
  const groups = new Map<string, CandidateAssertion[]>();

  for (const c of candidates) {
    const key = candidateKey(c);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  const consolidated: ConsolidatedAssertion[] = [];

  for (const [key, group] of groups) {
    const supporting = group.flatMap((c) =>
      c.evidence.map((e) => ({
        source: e.source,
        line: e.line,
        detail: e.detail,
        stance: "supports" as const,
      }))
    );

    const allStatuses = group.map((c) => c.epistemicStatus);
    const epistemicStatus = resolveStatus(supporting.length, 0);
    const confidence = resolveConfidence(supporting.length, 0, allStatuses);

    const first = group[0];
    consolidated.push({
      id: key,
      subject: first.subject,
      predicate: first.predicate,
      object: first.object,
      evidenceCount: supporting.length,
      evidence: supporting,
      epistemicStatus,
      confidence,
      derivationCount: group.length,
    });
  }

  consolidated.sort((a, b) => b.confidence - a.confidence);
  return consolidated;
}

export function renderConsolidated(consolidated: ConsolidatedAssertion[]): string {
  const lines: string[] = [];
  lines.push("Consolidated Candidate Assertions");
  lines.push("=================================\n");

  for (const c of consolidated) {
    const icon =
      c.epistemicStatus === "validated" ? "✓" :
      c.epistemicStatus === "inferred" ? "~" :
      c.epistemicStatus === "conflicting" ? "✗" : "?";

    lines.push(`${icon} ${c.subject} ${c.predicate} ${c.object ?? ""}`);
    lines.push(`  Status: ${c.epistemicStatus} (confidence: ${c.confidence.toFixed(2)})`);
    lines.push(`  Derivations: ${c.derivationCount} | Evidence sources: ${c.evidenceCount}`);

    const uniqueSources = [...new Set(c.evidence.map((e) => e.source))];
    for (const src of uniqueSources) {
      const relPath = src.replace(/.*examples\//, "");
      lines.push(`    ${relPath}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
