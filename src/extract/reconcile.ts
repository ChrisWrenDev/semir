import { CandidateAssertion } from "./interpret-candidates.ts";
import { LLMConfig } from "./llm-interpret.ts";

// --- Types ---

export type AssertionRelationship = "same" | "distinct" | "unknown";

export interface ReconciliationProposal {
  candidateA: string;
  candidateB: string;
  relationship: AssertionRelationship;
  confidence: "high" | "medium" | "low";
  rationale: string;
  evidence: string[];
}

export interface AssertionSignature {
  subject: string;
  predicate: string;
  object?: string;
  constraint?: string;
  scope?: string;
}

export interface ReconciledAssertion {
  id: string;
  canonicalName: string;
  signature: AssertionSignature;
  mergedFrom: string[];
  candidates: CandidateAssertion[];
}

export interface DeterministicMatchResult {
  exactMatches: Array<{ a: CandidateAssertion; b: CandidateAssertion }>;
  obviousDistinct: Array<{ a: CandidateAssertion; b: CandidateAssertion; reason: string }>;
  ambiguous: Array<{ a: CandidateAssertion; b: CandidateAssertion }>;
}

// --- Concept normalization ---

const CONCEPT_ALIASES: Record<string, string> = {
  // Object-level: payment result concepts
  "result.paid": "PaymentAccepted",
  "resultpaid": "PaymentAccepted",
  "paymentcomplete": "PaymentAccepted",
  "paymentcompleted": "PaymentAccepted",
  "paymentcompletedat": "PaymentAccepted",
  "paymentstatusaccepted": "PaymentAccepted",
  "paymentstatus": "PaymentAccepted",
  "successfulpayment": "PaymentAccepted",
  "paid": "Paid",
  "paidstate": "Paid",
  "active": "Active",
  "activestate": "Active",
  "expired": "Expired",
  "expiredstate": "Expired",
  "rate-limit-exceeded": "RateLimitExceeded",
  "ratelimitexceeded": "RateLimitExceeded",
  "request-rejected": "RequestRejected",
  "requestrejected": "RequestRejected",
  "http_429": "HTTP_429",
  // Subject-level: payment action concepts
  "processpayment": "PaymentAction",
  "handlepayment": "PaymentAction",
  "recordpayment": "PaymentAction",
  "paymentcontroller": "PaymentAction",
  "payreservation": "PayReservation",
  // Subject-level: expiry action concepts
  "processexpiry": "ExpiryAction",
  "expiryworker": "ExpiryAction",
  "processreservationexpiry": "ExpiryAction",
};

const PREDICATE_ALIASES: Record<string, string> = {
  "prevents": "forbids",
  "inhibits": "forbids",
  "blocks": "forbids",
  "triggers": "causes",
  "initiates": "causes",
  "leads_to": "causes",
  "generates": "causes",
};

function normalizeConcept(name: string): string {
  const lower = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (CONCEPT_ALIASES[lower]) return CONCEPT_ALIASES[lower];

  // Pattern-based normalization: detect payment-related concepts
  if (/process|handle|record|execute/.test(lower) && /payment|pay/.test(lower)) return "PaymentAction";
  if (/process|handle|check/.test(lower) && /expir/.test(lower)) return "ExpiryAction";

  return name;
}

function normalizePredicate(pred: string): string {
  return PREDICATE_ALIASES[pred] ?? pred;
}

// --- Signature computation ---

export function computeSignature(c: CandidateAssertion): AssertionSignature {
  return {
    subject: normalizeConcept(c.subject),
    predicate: normalizePredicate(c.predicate),
    object: c.object ? normalizeConcept(c.object) : undefined,
    constraint: extractConstraint(c),
    scope: undefined,
  };
}

function extractConstraint(c: CandidateAssertion): string | undefined {
  const reasoning = c.reasoning.toLowerCase();
  if (reasoning.includes("where") || reasoning.includes("constraint") || reasoning.includes("condition")) {
    const match = c.reasoning.match(/(?:where|constraint|condition)[:\s]+(.+)/i);
    if (match) return match[1].trim();
  }
  return undefined;
}

