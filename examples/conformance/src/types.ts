export type ReservationState = "active" | "paid" | "expired";

export interface Reservation {
  id: string;
  ownerId: string;
  state: ReservationState;
  createdAt: Date;
}

export interface PaymentIntent {
  reservationId: string;
  payerId: string;
}

export interface PaymentResult {
  success: boolean;
  reservationId: string;
  reason?: string;
}
