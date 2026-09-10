import { describe, it, expect } from "vitest";
import { ReservationService } from "../src/ReservationService.js";

describe("Payment Authorization", () => {
  it("only reservation owner can pay", () => {
    const service = new ReservationService();
    service.createReservation("r1", "alice", "org1");

    const result = service.payReservation("r1", "alice");
    expect(result.success).toBe(true);
  });

  it("non-owner cannot pay reservation", () => {
    const service = new ReservationService();
    service.createReservation("r1", "alice", "org1");

    const result = service.payReservation("r1", "charlie");
    expect(result.success).toBe(false);
    expect(result.reason).toBe("unauthorized");
  });
});
