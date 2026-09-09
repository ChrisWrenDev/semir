import { describe, it, expect } from "vitest";
import { reservationModel } from "../examples/reservations/model.ts";
import { projectEventModel } from "../src/projections/event-model/index.ts";
import { projectScenarios } from "../src/projections/scenarios/index.ts";
import { projectFormal } from "../src/projections/formal/index.ts";
import { slice } from "../src/core/slice.ts";
import { validateModel } from "../src/core/validation.ts";
import { assertions, effectsOf, preconditionsOf, eventsCausedBy, constraintsOn, neighbors } from "../src/core/query.ts";
import { serialize, deserialize, toJson, fromJson } from "../src/core/serialize.ts";
import { toSemirYaml, fromSemirYaml } from "../src/core/semir-format.ts";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const reservationSlice = slice(reservationModel, {
  roots: ["sem://reservation/action/pay-reservation"],
  relationships: ["causes", "transitions_to", "requires", "forbids", "authorized_by", "observable_within", "writes"],
});

describe("Core Model", () => {
  it("has unique object IDs", () => {
    const ids = [...reservationModel.objects.keys()];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique assertion IDs", () => {
    const ids = reservationModel.assertions.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("passes validation", () => {
    const result = validateModel(reservationModel);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("has no dangling references", () => {
    const result = validateModel(reservationModel);
    const dangling = result.errors.filter((e) => e.type === "dangling_reference");
    expect(dangling).toHaveLength(0);
  });
});

describe("Semantic Queries", () => {
  it("finds effects of PayReservation", () => {
    const effects = effectsOf(reservationModel, "sem://reservation/action/pay-reservation");
    expect(effects.length).toBeGreaterThan(0);
    expect(effects.some((a) => a.object === "sem://reservation/event/payment-accepted")).toBe(true);
  });

  it("finds preconditions of PayReservation", () => {
    const preconds = preconditionsOf(reservationModel, "sem://reservation/action/pay-reservation");
    expect(preconds.length).toBeGreaterThan(0);
    expect(preconds.some((a) => a.object === "sem://reservation/state/active")).toBe(true);
  });

  it("finds events caused by PayReservation", () => {
    const events = eventsCausedBy(reservationModel, "sem://reservation/action/pay-reservation");
    expect(events.length).toBeGreaterThan(0);
  });

  it("finds constraints on PaymentAccepted", () => {
    const constraints = constraintsOn(reservationModel, "sem://reservation/event/payment-accepted");
    expect(constraints.length).toBeGreaterThan(0);
  });

  it("finds neighbors of PayReservation", () => {
    const nbrs = neighbors(reservationModel, "sem://reservation/action/pay-reservation");
    expect(nbrs.length).toBeGreaterThan(0);
    expect(nbrs).toContain("sem://reservation/event/payment-accepted");
  });
});

describe("Semantic Slicing", () => {
  it("slice around PayReservation includes payment-related semantics", () => {
    expect(reservationSlice.objects.size).toBeGreaterThan(0);
    expect(reservationSlice.assertions.length).toBeGreaterThan(0);
  });

  it("slice includes authorization assertion", () => {
    expect(
      reservationSlice.assertions.some(
        (a) => a.id === "sem://reservation/assertion/pay-authorized-by-owner"
      )
    ).toBe(true);
  });

  it("slice includes paid-not-expire invariant", () => {
    expect(
      reservationSlice.assertions.some(
        (a) => a.id === "sem://reservation/assertion/paid-reservations-do-not-expire"
      )
    ).toBe(true);
  });
});

describe("Event Model Projection", () => {
  it("generates valid Mermaid output", () => {
    const result = projectEventModel(reservationSlice);
    expect(result.mermaid).toContain("graph LR");
    expect(result.mermaid).toContain("PayReservation");
    expect(result.mermaid).toContain("PaymentAccepted");
  });

  it("has acceptable diagnostics", () => {
    const result = projectEventModel(reservationSlice);
    expect(result.diagnostics.coverage).toBeGreaterThan(0);
  });
});

describe("Scenario Projection", () => {
  it("generates Gherkin scenarios", () => {
    const result = projectScenarios(reservationSlice);
    expect(result.gherkin).toContain("Feature:");
    expect(result.gherkin).toContain("Scenario:");
  });

  it("derives lifecycle scenarios from action→event→state patterns", () => {
    const result = projectScenarios(reservationSlice);
    expect(result.gherkin).toContain("PayReservation lifecycle");
    expect(result.gherkin).toContain("When PayReservation is executed");
    expect(result.gherkin).toContain("PaymentAccepted occurs");
    expect(result.gherkin).toContain("transitions to Paid state");
  });

  it("derives invariant scenarios from forbids patterns", () => {
    const result = projectScenarios(reservationSlice);
    expect(result.gherkin).toContain("Paid does not lead to Expired");
    expect(result.gherkin).toContain("does NOT transition to Expired");
  });

  it("derives failure prevention scenarios", () => {
    const result = projectScenarios(reservationSlice);
    expect(result.gherkin).toContain("ExpireReservation does not lead to Expired");
  });

  it("contains no hardcoded assertion IDs in generated text", () => {
    const result = projectScenarios(reservationSlice);
    expect(result.gherkin).not.toContain("sem://");
  });

  it("all scenarios have semantic traceability", () => {
    const result = projectScenarios(reservationSlice);
    for (const s of result.ir.scenarios) {
      expect(s.semanticIds.length).toBeGreaterThan(0);
    }
  });
});

describe("Formal Verification Projection", () => {
  it("generates TLA+ spec", () => {
    const result = projectFormal(reservationSlice);
    expect(result.tla).toContain("---- MODULE Reservation ----");
    expect(result.tla).toContain("VARIABLE reservationState");
  });

  it("includes paid-not-expire property", () => {
    const result = projectFormal(reservationSlice);
    expect(result.tla).toContain("Paid");
    expect(result.tla).toContain("Expired");
  });

  it("has acceptable diagnostics", () => {
    const result = projectFormal(reservationSlice);
    expect(result.diagnostics.coverage).toBeGreaterThan(0);
  });
});

describe("Serialization Round-Trip", () => {
  it("round-trips through JSON without semantic loss", () => {
    const json = toJson(reservationModel);
    const restored = fromJson(json);

    expect(restored.objects.size).toBe(reservationModel.objects.size);
    expect(restored.assertions.length).toBe(reservationModel.assertions.length);

    for (const [id, obj] of reservationModel.objects) {
      const restoredObj = restored.objects.get(id);
      expect(restoredObj).toBeDefined();
      expect(restoredObj!.name).toBe(obj.name);
      expect(restoredObj!.kind).toBe(obj.kind);
    }

    for (const a of reservationModel.assertions) {
      const restoredA = restored.assertions.find((ra) => ra.id === a.id);
      expect(restoredA).toBeDefined();
      expect(restoredA!.subject).toBe(a.subject);
      expect(restoredA!.predicate).toBe(a.predicate);
      expect(restoredA!.kind).toBe(a.kind);
    }
  });

  it("preserves evidence through round-trip", () => {
    const json = toJson(reservationModel);
    const restored = fromJson(json);

    const noDuplicate = restored.assertions.find(
      (a) => a.id === "sem://reservation/assertion/payment-retry-forbids-duplicate-charge"
    );
    expect(noDuplicate).toBeDefined();
    expect(noDuplicate!.evidence).toBeDefined();
    expect(noDuplicate!.evidence!.length).toBeGreaterThan(0);
    expect(noDuplicate!.confidence).toBe(0.97);
  });

  it("preserves epistemic status", () => {
    const json = toJson(reservationModel);
    const restored = fromJson(json);

    for (const a of reservationModel.assertions) {
      const restoredA = restored.assertions.find((ra) => ra.id === a.id);
      expect(restoredA!.epistemicStatus).toBe(a.epistemicStatus);
    }
  });
});

describe(".semir YAML Format", () => {
  it("round-trips through YAML without semantic loss", () => {
    const yamlContent = toSemirYaml(reservationModel);
    const restored = fromSemirYaml(yamlContent);

    expect(restored.objects.size).toBe(reservationModel.objects.size);
    expect(restored.assertions.length).toBe(reservationModel.assertions.length);

    for (const [id, obj] of reservationModel.objects) {
      const restoredObj = restored.objects.get(id);
      expect(restoredObj).toBeDefined();
      expect(restoredObj!.name).toBe(obj.name);
      expect(restoredObj!.kind).toBe(obj.kind);
    }

    for (const a of reservationModel.assertions) {
      const restoredA = restored.assertions.find((ra) => ra.id === a.id);
      expect(restoredA).toBeDefined();
      expect(restoredA!.subject).toBe(a.subject);
      expect(restoredA!.predicate).toBe(a.predicate);
      expect(restoredA!.kind).toBe(a.kind);
    }
  });

  it("parses the reservation.semir file", () => {
    const yamlContent = readFileSync(
      join(process.cwd(), "examples", "reservations", "reservation.semir"),
      "utf8"
    );
    const model = fromSemirYaml(yamlContent);

    expect(model.name).toBe("Reservation/Payment Subsystem");
    expect(model.objects.size).toBe(12);
    expect(model.assertions.length).toBe(18);
  });

  it("produces valid YAML", () => {
    const yamlContent = toSemirYaml(reservationModel);
    expect(yamlContent).toContain("version:");
    expect(yamlContent).toContain("name:");
    expect(yamlContent).toContain("objects:");
    expect(yamlContent).toContain("assertions:");
  });

  it("preserves evidence in YAML format", () => {
    const yamlContent = toSemirYaml(reservationModel);
    const restored = fromSemirYaml(yamlContent);

    const noDuplicate = restored.assertions.find(
      (a) => a.id === "sem://reservation/assertion/payment-retry-forbids-duplicate-charge"
    );
    expect(noDuplicate).toBeDefined();
    expect(noDuplicate!.evidence).toBeDefined();
    expect(noDuplicate!.evidence!.length).toBe(2);
    expect(noDuplicate!.confidence).toBe(0.97);
  });
});

describe("Golden Tests", () => {
  const goldenDir = join(process.cwd(), "test", "golden");

  function writeGolden(name: string, content: string) {
    writeFileSync(join(goldenDir, name), content);
  }

  function readGolden(name: string): string {
    return readFileSync(join(goldenDir, name), "utf8");
  }

  it("event model golden output is stable", () => {
    const result = projectEventModel(reservationSlice);
    const output = "```mermaid\n" + result.mermaid + "\n```\n";
    writeGolden("reservation.event-model.md", output);
    const golden = readGolden("reservation.event-model.md");
    expect(output).toBe(golden);
  });

  it("scenario golden output is stable", () => {
    const result = projectScenarios(reservationSlice);
    writeGolden("reservation.feature", result.gherkin);
    const golden = readGolden("reservation.feature");
    expect(result.gherkin).toBe(golden);
  });

  it("formal golden output is stable", () => {
    const result = projectFormal(reservationSlice);
    writeGolden("reservation.tla", result.tla);
    const golden = readGolden("reservation.tla");
    expect(result.tla).toBe(golden);
  });
});

describe("Semantic Change Demo", () => {
  it("paid-not-expire invariant is traceable across projections", () => {
    const emResult = projectEventModel(reservationSlice);
    const scResult = projectScenarios(reservationSlice);
    const fmResult = projectFormal(reservationSlice);

    expect(scResult.gherkin).toContain("Paid does not lead to Expired");
    expect(fmResult.tla).toContain("Paid");
    expect(emResult.mermaid).toContain("forbids");
  });

  it("expiry timeout affects Event Model and Formal projections", () => {
    const emResult = projectEventModel(reservationSlice);
    const fmResult = projectFormal(reservationSlice);

    expect(emResult.mermaid).toContain("ExpireReservation");
    expect(fmResult.tla).toContain("ExpireReservation");
  });
});

describe("Semantic Change Propagation", () => {
  it("changing observable_within from 5s to 2s updates Event Model and Formal model", () => {
    const changed = fromSemirYaml(
      toSemirYaml(reservationModel).replace("literal: 5s", "literal: 2s")
    );

    const em2s = projectEventModel(
      slice(changed, {
        roots: [...changed.objects.keys()],
        relationships: ["causes", "transitions_to", "requires", "forbids", "authorized_by", "observable_within", "writes"],
      })
    );
    expect(em2s.mermaid).toContain("2s");
    expect(em2s.mermaid).not.toContain("5s");
  });
});

describe("Domain Independence", () => {
  it("projections work after renaming all domain concepts", () => {
    const yaml = toSemirYaml(reservationModel)
      .replace(/Reservation/g, "Widget")
      .replace(/ReservationOwner/g, "WidgetManager")
      .replace(/PaymentAccepted/g, "PaymentRecorded")
      .replace(/ReservationExpired/g, "WidgetArchived")
      .replace(/ReservationCreated/g, "WidgetRegistered")
      .replace(/DuplicateCharge/g, "DoubleBilling")
      .replace(/PaymentIdempotency/g, "PaymentDedup");

    const renamed = fromSemirYaml(yaml);
    const renamedSlice = slice(renamed, {
      roots: [...renamed.objects.keys()],
      relationships: ["causes", "transitions_to", "requires", "forbids", "authorized_by", "observable_within", "writes"],
    });

    const em = projectEventModel(renamedSlice);
    expect(em.mermaid).toContain("Widget");
    expect(em.mermaid).toContain("PayWidget");

    const sc = projectScenarios(renamedSlice);
    expect(sc.gherkin).toContain("Widget");
    expect(sc.gherkin).toContain("PayWidget lifecycle");

    const fm = projectFormal(renamedSlice);
    expect(fm.tla).toContain("Widget");

    expect(em.diagnostics.coverage).toBeGreaterThan(0);
    expect(sc.diagnostics.coverage).toBeGreaterThan(0);
  });
});

describe("Contradiction Handling", () => {
  it("model can hold conflicting assertions without silent resolution", () => {
    const yaml = toSemirYaml(reservationModel);

    const contradictionYaml = yaml + `
  - id: sem://reservation/assertion/contradictory-paid-expires
    subject: sem://reservation/state/paid
    predicate: requires
    object: sem://reservation/state/expired
    kind: invariant
    epistemicStatus: conflicting
    confidence: 0.3
    evidence:
      - type: documentation
        source: Outdated legacy docs
        stance: contradicts
`;

    const withContradiction = fromSemirYaml(contradictionYaml);

    const paidExpires = withContradiction.assertions.find(
      (a) => a.id === "sem://reservation/assertion/contradictory-paid-expires"
    );
    expect(paidExpires).toBeDefined();
    expect(paidExpires!.epistemicStatus).toBe("conflicting");

    const paidNoExpire = withContradiction.assertions.find(
      (a) => a.id === "sem://reservation/assertion/paid-reservations-do-not-expire"
    );
    expect(paidNoExpire).toBeDefined();
    expect(paidNoExpire!.epistemicStatus).toBe("validated");

    const conflicting = withContradiction.assertions.filter(
      (a) => a.epistemicStatus === "conflicting"
    );
    expect(conflicting.length).toBe(1);

    const s = slice(withContradiction, {
      roots: [...withContradiction.objects.keys()],
      relationships: ["causes", "transitions_to", "requires", "forbids", "authorized_by", "observable_within", "writes"],
    });

    const em = projectEventModel(s);
    expect(em.mermaid).toContain("forbids");

    const sc = projectScenarios(s);
    expect(sc.gherkin).toContain("Paid does not lead to Expired");
  });
});
