import { CandidateAssertion } from "./interpret-candidates.ts";
import { LLMConfig } from "./llm-interpret.ts";
import {
  AssertionSignature,
  computeSignature,
  normalizeConcept,
  normalizePredicate,
  signatureKey,
  signaturesMatch,
} from "./reconcile.ts";

// --- Types ---

export type ComparisonClassification =
  | "match"
  | "semantic_drift"
  | "contradicted"
  | "unverified_intent"
  | "undocumented_behaviour"
  | "unknown";

export interface SemanticCorrespondence {
  intendedId: string;
  extractedId?: string;
  classification: ComparisonClassification;
  relationship?: "equivalent" | "refines" | "overlaps" | "contradicts";
  confidence: "high" | "medium" | "low";
  rationale: string;
  evidence: string[];
}

export interface IntendedAssertion {
  id: string;
  subject: string;
  predicate: string;
  object?: string;
  constraint?: string;
}

export interface ComparisonResult {
  correspondences: SemanticCorrespondence[];
  matchCount: number;
  driftCount: number;
  contradictedCount: number;
  unverifiedCount: number;
  undocumentedCount: number;
  unknownCount: number;
}

// --- Deterministic comparison ---

function intendedSignature(a: IntendedAssertion): AssertionSignature {
  return {
    subject: normalizeConcept(a.subject),
    predicate: normalizePredicate(a.predicate),
    object: a.object ? normalizeConcept(a.object) : undefined,
    constraint: a.constraint,
    scope: undefined,
  };
}

export function deterministicCompare(
  intended: IntendedAssertion[],
  extracted: CandidateAssertion[]
): {
  matches: Array<{ intended: IntendedAssertion; extracted: CandidateAssertion }>;
  driftCandidates: Array<{ intended: IntendedAssertion; extracted: CandidateAssertion; reason: string }>;
  unverified: IntendedAssertion[];
  undocumented: CandidateAssertion[];
  ambiguous: Array<{ intended: IntendedAssertion; extracted: CandidateAssertion }>;
} {
  const matches: Array<{ intended: IntendedAssertion; extracted: CandidateAssertion }> = [];
  const driftCandidates: Array<{ intended: IntendedAssertion; extracted: CandidateAssertion; reason: string }> = [];
  const unverified: IntendedAssertion[] = [];
  const undocumented: CandidateAssertion[] = [];
  const ambiguous: Array<{ intended: IntendedAssertion; extracted: CandidateAssertion }> = [];

  const extractedSigs = extracted.map((e) => ({ candidate: e, sig: computeSignature(e) }));
  const matchedExtracted = new Set<string>();

  for (const intent of intended) {
    const iSig = intendedSignature(intent);
    let foundMatch = false;

    for (const { candidate: ext, sig: eSig } of extractedSigs) {
      if (signaturesMatch(iSig, eSig)) {
        matches.push({ intended: intent, extracted: ext });
        matchedExtracted.add(ext.id);
        foundMatch = true;
        break;
      }
    }

    if (!foundMatch) {
      // Check for drift candidates: same identity, different literal/constraint
      let foundDrift = false;
      for (const { candidate: ext, sig: eSig } of extractedSigs) {
        if (matchedExtracted.has(ext.id)) continue;
        if (iSig.subject === eSig.subject && iSig.predicate === eSig.predicate && iSig.object === eSig.object) {
          if (iSig.constraint !== eSig.constraint) {
            driftCandidates.push({
              intended: intent,
              extracted: ext,
              reason: `Constraint changed: "${iSig.constraint}" → "${eSig.constraint}"`,
            });
            matchedExtracted.add(ext.id);
            foundDrift = true;
            break;
          }
        }
      }

      if (!foundDrift) {
        // Check for broader structural overlap (ambiguous)
        let foundAmbiguous = false;
        for (const { candidate: ext, sig: eSig } of extractedSigs) {
          if (matchedExtracted.has(ext.id)) continue;
          if (iSig.subject === eSig.subject || iSig.object === eSig.object) {
            ambiguous.push({ intended: intent, extracted: ext });
            foundAmbiguous = true;
            break;
          }
        }

        if (!foundAmbiguous) {
          unverified.push(intent);
        }
      }
    }
  }

  // Undocumented: extracted candidates not matched to any intended
  for (const ext of extracted) {
    if (!matchedExtracted.has(ext.id)) {
      undocumented.push(ext);
    }
  }

  return { matches, driftCandidates, unverified, undocumented, ambiguous };
}

