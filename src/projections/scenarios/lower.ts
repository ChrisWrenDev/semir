import { SemanticSlice } from "../../core/slice.ts";
import { Assertion, isRef, targetId } from "../../core/assertion.ts";
import { SemanticObject } from "../../core/object.ts";
import { ScenarioIR, Scenario, Clause } from "./ir.ts";
import { ProjectionCapabilities, ProjectionDiagnostics } from "../../core/predicates.ts";

export const SCENARIO_CAPABILITIES: ProjectionCapabilities = {
  predicates: ["causes", "transitions_to", "requires", "forbids", "authorized_by", "observable_within", "exactly_once", "writes"],
  assertionKinds: ["fact", "precondition", "postcondition", "invariant", "temporal", "security", "failure"],
};

const SUPPORTED_PREDICATES = new Set<string>(SCENARIO_CAPABILITIES.predicates);

function objName(slice: SemanticSlice, id: string): string {
  return slice.objects.get(id)?.name ?? id;
}

interface LifecyclePattern {
  action: SemanticObject;
  requiredState?: Assertion;
  causedEvent?: Assertion;
  transition?: Assertion;
}

function findLifecyclePatterns(slice: SemanticSlice, assertions: Assertion[]): LifecyclePattern[] {
  const actions = [...slice.objects.values()].filter((o) => o.kind === "action");
  const patterns: LifecyclePattern[] = [];

  for (const action of actions) {
    const requiredState = assertions.find(
      (a) => a.subject === action.id && a.predicate === "requires" && a.object && isRef(a.object)
    );
    const causedEvent = assertions.find(
      (a) => a.subject === action.id && a.predicate === "causes" && a.object && isRef(a.object)
    );
    let transition: Assertion | undefined;
    if (causedEvent?.object && isRef(causedEvent.object)) {
      transition = assertions.find(
        (a) => a.subject === causedEvent.object && a.predicate === "transitions_to" && a.object && isRef(a.object)
      );
    }

    patterns.push({ action, requiredState, causedEvent, transition });
  }

  return patterns;
}

interface InvariantPattern {
  subject: SemanticObject;
  forbidden: SemanticObject;
  assertion: Assertion;
}

function findInvariantPatterns(slice: SemanticSlice, assertions: Assertion[]): InvariantPattern[] {
  const patterns: InvariantPattern[] = [];

  for (const a of assertions) {
    if (a.predicate === "forbids" && a.object && isRef(a.object) && a.kind === "invariant") {
      const subjectObj = slice.objects.get(a.subject);
      const forbiddenObj = slice.objects.get(a.object);
      if (subjectObj && forbiddenObj) {
        patterns.push({ subject: subjectObj, forbidden: forbiddenObj, assertion: a });
      }
    }
  }

  return patterns;
}

interface AuthPattern {
  action: SemanticObject;
  actor: SemanticObject;
  assertion: Assertion;
}

function findAuthPatterns(slice: SemanticSlice, assertions: Assertion[]): AuthPattern[] {
  const patterns: AuthPattern[] = [];

  for (const a of assertions) {
    if (a.predicate === "authorized_by" && a.object && isRef(a.object)) {
      const actionObj = slice.objects.get(a.subject);
      const actorObj = slice.objects.get(a.object);
      if (actionObj && actorObj) {
        patterns.push({ action: actionObj, actor: actorObj, assertion: a });
      }
    }
  }

  return patterns;
}

interface FailurePattern {
  action: SemanticObject;
  forbiddenOutcome: SemanticObject;
  assertion: Assertion;
}

function findFailurePatterns(slice: SemanticSlice, assertions: Assertion[]): FailurePattern[] {
  const patterns: FailurePattern[] = [];

  for (const a of assertions) {
    if (a.predicate === "forbids" && a.object && isRef(a.object) && a.kind === "failure") {
      const actionObj = slice.objects.get(a.subject);
      const outcomeObj = slice.objects.get(a.object);
      if (actionObj && outcomeObj) {
        patterns.push({ action: actionObj, forbiddenOutcome: outcomeObj, assertion: a });
      }
    }
  }

  return patterns;
}

