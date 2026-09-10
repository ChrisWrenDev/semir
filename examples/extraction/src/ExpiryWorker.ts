import { Reservation } from "./types.js";

const EXPIRY_TIMEOUT_MS = 30 * 60 * 1000;

export class ExpiryWorker {
  private reservationGetter: (id: string) => Reservation | undefined;

  constructor(reservationGetter: (id: string) => Reservation | undefined) {
    this.reservationGetter = reservationGetter;
  }

  processExpiry(reservationId: string): { expired: boolean; reason?: string } {
    const reservation = this.reservationGetter(reservationId);
    if (!reservation) {
      return { expired: false, reason: "not_found" };
    }

    // PAID GUARD: paid reservations cannot expire
    if (reservation.state === "paid") {
      return { expired: false, reason: "paid_cannot_expire" };
    }

    if (reservation.state !== "active") {
      return { expired: false, reason: "not_active" };
    }

    const elapsed = Date.now() - reservation.createdAt.getTime();
    if (elapsed >= EXPIRY_TIMEOUT_MS) {
      reservation.state = "expired";
      return { expired: true };
    }

    return { expired: false, reason: "not_yet_expired" };
  }
}