// --- LLM adjudication ---

function buildComparisonSystemPrompt(): string {
  return `You are a semantic comparison engine for software system assertions.

You compare INTENDED assertions (what the system should mean) against EXTRACTED assertions (what the implementation appears to mean) and classify their relationship.

CLASSIFICATIONS:
- "match": The intended and extracted assertions are semantically equivalent.
- "semantic_drift": Same semantic identity but changed literal, constraint, or parameter.
- "contradicted": The extracted evidence demonstrates the intended assertion is violated.
- "unverified_intent": The intended assertion exists but no implementation evidence was found.
- "undocumented_behaviour": The extracted assertion exists but has no corresponding intent.
- "unknown": Insufficient evidence to classify.

CRITICAL RULES:
- "not found" ≠ "not implemented". Absence of extraction evidence is not proof of absence in implementation.
- If you are unsure, prefer "unknown" over "contradicted". False violations destroy trust.
- For "semantic_drift", specify what changed (constraint, literal, threshold).
- For "match", note if the extracted version is a refinement or lower-resolution description.

OUTPUT SCHEMA:
{
  "correspondences": [
    {
      "intendedId": "intended assertion ID",
      "extractedId": "extracted assertion ID (null if unverified)",
      "classification": "match" | "semantic_drift" | "contradicted" | "unverified_intent" | "undocumented_behaviour" | "unknown",
      "relationship": "equivalent" | "refines" | "overlaps" | "contradicts" (optional),
      "confidence": "high" | "medium" | "low",
      "rationale": "string",
      "evidence": ["string"]
    }
  ],
  "notes": "string"
}`;
}

function buildComparisonUserPrompt(
  pairs: Array<{ intended: IntendedAssertion; extracted?: CandidateAssertion; hint?: string }>
): string {
  const lines: string[] = [];
  lines.push("Compare the following intended vs extracted assertions:\n");

  for (let i = 0; i < pairs.length; i++) {
    const { intended, extracted, hint } = pairs[i];
    lines.push(`--- PAIR ${i + 1} ---`);
    lines.push("");
    lines.push(`Intended: [${intended.id}]`);
    lines.push(`  subject:    ${normalizeConcept(intended.subject)}`);
    lines.push(`  predicate:  ${normalizePredicate(intended.predicate)}`);
    lines.push(`  object:     ${intended.object ? normalizeConcept(intended.object) : "(none)"}`);
    if (intended.constraint) lines.push(`  constraint: ${intended.constraint}`);
    lines.push("");

    if (extracted) {
      const eSig = computeSignature(extracted);
      lines.push(`Extracted: [${extracted.id}]`);
      lines.push(`  subject:    ${eSig.subject}`);
      lines.push(`  predicate:  ${eSig.predicate}`);
      lines.push(`  object:     ${eSig.object ?? "(none)"}`);
      if (eSig.constraint) lines.push(`  constraint: ${eSig.constraint}`);
      lines.push(`  evidence:   ${extracted.evidence.map((e) => e.detail).join("; ")}`);
    } else {
      lines.push("Extracted: (no corresponding assertion found)");
    }
    lines.push("");

    if (hint) lines.push(`  Hint: ${hint}`);
    lines.push("  → match, semantic_drift, contradicted, unverified_intent, or unknown?");
    lines.push("");
  }

  lines.push(`Total pairs: ${pairs.length}`);
  lines.push("Respond with JSON only. No markdown, no explanation outside the JSON.");
  return lines.join("\n");
}

