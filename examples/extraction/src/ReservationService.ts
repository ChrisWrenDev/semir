import { Reservation, User } from "./types.js";

export class ReservationService {
  private reservations = new Map<string, Reservation>();

  createReservation(id: string, ownerId: string, orgId: string): Reservation {
    const reservation: Reservation = {
      id,
      ownerId,
      organisationId: orgId,
      state: "active",
      createdAt: new Date(),
    };
    this.reservations.set(id, reservation);
    return reservation;
  }

  // AMBIGUOUS: is this "owner" or "same organisation"?
  canPay(user: User, reservation: Reservation): boolean {
    return user.organisationId === reservation.organisationId;
  }

  payReservation(reservationId: string, payerId: string): { success: boolean; reason?: string } {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      return { success: false, reason: "not_found" };
    }

    // AUTHORIZATION: checks organisation membership
    if (reservation.ownerId !== payerId) {
      return { success: false, reason: "unauthorized" };
    }

    // PRECONDITION: must be active
    if (reservation.state !== "active") {
      return { success: false, reason: "not_active" };
    }

    // CAUSES: payment accepted
    reservation.state = "paid";
    return { success: true };
  }

  getReservation(id: string): Reservation | undefined {
    return this.reservations.get(id);
  }
}
