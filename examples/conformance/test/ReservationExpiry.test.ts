import { describe, it, expect, beforeEach } from "vitest";
import { ReservationService } from "../src/ReservationService.js";
import { ExpiryWorker } from "../src/ExpiryWorker.js";

describe("Reservation Expiry", () => {
  let service: ReservationService;
  let worker: ExpiryWorker;

  beforeEach(() => {
    service = new ReservationService();
    worker = new ExpiryWorker((id) => service.getReservation(id));
  });

  it("paid reservation never expires", () => {
    const reservation = service.createReservation("r1", "alice");
    service.payReservation("r1", "alice");

    const result = worker.processExpiry("r1");
    expect(result.expired).toBe(false);
    expect(result.reason).toBe("paid_cannot_expire");
  });

  it("unpaid active reservation can expire", () => {
    const reservation = service.createReservation("r2", "bob");
    // Simulate time passing by backdating
    reservation.createdAt = new Date(Date.now() - 31 * 60 * 1000);

    const result = worker.processExpiry("r2");
    expect(result.expired).toBe(true);
  });
});

describe("Payment Authorization", () => {
  let service: ReservationService;

  beforeEach(() => {
    service = new ReservationService();
  });

  it("only owner may pay", () => {
    service.createReservation("r1", "alice");

    const ownerResult = service.payReservation("r1", "alice");
    expect(ownerResult.success).toBe(true);

    const service2 = new ReservationService();
    service2.createReservation("r2", "bob");
    const nonOwnerResult = service2.payReservation("r2", "charlie");
    expect(nonOwnerResult.success).toBe(false);
    expect(nonOwnerResult.reason).toBe("unauthorized");
  });
});
