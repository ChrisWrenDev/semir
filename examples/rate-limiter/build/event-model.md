```mermaid
graph LR
    sem___ratelimit_action_allow_request["AllowRequest"]
    sem___ratelimit_action_refill_tokens["RefillTokens"]
    sem___ratelimit_action_reject_request["RejectRequest"]
    sem___ratelimit_action_reset_bucket["ResetBucket"]
    sem___ratelimit_event_tokens_refilled(["TokensRefilledEvent"])
    sem___ratelimit_event_request_allowed(["RequestAllowedEvent"])
    sem___ratelimit_event_bucket_reset(["BucketResetEvent"])
    sem___ratelimit_event_request_rejected(["RequestRejectedEvent"])
    sem___ratelimit_state_bucket_ready{"BucketReady"}
    sem___ratelimit_state_request_allowed{"RequestAllowed"}
    sem___ratelimit_state_bucket_empty{"BucketEmpty"}
    sem___ratelimit_state_request_rejected{"RequestRejected"}

    sem___ratelimit_action_allow_request -.->|authorized_by| sem___ratelimit_entity_client
    sem___ratelimit_action_allow_request -.->|requires| sem___ratelimit_state_bucket_ready
    sem___ratelimit_event_tokens_refilled ==>|transitions_to| sem___ratelimit_state_bucket_ready
    sem___ratelimit_action_refill_tokens -->|causes| sem___ratelimit_event_tokens_refilled
    sem___ratelimit_action_refill_tokens -.x|[conditional]| sem___ratelimit_event_tokens_refilled
    sem___ratelimit_event_tokens_refilled -.->|observable_within| 1s
    sem___ratelimit_action_allow_request -->|causes| sem___ratelimit_event_request_allowed
    sem___ratelimit_event_request_allowed ==>|transitions_to| sem___ratelimit_state_request_allowed
    sem___ratelimit_state_bucket_empty -.x|forbids| sem___ratelimit_state_request_allowed
    sem___ratelimit_action_reject_request -.->|requires| sem___ratelimit_state_bucket_empty
    sem___ratelimit_action_reject_request -->|causes| sem___ratelimit_event_request_rejected
    sem___ratelimit_action_allow_request -.->|observable_within| 2ms
    sem___ratelimit_event_bucket_reset ==>|transitions_to| sem___ratelimit_state_bucket_ready
    sem___ratelimit_action_reset_bucket -->|causes| sem___ratelimit_event_bucket_reset
    sem___ratelimit_event_request_rejected ==>|transitions_to| sem___ratelimit_state_request_rejected
```
