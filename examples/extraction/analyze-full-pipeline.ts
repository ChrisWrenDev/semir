import { join } from "path";
import { readFileSync, existsSync } from "fs";
import { extractEvidence } from "../../src/extract/extract-evidence.ts";
import { interpretCandidates, CandidateAssertion } from "../../src/extract/interpret-candidates.ts";
import { buildEvidenceSlice, llmInterpretation, mockLLMInterpretation, LLMCandidate, LLMConfig } from "../../src/extract/llm-interpret.ts";
import { consolidate, renderConsolidated, ConsolidatedAssertion } from "../../src/extract/consolidate.ts";
import { Predicate } from "../../src/core/assertion.ts";

function loadEnv(envPath: string): void {
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(join(process.cwd(), ".env"));

function loadReference(refPath: string): string[] {
  const content = readFileSync(refPath, "utf8");
  const ids: string[] = [];
  for (const line of content.split("\n")) {
    const match = line.match(/- id: (.+)/);
    if (match) {
      const id = match[1].trim();
      if (id.includes("/assertion/")) ids.push(id);
    }
  }
  return ids;
}

function evaluateRecall(
  consolidated: ConsolidatedAssertion[],
  referenceIds: string[]
): { observable: number; recovered: number; missed: string[] } {
  const predicateMap: Record<string, string> = {
    "pay-causes-payment-accepted": "causes",
    "payment-accepted-transitions-to-paid": "transitions_to",
    "pay-requires-active": "requires",
    "pay-authorized-by-owner": "authorized_by",
    "paid-reservations-do-not-expire": "forbids",
    "expire-causes-reservation-expired": "causes",
    "reservation-expired-transitions-to-expired": "transitions_to",
    "expire-requires-active": "requires",
  };

  let recovered = 0;
  const missed: string[] = [];

  for (const refId of referenceIds) {
    const assertionName = refId.split("/").pop() ?? "";
    const expectedPredicate = predicateMap[assertionName];
    if (!expectedPredicate) { missed.push(refId); continue; }

    const found = consolidated.some((c) => c.predicate === expectedPredicate);
    if (found) recovered++;
    else missed.push(refId);
  }

  return { observable: referenceIds.length, recovered, missed };
}

function evaluatePrecision(consolidated: ConsolidatedAssertion[]): {
  total: number;
  defensible: number;
  questionable: number;
} {
  let defensible = 0;
  let questionable = 0;
  for (const c of consolidated) {
    if (c.confidence >= 0.5 && c.evidenceCount >= 1) defensible++;
    else questionable++;
  }
  return { total: consolidated.length, defensible, questionable };
}

function evaluateCalibration(consolidated: ConsolidatedAssertion[]): void {
  const high = consolidated.filter((c) => c.confidence >= 0.7);
  const medium = consolidated.filter((c) => c.confidence >= 0.4 && c.confidence < 0.7);
  const low = consolidated.filter((c) => c.confidence < 0.4);

  console.log("Calibration:");
  console.log(`  high confidence (${high.length}):   ${high.map((c) => c.confidence.toFixed(2)).join(", ") || "none"}`);
  console.log(`  medium (${medium.length}):    ${medium.map((c) => c.confidence.toFixed(2)).join(", ") || "none"}`);
  console.log(`  low confidence (${low.length}):    ${low.map((c) => c.confidence.toFixed(2)).join(", ") || "none"}`);
}

// Main
async function main() {
const extractionDir = process.argv[2] || join(process.cwd(), "examples", "extraction");
const refPath = process.argv[3] || join(extractionDir, "reference.semir");

const llmEndpoint = process.env.LLM_ENDPOINT;
const llmApiKey = process.env.LLM_API_KEY;
const llmModel = process.env.LLM_MODEL;
const useMock = !llmEndpoint || !llmApiKey;

if (useMock) {
  console.log("WARNING: LLM_ENDPOINT and LLM_API_KEY not set. Using mock LLM.\n");
  console.log("  Set LLM_ENDPOINT (e.g. https://api.openai.com/v1/chat/completions)");
  console.log("  Set LLM_API_KEY (your API key)");
  console.log("  Optional: LLM_MODEL (default: gpt-4o)\n");
} else {
  console.log(`LLM endpoint: ${llmEndpoint}`);
  console.log(`LLM model:    ${llmModel ?? "gpt-4o"}\n`);
}

const llmConfig: LLMConfig | undefined = useMock
  ? undefined
  : { endpoint: llmEndpoint!, apiKey: llmApiKey!, model: llmModel };

console.log("=== PASS 1-2: Deterministic Extraction ===\n");

const evidence = extractEvidence(join(extractionDir, "src"));
const testEvidence = extractEvidence(join(extractionDir, "test"));
const allEvidence = [...evidence, ...testEvidence];
const allFacts = allEvidence.flatMap((e) => e.facts);

console.log(`Facts extracted: ${allFacts.length}`);
const detCandidates = interpretCandidates(allEvidence);
console.log(`Deterministic candidates: ${detCandidates.length}`);

console.log("\n=== PASS 3: LLM Semantic Interpretation ===\n");

const functions = [...new Set(allFacts.filter((f) => f.kind === "function_call").map((f) => f.symbols[0]))];
const llmCandidates: LLMCandidate[] = [];

for (const func of functions) {
  const slice = buildEvidenceSlice(func, allFacts);
  slice.existingCandidates = detCandidates.map((c) => ({
    subject: c.subject,
    predicate: c.predicate,
    object: c.object,
  }));

  let interpretation;
  if (llmConfig) {
    interpretation = await llmInterpretation(slice, llmConfig);
  } else {
    interpretation = mockLLMInterpretation(slice);
  }
  llmCandidates.push(...interpretation.candidates);
  console.log(`  ${func}: ${interpretation.candidates.length} candidates, ${interpretation.synthesizedConcepts.length} synthesized`);
}

console.log(`\nLLM candidates: ${llmCandidates.length}`);

// Merge deterministic + LLM candidates
const allCandidates: CandidateAssertion[] = [
  ...detCandidates,
  ...llmCandidates.map((lc) => ({
    id: `llm://${lc.subject}-${lc.predicate}-${lc.object ?? ""}`,
    subject: lc.subject,
    predicate: lc.predicate,
    object: lc.object,
    kind: "inferred",
    epistemicStatus: lc.epistemicStatus,
    confidence: lc.confidence === "high" ? 0.9 : lc.confidence === "medium" ? 0.65 : 0.4,
    evidence: lc.evidenceRefs.map((ref) => ({
      source: ref.split(":")[0],
      detail: ref,
    })),
    reasoning: lc.rationale,
  })),
];

console.log(`\n=== PASS 4: Consolidation ===\n`);

const consolidated = consolidate(allCandidates);
console.log(renderConsolidated(consolidated));

console.log("=== Evaluation ===\n");

const referenceIds = loadReference(refPath);
const recall = evaluateRecall(consolidated, referenceIds);
const precision = evaluatePrecision(consolidated);

console.log(`Reference assertions: ${recall.observable}`);
console.log(`Correctly recovered:  ${recall.recovered}`);
console.log(`Recall:               ${(recall.recovered / recall.observable * 100).toFixed(0)}%`);
if (recall.missed.length > 0) {
  console.log(`\nMissed:`);
  for (const m of recall.missed) console.log(`  - ${m}`);
}

console.log(`\nConsolidated candidates: ${precision.total}`);
console.log(`Defensible:              ${precision.defensible}`);
console.log(`Questionable:            ${precision.questionable}`);
console.log(`Precision:               ${(precision.defensible / precision.total * 100).toFixed(0)}%`);

console.log();
evaluateCalibration(consolidated);
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
