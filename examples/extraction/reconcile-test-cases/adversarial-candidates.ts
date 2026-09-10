import { CandidateAssertion } from "../../../src/extract/interpret-candidates.ts";

/**
 * Adversarial test cases for semantic identity reconciliation.
 *
 * Four categories per RFC 0009:
 * 1. Different names, same meaning → should merge
 * 2. Similar names, different meaning → should remain separate
 * 3. Same representation, different meaning → should not merge
 * 4. Different abstraction levels → chain, not collapse
 */

// --- Category 1: Different names, same meaning ---
// All refer to the same semantic event: a payment was accepted

const paymentAcceptedSameMeaning: CandidateAssertion[] = [
  {
    id: "candidate://PaymentService.ts:causes-PaymentAccepted",
    subject: "processPayment",
    predicate: "causes",
    object: "PaymentAccepted",
    kind: "postcondition",
    epistemicStatus: "inferred",
    confidence: 0.85,
    evidence: [
      { source: "PaymentService.ts", detail: "reservation.status = 'paid'" },
    ],
    reasoning: "Service sets status to paid after payment",
  },
  {
    id: "candidate://PaymentController.test.ts:causes-result.paid",
    subject: "handlePayment",
    predicate: "causes",
    object: "result.paid",
    kind: "postcondition",
    epistemicStatus: "inferred",
    confidence: 0.75,
    evidence: [
      { source: "PaymentController.test.ts", detail: "expect(result.paid).toBe(true)" },
    ],
    reasoning: "Test confirms payment result is true",
  },
  {
    id: "candidate://AuditLogger.ts:causes-payment-complete",
    subject: "recordPayment",
    predicate: "causes",
    object: "payment-complete",
    kind: "postcondition",
    epistemicStatus: "inferred",
    confidence: 0.70,
    evidence: [
      { source: "AuditLogger.ts", detail: 'record("payment-complete")' },
    ],
    reasoning: "Audit log records payment completion",
  },
  {
    id: "candidate://migration:transitions_to-payment_completed_at",
    subject: "payment_migration",
    predicate: "transitions_to",
    object: "payment_completed_at",
    kind: "postcondition",
    epistemicStatus: "inferred",
    confidence: 0.65,
    evidence: [
      { source: "migration.sql", detail: "ALTER TABLE ADD payment_completed_at" },
    ],
    reasoning: "Database tracks payment completion timestamp",
  },
  {
    id: "candidate://API-response:causes-paymentStatus-accepted",
    subject: "PaymentController",
    predicate: "causes",
    object: "paymentStatus: accepted",
    kind: "postcondition",
    epistemicStatus: "inferred",
    confidence: 0.80,
    evidence: [
      { source: "API-response.json", detail: 'paymentStatus: "accepted"' },
    ],
    reasoning: "API response includes accepted status",
  },
];

// --- Category 2: Similar names, different meaning ---
// PaymentAccepted (event) and ReservationPaid (state) are causally related, not the same

const paymentAcceptedVsReservationPaid: CandidateAssertion[] = [
  {
    id: "candidate://payReservation:causes-PaymentAccepted",
    subject: "payReservation",
    predicate: "causes",
    object: "PaymentAccepted",
    kind: "postcondition",
    epistemicStatus: "inferred",
    confidence: 0.85,
    evidence: [
      { source: "ReservationService.ts", detail: "reservation.state = 'paid'" },
      { source: "ReservationService.ts", detail: "reservation.ownerId !== payerId guard" },
    ],
    reasoning: "PayReservation function transitions state to paid",
  },
  {
    id: "candidate://state:transitions_to-Paid",
    subject: "PaymentAccepted",
    predicate: "transitions_to",
    object: "Paid",
    kind: "postcondition",
    epistemicStatus: "inferred",
    confidence: 0.75,
    evidence: [
      { source: "ReservationService.ts", detail: "reservation.state = 'paid'" },
    ],
    reasoning: "PaymentAccepted event transitions to Paid state",
  },
];

// --- Category 3: Same representation, different meaning ---
// Two separate boolean guards, both checking "active", but for different purposes