function signatureKey(s: AssertionSignature): string {
  const parts = [s.subject, s.predicate];
  if (s.object) parts.push(s.object);
  if (s.constraint) parts.push(`constraint:${s.constraint}`);
  if (s.scope) parts.push(`scope:${s.scope}`);
  return parts.join(":");
}

function signaturesMatch(a: AssertionSignature, b: AssertionSignature): boolean {
  return signatureKey(a) === signatureKey(b);
}

// --- Deterministic matching ---

export function deterministicMatch(candidates: CandidateAssertion[]): DeterministicMatchResult {
  const result: DeterministicMatchResult = {
    exactMatches: [],
    obviousDistinct: [],
    ambiguous: [],
  };

  const signatures = candidates.map((c) => ({ candidate: c, sig: computeSignature(c) }));

  for (let i = 0; i < signatures.length; i++) {
    for (let j = i + 1; j < signatures.length; j++) {
      const a = signatures[i];
      const b = signatures[j];

      if (signaturesMatch(a.sig, b.sig)) {
        result.exactMatches.push({ a: a.candidate, b: b.candidate });
      } else if (a.sig.subject !== b.sig.subject && a.sig.predicate === b.sig.predicate && a.sig.object === b.sig.object) {
        result.obviousDistinct.push({
          a: a.candidate,
          b: b.candidate,
          reason: `Different subjects: ${a.sig.subject} vs ${b.sig.subject}`,
        });
      } else if (a.sig.subject === b.sig.subject && a.sig.predicate !== b.sig.predicate) {
        result.obviousDistinct.push({
          a: a.candidate,
          b: b.candidate,
          reason: `Different predicates: ${a.sig.predicate} vs ${b.sig.predicate}`,
        });
      } else if (a.sig.subject === b.sig.subject && a.sig.predicate === b.sig.predicate && a.sig.object !== b.sig.object) {
        result.obviousDistinct.push({
          a: a.candidate,
          b: b.candidate,
          reason: `Different objects: ${a.sig.object} vs ${b.sig.object}`,
        });
      } else {
        result.ambiguous.push({ a: a.candidate, b: b.candidate });
      }
    }
  }

  return result;
}

// --- LLM role-aware reconciliation ---

function buildReconciliationSystemPrompt(): string {
  return `You are a role-aware semantic assertion reconciliation engine.

You receive PAIRS of candidate assertions that require semantic judgment. Each pair has been pre-filtered by deterministic structure — the pairs you receive are genuinely ambiguous.

For each pair, examine the SEMANTIC ROLES (subject, predicate, object, constraint) of both assertions.

RELATIONSHIPS:
- "same": The two assertions make the identical semantic claim. They would be redundant in any model.
- "distinct": The two assertions make different semantic claims, even if they share entities.
- "unknown": Insufficient evidence to determine the relationship.

CRITICAL RULES:
- Assertion identity is defined over ROLES, not entity names.
- Two assertions sharing an object but having different subjects are DISTINCT.
  Example: "PayReservation requires Active" and "ProcessExpiry requires Active" are DISTINCT because subjects differ.
- Two assertions with the same triple but different constraints are DISTINCT.
  Example: "authorized_by User where owner" and "authorized_by User where organisation" are DISTINCT.
- Only merge when the FULL assertion triple matches AND the concepts are equivalent.
- If you are unsure, prefer "distinct" over "same". False merges are more damaging than missed merges.

OUTPUT SCHEMA:
{
  "proposals": [
    {
      "candidateA": "candidate ID",
      "candidateB": "candidate ID",
      "relationship": "same" | "distinct" | "unknown",
      "confidence": "high" | "medium" | "low",
      "rationale": "string",
      "evidence": ["string"]
    }
  ],
  "notes": "string"
}`;
}

