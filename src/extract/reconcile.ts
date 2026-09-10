import { CandidateAssertion } from "./interpret-candidates.ts";
import { LLMConfig } from "./llm-interpret.ts";

export type ReconciliationRelationship = "same" | "distinct" | "related" | "unknown";

export interface ReconciliationProposal {
  candidateA: string;
  candidateB: string;
  relationship: ReconciliationRelationship;
  confidence: "high" | "medium" | "low";
  rationale: string;
  evidence: string[];
  suggestedAssertion?: {
    subject: string;
    predicate: string;
    object?: string;
  };
}

export interface ReconciledConcept {
  id: string;
  canonicalName: string;
  mergedFrom: string[];
  candidates: CandidateAssertion[];
  relatedProposals: ReconciliationProposal[];
}

function buildReconciliationSystemPrompt(): string {
  return `You are a semantic identity reconciliation engine for software system assertions.

You receive a list of candidate semantic assertions extracted from source code. Your job is to determine relationships between the semantic concepts referenced by these candidates.

RELATIONSHIPS:
- "same": Two candidates refer to the identical semantic concept under different names or representations
- "distinct": Two candidates refer to genuinely different semantic concepts
- "related": Two candidates are causally or structurally connected but are not the same concept
- "unknown": Insufficient evidence to determine the relationship

CRITICAL RULES:
- "same" means SAME REFERENT, not similar meaning. PaymentAccepted and ReservationPaid are NOT the same — one causes the other.
- Return proposals for ALL pairs where the relationship is not obvious (skip pairs that are clearly distinct with no possible connection)
- For "related" pairs, include a suggestedAssertion linking the two concepts with the correct predicate
- For "same" pairs, identify the canonical name and the evidence supporting equivalence
- Do NOT merge concepts just because their names are similar or they share syntactic structure
- Preserve genuinely distinct concepts even if they appear in similar positions

OUTPUT SCHEMA:
{
  "proposals": [
    {
      "candidateA": "candidate ID",
      "candidateB": "candidate ID",
      "relationship": "same" | "distinct" | "related" | "unknown",
      "confidence": "high" | "medium" | "low",
      "rationale": "string",
      "evidence": ["string"],
      "suggestedAssertion": { "subject": "string", "predicate": "string", "object": "string" } (only for "related")
    }
  ],
  "notes": "string"
}`;
}

function buildReconciliationUserPrompt(candidates: CandidateAssertion[]): string {
  const lines: string[] = [];
  lines.push("Reconcile the following candidate assertions:\n");

  for (const c of candidates) {
    const obj = c.object ? ` ${c.object}` : "";
    lines.push(`[${c.id}] ${c.subject} ${c.predicate}${obj}`);
    lines.push(`  Evidence: ${c.evidence.map((e) => e.detail).join(", ")}`);
    lines.push(`  Confidence: ${c.confidence.toFixed(2)} | Status: ${c.epistemicStatus}`);
    lines.push("");
  }

  lines.push(`Total candidates: ${candidates.length}`);
  lines.push("Identify pairs that are the same concept, related, or distinctly different.");
  lines.push("Respond with JSON only. No markdown, no explanation outside the JSON.");
  return lines.join("\n");
}

function parseReconciliationResponse(raw: string): ReconciliationProposal[] {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(cleaned);

  return (parsed.proposals ?? []).map((p: Record<string, unknown>) => ({
    candidateA: String(p.candidateA ?? ""),
    candidateB: String(p.candidateB ?? ""),
    relationship: (["same", "distinct", "related", "unknown"].includes(String(p.relationship))
      ? p.relationship
      : "unknown") as ReconciliationRelationship,
    confidence: (["high", "medium", "low"].includes(String(p.confidence))
      ? p.confidence
      : "medium") as "high" | "medium" | "low",
    rationale: String(p.rationale ?? ""),
    evidence: Array.isArray(p.evidence) ? p.evidence.map(String) : [],
    suggestedAssertion: p.suggestedAssertion != null
      ? {
          subject: String((p.suggestedAssertion as Record<string, unknown>).subject ?? ""),
          predicate: String((p.suggestedAssertion as Record<string, unknown>).predicate ?? ""),
          object: (p.suggestedAssertion as Record<string, unknown>).object != null
            ? String((p.suggestedAssertion as Record<string, unknown>).object)
            : undefined,
        }
      : undefined,
  }));
}

export async function reconcile(
  candidates: CandidateAssertion[],
  config: LLMConfig
): Promise<ReconciliationProposal[]> {
  const model = config.model ?? "gpt-4o";
  const sessionId = crypto.randomUUID();

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
      "x-opencode-session": sessionId,
      "User-Agent": "semir-reconciliation/0.1",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildReconciliationSystemPrompt() },
        { role: "user", content: buildReconciliationUserPrompt(candidates) },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LLM API error ${response.status}: ${body}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned empty response");
  }

  return parseReconciliationResponse(content);
}

