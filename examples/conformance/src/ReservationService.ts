import { Reservation, ReservationState, PaymentResult } from "./types.js";

export class ReservationService {
  private reservations = new Map<string, Reservation>();

  createReservation(id: string, ownerId: string): Reservation {
    const reservation: Reservation = {
      id,
      ownerId,
      state: "active",
      createdAt: new Date(),
    };
    this.reservations.set(id, reservation);
    return reservation;
  }

  // PAY RESERVATION — requires active state and owner authorization
  payReservation(reservationId: string, payerId: string): PaymentResult {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      return { success: false, reservationId, reason: "not_found" };
    }

    // AUTHORIZATION: only owner may pay
    if (reservation.ownerId !== payerId) {
      return { success: false, reservationId, reason: "unauthorized" };
    }

    // PRECONDITION: must be active
    if (reservation.state !== "active") {
      return { success: false, reservationId, reason: "not_active" };
    }

    // CAUSES: payment accepted → transitions to paid
    reservation.state = "paid";
    return { success: true, reservationId };
  }

  getReservation(id: string): Reservation | undefined {
    return this.reservations.get(id);
  }
}