function parseComparisonResponse(raw: string): SemanticCorrespondence[] {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(cleaned);

  return (parsed.correspondences ?? []).map((c: Record<string, unknown>) => ({
    intendedId: String(c.intendedId ?? ""),
    extractedId: c.extractedId != null ? String(c.extractedId) : undefined,
    classification: (["match", "semantic_drift", "contradicted", "unverified_intent", "undocumented_behaviour", "unknown"]
      .includes(String(c.classification))
      ? c.classification
      : "unknown") as ComparisonClassification,
    relationship: c.relationship != null &&
      ["equivalent", "refines", "overlaps", "contradicts"].includes(String(c.relationship))
      ? (c.relationship as "equivalent" | "refines" | "overlaps" | "contradicts")
      : undefined,
    confidence: (["high", "medium", "low"].includes(String(c.confidence))
      ? c.confidence
      : "medium") as "high" | "medium" | "low",
    rationale: String(c.rationale ?? ""),
    evidence: Array.isArray(c.evidence) ? c.evidence.map(String) : [],
  }));
}

export async function compareLLM(
  pairs: Array<{ intended: IntendedAssertion; extracted?: CandidateAssertion; hint?: string }>,
  config: LLMConfig
): Promise<SemanticCorrespondence[]> {
  if (pairs.length === 0) return [];

  const model = config.model ?? "gpt-4o";
  const sessionId = crypto.randomUUID();

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
      "x-opencode-session": sessionId,
      "User-Agent": "semir-comparison/0.1",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildComparisonSystemPrompt() },
        { role: "user", content: buildComparisonUserPrompt(pairs) },
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

  return parseComparisonResponse(content);
}

// --- Full comparison pipeline (6a + 6b) ---

export async function compareAll(
  intended: IntendedAssertion[],
  extracted: CandidateAssertion[],
  config?: LLMConfig
): Promise<ComparisonResult> {
  // Pass 6a: deterministic signature comparison
  const det = deterministicCompare(intended, extracted);

  const correspondences: SemanticCorrespondence[] = [];

  // Exact matches
  for (const { intended: intent, extracted: ext } of det.matches) {
    correspondences.push({
      intendedId: intent.id,
      extractedId: ext.id,
      classification: "match",
      relationship: "equivalent",
      confidence: "high",
      rationale: `Exact signature match: ${signatureKey(intendedSignature(intent))}`,
      evidence: ["deterministic:exact-match"],
    });
  }

  // Drift candidates — send to LLM for confirmation
  const llmPairs: Array<{ intended: IntendedAssertion; extracted?: CandidateAssertion; hint?: string }> = [];
  for (const { intended: intent, extracted: ext, reason } of det.driftCandidates) {
    llmPairs.push({ intended: intent, extracted: ext, hint: reason });
  }

  // Unverified intent — send to LLM
  for (const intent of det.unverified) {
    llmPairs.push({ intended: intent, hint: "No corresponding extracted assertion found" });
  }

  // Ambiguous pairs — send to LLM
  for (const { intended: intent, extracted: ext } of det.ambiguous) {
    llmPairs.push({ intended: intent, extracted: ext });
  }

  // Undocumented behaviour — send to LLM
  for (const ext of det.undocumented) {
    llmPairs.push({
      intended: { id: `undocumented://${ext.id}`, subject: ext.subject, predicate: ext.predicate, object: ext.object },
      extracted: ext,
      hint: "No corresponding intended assertion found",
    });
  }

  // Pass 6b: LLM adjudication
  let llmCorrespondences: SemanticCorrespondence[] = [];
  if (config && llmPairs.length > 0) {
    llmCorrespondences = await compareLLM(llmPairs, config);
  }

  // For unverified intents not handled by LLM, create default correspondences
  for (const intent of det.unverified) {
    if (!llmCorrespondences.some((c) => c.intendedId === intent.id)) {
      correspondences.push({
        intendedId: intent.id,
        classification: "unverified_intent",
        confidence: "medium",
        rationale: "No corresponding extracted assertion found",
        evidence: ["deterministic:no-match"],
      });
    }
  }

  // For undocumented behaviours not handled by LLM
  for (const ext of det.undocumented) {
    const extId = `undocumented://${ext.id}`;
    if (!llmCorrespondences.some((c) => c.extractedId === ext.id)) {
      correspondences.push({
        intendedId: extId,
        extractedId: ext.id,
        classification: "undocumented_behaviour",
        confidence: "medium",
        rationale: "No corresponding intended assertion found",
        evidence: ["deterministic:no-intent"],
      });
    }
  }

  correspondences.push(...llmCorrespondences);

  const counts = {
    matchCount: correspondences.filter((c) => c.classification === "match").length,
    driftCount: correspondences.filter((c) => c.classification === "semantic_drift").length,
    contradictedCount: correspondences.filter((c) => c.classification === "contradicted").length,
    unverifiedCount: correspondences.filter((c) => c.classification === "unverified_intent").length,
    undocumentedCount: correspondences.filter((c) => c.classification === "undocumented_behaviour").length,
    unknownCount: correspondences.filter((c) => c.classification === "unknown").length,
  };

  return { correspondences, ...counts };
}

