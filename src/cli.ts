#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname, basename } from "path";
import { fromSemirYaml } from "./core/semir-format.ts";
import { validateModel } from "./core/validation.ts";
import { slice } from "./core/slice.ts";
import { unionRelationships } from "./core/predicates.ts";
import { projectEventModel, EVENT_MODEL_CAPABILITIES } from "./projections/event-model/index.ts";
import { projectScenarios, SCENARIO_CAPABILITIES } from "./projections/scenarios/index.ts";
import { projectFormal, FORMAL_CAPABILITIES } from "./projections/formal/index.ts";
import { assertionsAbout } from "./core/query.ts";
import { isRef, targetId, targetDisplay } from "./core/assertion.ts";

const args = process.argv.slice(2);
const command = args[0];
const filePath = args[1];

function printError(msg: string): never {
  console.error(`\x1b[31merror\x1b[0m: ${msg}`);
  process.exit(1);
}

function printSuccess(msg: string): void {
  console.log(`\x1b[32m✓\x1b[0m ${msg}`);
}

function printInfo(msg: string): void {
  console.log(`  ${msg}`);
}

function loadModel(path: string) {
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    printError(`cannot read file: ${path}`);
  }

  let model;
  try {
    model = fromSemirYaml(content!);
  } catch (e) {
    printError(`failed to parse .semir file: ${e}`);
  }
  return model!;
}

function cmdValidate() {
  if (!filePath) printError("usage: semir validate <file.semir>");

  const model = loadModel(filePath);
  const result = validateModel(model);

  if (result.valid) {
    printSuccess("model valid");
    printInfo(`${model.objects.size} objects, ${model.assertions.length} assertions`);
  } else {
    printError(`model has ${result.errors.length} error(s):\n${result.errors.map((e) => `  - ${e.message}`).join("\n")}`);
  }
}

function cmdBuild() {
  if (!filePath) printError("usage: semir build <file.semir>");

  const model = loadModel(filePath);
  const result = validateModel(model);
  if (!result.valid) {
    printError(`model has ${result.errors.length} error(s). run 'semir validate' for details.`);
  }

  const outDir = join(dirname(filePath), "build");
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const modelName = model.name ?? basename(filePath, ".semir");

  console.log("\nBuilding projections...\n");

  const relationships = unionRelationships(
    EVENT_MODEL_CAPABILITIES,
    SCENARIO_CAPABILITIES,
    FORMAL_CAPABILITIES,
  );
  const modelSlice = slice(model, {
    roots: [...model.objects.keys()],
    relationships,
  });

  const emResult = projectEventModel(modelSlice, modelName);
  const emPath = join(outDir, "event-model.md");
  writeFileSync(emPath, "```mermaid\n" + emResult.mermaid + "\n```\n");
  printSuccess("Event Model");
  printInfo(emPath);

  const scResult = projectScenarios(modelSlice, modelName);
  const scPath = join(outDir, "scenarios.feature");
  writeFileSync(scPath, scResult.gherkin);
  printSuccess("Scenarios");
  printInfo(scPath);

  const fmResult = projectFormal(modelSlice, modelName);
  const fmPath = join(outDir, "formal.tla");
  writeFileSync(fmPath, fmResult.tla);
  printSuccess("Formal model");
  printInfo(fmPath);

  const unsupported = [
    ...emResult.diagnostics.unsupported,
    ...scResult.diagnostics.unsupported,
    ...fmResult.diagnostics.unsupported,
  ];
  if (unsupported.length > 0) {
    console.log(`\n\x1b[33mwarning:\x1b[0m ${unsupported.length} unsupported assertion(s) across projections`);
  }

  console.log("");
}

function cmdExplain() {
  if (!filePath) printError("usage: semir explain <assertion-id> [--file <file.semir>]");
  const assertionId = filePath;

  let semirFile: string | undefined;
  const fileIdx = args.indexOf("--file");
  if (fileIdx !== -1 && args[fileIdx + 1]) {
    semirFile = args[fileIdx + 1];
  } else {
    const candidate = args.find((a) => a.endsWith(".semir"));
    if (candidate) semirFile = candidate;
  }

  if (!semirFile) printError("usage: semir explain <assertion-id> --file <file.semir>");

  const model = loadModel(semirFile!);
  const assertion = model.assertions.find((a) => a.id === assertionId);
  if (!assertion) printError(`assertion not found: ${assertionId}`);

  const subjectObj = model.objects.get(assertion!.subject);
  const objectDisplay = assertion!.object
    ? (isRef(assertion!.object) ? (model.objects.get(assertion!.object)?.name ?? assertion!.object) : targetDisplay(assertion!.object))
    : "";

  console.log(`\n\x1b[1m${assertionId}\x1b[0m\n`);
  console.log(`  ${subjectObj?.name ?? assertion!.subject} ${assertion!.predicate} ${objectDisplay}\n`);

  const relationships = unionRelationships(
    EVENT_MODEL_CAPABILITIES,
    SCENARIO_CAPABILITIES,
    FORMAL_CAPABILITIES,
  );
  const modelSlice = slice(model, {
    roots: [...model.objects.keys()],
    relationships,
  });

  console.log("  Used by:\n");

  const emResult = projectEventModel(modelSlice);
  const emEdges = emResult.ir.edges.filter((e) => e.assertionId === assertionId);
  if (emEdges.length > 0) {
    console.log("    Event Model");
    for (const e of emEdges) {
      const from = model.objects.get(e.from)?.name ?? e.from;
      const to = model.objects.get(e.to)?.name ?? e.to;
      printInfo(`${from} --${e.kind}--> ${to}`);
    }
  }

  const scResult = projectScenarios(modelSlice);
  const scScenarios = scResult.ir.scenarios.filter((s) => s.semanticIds.includes(assertionId));
  if (scScenarios.length > 0) {
    console.log("    Scenarios");
    for (const s of scScenarios) {
      printInfo(s.name);
    }
  }

  const fmResult = projectFormal(modelSlice);
  const fmProps = fmResult.ir.properties.filter((p) => p.semanticId === assertionId);
  if (fmProps.length > 0) {
    console.log("    Formal model");
    for (const p of fmProps) {
      printInfo(`${p.name}: ${p.formula}`);
    }
  }

  console.log("");
}

switch (command) {
  case "validate":
    cmdValidate();
    break;
  case "build":
    cmdBuild();
    break;
  case "explain":
    cmdExplain();
    break;
  default:
    console.log(`
\x1b[1msemir\x1b[0m - Semantic System Intermediate Representation

Usage:
  semir validate <file.semir>         Validate a .semir model
  semir build <file.semir>            Build all projections
  semir explain <id> --file <file>    Explain an assertion across projections
`);
    break;
}
