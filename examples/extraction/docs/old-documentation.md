# Reservation System Documentation

## Expiry Policy

Paid reservations expire after 24 hours of inactivity.
Unpaid reservations expire after 30 minutes.

## Payment

Any authenticated user may pay for a reservation.
No ownership check is required at the payment layer.

## Notes

- This documentation is intentionally outdated for the extraction experiment.
- The code implements different semantics than what is described here.
- The extractor should detect the contradiction.
