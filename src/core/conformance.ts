import { SemanticId } from "./object.ts";

export type ConformanceStatus =
  | "supported"
  | "contradicted"
  | "partially_supported"
  | "unverified"
  | "unknown";

export type EvidenceType =
  | "static"
  | "test"
  | "runtime"
  | "formal"
  | "documentation";

export type EvidenceStance = "supports" | "contradicts" | "neutral";

export interface ConformanceEvidence {
  type: EvidenceType;
  source: string;
  stance: EvidenceStance;
  detail?: string;
}

export interface ConformanceResult {
  assertionId: string;
  status: ConformanceStatus;
  evidence: ConformanceEvidence[];
}

export interface ImplementationMapping {
  assertionId: string;
  symbols?: string[];
  tests?: string[];
  runtime?: string[];
}

export interface ConformanceReport {
  results: ConformanceResult[];
  summary: {
    total: number;
    supported: number;
    contradicted: number;
    partiallySupported: number;
    unverified: number;
    unknown: number;
  };
}

export function evaluateConformance(
  assertionId: string,
  evidence: ConformanceEvidence[]
): ConformanceResult {
  const supports = evidence.filter((e) => e.stance === "supports");
  const contradicts = evidence.filter((e) => e.stance === "contradicts");

  let status: ConformanceStatus;

  if (contradicts.length > 0 && supports.length > 0) {
    status = "contradicted";
  } else if (contradicts.length > 0) {
    status = "contradicted";
  } else if (supports.length >= 2) {
    status = "supported";
  } else if (supports.length === 1) {
    status = "partially_supported";
  } else if (evidence.length === 0) {
    status = "unverified";
  } else {
    status = "unknown";
  }

  return { assertionId, status, evidence };
}

export function buildReport(results: ConformanceResult[]): ConformanceReport {
  return {
    results,
    summary: {
      total: results.length,
      supported: results.filter((r) => r.status === "supported").length,
      contradicted: results.filter((r) => r.status === "contradicted").length,
      partiallySupported: results.filter((r) => r.status === "partially_supported").length,
      unverified: results.filter((r) => r.status === "unverified").length,
      unknown: results.filter((r) => r.status === "unknown").length,
    },
  };
}

export function renderConformanceReport(report: ConformanceReport): string {
  const lines: string[] = [];
  lines.push("Conformance Report");
  lines.push("==================\n");

  for (const r of report.results) {
    const icon =
      r.status === "supported" ? "✓" :
      r.status === "contradicted" ? "✗" :
      r.status === "partially_supported" ? "~" :
      r.status === "unverified" ? "?" : "—";

    lines.push(`${icon} ${r.assertionId}`);
    lines.push(`  Status: ${r.status}`);

    if (r.evidence.length > 0) {
      lines.push("  Evidence:");
      for (const e of r.evidence) {
        const stanceIcon = e.stance === "supports" ? "+" : e.stance === "contradicts" ? "-" : "~";
        lines.push(`    [${stanceIcon}] ${e.type}: ${e.source}`);
      }
    } else {
      lines.push("  Evidence: none");
    }
    lines.push("");
  }

  lines.push("Summary");
  lines.push("-------");
  lines.push(`  Total:       ${report.summary.total}`);
  lines.push(`  Supported:   ${report.summary.supported}`);
  lines.push(`  Contradicted:${report.summary.contradicted}`);
  lines.push(`  Partial:     ${report.summary.partiallySupported}`);
  lines.push(`  Unverified:  ${report.summary.unverified}`);

  return lines.join("\n");
}
