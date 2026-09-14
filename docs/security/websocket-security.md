# Stockora Enterprise — WebSocket & Real-Time Security

## 1. Overview
Real-time Socket.IO streams distribute POS checkout updates, stock quantity changes, inventory notifications, and chat events.

---

## 2. Security Controls
1. **Connection Authentication**: Handshake requests require a valid JWT token. Unauthenticated connections are terminated.
2. **Room Scoping by Tenant**: Sockets automatically join isolated rooms keyed by tenant (`room:tenant:{tenantId}`). A socket from Tenant A cannot join or receive broadcasts meant for Tenant B.
3. **Payload Sanitization**: Inbound client socket events are validated with Zod schemas.
4. **Rate Limiting on Socket Events**: High-frequency socket emissions are throttled to prevent server resource exhaustion.
