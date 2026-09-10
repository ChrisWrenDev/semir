import { describe, it, expect } from "vitest";
import { ReservationService } from "../src/ReservationService.js";
import { ExpiryWorker } from "../src/ExpiryWorker.js";

describe("Reservation Expiry", () => {
  it("paid reservation never expires", () => {
    const service = new ReservationService();
    service.createReservation("r1", "alice", "org1");
    service.payReservation("r1", "alice");

    const worker = new ExpiryWorker((id) => service.getReservation(id));
    const result = worker.processExpiry("r1");
    expect(result.expired).toBe(false);
    expect(result.reason).toBe("paid_cannot_expire");
  });

  it("unpaid reservation can expire", () => {
    const service = new ReservationService();
    const reservation = service.createReservation("r2", "bob", "org2");
    reservation.createdAt = new Date(Date.now() - 31 * 60 * 1000);

    const worker = new ExpiryWorker((id) => service.getReservation(id));
    const result = worker.processExpiry("r2");
    expect(result.expired).toBe(true);
  });
});