function buildReconciliationUserPrompt(
  pairs: Array<{ a: CandidateAssertion; b: CandidateAssertion }>
): string {
  const lines: string[] = [];
  lines.push("Reconcile the following assertion pairs:\n");

  for (let i = 0; i < pairs.length; i++) {
    const { a, b } = pairs[i];
    const sigA = computeSignature(a);
    const sigB = computeSignature(b);

    lines.push(`--- PAIR ${i + 1} ---`);
    lines.push("");
    lines.push(`Candidate A: [${a.id}]`);
    lines.push(`  subject:    ${sigA.subject}`);
    lines.push(`  predicate:  ${sigA.predicate}`);
    lines.push(`  object:     ${sigA.object ?? "(none)"}`);
    if (sigA.constraint) lines.push(`  constraint: ${sigA.constraint}`);
    lines.push(`  evidence:   ${a.evidence.map((e) => e.detail).join("; ")}`);
    lines.push("");
    lines.push(`Candidate B: [${b.id}]`);
    lines.push(`  subject:    ${sigB.subject}`);
    lines.push(`  predicate:  ${sigB.predicate}`);
    lines.push(`  object:     ${sigB.object ?? "(none)"}`);
    if (sigB.constraint) lines.push(`  constraint: ${sigB.constraint}`);
    lines.push(`  evidence:   ${b.evidence.map((e) => e.detail).join("; ")}`);
    lines.push("");

    // Show shared and differing roles
    const sharedRoles: string[] = [];
    const diffRoles: string[] = [];

    if (sigA.subject === sigB.subject) sharedRoles.push(`subject = ${sigA.subject}`);
    else diffRoles.push(`subject: ${sigA.subject} vs ${sigB.subject}`);

    if (sigA.predicate === sigB.predicate) sharedRoles.push(`predicate = ${sigA.predicate}`);
    else diffRoles.push(`predicate: ${sigA.predicate} vs ${sigB.predicate}`);

    if (sigA.object === sigB.object) sharedRoles.push(`object = ${sigA.object ?? "(none)"}`);
    else diffRoles.push(`object: ${sigA.object ?? "(none)"} vs ${sigB.object ?? "(none)"}`);

    if (sharedRoles.length > 0) lines.push(`Shared referents: ${sharedRoles.join(", ")}`);
    if (diffRoles.length > 0) lines.push(`Differing roles:  ${diffRoles.join(", ")}`);
    lines.push("");
    lines.push("  → same assertion, distinct assertion, or unknown?");
    lines.push("");
  }

  lines.push(`Total pairs: ${pairs.length}`);
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
    relationship: (["same", "distinct", "unknown"].includes(String(p.relationship))
      ? p.relationship
      : "unknown") as AssertionRelationship,
    confidence: (["high", "medium", "low"].includes(String(p.confidence))
      ? p.confidence
      : "medium") as "high" | "medium" | "low",
    rationale: String(p.rationale ?? ""),
    evidence: Array.isArray(p.evidence) ? p.evidence.map(String) : [],
  }));
}

export async function reconcileLLM(
  pairs: Array<{ a: CandidateAssertion; b: CandidateAssertion }>,
  config: LLMConfig
): Promise<ReconciliationProposal[]> {
  if (pairs.length === 0) return [];

  const model = config.model ?? "gpt-4o";
  const sessionId = crypto.randomUUID();

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
      "x-opencode-session": sessionId,
      "User-Agent": "semir-reconciliation/0.2",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildReconciliationSystemPrompt() },
        { role: "user", content: buildReconciliationUserPrompt(pairs) },
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

// --- Full reconciliation pipeline (5a + 5b + 5c) ---

export interface ReconciliationResult {
  deterministicProposals: ReconciliationProposal[];
  llmProposals: ReconciliationProposal[];
  allProposals: ReconciliationProposal[];
  matchResult: DeterministicMatchResult;
}

