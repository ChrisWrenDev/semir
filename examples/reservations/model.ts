import { createModel } from "../../src/core/model.ts";

export const reservationModel = createModel(
  [
    // Entities
    {
      id: "sem://reservation/entity/reservation",
      kind: "entity",
      name: "Reservation",
    },
    {
      id: "sem://reservation/actor/owner",
      kind: "actor",
      name: "ReservationOwner",
    },

    // States
    {
      id: "sem://reservation/state/active",
      kind: "state",
      name: "Active",
      attributes: { entity: { value: "sem://reservation/entity/reservation", kind: "ref" } },
    },
    {
      id: "sem://reservation/state/paid",
      kind: "state",
      name: "Paid",
      attributes: { entity: { value: "sem://reservation/entity/reservation", kind: "ref" } },
    },
    {
      id: "sem://reservation/state/expired",
      kind: "state",
      name: "Expired",
      attributes: { entity: { value: "sem://reservation/entity/reservation", kind: "ref" } },
    },

    // Actions
    {
      id: "sem://reservation/action/create-reservation",
      kind: "action",
      name: "CreateReservation",
    },
    {
      id: "sem://reservation/action/pay-reservation",
      kind: "action",
      name: "PayReservation",
    },
    {
      id: "sem://reservation/action/expire-reservation",
      kind: "action",
      name: "ExpireReservation",
    },

    // Events
    {
      id: "sem://reservation/event/reservation-created",
      kind: "event",
      name: "ReservationCreated",
    },
    {
      id: "sem://reservation/event/payment-accepted",
      kind: "event",
      name: "PaymentAccepted",
    },
    {
      id: "sem://reservation/event/reservation-expired",
      kind: "event",
      name: "ReservationExpired",
    },
    {
      id: "sem://reservation/event/duplicate-charge",
      kind: "event",
      name: "DuplicateCharge",
    },
  ],
  [
    // === Lifecycle transitions ===
    {
      id: "sem://reservation/assertion/create-causes-created",
      subject: "sem://reservation/action/create-reservation",
      predicate: "causes",
      object: "sem://reservation/event/reservation-created",
      kind: "postcondition",
      epistemicStatus: "validated",
      confidence: 1.0,
    },
    {
      id: "sem://reservation/assertion/created-transitions-to-active",
      subject: "sem://reservation/event/reservation-created",
      predicate: "transitions_to",
      object: "sem://reservation/state/active",
      kind: "postcondition",
      epistemicStatus: "validated",
      confidence: 1.0,
    },
    {
      id: "sem://reservation/assertion/pay-causes-payment-accepted",
      subject: "sem://reservation/action/pay-reservation",
      predicate: "causes",
      object: "sem://reservation/event/payment-accepted",
      kind: "postcondition",
      epistemicStatus: "validated",
      confidence: 1.0,
    },
    {
      id: "sem://reservation/assertion/payment-accepted-transitions-to-paid",
      subject: "sem://reservation/event/payment-accepted",
      predicate: "transitions_to",
      object: "sem://reservation/state/paid",
      kind: "postcondition",
      epistemicStatus: "validated",
      confidence: 1.0,
    },
    {
      id: "sem://reservation/assertion/expire-causes-reservation-expired",
      subject: "sem://reservation/action/expire-reservation",
      predicate: "causes",
      object: "sem://reservation/event/reservation-expired",
      kind: "postcondition",
      epistemicStatus: "validated",
      confidence: 1.0,
    },
    {
      id: "sem://reservation/assertion/reservation-expired-transitions-to-expired",
      subject: "sem://reservation/event/reservation-expired",
      predicate: "transitions_to",
      object: "sem://reservation/state/expired",
      kind: "postcondition",
      epistemicStatus: "validated",
      confidence: 1.0,
    },

    // === Preconditions ===
    {
      id: "sem://reservation/assertion/pay-requires-active",
      subject: "sem://reservation/action/pay-reservation",
      predicate: "requires",
      object: "sem://reservation/state/active",
      kind: "precondition",
      epistemicStatus: "validated",
      confidence: 1.0,
    },
    {
      id: "sem://reservation/assertion/expire-requires-active",
      subject: "sem://reservation/action/expire-reservation",
      predicate: "requires",
      object: "sem://reservation/state/active",
      kind: "precondition",
      epistemicStatus: "validated",
      confidence: 1.0,
    },

    // === Authorization ===
    {
      id: "sem://reservation/assertion/pay-authorized-by-owner",
      subject: "sem://reservation/action/pay-reservation",
      predicate: "authorized_by",
      object: "sem://reservation/actor/owner",
      kind: "security",
      epistemicStatus: "validated",
      confidence: 1.0,
      evidence: [
        {
          type: "documentation",
          source: "Reservation API documentation",
          stance: "supports",
        },
      ],
    },

    // === Core invariant: paid reservations cannot expire ===
    {
      id: "sem://reservation/assertion/paid-reservations-do-not-expire",
      subject: "sem://reservation/state/paid",
      predicate: "forbids",
      object: "sem://reservation/state/expired",
      kind: "invariant",
      epistemicStatus: "validated",
      confidence: 1.0,
      evidence: [
        {
          type: "test",
          source: "PaidReservationExpirationTest",
          stance: "supports",
        },
        {
          type: "code",
          source: "ReservationService.java",
          stance: "supports",
        },
      ],
    },
    {
      id: "sem://reservation/assertion/expire-forbidden-when-paid",
      subject: "sem://reservation/action/expire-reservation",
      predicate: "forbids",
      object: "sem://reservation/state/expired",
      kind: "invariant",
      epistemicStatus: "validated",
      confidence: 1.0,
      conditions: [
        {
          subject: "sem://reservation/entity/reservation",
          predicate: "holds_when",
          object: "sem://reservation/state/paid",
        },
      ],
    },

    // === Temporal: unpaid reservations expire after timeout ===
    {
      id: "sem://reservation/assertion/expiry-timeout",
      subject: "sem://reservation/action/expire-reservation",
      predicate: "requires",
      object: "sem://reservation/state/active",
      kind: "temporal",
      epistemicStatus: "validated",
      confidence: 1.0,
      conditions: [
        {
          subject: "sem://reservation/entity/reservation",
          predicate: "holds_when",
          object: "sem://reservation/state/active",
        },
      ],
      evidence: [
        {
          type: "documentation",
          source: "Business rules documentation §3.2",
          stance: "supports",
        },
      ],
    },

    // === Temporal: expiry visibility within 5 seconds ===
    {
      id: "sem://reservation/assertion/expiry-visibility-within-5s",
      subject: "sem://reservation/event/reservation-expired",
      predicate: "observable_within",
      object: { kind: "literal", value: "5s", datatype: "duration" as const },
      kind: "temporal",
      epistemicStatus: "asserted",
      confidence: 0.9,
      evidence: [
        {
          type: "documentation",
          source: "SLA requirements document",
          stance: "supports",
        },
      ],
    },

    // === Failure: payment retry must not duplicate charge ===
    {
      id: "sem://reservation/assertion/payment-retry-forbids-duplicate-charge",
      subject: "sem://reservation/action/pay-reservation",
      predicate: "forbids",
      object: "sem://reservation/event/duplicate-charge",
      kind: "failure",
      epistemicStatus: "validated",
      confidence: 0.97,
      conditions: [
        {
          subject: "sem://reservation/action/pay-reservation",
          predicate: "occurs_after",
          object: "sem://reservation/event/payment-accepted",
        },
      ],
      evidence: [
        {
          type: "test",
          source: "PaymentRetryTest#retryDoesNotChargeTwice",
          stance: "supports",
        },
        {
          type: "code",
          source: "StripeAdapter.java:122",
          stance: "supports",
        },
      ],
    },

    // === PaymentAccepted exactly once ===
    {
      id: "sem://reservation/assertion/payment-accepted-exactly-once",
      subject: "sem://reservation/event/payment-accepted",
      predicate: "exactly_once",
      kind: "invariant",
      epistemicStatus: "validated",
      confidence: 0.95,
      evidence: [
        {
          type: "test",
          source: "PaymentIdempotencyTest",
          stance: "supports",
        },
      ],
    },

    // === Reads/Writes for projection ===
    {
      id: "sem://reservation/assertion/create-writes-reservation",
      subject: "sem://reservation/action/create-reservation",
      predicate: "writes",
      object: "sem://reservation/entity/reservation",
      kind: "fact",
      epistemicStatus: "validated",
      confidence: 1.0,
    },
    {
      id: "sem://reservation/assertion/pay-writes-reservation",
      subject: "sem://reservation/action/pay-reservation",
      predicate: "writes",
      object: "sem://reservation/entity/reservation",
      kind: "fact",
      epistemicStatus: "validated",
      confidence: 1.0,
    },
    {
      id: "sem://reservation/assertion/expire-writes-reservation",
      subject: "sem://reservation/action/expire-reservation",
      predicate: "writes",
      object: "sem://reservation/entity/reservation",
      kind: "fact",
      epistemicStatus: "validated",
      confidence: 1.0,
    },
  ],
  "Reservation/Payment Subsystem",
  "Canonical SEMIR MVP reservation domain model"
);
