import { Predicate } from "../core/assertion.ts";
import { ImplementationFact } from "./evidence.ts";

export interface EvidenceSlice {
  function: string;
  inputs: string[];
  guards: string[];
  writes: string[];
  tests: string[];
  equalityChecks: string[];
  existingCandidates: Array<{
    subject: string;
    predicate: string;
    object?: string;
  }>;
}

export interface LLMCandidate {
  subject: string;
  predicate: Predicate;
  object?: string;
  constraint?: { description: string };
  epistemicStatus: "inferred" | "hypothesized";
  confidence: "high" | "medium" | "low";
  rationale: string;
  evidenceRefs: string[];
}

export interface LLMInterpretation {
  candidates: LLMCandidate[];
  synthesizedConcepts: string[];
  notes: string;
}

export interface LLMConfig {
  endpoint: string;
  apiKey: string;
  model?: string;
}

export function buildEvidenceSlice(
  functionName: string,
  facts: ImplementationFact[]
): EvidenceSlice {
  const funcFacts = facts.filter(
    (f) => f.kind === "function_call" && f.symbols.includes(functionName)
  );
  const funcLine = funcFacts[0]?.line ?? 0;
  const funcSource = funcFacts[0]?.source ?? "";
  const laterFacts = facts.filter(
    (f) => f.source === funcSource && (f.line ?? 0) > funcLine
  );

  // Only get equality checks from the same function scope
  const nextFuncLine = facts
    .filter((f) => f.kind === "function_call" && f.source === funcSource && (f.line ?? 0) > funcLine)
    .sort((a, b) => (a.line ?? 0) - (b.line ?? 0))[0]?.line ?? Infinity;

  const functionScopeFacts = facts.filter(
    (f) =>
      f.source === funcSource &&
      (f.line ?? 0) > funcLine &&
      (f.line ?? 0) < nextFuncLine
  );

  return {
    function: functionName,
    inputs: [],
    guards: functionScopeFacts
      .filter((f) => f.kind === "guard_check")
      .map((f) => f.detail),
    writes: functionScopeFacts
      .filter((f) => f.kind === "state_write")
      .map((f) => f.detail),
    tests: facts
      .filter((f) => f.kind === "test_name")
      .map((f) => f.symbols[0]),
    equalityChecks: functionScopeFacts
      .filter((f) => f.kind === "equality_check")
      .map((f) => f.detail),
    existingCandidates: [],
  };
}

const VALID_PREDICATES: Predicate[] = [
  "causes", "requires", "forbids", "transitions_to", "reads", "writes",
  "produces", "occurs_before", "authorized_by", "must_hold",
  "observable_within", "exactly_once",
];

function buildSystemPrompt(): string {
  return `You are a semantic interpretation engine for software system assertions.

Given structured evidence extracted from source code (guards, state writes, equality checks, test names),
infer latent semantic assertions about the system's behavior.

RULES:
- Return ONLY valid JSON matching the schema below
- Use ONLY these predicates: ${VALID_PREDICATES.join(", ")}
- Each candidate must have: subject, predicate, object (optional), constraint (optional),
  epistemicStatus ("inferred"|"hypothesized"), confidence ("high"|"medium"|"low"),
  rationale (one sentence), evidenceRefs (array of strings like "guard:...", "write:...", "eq:...", "test:...")
- "inferred" = strong evidence supports this (multiple sources or clear pattern)
- "hypothesized" = plausible but weak evidence (single source or ambiguous)
- Synthesize latent concepts not named in the code (e.g., if code writes state="paid",
  infer a "PaymentAccepted" concept)
- Preserve ambiguity: if multiple interpretations are valid, return candidates for each
- Do NOT hallucinate evidence. Only reference actual items from the input.

OUTPUT SCHEMA:
{
  "candidates": [
    {
      "subject": "string",
      "predicate": "string (one of the valid predicates)",
      "object": "string (optional)",
      "constraint": { "description": "string" } (optional),
      "epistemicStatus": "inferred" | "hypothesized",
      "confidence": "high" | "medium" | "low",
      "rationale": "string",
      "evidenceRefs": ["string"]
    }
  ],
  "synthesizedConcepts": ["string"],
  "notes": "string"
}`;
}

function buildUserPrompt(slice: EvidenceSlice): string {
  const lines: string[] = [];
  lines.push(`Interpret the following evidence for function "${slice.function}":\n`);

  if (slice.guards.length > 0) {
    lines.push("GUARDS (conditions checked before execution):");
    for (const g of slice.guards) lines.push(`  - ${g}`);
    lines.push("");
  }

  if (slice.writes.length > 0) {
    lines.push("STATE WRITES (mutations performed):");
    for (const w of slice.writes) lines.push(`  - ${w}`);
    lines.push("");
  }

  if (slice.equalityChecks.length > 0) {
    lines.push("EQUALITY CHECKS (comparisons made):");
    for (const e of slice.equalityChecks) lines.push(`  - ${e}`);
    lines.push("");
  }

  if (slice.tests.length > 0) {
    lines.push("RELATED TESTS:");
    for (const t of slice.tests) lines.push(`  - ${t}`);
    lines.push("");
  }

  if (slice.existingCandidates.length > 0) {
    lines.push("EXISTING CANDIDATES (from deterministic extraction):");
    for (const c of slice.existingCandidates) {
      lines.push(`  - ${c.subject} ${c.predicate} ${c.object ?? ""}`);
    }
    lines.push("");
  }

  lines.push("Respond with JSON only. No markdown, no explanation outside the JSON.");
  return lines.join("\n");
}

