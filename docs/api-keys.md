# Stockora Enterprise — Developer API Keys & Authentication

## 1. Overview

Stockora Enterprise provides tenant-scoped developer API keys with cryptographic SHA-256 hashing at rest, granular permission scopes, rate limits, and Phase 44 plan-based enforcement.

## 2. API Key Format
```text
sk_live_key_<8-byte-id>_<24-byte-secret>
```

* **One-Time Reveal:** Raw secret is returned once upon creation.
* **Storage:** Only SHA-256 hash and `prefix` (e.g. `sk_live_key_a1b2...`) are retained.

## 3. Scopes & Permissions
* `products:read`, `products:write`
* `inventory:read`, `inventory:write`
* `orders:read`, `orders:write`
* `customers:read`, `customers:write`
* `suppliers:read`, `suppliers:write`
* `reports:read`, `finance:read`
* `webhooks:manage`

## 4. Usage in HTTP Requests
```http
GET /api/v1/products HTTP/1.1
Host: api.stockora.com
Authorization: Bearer sk_live_key_xxxx_yyyy
```
Or via header:
```http
X-API-Key: sk_live_key_xxxx_yyyy
```