export async function reconcileAll(
  candidates: CandidateAssertion[],
  config?: LLMConfig
): Promise<ReconciliationResult> {
  // Pass 5b: deterministic structural matching
  const matchResult = deterministicMatch(candidates);

  const deterministicProposals: ReconciliationProposal[] = [];

  for (const { a, b } of matchResult.exactMatches) {
    deterministicProposals.push({
      candidateA: a.id,
      candidateB: b.id,
      relationship: "same",
      confidence: "high",
      rationale: `Exact signature match: ${signatureKey(computeSignature(a))}`,
      evidence: ["deterministic:exact-match"],
    });
  }

  for (const { a, b, reason } of matchResult.obviousDistinct) {
    deterministicProposals.push({
      candidateA: a.id,
      candidateB: b.id,
      relationship: "distinct",
      confidence: "high",
      rationale: reason,
      evidence: ["deterministic:structural-mismatch"],
    });
  }

  // Pass 5c: LLM only for ambiguous pairs
  let llmProposals: ReconciliationProposal[] = [];
  if (config && matchResult.ambiguous.length > 0) {
    llmProposals = await reconcileLLM(matchResult.ambiguous, config);
  }

  return {
    deterministicProposals,
    llmProposals,
    allProposals: [...deterministicProposals, ...llmProposals],
    matchResult,
  };
}

// --- Apply reconciliations ---

export function applyReconciliations(
  candidates: CandidateAssertion[],
  proposals: ReconciliationProposal[]
): ReconciledAssertion[] {
  const candidateMap = new Map(candidates.map((c) => [c.id, c]));
  const merged = new Map<string, ReconciledAssertion>();
  const used = new Set<string>();

  for (const p of proposals) {
    if (p.relationship !== "same") continue;

    const a = candidateMap.get(p.candidateA);
    const b = candidateMap.get(p.candidateB);
    if (!a || !b) continue;

    const existingA = merged.get(p.candidateA);
    const existingB = merged.get(p.candidateB);

    let assertion: ReconciledAssertion;

    if (existingA && existingB) {
      if (existingA !== existingB) {
        for (const cid of existingB.mergedFrom) {
          if (!existingA.mergedFrom.includes(cid)) {
            existingA.mergedFrom.push(cid);
            existingA.candidates.push(candidateMap.get(cid)!);
          }
          merged.set(cid, existingA);
        }
      }
      // Both already in same group — skip
      continue;
    } else if (existingA) {
      if (!existingA.mergedFrom.includes(p.candidateB)) {
        existingA.mergedFrom.push(p.candidateB);
        existingA.candidates.push(b);
      }
      merged.set(p.candidateB, existingA);
      assertion = existingA;
    } else if (existingB) {
      if (!existingB.mergedFrom.includes(p.candidateA)) {
        existingB.mergedFrom.push(p.candidateA);
        existingB.candidates.push(a);
      }
      merged.set(p.candidateA, existingB);
      assertion = existingB;
    } else {
      const canonical = a.confidence >= b.confidence ? a : b;
      const canonicalId = canonical.id;
      assertion = {
        id: canonicalId,
        canonicalName: canonical.subject,
        signature: computeSignature(canonical),
        mergedFrom: [p.candidateA, p.candidateB],
        candidates: [a, b],
      };
      merged.set(p.candidateA, assertion);
      merged.set(p.candidateB, assertion);
    }

    used.add(p.candidateA);
    used.add(p.candidateB);
  }

  for (const c of candidates) {
    if (used.has(c.id) || merged.has(c.id)) continue;
    merged.set(c.id, {
      id: c.id,
      canonicalName: c.subject,
      signature: computeSignature(c),
      mergedFrom: [c.id],
      candidates: [c],
    });
  }

  // Deduplicate by object reference (multiple keys may point to the same group)
  const seen = new Set<ReconciledAssertion>();
  const unique: ReconciledAssertion[] = [];
  for (const assertion of merged.values()) {
    if (!seen.has(assertion)) {
      seen.add(assertion);
      unique.push(assertion);
    }
  }
  return unique;
}

// --- Render ---