const sameRepresentationDifferentMeaning: CandidateAssertion[] = [
  {
    id: "candidate://payReservation:requires-active",
    subject: "payReservation",
    predicate: "requires",
    object: "active",
    kind: "precondition",
    epistemicStatus: "inferred",
    confidence: 0.80,
    evidence: [
      { source: "ReservationService.ts", detail: "reservation.state !== 'active'" },
    ],
    reasoning: "PayReservation requires active state before payment",
  },
  {
    id: "candidate://processExpiry:requires-active",
    subject: "processExpiry",
    predicate: "requires",
    object: "active",
    kind: "precondition",
    epistemicStatus: "inferred",
    confidence: 0.75,
    evidence: [
      { source: "ExpiryWorker.ts", detail: "reservation.state !== 'active'" },
    ],
    reasoning: "processExpiry requires active state to check expiry",
  },
  {
    id: "candidate://deactivateReservation:writes-inactive",
    subject: "deactivateReservation",
    predicate: "writes",
    object: "inactive",
    kind: "postcondition",
    epistemicStatus: "inferred",
    confidence: 0.70,
    evidence: [
      { source: "AdminService.ts", detail: "reservation.state = 'inactive'" },
    ],
    reasoning: "Deactivation writes inactive state",
  },
];

// --- Category 4: Different abstraction levels ---
// RateLimitExceeded → RequestRejected → HTTP 429

const abstractionLevels: CandidateAssertion[] = [
  {
    id: "candidate://RateLimiter:causes-RateLimitExceeded",
    subject: "RateLimiter",
    predicate: "causes",
    object: "RateLimitExceeded",
    kind: "postcondition",
    epistemicStatus: "inferred",
    confidence: 0.90,
    evidence: [
      { source: "RateLimiter.ts", detail: "if (count > limit) throw RateLimitExceeded" },
    ],
    reasoning: "Rate limiter detects exceeded limit",
  },
  {
    id: "candidate://RateLimitExceeded:causes-RequestRejected",
    subject: "RateLimitExceeded",
    predicate: "causes",
    object: "RequestRejected",
    kind: "postcondition",
    epistemicStatus: "inferred",
    confidence: 0.80,
    evidence: [
      { source: "Middleware.ts", detail: "catch (RateLimitExceeded) { return 429 }" },
    ],
    reasoning: "Rate limit exception causes request rejection",
  },
  {
    id: "candidate://RequestRejected:transitions_to-HTTP_429",
    subject: "RequestRejected",
    predicate: "transitions_to",
    object: "HTTP_429",
    kind: "postcondition",
    epistemicStatus: "inferred",
    confidence: 0.75,
    evidence: [
      { source: "Middleware.ts", detail: "return { status: 429 }" },
    ],
    reasoning: "Request rejection maps to HTTP 429 status",
  },
];

export interface TestCase {
  name: string;
  description: string;
  candidates: CandidateAssertion[];
  expectedSame: string[][];
  expectedDistinct: string[][];
}

export const TEST_CATEGORIES: TestCase[] = [
  {
    name: "category-1-same-meaning",
    description: "Different names, same semantic referent — should merge",
    candidates: paymentAcceptedSameMeaning,
    expectedSame: [
      ["candidate://PaymentService.ts:causes-PaymentAccepted", "candidate://PaymentController.test.ts:causes-result.paid"],
      ["candidate://PaymentService.ts:causes-PaymentAccepted", "candidate://AuditLogger.ts:causes-payment-complete"],
      ["candidate://PaymentService.ts:causes-PaymentAccepted", "candidate://API-response:causes-paymentStatus-accepted"],
      ["candidate://PaymentController.test.ts:causes-result.paid", "candidate://AuditLogger.ts:causes-payment-complete"],
    ],
    expectedDistinct: [],
  },
  {
    name: "category-2-different-meaning",
    description: "Similar names, causally related but distinct — should NOT merge",
    candidates: paymentAcceptedVsReservationPaid,
    expectedSame: [],
    expectedDistinct: [
      ["candidate://payReservation:causes-PaymentAccepted", "candidate://state:transitions_to-Paid"],
    ],
  },
  {
    name: "category-3-same-representation",
    description: "Same syntax 'active', different semantic roles — should NOT merge",
    candidates: sameRepresentationDifferentMeaning,
    expectedSame: [],
    expectedDistinct: [
      ["candidate://payReservation:requires-active", "candidate://processExpiry:requires-active"],
      ["candidate://payReservation:requires-active", "candidate://deactivateReservation:writes-inactive"],
    ],
  },
  {
    name: "category-4-abstraction-levels",
    description: "Different abstraction levels — should form chain, not collapse",
    candidates: abstractionLevels,
    expectedSame: [],
    expectedDistinct: [
      ["candidate://RateLimiter:causes-RateLimitExceeded", "candidate://RequestRejected:transitions_to-HTTP_429"],
    ],
  },
];
