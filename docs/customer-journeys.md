# Automated Customer Lifecycle Journeys & Workflows

## Overview
Automated state machine that executes personalized engagement sequences triggered by customer lifecycle milestones.

### Triggers
- `CUSTOMER_CREATED` (Welcome onboarding)
- `FIRST_PURCHASE` (First-order thank you & loyalty points)
- `LOYALTY_TIER_UPGRADED` (VIP recognition)
- `CHURN_RISK_HIGH` (Automated win-back trigger)
- `INACTIVE_30_DAYS` (Re-engagement digest)

### Action Steps
- `SEND_EMAIL`, `SEND_SMS`, `SEND_PUSH`
- `ISSUE_LOYALTY_POINTS`
- `ISSUE_COUPON`
- `ADD_TAG`
