# Paystack Gateway SaaS Billing Integration

## 1. Overview
All SaaS subscription charges and payment transactions in Stockora are processed exclusively through **Paystack**.

---

## 2. Payment Flow & Price Manipulation Protection

```text
Client requests checkout
         ↓
POST /billing/subscription/initialize
         ↓
Backend fetches authoritative price from Plan model (Prevents price tampering)
         ↓
Paystack transaction initialized (Amount in kobo)
         ↓
User redirected to Paystack / Checkout modal
         ↓
POST /billing/subscription/verify (or Webhook)
         ↓
Backend directly verifies reference + expected amount with Paystack API
         ↓
Subscription activated + SaaS invoice generated
```

---

## 3. Environment Variables

```env
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...
PAYSTACK_WEBHOOK_SECRET=sk_test_...
```