function deriveLifecycleScenario(slice: SemanticSlice, pattern: LifecyclePattern): Scenario | null {
  const { action, requiredState, causedEvent, transition } = pattern;
  if (!causedEvent || !causedEvent.object || !isRef(causedEvent.object)) return null;

  const resultingState = transition?.object && isRef(transition.object)
    ? objName(slice, transition.object)
    : undefined;

  const given: Clause[] = [];
  if (requiredState?.object && isRef(requiredState.object)) {
    given.push({
      text: `the system is in ${objName(slice, requiredState.object)} state`,
      semanticId: requiredState.object,
    });
  }

  const when: Clause[] = [
    { text: `${action.name} is executed`, semanticId: action.id },
  ];

  const then: Clause[] = [
    { text: `${objName(slice, causedEvent.object)} occurs`, semanticId: causedEvent.object },
  ];
  if (resultingState && transition?.object && isRef(transition.object)) {
    then.push({
      text: `the system transitions to ${resultingState} state`,
      semanticId: transition.object,
    });
  }

  const semanticIds = [action.id, causedEvent.id];
  if (requiredState) semanticIds.push(requiredState.id);
  if (transition) semanticIds.push(transition.id);

  return {
    name: `${action.name} lifecycle`,
    semanticIds,
    given,
    when,
    then,
  };
}

function deriveInvariantScenario(_slice: SemanticSlice, pattern: InvariantPattern): Scenario | null {
  const { subject, forbidden, assertion } = pattern;

  return {
    name: `${subject.name} does not lead to ${forbidden.name}`,
    semanticIds: [assertion.id],
    given: [
      { text: `the system is in ${subject.name} state`, semanticId: subject.id },
    ],
    when: [
      { text: "a transition is attempted", semanticId: assertion.id },
    ],
    then: [
      { text: `the system does NOT transition to ${forbidden.name}`, semanticId: assertion.id },
    ],
  };
}

function deriveAuthScenario(_slice: SemanticSlice, pattern: AuthPattern): Scenario | null {
  const { action, actor, assertion } = pattern;

  return {
    name: `${actor.name} is authorized to ${action.name}`,
    semanticIds: [assertion.id],
    given: [
      { text: `a valid ${actor.name} is present`, semanticId: actor.id },
    ],
    when: [
      { text: `${action.name} is requested`, semanticId: action.id },
    ],
    then: [
      { text: `${action.name} is authorized`, semanticId: assertion.id },
    ],
  };
}

function deriveFailureScenario(_slice: SemanticSlice, pattern: FailurePattern): Scenario | null {
  const { action, forbiddenOutcome, assertion } = pattern;

  return {
    name: `${action.name} does not cause ${forbiddenOutcome.name}`,
    semanticIds: [assertion.id],
    given: [
      { text: `${action.name} is executed`, semanticId: action.id },
    ],
    when: [
      { text: "the action completes", semanticId: action.id },
    ],
    then: [
      { text: `${forbiddenOutcome.name} does NOT occur`, semanticId: assertion.id },
    ],
  };
}

export function lower(slice: SemanticSlice): ScenarioIR {
  const assertions = [...slice.assertions];
  const unsupported: Array<{ assertionId: string; reason: string }> = [];

  for (const a of assertions) {
    if (!SUPPORTED_PREDICATES.has(a.predicate)) {
      unsupported.push({
        assertionId: a.id,
        reason: `Predicate "${a.predicate}" is not representable in scenarios`,
      });
    }
  }

  const lifecyclePatterns = findLifecyclePatterns(slice, assertions);
  const invariantPatterns = findInvariantPatterns(slice, assertions);
  const authPatterns = findAuthPatterns(slice, assertions);
  const failurePatterns = findFailurePatterns(slice, assertions);

  const scenarios: Scenario[] = [];

  for (const p of lifecyclePatterns) {
    const s = deriveLifecycleScenario(slice, p);
    if (s) scenarios.push(s);
  }
  for (const p of invariantPatterns) {
    const s = deriveInvariantScenario(slice, p);
    if (s) scenarios.push(s);
  }
  for (const p of authPatterns) {
    const s = deriveAuthScenario(slice, p);
    if (s) scenarios.push(s);
  }
  for (const p of failurePatterns) {
    const s = deriveFailureScenario(slice, p);
    if (s) scenarios.push(s);
  }

  return { scenarios, unsupported };
}

export function validate(ir: ScenarioIR): ProjectionDiagnostics {
  const unsupported = ir.unsupported.map((u) => ({
    assertionId: u.assertionId,
    reason: u.reason,
  }));

  const totalScenarios = ir.scenarios.length;
  const coverage = totalScenarios > 0 ? 1 : 0;

  return {
    unsupported,
    warnings: [],
    coverage,
  };
}
