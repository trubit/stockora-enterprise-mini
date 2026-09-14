# Stockora Enterprise — Production Architecture Specification

## 1. System Topology Overview

Stockora Enterprise operates as a cloud-native, multi-tenant enterprise resource planning and point-of-sale platform.

```
                                  [ Internet / Clients ]
                                             |
                                   [ Cloudflare / Route53 ]
                                             |  (HTTPS 443 / TLS 1.3)
                              [ AWS Application Load Balancer ]
                                             |
                  +--------------------------+--------------------------+
                  |                                                     |
        [ Client Pods (Nginx) ]                               [ Server API Pods (NodeJS) ]
        - React 18 + Vite + TS                                - Express + TypeScript
        - Zustand State Management                            - BullMQ Queue Producer/Worker
        - Static Asset Compression                            - Socket.IO Multi-Tenant Rooms
                  |                                                     |
                  +--------------------------+--------------------------+
                                             |
             +-------------------------------+-------------------------------+
             |                               |                               |
    [ DocumentDB / MongoDB ]          [ Redis Cluster ]              [ External Gateways ]
    - 3-node ReplicaSet               - Cluster Mode Enabled         - Stripe PaymentIntent API
    - SCRAM-SHA-256 + TLS             - Session Cache / BullMQ       - Paystack Direct Checkout
    - Automated Daily Snapshots       - Rate Limiter Store           - Brevo Email API / SMTP
    - Tenant Compound Indexes         - Socket.IO Adapter            - Google Gemini AI Engine
```

## 2. Component Specifications

### 2.1 Frontend Tier (Client Pods)
- **Container**: Nginx Alpine serving pre-compiled React 18 / TypeScript SPA.
- **Routing**: Client-side React Router 6 with HTML5 pushState fallback in Nginx.
- **Security Headers**: HSTS, CSP, X-Frame-Options (`DENY`), X-Content-Type-Options (`nosniff`).

### 2.2 Backend Tier (API Pods)
- **Runtime**: Node.js 22 LTS (Alpine) executing transpiled TypeScript (`dist/server`).
- **Framework**: Express with strict middleware chaining:
  1. Request correlation ID injector (`X-Correlation-ID`).
  2. Rate limiting & DDoS mitigation.
  3. Tenant context resolution (`Tenant` model lookup & isolation validation).
  4. Authentication (`JWT` access token validation via cookie/header).
  5. RBAC permission evaluation.
- **Resilience**: Integrated `ResilientExecutor` wrapping external calls with Bulkheads and Circuit Breakers.

### 2.3 Data & Storage Tier
- **Primary Database**: MongoDB 8.0 / AWS DocumentDB with compound indexes on `{ tenantId, createdAt }`, `{ tenantId, sku }`, `{ tenantId, status }`.
- **Cache / Distributed State**: Redis 7.2 with maxmemory-lru eviction.
- **File & Media Storage**: Cloudinary secure signed upload URLs.
