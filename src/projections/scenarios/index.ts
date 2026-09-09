import { SemanticSlice } from "../../core/slice.ts";
import { ScenarioIR } from "./ir.ts";
import { lower, validate, SCENARIO_CAPABILITIES } from "./lower.ts";
import { renderGherkin } from "./render-gherkin.ts";
import { ProjectionDiagnostics } from "../../core/predicates.ts";

export interface ScenarioProjection {
  ir: ScenarioIR;
  diagnostics: ProjectionDiagnostics;
  gherkin: string;
}

export function projectScenarios(slice: SemanticSlice, modelName?: string): ScenarioProjection {
  const ir = lower(slice);
  const diagnostics = validate(ir);
  const gherkin = renderGherkin(ir, modelName);
  return { ir, diagnostics, gherkin };
}

export { SCENARIO_CAPABILITIES };
