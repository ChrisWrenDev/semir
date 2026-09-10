import { join } from "path";
import { extractEvidence } from "../../src/extract/extract-evidence.ts";
import { interpretCandidates, CandidateAssertion } from "../../src/extract/interpret-candidates.ts";
import { readFileSync } from "fs";

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
  candidates: CandidateAssertion[],
  referenceIds: string[]
): { observable: number; recovered: number; missed: string[] } {
  let recovered = 0;
  const missed: string[] = [];

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

  for (const refId of referenceIds) {
    const assertionName = refId.split("/").pop() ?? "";
    const expectedPredicate = predicateMap[assertionName];

    if (!expectedPredicate) {
      missed.push(refId);
      continue;
    }

    const found = candidates.some(
      (c) => c.predicate === expectedPredicate
    );

    if (found) {
      recovered++;
    } else {
      missed.push(refId);
    }
  }

  return { observable: referenceIds.length, recovered, missed };
}

function evaluatePrecision(candidates: CandidateAssertion[]): {
  total: number;
  defensible: number;
  questionable: number;
} {
  let defensible = 0;
  let questionable = 0;

  for (const c of candidates) {
    if (c.confidence >= 0.6 && c.evidence.length >= 1) {
      defensible++;
    } else {
      questionable++;
    }
  }

  return { total: candidates.length, defensible, questionable };
}

// Main
const extractionDir = process.argv[2] || join(process.cwd(), "examples", "extraction");
const refPath = process.argv[3] || join(extractionDir, "reference.semir");

console.log("Evidence Extraction");
console.log("===================\n");

const evidence = extractEvidence(join(extractionDir, "src"));
const testEvidence = extractEvidence(join(extractionDir, "test"));
const allEvidence = [...evidence, ...testEvidence];

console.log(`Source files scanned: ${allEvidence.length}`);
console.log(`Total facts extracted: ${allEvidence.reduce((sum, e) => sum + e.facts.length, 0)}`);

console.log("\nCandidate Interpretation");
console.log("========================\n");

const candidates = interpretCandidates(allEvidence);

for (const c of candidates) {
  console.log(`  ${c.epistemicStatus.toUpperCase()}: ${c.subject} ${c.predicate} ${c.object ?? ""}`);
  console.log(`    confidence: ${c.confidence}`);
  console.log(`    reasoning: ${c.reasoning}`);
  console.log(`    evidence:`);
  for (const e of c.evidence) {
    console.log(`      ${e.source}:${e.line ?? "?"} — ${e.detail}`);
  }
  console.log();
}

console.log("Evaluation Against Reference");
console.log("============================\n");

const referenceIds = loadReference(refPath);
const recall = evaluateRecall(candidates, referenceIds);
const precision = evaluatePrecision(candidates);

console.log(`Reference assertions: ${recall.observable}`);
console.log(`Correctly recovered:  ${recall.recovered}`);
console.log(`Recall:               ${(recall.recovered / recall.observable * 100).toFixed(0)}%`);
if (recall.missed.length > 0) {
  console.log(`\nMissed:`);
  for (const m of recall.missed) {
    console.log(`  - ${m}`);
  }
}

console.log(`\nExtracted candidates: ${precision.total}`);
console.log(`Defensible:           ${precision.defensible}`);
console.log(`Questionable:         ${precision.questionable}`);
console.log(`Precision:            ${(precision.defensible / precision.total * 100).toFixed(0)}%`);
