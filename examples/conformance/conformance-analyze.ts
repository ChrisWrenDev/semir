import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import {
  ConformanceEvidence,
  ConformanceResult,
  evaluateConformance,
  buildReport,
  renderConformanceReport,
} from "../../src/core/conformance.js";

interface MappingEntry {
  assertionId: string;
  symbols: string[];
  tests: string[];
}

function loadMappings(mapPath: string): MappingEntry[] {
  const content = readFileSync(mapPath, "utf8");
  const entries: MappingEntry[] = [];
  let current: MappingEntry | null = null;
  let section: "symbols" | "tests" | null = null;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || trimmed === "") continue;

    if (trimmed.startsWith("- assertionId:")) {
      if (current) entries.push(current);
      current = { assertionId: trimmed.split(": ")[1], symbols: [], tests: [] };
      section = null;
    } else if (trimmed === "symbols:") {
      section = "symbols";
    } else if (trimmed === "tests:") {
      section = "tests";
    } else if (trimmed.startsWith("- ") && current && section) {
      current[section].push(trimmed.slice(2));
    }
  }
  if (current) entries.push(current);
  return entries;
}

function scanSource(dir: string): string {
  let content = "";
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        content += scanSource(fullPath);
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".js")) {
        content += readFileSync(fullPath, "utf8") + "\n";
      }
    }
  } catch {}
  return content;
}

function findEvidence(
  mapping: MappingEntry,
  sourceCode: string,
  testCode: string
): ConformanceEvidence[] {
  const evidence: ConformanceEvidence[] = [];

  for (const symbol of mapping.symbols) {
    if (sourceCode.includes(symbol)) {
      evidence.push({
        type: "static",
        source: symbol,
        stance: "supports",
        detail: "found in implementation",
      });
    } else {
      evidence.push({
        type: "static",
        source: symbol,
        stance: "contradicts",
        detail: "symbol not found in implementation",
      });
    }
  }

  for (const test of mapping.tests) {
    if (testCode.includes(test)) {
      evidence.push({
        type: "test",
        source: test,
        stance: "supports",
        detail: "test found",
      });
    } else {
      evidence.push({
        type: "test",
        source: test,
        stance: "neutral",
        detail: "test not found (absence of evidence)",
      });
    }
  }

  return evidence;
}

export function analyzeConformance(
  implDir: string,
  mapPath: string
): string {
  const mappings = loadMappings(mapPath);
  const sourceCode = scanSource(join(implDir, "src"));
  const testCode = scanSource(join(implDir, "test"));

  const results: ConformanceResult[] = [];

  for (const mapping of mappings) {
    const evidence = findEvidence(mapping, sourceCode, testCode);
    const result = evaluateConformance(mapping.assertionId, evidence);
    results.push(result);
  }

  const report = buildReport(results);
  return renderConformanceReport(report);
}

if (process.argv[1] && process.argv[1].endsWith("conformance-analyze.ts")) {
  const implDir = process.argv[2] || join(process.cwd(), "examples", "conformance");
  const mapPath = process.argv[3] || join(implDir, "conformance-map.yaml");
  console.log(analyzeConformance(implDir, mapPath));
}
