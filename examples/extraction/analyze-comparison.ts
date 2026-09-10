import { join } from "path";
import { readFileSync, existsSync } from "fs";
import { extractEvidence } from "../../src/extract/extract-evidence.ts";
import { interpretCandidates, CandidateAssertion } from "../../src/extract/interpret-candidates.ts";
import { buildEvidenceSlice, llmInterpretation, mockLLMInterpretation, LLMCandidate, LLMConfig } from "../../src/extract/llm-interpret.ts";
import { reconcileAll, applyReconciliations } from "../../src/extract/reconcile.ts";
import {
  compareAll,
  renderComparison,
  evaluateComparison,
  ComparisonEvaluation,
  IntendedAssertion,
} from "../../src/extract/compare.ts";
import { TEST_VARIANTS, TestCase } from "./compare-test-cases/variants.ts";

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

function loadIntended(path: string): IntendedAssertion[] {
  const content = readFileSync(path, "utf8");
  const intended: IntendedAssertion[] = [];
  const lines = content.split("\n");
  let current: Partial<IntendedAssertion> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- id:")) {
      if (current.id) intended.push(current as IntendedAssertion);
      current = { id: trimmed.replace("- id:", "").trim() };
    } else if (trimmed.startsWith("subject:") && current.id) {
      const ref = trimmed.replace("subject:", "").trim();
      current.subject = ref.split("/").pop() ?? ref;
    } else if (trimmed.startsWith("predicate:") && current.id) {
      current.predicate = trimmed.replace("predicate:", "").trim();
    } else if (trimmed.startsWith("object:") && current.id) {
      const ref = trimmed.replace("object:", "").trim();
      current.object = ref.split("/").pop() ?? ref;
    }
  }
  if (current.id) intended.push(current as IntendedAssertion);
  return intended;
}

function renderEvaluation(eval_: ComparisonEvaluation, label: string): string {
  const lines: string[] = [];
  lines.push(`\n--- ${label} ---\n`);
  lines.push(`Match precision:       ${(eval_.matchPrecision * 100).toFixed(0)}%`);
  lines.push(`Drift precision:       ${(eval_.driftPrecision * 100).toFixed(0)}%`);
  lines.push(`False violation rate:  ${(eval_.falseViolationRate * 100).toFixed(0)}%`);
  lines.push(`Undocumented precision: ${(eval_.undocumentedPrecision * 100).toFixed(0)}%`);
  return lines.join("\n");
}

async function runExtractionPipeline(
  extractionDir: string,
  llmConfig: LLMConfig | undefined
): Promise<CandidateAssertion[]> {
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
    console.log(`  ${func}: ${interpretation.candidates.length} candidates`);
  }

  console.log(`\nLLM candidates: ${llmCandidates.length}`);

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

  return allCandidates;
}

async function runTestCase(
  tc: TestCase,
  llmConfig: LLMConfig
) {
  console.log(`\n=== TEST: ${tc.name} ===`);
  console.log(`${tc.description}\n`);
  console.log(`Intended: ${tc.intended.length} assertions`);
  console.log(`Extracted: ${tc.extracted.length} candidates`);
  console.log(`Expected classifications: ${tc.expected.length}\n`);

  const result = await compareAll(tc.intended, tc.extracted, llmConfig);
  console.log(renderComparison(result));

  if (tc.expected.length > 0) {
    const evaluation = evaluateComparison(result.correspondences, tc.expected);
    console.log(renderEvaluation(evaluation, tc.name));
  }
}

// Main
async function main() {
  const extractionDir = process.argv[2] || join(process.cwd(), "examples", "extraction");
  const mode = process.argv[3] || "all";

  const llmEndpoint = process.env.LLM_ENDPOINT;
  const llmApiKey = process.env.LLM_API_KEY;
  const llmModel = process.env.LLM_MODEL;
  const useMock = !llmEndpoint || !llmApiKey;

  if (useMock) {
    console.log("WARNING: LLM_ENDPOINT and LLM_API_KEY not set. Using mock LLM.\n");
    console.log("  Set LLM_ENDPOINT and LLM_API_KEY in .env\n");
  } else {
    console.log(`LLM endpoint: ${llmEndpoint}`);
    console.log(`LLM model:    ${llmModel ?? "gpt-4o"}\n`);
  }

  const llmConfig: LLMConfig | undefined = useMock
    ? undefined
    : { endpoint: llmEndpoint!, apiKey: llmApiKey!, model: llmModel };

  // --- Full pipeline + comparison ---
  if (mode === "full" || mode === "all") {
    const candidates = await runExtractionPipeline(extractionDir, llmConfig);

    // Reconcile
    console.log("\n=== PASS 5: Reconciliation ===\n");
    const reconciliation = await reconcileAll(candidates, llmConfig);
    const assertions = applyReconciliations(candidates, reconciliation.allProposals);
    console.log(`Reconciled: ${assertions.length} assertions\n`);

    // Load intended model
    const intendedPath = join(extractionDir, "reference.semir");
    if (existsSync(intendedPath)) {
      console.log("=== PASS 6: Comparison ===\n");
      const intended = loadIntended(intendedPath);
      console.log(`Intended assertions: ${intended.length}`);

      const extractedCandidates = assertions.flatMap((a) => a.candidates);
      const result = await compareAll(intended, extractedCandidates, llmConfig);
      console.log(renderComparison(result));
    }
  }

  // --- Variant test cases ---
  if (mode === "variants" || mode === "all") {
    if (!llmConfig) {
      console.log("\n=== Variant tests require LLM — skipping ===\n");
      return;
    }

    console.log("\n========================================");
    console.log("  VARIANT COMPARISON TESTS");
    console.log("========================================\n");

    for (const tc of TEST_VARIANTS) {
      await runTestCase(tc, llmConfig);
    }
  }
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
