```mermaid
graph LR
    sem___instance_action_pay_reservation["PayReservation"]
    sem___instance_action_attempt_charge["AttemptCharge"]
    sem___instance_action_block_duplicate["BlockDuplicate"]
    sem___instance_event_charge_created(["ChargeCreated"])
    sem___instance_event_duplicate_blocked(["DuplicateBlockedEvent"])
    sem___instance_event_payment_accepted(["PaymentAccepted"])
    sem___instance_state_active{"Active"}
    sem___instance_state_charged{"Charged"}
    sem___instance_state_duplicate_blocked{"DuplicateBlocked"}
    sem___instance_state_paid{"Paid"}

    sem___instance_action_pay_reservation -.->|requires| sem___instance_state_active
    sem___instance_action_attempt_charge -.->|requires| sem___instance_state_active
    sem___instance_action_attempt_charge -->|causes| sem___instance_event_charge_created
    sem___instance_event_charge_created ==>|transitions_to| sem___instance_state_charged
    sem___instance_action_block_duplicate -.x|[conditional]| sem___instance_event_charge_created
    sem___instance_action_block_duplicate -->|causes| sem___instance_event_duplicate_blocked
    sem___instance_event_duplicate_blocked ==>|transitions_to| sem___instance_state_duplicate_blocked
    sem___instance_action_pay_reservation -.->|authorized_by| sem___instance_actor_owner
    sem___instance_action_pay_reservation -.->|[conditional]| sem___instance_actor_owner
    sem___instance_action_pay_reservation -->|causes| sem___instance_event_payment_accepted
    sem___instance_event_payment_accepted ==>|transitions_to| sem___instance_state_paid
```