export function renderReconciled(assertions: ReconciledAssertion[]): string {
  const lines: string[] = [];
  lines.push("Reconciled Assertions");
  lines.push("=====================\n");

  for (const a of assertions) {
    const merged = a.mergedFrom.length > 1
      ? ` (merged from ${a.mergedFrom.length} candidates)`
      : "";
    lines.push(`[ ${a.canonicalName} ]${merged}`);
    lines.push(`  signature: (${a.signature.subject}, ${a.signature.predicate}, ${a.signature.object ?? "-"})`);

    for (const c of a.candidates) {
      const obj = c.object ? ` ${c.object}` : "";
      lines.push(`  └─ ${c.subject} ${c.predicate}${obj}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// --- Evaluation ---

export interface ReconciliationEvaluation {
  mergePrecision: number;
  mergeRecall: number;
  falseCollapseRate: number;
  distinctPrecision: number;
  roleConfusionFalseMerges: number;
  totalProposals: number;
  correctMerges: number;
  incorrectMerges: number;
  missedMerges: number;
  falseDistinct: number;
}

export function evaluateReconciliation(
  proposals: ReconciliationProposal[],
  candidates: CandidateAssertion[],
  expectedSame: string[][],
  expectedDistinct: string[][]
): ReconciliationEvaluation {
  // Build groups from same proposals
  const groups = new Map<string, Set<string>>();
  for (const p of proposals) {
    if (p.relationship !== "same") continue;
    const existingA = groups.get(p.candidateA);
    const existingB = groups.get(p.candidateB);
    if (existingA && existingB && existingA !== existingB) {
      for (const cid of existingB) existingA.add(cid);
      for (const cid of existingA) groups.set(cid, existingA);
    } else if (existingA) {
      existingA.add(p.candidateB);
      groups.set(p.candidateB, existingA);
    } else if (existingB) {
      existingB.add(p.candidateA);
      groups.set(p.candidateA, existingB);
    } else {
      const group = new Set([p.candidateA, p.candidateB]);
      groups.set(p.candidateA, group);
      groups.set(p.candidateB, group);
    }
  }

  // Group-level merge accuracy: are all expectedSame pairs in the same group?
  let correctMerges = 0;
  let missedMerges = 0;
  for (const [a, b] of expectedSame) {
    const groupA = groups.get(a);
    const groupB = groups.get(b);
    if (groupA && groupB && groupA === groupB) correctMerges++;
    else missedMerges++;
  }

  // Group-level distinct accuracy: are all expectedDistinct pairs in different groups?
  let falseDistinct = 0;
  for (const [a, b] of expectedDistinct) {
    const groupA = groups.get(a);
    const groupB = groups.get(b);
    if (groupA && groupB && groupA === groupB) falseDistinct++;
  }

  // Count incorrect merges: same proposals between candidates that should be distinct
  let incorrectMerges = 0;
  let totalSameProposals = 0;
  for (const p of proposals) {
    if (p.relationship !== "same") continue;
    totalSameProposals++;
    const shouldDistinct = expectedDistinct.some(
      ([a, b]) =>
        (p.candidateA === a && p.candidateB === b) ||
        (p.candidateA === b && p.candidateB === a)
    );
    if (shouldDistinct) incorrectMerges++;
  }

  const mergePrecision = totalSameProposals > 0 ? (totalSameProposals - incorrectMerges) / totalSameProposals : 0;
  const mergeRecall = expectedSame.length > 0 ? correctMerges / expectedSame.length : 0;
  const falseCollapseRate = totalSameProposals > 0 ? incorrectMerges / totalSameProposals : 0;
  const distinctPrecision = expectedDistinct.length > 0
    ? (expectedDistinct.length - falseDistinct) / expectedDistinct.length
    : 1;

  return {
    mergePrecision,
    mergeRecall,
    falseCollapseRate,
    distinctPrecision,
    roleConfusionFalseMerges: falseDistinct,
    totalProposals: totalSameProposals,
    correctMerges,
    incorrectMerges,
    missedMerges,
    falseDistinct,
  };
}
