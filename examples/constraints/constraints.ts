import { createModel } from "../../src/core/model.ts";
import { Constraint, eq, propRef, varRef, forall, atMost, and, lit } from "../../src/core/constraint.ts";

const ownershipConstraint: Constraint = {
  description: "the actor must be the owner of the reservation",
  expr: forall(
    "r", "sem://instance/entity/reservation",
    eq(
      varRef("a"),
      propRef("r", "owner")
    )
  ),
};

const rateLimitConstraint: Constraint = {
  description: "the request client must match the bucket owner",
  expr: forall(
    "b", "sem://instance/entity/token-bucket",
    eq(
      propRef("q", "client"),
      propRef("b", "owner")
    )
  ),
};

const idempotencyConstraint: Constraint = {
  description: "at most one successful charge per payment intent",
  expr: forall(
    "p", "sem://instance/entity/payment-intent",
    atMost(1, "c", "sem://instance/entity/charge",
      and(
        eq(propRef("c", "intent"), varRef("p")),
        eq(propRef("c", "status"), lit("successful"))
      )
    )
  ),
};

export const constraintModel = createModel(
  [
    // === Entities ===
    {
      id: "sem://instance/entity/reservation",
      kind: "entity",
      name: "Reservation",
    },
    {
      id: "sem://instance/entity/payment-intent",
      kind: "entity",
      name: "PaymentIntent",
    },
    {
      id: "sem://instance/entity/charge",
      kind: "entity",
      name: "Charge",
    },
    {
      id: "sem://instance/actor/owner",
      kind: "actor",
      name: "ReservationOwner",
    },

    // === States ===
    {
      id: "sem://instance/state/active",
      kind: "state",
      name: "Active",
    },
    {
      id: "sem://instance/state/paid",
      kind: "state",
      name: "Paid",
    },
    {
      id: "sem://instance/state/charged",
      kind: "state",
      name: "Charged",
    },

    // === Actions ===
    {
      id: "sem://instance/action/pay-reservation",
      kind: "action",
      name: "PayReservation",
    },
    {
      id: "sem://instance/action/attempt-charge",
      kind: "action",
      name: "AttemptCharge",
    },

    // === Events ===
    {
      id: "sem://instance/event/payment-accepted",
      kind: "event",
      name: "PaymentAccepted",
    },
    {
      id: "sem://instance/event/charge-created",
      kind: "event",
      name: "ChargeCreated",
    },
  ],
  [
    // === Structural assertions ===

    // Reservation ownership (Test Case C)
    {
      id: "sem://instance/assertion/pay-authorized-by-owner",
      subject: "sem://instance/action/pay-reservation",
      predicate: "authorized_by",
      object: "sem://instance/actor/owner",
      kind: "security",
      epistemicStatus: "validated",
      confidence: 1.0,
      constraint: ownershipConstraint,
    },

    // Payment lifecycle
    {
      id: "sem://instance/assertion/pay-causes-payment-accepted",
      subject: "sem://instance/action/pay-reservation",
      predicate: "causes",
      object: "sem://instance/event/payment-accepted",
      kind: "postcondition",
      epistemicStatus: "validated",
      confidence: 1.0,
    },
    {
      id: "sem://instance/assertion/payment-accepted-transitions-to-paid",
      subject: "sem://instance/event/payment-accepted",
      predicate: "transitions_to",
      object: "sem://instance/state/paid",
      kind: "postcondition",
      epistemicStatus: "validated",
      confidence: 1.0,
    },
    {
      id: "sem://instance/assertion/pay-requires-active",
      subject: "sem://instance/action/pay-reservation",
      predicate: "requires",
      object: "sem://instance/state/active",
      kind: "precondition",
      epistemicStatus: "validated",
      confidence: 1.0,
    },

    // Charge lifecycle
    {
      id: "sem://instance/assertion/attempt-causes-charge",
      subject: "sem://instance/action/attempt-charge",
      predicate: "causes",
      object: "sem://instance/event/charge-created",
      kind: "postcondition",
      epistemicStatus: "validated",
      confidence: 1.0,
    },
    {
      id: "sem://instance/assertion/charge-transitions-to-charged",
      subject: "sem://instance/event/charge-created",
      predicate: "transitions_to",
      object: "sem://instance/state/charged",
      kind: "postcondition",
      epistemicStatus: "validated",
      confidence: 1.0,
    },

    // Idempotency invariant (Test Case A)
    {
      id: "sem://instance/assertion/idempotent-charge",
      subject: "sem://instance/action/attempt-charge",
      predicate: "forbids",
      object: "sem://instance/event/charge-created",
      kind: "invariant",
      epistemicStatus: "validated",
      confidence: 1.0,
      constraint: idempotencyConstraint,
    },
  ],
  "Instance Constraints",
  "Testing relational constraint calculus"
);
