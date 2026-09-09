```mermaid
graph LR
    sem___reservation_action_pay_reservation["PayReservation"]
    sem___reservation_action_expire_reservation["ExpireReservation"]
    sem___ratelimit_action_check_rate_limit["CheckRateLimit"]
    sem___composition_action_pay_with_rate_limit["PayWithRateLimit"]
    sem___ratelimit_action_refill_tokens["RefillTokens"]
    sem___reservation_event_payment_accepted(["PaymentAccepted"])
    sem___reservation_event_reservation_expired(["ReservationExpired"])
    sem___ratelimit_event_request_allowed(["RequestAllowed"])
    sem___ratelimit_event_tokens_refilled(["TokensRefilled"])
    sem___ratelimit_event_request_rejected(["RequestRejected"])
    sem___composition_event_payment_blocked_by_rate_limit(["PaymentBlockedByRateLimit"])
    sem___reservation_state_paid{"Paid"}
    sem___reservation_state_expired{"Expired"}
    sem___reservation_state_active{"Active"}
    sem___ratelimit_state_bucket_ready{"BucketReady"}
    sem___ratelimit_state_bucket_empty{"BucketEmpty"}
    sem___ratelimit_state_request_allowed{"RequestAllowed"}

    sem___reservation_action_pay_reservation -->|causes| sem___reservation_event_payment_accepted
    sem___reservation_event_payment_accepted ==>|transitions_to| sem___reservation_state_paid
    sem___reservation_state_paid -.x|forbids| sem___reservation_state_expired
    sem___reservation_event_reservation_expired ==>|transitions_to| sem___reservation_state_expired
    sem___reservation_action_expire_reservation -->|causes| sem___reservation_event_reservation_expired
    sem___reservation_action_expire_reservation -.->|requires| sem___reservation_state_active
    sem___reservation_action_pay_reservation -.->|requires| sem___reservation_state_active
    sem___reservation_action_pay_reservation -.->|authorized_by| sem___reservation_actor_owner
    sem___ratelimit_action_check_rate_limit -.->|authorized_by| sem___reservation_actor_owner
    sem___ratelimit_action_check_rate_limit -.->|requires| sem___ratelimit_state_bucket_ready
    sem___ratelimit_action_check_rate_limit -->|causes| sem___ratelimit_event_request_allowed
    sem___ratelimit_action_check_rate_limit -.->|authorized_by| sem___ratelimit_entity_client
    sem___composition_action_pay_with_rate_limit -->|causes| sem___ratelimit_action_check_rate_limit
    sem___reservation_action_pay_reservation -.->|requires| sem___ratelimit_state_bucket_ready
    sem___ratelimit_event_request_allowed ==>|transitions_to| sem___ratelimit_state_bucket_ready
    sem___ratelimit_event_tokens_refilled ==>|transitions_to| sem___ratelimit_state_bucket_ready
    sem___ratelimit_action_refill_tokens -->|causes| sem___ratelimit_event_tokens_refilled
    sem___composition_action_pay_with_rate_limit -.->|requires| sem___ratelimit_state_bucket_ready
    sem___ratelimit_event_request_rejected -.x|forbids| sem___reservation_event_payment_accepted
    sem___ratelimit_event_request_rejected -->|causes| sem___composition_event_payment_blocked_by_rate_limit
    sem___ratelimit_state_bucket_empty -.x|forbids| sem___ratelimit_state_request_allowed
```
