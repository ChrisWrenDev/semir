import { SemanticSlice } from "../../core/slice.ts";
import { EventModelIR } from "./ir.ts";
import { lower, validate, EVENT_MODEL_CAPABILITIES } from "./lower.ts";
import { renderMermaid } from "./render-mermaid.ts";
import { ProjectionDiagnostics } from "../../core/predicates.ts";

export interface EventModelProjection {
  ir: EventModelIR;
  diagnostics: ProjectionDiagnostics;
  mermaid: string;
}

export function projectEventModel(slice: SemanticSlice, _modelName?: string): EventModelProjection {
  const ir = lower(slice);
  const diagnostics = validate(ir);
  const mermaid = renderMermaid(ir);
  return { ir, diagnostics, mermaid };
}

export { EVENT_MODEL_CAPABILITIES };
