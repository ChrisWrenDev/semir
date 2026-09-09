```mermaid
graph LR
    sem___reservation_action_pay_reservation["PayReservation"]
    sem___reservation_action_expire_reservation["ExpireReservation"]
    sem___reservation_action_create_reservation["CreateReservation"]
    sem___reservation_event_payment_accepted(["PaymentAccepted"])
    sem___reservation_event_reservation_expired(["ReservationExpired"])
    sem___reservation_event_reservation_created(["ReservationCreated"])
    sem___reservation_state_paid{"Paid"}
    sem___reservation_state_expired{"Expired"}
    sem___reservation_state_active{"Active"}

    sem___reservation_action_pay_reservation -->|causes| sem___reservation_event_payment_accepted
    sem___reservation_event_payment_accepted ==>|transitions_to| sem___reservation_state_paid
    sem___reservation_state_paid -.x|forbids| sem___reservation_state_expired
    sem___reservation_event_reservation_expired ==>|transitions_to| sem___reservation_state_expired
    sem___reservation_action_expire_reservation -->|causes| sem___reservation_event_reservation_expired
    sem___reservation_action_expire_reservation -.->|requires| sem___reservation_state_active
    sem___reservation_event_reservation_created ==>|transitions_to| sem___reservation_state_active
    sem___reservation_action_create_reservation -->|causes| sem___reservation_event_reservation_created
    sem___reservation_action_pay_reservation -.->|requires| sem___reservation_state_active
    sem___reservation_action_pay_reservation -.->|authorized_by| sem___reservation_actor_owner
    sem___reservation_action_pay_reservation -.x|[conditional]| sem___reservation_event_duplicate_charge
    sem___reservation_action_expire_reservation -.x|[conditional]| sem___reservation_state_expired
    sem___reservation_action_expire_reservation -.->|[conditional]| sem___reservation_state_active
    sem___reservation_event_reservation_expired -.->|observable_within| 5s
```
