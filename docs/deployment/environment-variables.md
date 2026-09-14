# Stockora Enterprise — Production Environment Variables Reference

## 1. Complete Environment Variables Matrix

| Variable Name | Required | Default / Format | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Optional | `8080` | Port for Express HTTP server to listen on. |
| `NODE_ENV` | **Required** | `production` | Node execution environment (`production`, `staging`, `test`). |
| `CORS_ORIGIN` | **Required** | `https://app.stockora.enterprise` | Comma-separated list of allowed frontend origins for CORS. |
| `FRONTEND_URL` | **Required** | `https://app.stockora.enterprise` | Canonical URL of the client application. |
| `COOKIE_SECRET` | **Required** | 64-char Hex | Cryptographic secret for signing HTTP-only cookies. |
| `SECURE_COOKIES` | **Required** | `true` | Enforces `Secure` flag on all session cookies over HTTPS. |
| `MONGODB_URI` | **Required** | `mongodb+srv://...` | Connection string for MongoDB ReplicaSet with TLS. |
| `REDIS_URL` | **Required** | `rediss://...` | Connection URL for Redis with TLS enabled. |
| `JWT_SECRET` | **Required** | 64-char Hex | HMAC-SHA256 secret for signing access tokens (15m expiration). |
| `JWT_REFRESH_SECRET`| **Required** | 64-char Hex | HMAC-SHA256 secret for signing refresh tokens (7d expiration). |
| `RATE_LIMIT_WINDOW_MS`| Optional | `900000` (15m) | Rate limiting evaluation window in milliseconds. |
| `RATE_LIMIT_MAX` | Optional | `100` | Max requests per IP within the rate limiting window. |
| `CLOUDINARY_CLOUD_NAME`| **Required** | String | Cloudinary cloud account name. |
| `CLOUDINARY_API_KEY` | **Required** | String | Cloudinary public API identifier. |
| `CLOUDINARY_API_SECRET`| **Required** | Secret | Cloudinary private API secret. |
| `BREVO_API_KEY` | **Required** | Secret | Brevo HTTPS transactional email API key. |
| `BREVO_SENDER_EMAIL` | **Required** | `noreply@stockora.enterprise` | Verified sender email address. |
| `PAYSTACK_SECRET_KEY` | **Required** | `sk_live_...` | Live Paystack secret gateway key. |
| `PAYSTACK_PUBLIC_KEY` | **Required** | `pk_live_...` | Live Paystack public browser key. |
| `PAYSTACK_WEBHOOK_SECRET`| **Required**| Secret | Paystack webhook cryptographic validation signature. |
| `STRIPE_SECRET_KEY` | **Required** | `sk_live_...` | Live Stripe secret gateway key. |
| `STRIPE_WEBHOOK_SECRET` | **Required** | `whsec_...` | Stripe webhook cryptographic signing secret. |
| `GEMINI_API_KEY` | Optional | Secret | Google Gemini Cloud AI Studio API key. |
