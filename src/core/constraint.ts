import { SemanticId } from "./object.ts";

export interface Binding {
  name: string;
  semanticType: SemanticId;
}

export type ConstraintExpr =
  | { kind: "var"; name: string }
  | { kind: "prop"; subject: string; property: string }
  | { kind: "literal"; value: string | number | boolean }
  | { kind: "equals"; left: ConstraintExpr; right: ConstraintExpr }
  | { kind: "not_equals"; left: ConstraintExpr; right: ConstraintExpr }
  | { kind: "lt"; left: ConstraintExpr; right: ConstraintExpr }
  | { kind: "lte"; left: ConstraintExpr; right: ConstraintExpr }
  | { kind: "gt"; left: ConstraintExpr; right: ConstraintExpr }
  | { kind: "gte"; left: ConstraintExpr; right: ConstraintExpr }
  | { kind: "and"; left: ConstraintExpr; right: ConstraintExpr }
  | { kind: "or"; left: ConstraintExpr; right: ConstraintExpr }
  | { kind: "not"; expr: ConstraintExpr }
  | { kind: "forall"; binding: Binding; where?: ConstraintExpr; body: ConstraintExpr }
  | { kind: "exists"; binding: Binding; where?: ConstraintExpr; body: ConstraintExpr }
  | { kind: "at_most"; count: number; bindingName: string; targetType: SemanticId; where?: ConstraintExpr }
  | { kind: "at_least"; count: number; bindingName: string; targetType: SemanticId; where?: ConstraintExpr };

export interface Constraint {
  description?: string;
  expr: ConstraintExpr;
}

export function varRef(name: string): ConstraintExpr {
  return { kind: "var", name };
}

export function propRef(subject: string, property: string): ConstraintExpr {
  return { kind: "prop", subject, property };
}

export function lit(value: string | number | boolean): ConstraintExpr {
  return { kind: "literal", value };
}

export function eq(left: ConstraintExpr, right: ConstraintExpr): ConstraintExpr {
  return { kind: "equals", left, right };
}

export function neq(left: ConstraintExpr, right: ConstraintExpr): ConstraintExpr {
  return { kind: "not_equals", left, right };
}

export function lt(left: ConstraintExpr, right: ConstraintExpr): ConstraintExpr {
  return { kind: "lt", left, right };
}

export function lte(left: ConstraintExpr, right: ConstraintExpr): ConstraintExpr {
  return { kind: "lte", left, right };
}

export function gt(left: ConstraintExpr, right: ConstraintExpr): ConstraintExpr {
  return { kind: "gt", left, right };
}

export function gte(left: ConstraintExpr, right: ConstraintExpr): ConstraintExpr {
  return { kind: "gte", left, right };
}

export function and(left: ConstraintExpr, right: ConstraintExpr): ConstraintExpr {
  return { kind: "and", left, right };
}

export function or(left: ConstraintExpr, right: ConstraintExpr): ConstraintExpr {
  return { kind: "or", left, right };
}

export function not(expr: ConstraintExpr): ConstraintExpr {
  return { kind: "not", expr };
}

export function forall(
  name: string,
  semanticType: SemanticId,
  body: ConstraintExpr,
  where?: ConstraintExpr
): ConstraintExpr {
  return { kind: "forall", binding: { name, semanticType }, where, body };
}

export function exists(
  name: string,
  semanticType: SemanticId,
  body: ConstraintExpr,
  where?: ConstraintExpr
): ConstraintExpr {
  return { kind: "exists", binding: { name, semanticType }, where, body };
}

export function atMost(
  count: number,
  bindingName: string,
  targetType: SemanticId,
  where?: ConstraintExpr
): ConstraintExpr {
  return { kind: "at_most", count, bindingName, targetType, where };
}

export function atLeast(
  count: number,
  bindingName: string,
  targetType: SemanticId,
  where?: ConstraintExpr
): ConstraintExpr {
  return { kind: "at_least", count, bindingName, targetType, where };
}

export function renderConstraintExpr(expr: ConstraintExpr): string {
  switch (expr.kind) {
    case "var":
      return expr.name;
    case "prop":
      return `${expr.subject}.${expr.property}`;
    case "literal":
      return typeof expr.value === "string" ? `"${expr.value}"` : String(expr.value);
    case "equals":
      return `${renderConstraintExpr(expr.left)} == ${renderConstraintExpr(expr.right)}`;
    case "not_equals":
      return `${renderConstraintExpr(expr.left)} != ${renderConstraintExpr(expr.right)}`;
    case "lt":
      return `${renderConstraintExpr(expr.left)} < ${renderConstraintExpr(expr.right)}`;
    case "lte":
      return `${renderConstraintExpr(expr.left)} <= ${renderConstraintExpr(expr.right)}`;
    case "gt":
      return `${renderConstraintExpr(expr.left)} > ${renderConstraintExpr(expr.right)}`;
    case "gte":
      return `${renderConstraintExpr(expr.left)} >= ${renderConstraintExpr(expr.right)}`;
    case "and":
      return `(${renderConstraintExpr(expr.left)} ∧ ${renderConstraintExpr(expr.right)})`;
    case "or":
      return `(${renderConstraintExpr(expr.left)} ∨ ${renderConstraintExpr(expr.right)})`;
    case "not":
      return `¬${renderConstraintExpr(expr.expr)}`;
    case "forall":
      return `∀${expr.binding.name}:${expr.where ? ` [${renderConstraintExpr(expr.where)}]` : ""} ${renderConstraintExpr(expr.body)}`;
    case "exists":
      return `∃${expr.binding.name}:${expr.where ? ` [${renderConstraintExpr(expr.where)}]` : ""} ${renderConstraintExpr(expr.body)}`;
    case "at_most":
      return `at_most ${expr.count} ${expr.bindingName} [${expr.where ? renderConstraintExpr(expr.where) : "*"}]`;
    case "at_least":
      return `at_least ${expr.count} ${expr.bindingName} [${expr.where ? renderConstraintExpr(expr.where) : "*"}]`;
  }
}
