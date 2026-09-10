import { IntendedAssertion, ComparisonClassification } from "../../../src/extract/compare.ts";
import { CandidateAssertion } from "../../../src/extract/interpret-candidates.ts";

export interface TestCase {
  name: string;
  description: string;
  intended: IntendedAssertion[];
  extracted: CandidateAssertion[];
  expected: Array<{
    intendedId: string;
    extractedId?: string;
    classification: ComparisonClassification;
  }>;
}

// --- Base intended model ---

const BASE_INTENDED: IntendedAssertion[] = [
  {
    id: "sem://reservation/assertion/pay-causes-payment-accepted",
    subject: "PayReservation",
    predicate: "causes",
    object: "PaymentAccepted",
  },
  {
    id: "sem://reservation/assertion/payment-accepted-transitions-to-paid",
    subject: "PaymentAccepted",
    predicate: "transitions_to",
    object: "Paid",
  },
  {
    id: "sem://reservation/assertion/pay-requires-active",
    subject: "PayReservation",
    predicate: "requires",
    object: "Active",
  },
  {
    id: "sem://reservation/assertion/pay-authorized-by-owner",
    subject: "PayReservation",
    predicate: "authorized_by",
    object: "ReservationOwner",
    constraint: "actor == reservation.owner",
  },
  {
    id: "sem://reservation/assertion/paid-reservations-do-not-expire",
    subject: "Paid",
    predicate: "forbids",
    object: "Expired",
  },
  {
    id: "sem://reservation/assertion/expire-requires-active",
    subject: "ExpiryAction",
    predicate: "requires",
    object: "Active",
  },
];

// --- Variant A: Exact implementation ---

const variantAExtracted: CandidateAssertion[] = [
  {
    id: "ext://payReservation:causes-PaymentAccepted",
    subject: "PayReservation",
    predicate: "causes",
    object: "PaymentAccepted",
    kind: "postcondition",
    epistemicStatus: "inferred",
    confidence: 0.90,
    evidence: [{ source: "ReservationService.ts", detail: "reservation.state = 'paid'" }],
    reasoning: "PayReservation transitions state to paid",
  },
  {
    id: "ext://PaymentAccepted:transitions_to-Paid",
    subject: "PaymentAccepted",
    predicate: "transitions_to",
    object: "Paid",
    kind: "postcondition",
    epistemicStatus: "inferred",
    confidence: 0.85,
    evidence: [{ source: "ReservationService.ts", detail: "reservation.state = 'paid'" }],
    reasoning: "PaymentAccepted transitions to Paid state",
  },
  {
    id: "ext://payReservation:requires-active",
    subject: "PayReservation",
    predicate: "requires",
    object: "Active",
    kind: "precondition",
    epistemicStatus: "inferred",
    confidence: 0.80,
    evidence: [{ source: "ReservationService.ts", detail: "reservation.state !== 'active'" }],
    reasoning: "PayReservation requires active state",
  },
  {
    id: "ext://payReservation:authorized_by-owner",
    subject: "PayReservation",
    predicate: "authorized_by",
    object: "ReservationOwner",
    kind: "security",
    epistemicStatus: "inferred",
    confidence: 0.80,
    evidence: [{ source: "ReservationService.ts", detail: "reservation.ownerId !== payerId" }],
    reasoning: "PayReservation authorized by owner",
  },
  {
    id: "ext://Paid:forbids-Expired",
    subject: "Paid",
    predicate: "forbids",
    object: "Expired",
    kind: "invariant",
    epistemicStatus: "inferred",
    confidence: 0.85,
    evidence: [{ source: "ExpiryWorker.ts", detail: "if (reservation.state === 'paid') return" }],
    reasoning: "Paid reservations cannot expire",
  },
  {
    id: "ext://ExpiryAction:requires-active",
    subject: "ExpiryAction",
    predicate: "requires",
    object: "Active",
    kind: "precondition",
    epistemicStatus: "inferred",
    confidence: 0.75,
    evidence: [{ source: "ExpiryWorker.ts", detail: "reservation.state !== 'active'" }],
    reasoning: "ExpiryAction requires active state",
  },
];

// --- Variant B: Changed business rule (expiry 30m → 10m) ---

const variantBExtracted: CandidateAssertion[] = [
  ...variantAExtracted.slice(0, 5),
  {
    id: "ext://ExpiryAction:observable_within-10m",
    subject: "ExpiryAction",
    predicate: "observable_within",
    object: "10m",
    kind: "temporal",
    epistemicStatus: "inferred",
    confidence: 0.70,
    evidence: [{ source: "ExpiryWorker.ts", detail: "EXPIRY_TIMEOUT_MS = 10 * 60 * 1000" }],
    reasoning: "Expiry timeout is 10 minutes",
  },
];

// --- Variant C: Removed enforcement (no authorization) ---

