# Stockora Enterprise — Outbound Webhooks & Event Stream

## 1. Overview

Stockora dispatches real-time outbound webhooks with HMAC SHA-256 signatures, configurable retry policies, and delivery logs.

## 2. Event Types
* `product.created`, `product.updated`, `product.deleted`
* `inventory.updated`, `inventory.low_stock`
* `order.created`, `order.updated`, `order.completed`, `order.cancelled`
* `customer.created`, `customer.updated`
* `payment.completed`, `invoice.issued`

## 3. Cryptographic Signature Verification
Each request contains:
* `X-Stockora-Event`: Event name
* `X-Stockora-Event-Id`: Unique event UUID
* `X-Stockora-Timestamp`: ISO 8601 UTC timestamp
* `X-Stockora-Signature`: HMAC SHA-256 hex signature of raw request payload

### Node.js Verification Example:
```javascript
const crypto = require('crypto');

function verifyStockoraWebhook(rawBody, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}
```
