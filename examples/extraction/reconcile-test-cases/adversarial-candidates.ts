import { CandidateAssertion } from "../../../src/extract/interpret-candidates.ts";

/**
 * Adversarial test cases for role-aware semantic identity reconciliation.
 *
 * RFC 0010 categories:
 * 1. Different names, same meaning → should merge (concept reconciliation)
 * 2. Similar names, different meaning → should remain separate
 * 3. Same object, different subjects → should remain separate (role-confusion trap)
 * 4. Different abstraction levels → chain, not collapse
 * 5. Same subject, different objects → should remain separate
 * 6. Same triple, different predicates → should remain separate
 * 7. Same triple, different constraints → should remain separate
 */

// --- Category 1: Different names, same meaning ---

const paymentAcceptedSameMeaning: CandidateAssertion[] = [
  {
    id: "candidate://PaymentService.ts:causes-PaymentAccepted",
    subject: "processPayment",
    predicate: "causes",
    object: "PaymentAccepted",
    kind: "postcondition",
    epistemicStatus: "inferred",
    confidence: 0.85,
    evidence: [{ source: "PaymentService.ts", detail: "reservation.status = 'paid'" }],
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
    evidence: [{ source: "PaymentController.test.ts", detail: "expect(result.paid).toBe(true)" }],
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
    evidence: [{ source: "AuditLogger.ts", detail: 'record("payment-complete")' }],
    reasoning: "Audit log records payment completion",
  },
  {
    id: "candidate://API-response:causes-paymentStatus-accepted",
    subject: "PaymentController",
    predicate: "causes",
    object: "paymentStatus: accepted",
    kind: "postcondition",
    epistemicStatus: "inferred",
    confidence: 0.80,
    evidence: [{ source: "API-response.json", detail: 'paymentStatus: "accepted"' }],
    reasoning: "API response includes accepted status",
  },
];

// --- Category 2: Similar names, different meaning ---

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
    evidence: [{ source: "ReservationService.ts", detail: "reservation.state = 'paid'" }],
    reasoning: "PaymentAccepted event transitions to Paid state",
  },
];

// --- Category 3: Same object, different subjects (role-confusion trap) ---

const sameObjectDifferentSubjects: CandidateAssertion[] = [
  {
    id: "candidate://payReservation:requires-active",
    subject: "payReservation",
    predicate: "requires",
    object: "active",
    kind: "precondition",
    epistemicStatus: "inferred",
    confidence: 0.80,
    evidence: [{ source: "ReservationService.ts", detail: "reservation.state !== 'active'" }],
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
    evidence: [{ source: "ExpiryWorker.ts", detail: "reservation.state !== 'active'" }],
    reasoning: "processExpiry requires active state to check expiry",
  },
];

// --- Category 4: Different abstraction levels ---

const abstractionLevels: CandidateAssertion[] = [
  {
    id: "candidate://RateLimiter:causes-RateLimitExceeded",
    subject: "RateLimiter",
    predicate: "causes",
    object: "RateLimitExceeded",
    kind: "postcondition",
    epistemicStatus: "inferred",
    confidence: 0.90,
    evidence: [{ source: "RateLimiter.ts", detail: "if (count > limit) throw RateLimitExceeded" }],
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
    evidence: [{ source: "Middleware.ts", detail: "catch (RateLimitExceeded) { return 429 }" }],
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
    evidence: [{ source: "Middleware.ts", detail: "return { status: 429 }" }],
    reasoning: "Request rejection maps to HTTP 429 status",
  },
];

// --- Category 5: Same subject, different objects ---

const sameSubjectDifferentObjects: CandidateAssertion[] = [
  {
    id: "candidate://payReservation:requires-active-5",
    subject: "payReservation",
    predicate: "requires",
    object: "active",
    kind: "precondition",
    epistemicStatus: "inferred",
    confidence: 0.80,
    evidence: [{ source: "ReservationService.ts", detail: "reservation.state !== 'active'" }],
    reasoning: "PayReservation requires active state",
  },
  {
    id: "candidate://payReservation:requires-auth-5",
    subject: "payReservation",
    predicate: "requires",
    object: "authenticated",
    kind: "precondition",
    epistemicStatus: "inferred",
    confidence: 0.75,
    evidence: [{ source: "ReservationService.ts", detail: "if (!user) return unauthorized" }],
    reasoning: "PayReservation requires authenticated user",
  },
];

// --- Category 6: Same triple, different predicates ---

const sameTripleDifferentPredicates: CandidateAssertion[] = [
  {
    id: "candidate://PaymentAccepted:causes-Paid-6",
    subject: "PaymentAccepted",
    predicate: "causes",
    object: "Paid",
    kind: "postcondition",
    epistemicStatus: "inferred",
    confidence: 0.85,
    evidence: [{ source: "ReservationService.ts", detail: "reservation.state = 'paid'" }],
    reasoning: "PaymentAccepted causes Paid state",
  },
  {
    id: "candidate://PaymentAccepted:requires-Paid-6",
    subject: "PaymentAccepted",
    predicate: "requires",
    object: "Paid",
    kind: "precondition",
    epistemicStatus: "inferred",
    confidence: 0.70,
    evidence: [{ source: "ReservationService.ts", detail: "assert(reservation.state === 'paid')" }],
    reasoning: "PaymentAccepted requires Paid state to exist",
  },
];

// --- Category 7: Same triple, different constraints ---

const sameTripleDifferentConstraints: CandidateAssertion[] = [
  {
    id: "candidate://payReservation:auth-owner-7",
    subject: "payReservation",
    predicate: "authorized_by",
    object: "User",
    kind: "security",
    epistemicStatus: "inferred",
    confidence: 0.80,
    evidence: [{ source: "ReservationService.ts", detail: "reservation.ownerId !== payerId" }],
    reasoning: "PayReservation authorized by User where user == reservation.owner",
  },
  {
    id: "candidate://payReservation:auth-org-7",
    subject: "payReservation",
    predicate: "authorized_by",
    object: "User",
    kind: "security",
    epistemicStatus: "inferred",
    confidence: 0.70,
    evidence: [{ source: "ReservationService.ts", detail: "user.organisationId === reservation.organisationId" }],
    reasoning: "PayReservation authorized by User where user.organisation == reservation.organisation",
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
    name: "category-3-same-object-different-subjects",
    description: "Same object 'active', different subjects — should NOT merge (role-confusion trap)",
    candidates: sameObjectDifferentSubjects,
    expectedSame: [],
    expectedDistinct: [
      ["candidate://payReservation:requires-active", "candidate://processExpiry:requires-active"],
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
  {
    name: "category-5-same-subject-different-objects",
    description: "Same subject, different objects — should NOT merge",
    candidates: sameSubjectDifferentObjects,
    expectedSame: [],
    expectedDistinct: [
      ["candidate://payReservation:requires-active-5", "candidate://payReservation:requires-auth-5"],
    ],
  },
  {
    name: "category-6-same-triple-different-predicates",
    description: "Same triple, different predicates — should NOT merge",
    candidates: sameTripleDifferentPredicates,
    expectedSame: [],
    expectedDistinct: [
      ["candidate://PaymentAccepted:causes-Paid-6", "candidate://PaymentAccepted:requires-Paid-6"],
    ],
  },
  {
    name: "category-7-same-triple-different-constraints",
    description: "Same triple, different constraints — should NOT merge",
    candidates: sameTripleDifferentConstraints,
    expectedSame: [],
    expectedDistinct: [
      ["candidate://payReservation:auth-owner-7", "candidate://payReservation:auth-org-7"],
    ],
  },
];