const variantCExtracted: CandidateAssertion[] = variantAExtracted.filter(
  (e) => e.id !== "ext://payReservation:authorized_by-owner"
);

// --- Variant D: Implementation-only behaviour (retry limit) ---

const variantDExtracted: CandidateAssertion[] = [
  ...variantAExtracted,
  {
    id: "ext://PaymentRetry:at_most-3",
    subject: "PaymentRetry",
    predicate: "at_most",
    object: "3 attempts",
    kind: "quantitative",
    epistemicStatus: "inferred",
    confidence: 0.75,
    evidence: [{ source: "PaymentService.ts", detail: "MAX_RETRIES = 3" }],
    reasoning: "Payment retry limited to 3 attempts",
  },
];

// --- Variant E: Stale intended model (implementation changed, intent not updated) ---

const variantEIntended: IntendedAssertion[] = [
  ...BASE_INTENDED.slice(0, 4),
  {
    id: "sem://reservation/assertion/expire-requires-active",
    subject: "ExpiryAction",
    predicate: "requires",
    object: "Active",
  },
];

const variantEExtracted: CandidateAssertion[] = [
  ...variantAExtracted.slice(0, 5),
  {
    id: "ext://ExpiryAction:requires-unpaid",
    subject: "ExpiryAction",
    predicate: "requires",
    object: "Unpaid",
    kind: "precondition",
    epistemicStatus: "inferred",
    confidence: 0.80,
    evidence: [{ source: "ExpiryWorker.ts", detail: "if (reservation.state === 'paid') return" }],
    reasoning: "ExpiryAction requires unpaid state (implementation changed from Active to Unpaid)",
  },
];

export const TEST_VARIANTS: TestCase[] = [
  {
    name: "variant-a-exact",
    description: "Exact implementation — all semantics should match",
    intended: BASE_INTENDED,
    extracted: variantAExtracted,
    expected: [
      { intendedId: "sem://reservation/assertion/pay-causes-payment-accepted", extractedId: "ext://payReservation:causes-PaymentAccepted", classification: "match" },
      { intendedId: "sem://reservation/assertion/payment-accepted-transitions-to-paid", extractedId: "ext://PaymentAccepted:transitions_to-Paid", classification: "match" },
      { intendedId: "sem://reservation/assertion/pay-requires-active", extractedId: "ext://payReservation:requires-active", classification: "match" },
      { intendedId: "sem://reservation/assertion/pay-authorized-by-owner", extractedId: "ext://payReservation:authorized_by-owner", classification: "match" },
      { intendedId: "sem://reservation/assertion/paid-reservations-do-not-expire", extractedId: "ext://Paid:forbids-Expired", classification: "match" },
      { intendedId: "sem://reservation/assertion/expire-requires-active", extractedId: "ext://ExpiryAction:requires-active", classification: "match" },
    ],
  },
  {
    name: "variant-b-drift",
    description: "Changed business rule — expiry timeout changed from 30m to 10m",
    intended: BASE_INTENDED,
    extracted: variantBExtracted,
    expected: [
      { intendedId: "sem://reservation/assertion/pay-causes-payment-accepted", extractedId: "ext://payReservation:causes-PaymentAccepted", classification: "match" },
      { intendedId: "sem://reservation/assertion/expire-requires-active", extractedId: "ext://ExpiryAction:requires-active", classification: "match" },
    ],
  },
  {
    name: "variant-c-removed-enforcement",
    description: "Removed authorization check — owner check deleted",
    intended: BASE_INTENDED,
    extracted: variantCExtracted,
    expected: [
      { intendedId: "sem://reservation/assertion/pay-authorized-by-owner", classification: "unverified_intent" },
      { intendedId: "sem://reservation/assertion/pay-causes-payment-accepted", extractedId: "ext://payReservation:causes-PaymentAccepted", classification: "match" },
    ],
  },
  {
    name: "variant-d-undocumented",
    description: "Implementation-only behaviour — retry limit not in intent",
    intended: BASE_INTENDED,
    extracted: variantDExtracted,
    expected: [
      { intendedId: "undocumented://ext://PaymentRetry:at_most-3", extractedId: "ext://PaymentRetry:at_most-3", classification: "undocumented_behaviour" },
      { intendedId: "sem://reservation/assertion/pay-causes-payment-accepted", extractedId: "ext://payReservation:causes-PaymentAccepted", classification: "match" },
    ],
  },
  {
    name: "variant-e-stale-model",
    description: "Stale intended model — implementation changed, intent not updated",
    intended: variantEIntended,
    extracted: variantEExtracted,
    expected: [
      { intendedId: "sem://reservation/assertion/pay-causes-payment-accepted", extractedId: "ext://payReservation:causes-PaymentAccepted", classification: "match" },
      { intendedId: "sem://reservation/assertion/expire-requires-active", classification: "semantic_drift" },
    ],
  },
];
