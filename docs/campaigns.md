# Multi-Channel Marketing Campaigns & Queue Engine

## Overview
Coordinates targeted promotional, win-back, and transactional communications across Email, SMS, WhatsApp, Push, and In-App channels.

### Delivery Lifecycle
1. **Creation & Validation**: Target segment filtering, consent validation (`optInMarketing`, `communicationPreferences`), and template placeholders (`{{name}}`, `{{coupon}}`, `{{tier}}`).
2. **Scheduling**: Immediate dispatch or scheduled background execution via BullMQ queues.
3. **Idempotency & Resiliency**: Unique idempotency key `CAMP:<campaignId>:<customerId>` prevents duplicate message sends. Temporary failures retry with exponential backoff and jitter.
4. **Analytics**: Tracks Sent, Delivered, Opened, Clicked, Failed, and Converted revenue.