export function applyReconciliations(
  candidates: CandidateAssertion[],
  proposals: ReconciliationProposal[]
): ReconciledConcept[] {
  const candidateMap = new Map(candidates.map((c) => [c.id, c]));
  const merged = new Map<string, ReconciledConcept>();
  const used = new Set<string>();

  for (const p of proposals) {
    if (p.relationship !== "same") continue;

    const a = candidateMap.get(p.candidateA);
    const b = candidateMap.get(p.candidateB);
    if (!a || !b) continue;

    const existingA = merged.get(p.candidateA);
    const existingB = merged.get(p.candidateB);

    // Find the canonical concept (prefer the one already merged, or the higher-confidence one)
    let canonicalId: string;
    let concept: ReconciledConcept;

    if (existingA && existingB) {
      // Both already merged — combine into existingA's group
      canonicalId = existingA.id;
      concept = existingA;
      for (const cid of existingB.mergedFrom) {
        concept.mergedFrom.push(cid);
        concept.candidates.push(candidateMap.get(cid)!);
        merged.set(cid, concept);
      }
    } else if (existingA) {
      canonicalId = existingA.id;
      concept = existingA;
      concept.mergedFrom.push(p.candidateB);
      concept.candidates.push(b);
      merged.set(p.candidateB, concept);
    } else if (existingB) {
      canonicalId = existingB.id;
      concept = existingB;
      concept.mergedFrom.push(p.candidateA);
      concept.candidates.push(a);
      merged.set(p.candidateA, concept);
    } else {
      // New merge group
      canonicalId = a.confidence >= b.confidence ? p.candidateA : p.candidateB;
      const canonical = canonicalId === p.candidateA ? a : b;
      const other = canonicalId === p.candidateA ? b : a;
      concept = {
        id: canonicalId,
        canonicalName: canonical.subject,
        mergedFrom: [p.candidateA, p.candidateB],
        candidates: [canonical, other],
        relatedProposals: [p],
      };
      merged.set(p.candidateA, concept);
      merged.set(p.candidateB, concept);
    }

    used.add(p.candidateA);
    used.add(p.candidateB);
  }

  // Add unmerged candidates as standalone concepts
  for (const c of candidates) {
    if (used.has(c.id)) continue;
    if (merged.has(c.id)) continue;

    const related = proposals.filter(
      (p) =>
        (p.candidateA === c.id || p.candidateB === c.id) &&
        p.relationship === "related"
    );

    merged.set(c.id, {
      id: c.id,
      canonicalName: c.subject,
      mergedFrom: [c.id],
      candidates: [c],
      relatedProposals: related,
    });
  }

  return [...merged.values()];
}

export function renderReconciled(concepts: ReconciledConcept[]): string {
  const lines: string[] = [];
  lines.push("Reconciled Semantic Concepts");
  lines.push("============================\n");

  for (const c of concepts) {
    const merged = c.mergedFrom.length > 1
      ? ` (merged from ${c.mergedFrom.length} candidates)`
      : "";
    lines.push(`[ ${c.canonicalName} ]${merged}`);

    for (const candidate of c.candidates) {
      const obj = candidate.object ? ` ${candidate.object}` : "";
      lines.push(`  └─ ${candidate.subject} ${candidate.predicate}${obj}`);
    }

    if (c.relatedProposals.length > 0) {
      for (const p of c.relatedProposals) {
        if (p.suggestedAssertion) {
          const obj = p.suggestedAssertion.object ? ` ${p.suggestedAssertion.object}` : "";
          lines.push(`  ~ ${p.suggestedAssertion.subject} ${p.suggestedAssertion.predicate}${obj}`);
        }
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}

export interface ReconciliationEvaluation {
  mergePrecision: number;
  mergeRecall: number;
  falseCollapseRate: number;
  distinctPrecision: number;
  totalProposals: number;
  correctMerges: number;
  incorrectMerges: number;
  missedMerges: number;
  falseDistinct: number;
}

export function evaluateReconciliation(
  proposals: ReconciliationProposal[],
  expectedSame: string[][],
  expectedDistinct: string[][]
): ReconciliationEvaluation {
  const proposalSet = new Set(
    proposals.map((p) =>
      [p.candidateA, p.candidateB].sort().join("==")
    )
  );

  let correctMerges = 0;
  let incorrectMerges = 0;
  let missedMerges = 0;

  for (const [a, b] of expectedSame) {
    const key = [a, b].sort().join("==");
    const proposal = proposals.find(
      (p) =>
        [p.candidateA, p.candidateB].sort().join("==") === key
    );

    if (proposal?.relationship === "same") {
      correctMerges++;
    } else {
      missedMerges++;
    }
  }

  for (const p of proposals) {
    if (p.relationship !== "same") continue;
    const key = [p.candidateA, p.candidateB].sort().join("==");
    const isExpected = expectedSame.some(
      ([a, b]) => [a, b].sort().join("==") === key
    );
    if (!isExpected) incorrectMerges++;
  }

  let falseDistinct = 0;
  for (const [a, b] of expectedDistinct) {
    const key = [a, b].sort().join("==");
    const proposal = proposals.find(
      (p) =>
        [p.candidateA, p.candidateB].sort().join("==") === key
    );
    if (proposal?.relationship === "same") falseDistinct++;
  }

  const totalProposals = proposals.filter((p) => p.relationship === "same").length;
  const mergePrecision = totalProposals > 0 ? correctMerges / totalProposals : 0;
  const mergeRecall = expectedSame.length > 0 ? correctMerges / expectedSame.length : 0;
  const falseCollapseRate = totalProposals > 0 ? incorrectMerges / totalProposals : 0;
  const distinctPrecision = expectedDistinct.length > 0
    ? (expectedDistinct.length - falseDistinct) / expectedDistinct.length
    : 1;

  return {
    mergePrecision,
    mergeRecall,
    falseCollapseRate,
    distinctPrecision,
    totalProposals,
    correctMerges,
    incorrectMerges,
    missedMerges,
    falseDistinct,
  };
}