function parseLLMResponse(raw: string): LLMInterpretation {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(cleaned);

  const validPredicates = new Set<string>(VALID_PREDICATES);

  const candidates: LLMCandidate[] = (parsed.candidates ?? []).map((c: Record<string, unknown>) => ({
    subject: String(c.subject ?? ""),
    predicate: validPredicates.has(String(c.predicate))
      ? (c.predicate as Predicate)
      : ("causes" as Predicate),
    object: c.object != null ? String(c.object) : undefined,
    constraint: c.constraint != null ? { description: String((c.constraint as Record<string, unknown>).description ?? "") } : undefined,
    epistemicStatus: (c.epistemicStatus === "hypothesized" ? "hypothesized" : "inferred") as "inferred" | "hypothesized",
    confidence: (["high", "medium", "low"].includes(String(c.confidence)) ? c.confidence : "medium") as "high" | "medium" | "low",
    rationale: String(c.rationale ?? ""),
    evidenceRefs: Array.isArray(c.evidenceRefs) ? c.evidenceRefs.map(String) : [],
  }));

  return {
    candidates,
    synthesizedConcepts: Array.isArray(parsed.synthesizedConcepts)
      ? parsed.synthesizedConcepts.map(String)
      : [],
    notes: String(parsed.notes ?? ""),
  };
}

export async function llmInterpretation(
  slice: EvidenceSlice,
  config: LLMConfig
): Promise<LLMInterpretation> {
  const model = config.model ?? "gpt-4o";
  const sessionId = crypto.randomUUID();

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
      "x-opencode-session": sessionId,
      "User-Agent": "semir-extraction/0.1",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(slice) },
      ],
      temperature: 0.2,
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

  return parseLLMResponse(content);
}

// Mock LLM interpretation — simulates what an LLM would produce via regex patterns
// Kept for offline testing and A/B comparison
export function mockLLMInterpretation(slice: EvidenceSlice): LLMInterpretation {
  const candidates: LLMCandidate[] = [];
  const synthesizedConcepts: string[] = [];

  // Pattern: state write → infer event concept (only for functions with writes)
  if (slice.writes.length > 0) {
    for (const write of slice.writes) {
      const match = write.match(/(\w+)\s*=\s*["'](\w+)["']/);
      if (match) {
        const [, field, value] = match;
        const conceptName = `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
        synthesizedConcepts.push(conceptName);

        candidates.push({
          subject: slice.function,
          predicate: "causes",
          object: conceptName,
          epistemicStatus: "inferred",
          confidence: "medium",
          rationale: `Function ${slice.function} writes ${field} = "${value}", implying ${conceptName} event`,
          evidenceRefs: [`write:${write}`],
        });

        candidates.push({
          subject: conceptName,
          predicate: "transitions_to",
          object: value,
          epistemicStatus: "inferred",
          confidence: "medium",
          rationale: `${conceptName} transitions to ${value} state`,
          evidenceRefs: [`write:${write}`],
        });
      }
    }
  }

  // Pattern: guard check → infer precondition
  for (const guard of slice.guards) {
    const match = guard.match(/(\w+)\s*(!==?|===?)\s*["'](\w+)["']/);
    if (match) {
      const [, field, op, value] = match;
      if (op.includes("!")) {
        // Negative guard → forbids or requires
        candidates.push({
          subject: slice.function,
          predicate: "requires",
          object: value,
          epistemicStatus: "inferred",
          confidence: "high",
          rationale: `Guard ${guard} requires ${value} state before proceeding`,
          evidenceRefs: [`guard:${guard}`],
        });
      }
    }
  }

  // Pattern: equality check → infer authorization (only for ownership-like patterns)
  for (const eq of slice.equalityChecks) {
    const match = eq.match(/(\w+(?:\.\w+)?)\s*(===?|!==?)\s*(\w+(?:\.\w+)?)/);
    if (match) {
      const [, left, op, right] = match;
      const leftParts = left.split(".");
      const rightParts = right.split(".");

      // Only infer authorization if one side looks like an actor and one like an entity property
      const isOwnershipPattern =
        (leftParts[0] === "reservation" && rightParts[0] === "user") ||
        (leftParts[0] === "user" && rightParts[0] === "reservation") ||
        (left.includes("owner") || right.includes("owner"));

      if (isOwnershipPattern && leftParts.length > 1 && rightParts.length > 1) {
        const conceptName = leftParts[0] === "user" ? "Actor" : leftParts[0];

        candidates.push({
          subject: slice.function,
          predicate: "authorized_by",
          object: conceptName,
          constraint: {
            description: `${left} ${op} ${right}`,
          },
          epistemicStatus: "hypothesized",
          confidence: "low",
          rationale: `Equality check ${eq} suggests ownership-based authorization`,
          evidenceRefs: [`eq:${eq}`],
        });
      }
    }
  }

  // Check existing candidates for test confirmation
  for (const existing of slice.existingCandidates) {
    const hasTestConfirmation = slice.tests.some((t) => {
      const lower = t.toLowerCase();
      return (
        lower.includes("never") ||
        lower.includes("not") ||
        lower.includes("cannot") ||
        lower.includes("forbid")
      );
    });

    if (hasTestConfirmation && existing.predicate === "forbids") {
      candidates.push({
        subject: existing.subject,
        predicate: "forbids",
        object: existing.object,
        epistemicStatus: "inferred",
        confidence: "high",
        rationale: `Guard + test confirmation: ${slice.tests[0]}`,
        evidenceRefs: [...slice.guards.map((g) => `guard:${g}`), ...slice.tests.map((t) => `test:${t}`)],
      });
    }
  }

  return {
    candidates,
    synthesizedConcepts,
    notes: `Interpreted ${slice.function}: ${candidates.length} candidates, ${synthesizedConcepts.length} synthesized concepts`,
  };
}
