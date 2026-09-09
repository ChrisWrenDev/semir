import { SemanticSlice } from "../../core/slice.ts";
import { FormalIR } from "./ir.ts";
import { lower, validate, FORMAL_CAPABILITIES } from "./lower.ts";
import { renderTLA } from "./render-tla.ts";
import { ProjectionDiagnostics } from "../../core/predicates.ts";

export interface FormalProjection {
  ir: FormalIR;
  diagnostics: ProjectionDiagnostics;
  tla: string;
}

export function projectFormal(slice: SemanticSlice, modelName?: string): FormalProjection {
  const ir = lower(slice);
  if (modelName) ir.module = modelName.replace(/[^a-zA-Z0-9]/g, "");
  const diagnostics = validate(ir);
  const tla = renderTLA(ir);
  return { ir, diagnostics, tla };
}

export { FORMAL_CAPABILITIES };
