import { join } from "path";
import { readFileSync, existsSync } from "fs";
import { extractEvidence } from "../../src/extract/extract-evidence.ts";
import { interpretCandidates, CandidateAssertion } from "../../src/extract/interpret-candidates.ts";
import { buildEvidenceSlice, llmInterpretation, mockLLMInterpretation, LLMCandidate, LLMConfig } from "../../src/extract/llm-interpret.ts";
import { consolidate } from "../../src/extract/consolidate.ts";
import {
  reconcileAll,
  applyReconciliations,
  renderReconciled,
  evaluateReconciliation,
  ReconciliationEvaluation,
} from "../../src/extract/reconcile.ts";
import { TEST_CATEGORIES, TestCase } from "./reconcile-test-cases/adversarial-candidates.ts";

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

function renderEvaluation(eval_: ReconciliationEvaluation, label: string): string {
  const lines: string[] = [];
  lines.push(`\n--- ${label} ---\n`);
  lines.push(`Merge precision:       ${(eval_.mergePrecision * 100).toFixed(0)}%  (${eval_.correctMerges}/${eval_.totalProposals} proposals correct)`);
  lines.push(`Merge recall:          ${(eval_.mergeRecall * 100).toFixed(0)}%  (${eval_.correctMerges}/${eval_.correctMerges + eval_.missedMerges} expected merges recovered)`);
  lines.push(`False-collapse rate:   ${(eval_.falseCollapseRate * 100).toFixed(0)}%  (${eval_.incorrectMerges} incorrect merges)`);
  lines.push(`Distinct precision:    ${(eval_.distinctPrecision * 100).toFixed(0)}%`);
  lines.push(`Role-confusion merges: ${eval_.roleConfusionFalseMerges}`);
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

  console.log(`\n=== PASS 4: Consolidation ===\n`);
  const consolidated = consolidate(allCandidates);
  console.log(`Consolidated: ${consolidated.length} assertions\n`);

  return allCandidates;
}

async function runTestCase(
  tc: TestCase,
  llmConfig: LLMConfig
): Promise<ReconciliationEvaluation> {
  console.log(`\n=== TEST: ${tc.name} ===`);
  console.log(`${tc.description}\n`);
  console.log(`Candidates: ${tc.candidates.length}`);
  console.log(`Expected same: ${tc.expectedSame.length} pairs`);
  console.log(`Expected distinct: ${tc.expectedDistinct.length} pairs\n`);

  const result = await reconcileAll(tc.candidates, llmConfig);

  console.log(`Deterministic matches: ${result.matchResult.exactMatches.length} exact, ${result.matchResult.obviousDistinct.length} distinct, ${result.matchResult.ambiguous.length} ambiguous`);
  console.log(`LLM proposals: ${result.llmProposals.length}`);
  console.log(`Total proposals: ${result.allProposals.length}`);

  for (const p of result.allProposals) {
    const src = p.evidence[0]?.startsWith("deterministic") ? "det" : "llm";
    console.log(`  [${p.relationship}] ${p.candidateA} ↔ ${p.candidateB} (${p.confidence}) [${src}]`);
  }

  const assertions = applyReconciliations(tc.candidates, result.allProposals);
  console.log(`\nReconciled assertions: ${assertions.length}`);
  console.log(renderReconciled(assertions));

  const evaluation = evaluateReconciliation(result.allProposals, tc.candidates, tc.expectedSame, tc.expectedDistinct);
  console.log(renderEvaluation(evaluation, tc.name));

  return evaluation;
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

  // --- Full pipeline + reconciliation ---
  if (mode === "full" || mode === "all") {
    const candidates = await runExtractionPipeline(extractionDir, llmConfig);

    if (llmConfig) {
      console.log("=== PASS 5: Role-Aware Identity Reconciliation ===\n");

      const result = await reconcileAll(candidates, llmConfig);

      console.log(`Deterministic: ${result.deterministicProposals.length} proposals`);
      console.log(`  exact matches: ${result.matchResult.exactMatches.length}`);
      console.log(`  obvious distinct: ${result.matchResult.obviousDistinct.length}`);
      console.log(`  ambiguous (sent to LLM): ${result.matchResult.ambiguous.length}`);
      console.log(`LLM: ${result.llmProposals.length} proposals`);
      console.log(`Total: ${result.allProposals.length} proposals\n`);

      for (const p of result.allProposals) {
        const src = p.evidence[0]?.startsWith("deterministic") ? "det" : "llm";
        console.log(`  [${p.relationship}] ${p.candidateA} ↔ ${p.candidateB} (${p.confidence}) [${src}]`);
      }

      const assertions = applyReconciliations(candidates, result.allProposals);
      console.log(renderReconciled(assertions));
    }
  }

  // --- Adversarial test cases ---
  if (mode === "adversarial" || mode === "all") {
    if (!llmConfig) {
      console.log("\n=== Adversarial tests require LLM — skipping ===\n");
      return;
    }

    console.log("\n========================================");
    console.log("  ADVERSARIAL RECONCILIATION TESTS");
    console.log("========================================\n");

    const evaluations: ReconciliationEvaluation[] = [];

    for (const tc of TEST_CATEGORIES) {
      const eval_ = await runTestCase(tc, llmConfig);
      evaluations.push(eval_);
    }

    // Summary
    console.log("\n========================================");
    console.log("  SUMMARY");
    console.log("========================================\n");

    const avgMergePrecision = evaluations.reduce((s, e) => s + e.mergePrecision, 0) / evaluations.length;
    const avgMergeRecall = evaluations.reduce((s, e) => s + e.mergeRecall, 0) / evaluations.length;
    const avgFalseCollapse = evaluations.reduce((s, e) => s + e.falseCollapseRate, 0) / evaluations.length;
    const avgDistinctPrecision = evaluations.reduce((s, e) => s + e.distinctPrecision, 0) / evaluations.length;
    const totalRoleConfusion = evaluations.reduce((s, e) => s + e.roleConfusionFalseMerges, 0);

    console.log(`Categories tested:       ${evaluations.length}`);
    console.log(`Avg merge precision:     ${(avgMergePrecision * 100).toFixed(0)}%`);
    console.log(`Avg merge recall:        ${(avgMergeRecall * 100).toFixed(0)}%`);
    console.log(`Avg false-collapse:      ${(avgFalseCollapse * 100).toFixed(0)}%`);
    console.log(`Avg distinct precision:  ${(avgDistinctPrecision * 100).toFixed(0)}%`);
    console.log(`Role-confusion merges:   ${totalRoleConfusion}`);
  }
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
