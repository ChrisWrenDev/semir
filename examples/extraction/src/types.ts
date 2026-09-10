export type ReservationState = "active" | "paid" | "expired";

export interface Reservation {
  id: string;
  ownerId: string;
  organisationId: string;
  state: ReservationState;
  createdAt: Date;
}

export interface User {
  id: string;
  organisationId: string;
}
