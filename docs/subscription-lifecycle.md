# Subscription Lifecycle Management

## 1. Lifecycle States

```text
[TRIALING] ──(Trial Expires)──> [EXPIRED]
    │                               │
(Checkout)                     (Checkout)
    ↓                               ↓
 [ACTIVE] <─────────────────────────┘
    │
    ├─► (Renewal Success) ──► [ACTIVE]
    ├─► (Renewal Fail)    ──► [PAST_DUE] ──(Grace Period Expiry)──► [PAUSED]
    └─► (Cancel)          ──► [CANCELLED]
```

---

## 2. Cancellation and Reactivation
- **Cancel At Period End**: Tenant retains access until `currentPeriodEnd`; status remains `ACTIVE` with `cancelAtPeriodEnd: true`.
- **Reactivate**: If cancellation is scheduled for period-end, the tenant can click "Reactivate" to clear the pending cancellation.
- **Immediate Cancellation**: Terminates subscription instantly and updates status to `CANCELLED`.