// --- Render ---

export function renderComparison(result: ComparisonResult): string {
  const lines: string[] = [];
  lines.push("Semantic Comparison Results");
  lines.push("===========================\n");

  const groups: Record<string, SemanticCorrespondence[]> = {};
  for (const c of result.correspondences) {
    if (!groups[c.classification]) groups[c.classification] = [];
    groups[c.classification].push(c);
  }

  const icons: Record<string, string> = {
    match: "=",
    semantic_drift: "~",
    contradicted: "!",
    unverified_intent: "?",
    undocumented_behaviour: "+",
    unknown: "-",
  };

  for (const [classification, items] of Object.entries(groups)) {
    lines.push(`[${classification.toUpperCase()}] (${items.length})`);
    for (const c of items) {
      const icon = icons[classification] ?? "-";
      const extracted = c.extractedId ? ` ← ${c.extractedId}` : "";
      lines.push(`  ${icon} ${c.intendedId}${extracted}`);
      lines.push(`    ${c.rationale}`);
    }
    lines.push("");
  }

  lines.push("Summary:");
  lines.push(`  Match:               ${result.matchCount}`);
  lines.push(`  Semantic drift:      ${result.driftCount}`);
  lines.push(`  Contradicted:        ${result.contradictedCount}`);
  lines.push(`  Unverified intent:   ${result.unverifiedCount}`);
  lines.push(`  Undocumented:        ${result.undocumentedCount}`);
  lines.push(`  Unknown:             ${result.unknownCount}`);

  return lines.join("\n");
}

// --- Evaluation ---

export interface ComparisonEvaluation {
  matchPrecision: number;
  driftPrecision: number;
  falseViolationRate: number;
  undocumentedPrecision: number;
  totalExpected: number;
  correctMatches: number;
  correctDrifts: number;
  falseViolations: number;
  correctUndocumented: number;
}

export function evaluateComparison(
  correspondences: SemanticCorrespondence[],
  expected: Array<{ intendedId: string; extractedId?: string; classification: ComparisonClassification }>
): ComparisonEvaluation {
  let correctMatches = 0;
  let correctDrifts = 0;
  let correctViolations = 0;
  let falseViolations = 0;
  let correctUndocumented = 0;

  for (const exp of expected) {
    const found = correspondences.find(
      (c) => c.intendedId === exp.intendedId && c.extractedId === exp.extractedId
    );
    if (!found) continue;

    if (exp.classification === "match" && found.classification === "match") correctMatches++;
    if (exp.classification === "semantic_drift" && found.classification === "semantic_drift") correctDrifts++;
    if (exp.classification === "contradicted" && found.classification === "contradicted") correctViolations++;
    if (exp.classification === "undocumented_behaviour" && found.classification === "undocumented_behaviour") correctUndocumented++;

    // False violations: classified as contradicted but should be something else
    if (found.classification === "contradicted" && exp.classification !== "contradicted") falseViolations++;
  }

  const totalExpected = expected.length;
  const matchPrecision = totalExpected > 0 ? correctMatches / totalExpected : 0;
  const driftPrecision = totalExpected > 0 ? correctDrifts / totalExpected : 0;
  const falseViolationRate = totalExpected > 0 ? falseViolations / totalExpected : 0;
  const undocumentedPrecision = totalExpected > 0 ? correctUndocumented / totalExpected : 0;

  return {
    matchPrecision,
    driftPrecision,
    falseViolationRate,
    undocumentedPrecision,
    totalExpected,
    correctMatches,
    correctDrifts,
    falseViolations,
    correctUndocumented,
  };
}
