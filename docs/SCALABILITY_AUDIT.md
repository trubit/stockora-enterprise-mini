# Scalability Audit & Bottlenecks Report
This document outlines the architecture analysis and scalability bottlenecks identified in the Stockora Enterprise codebase that prevent handling 300,000+ concurrent users, followed by the concrete engineering solutions implemented to resolve them.

---

## 1. Identified Architecture Bottlenecks

### A. In-Memory Data Storage (Severe Data Inconsistency & Memory Leaks)
* **Problem**: In **[`src/server/routes/api.ts`](file:///c:/Users/USER/stockora-enterprise/src/server/routes/api.ts)**, products and transactions are stored using standard in-memory arrays (`mockProducts` and `mockTransactions`).
* **Why it fails under load**: 
  1. **Memory Exhaustion**: Storing 300,000+ users' transactions and products inside the Node.js V8 heap will quickly hit memory limits, resulting in `Out of Memory (OOM)` process crashes.
  2. **Cluster Incompatibility**: If we fork multiple processes to utilize multi-core server hardware, each process will maintain its own private in-memory array copy. Products created on worker A will never show up on worker B.

### B. Single-Threaded Node.js Event Loop (Single Process)
* **Problem**: The server in **[`src/server/index.ts`](file:///c:/Users/USER/stockora-enterprise/src/server/index.ts)** executes on a single process thread (`httpServer.listen`).
* **Why it fails under load**: It utilizes only 1 CPU core. If the host machine has 16 or 32 cores, 95%+ of CPU computing power is completely unused, causing incoming request loops to block and time out under high throughput.

### C. Isolated WebSockets (No Multi-Process Pub/Sub)
* **Problem**: Socket.IO in **[`src/server/sockets/manager.ts`](file:///c:/Users/USER/stockora-enterprise/src/server/sockets/manager.ts)** is initialized as a standalone server without any adapters.
* **Why it fails under load**: Once clustered processes are running, a WebSocket message emitted by process A (such as stock updates or transaction updates) will only reach clients connected to process A. It fails to distribute events globally across processes.

### D. Tiny Database Connection Pool Size
* **Problem**: In **[`src/server/database/connection.ts`](file:///c:/Users/USER/stockora-enterprise/src/server/database/connection.ts)**, Mongoose connects with `maxPoolSize: 10`.
* **Why it fails under load**: 300k concurrent users trying to perform actions will immediately exhaust the 10 connections. Requests will block in queue and time out with `serverSelectionTimeoutMS` errors.

### E. No Caching Layer
* **Problem**: Every query fetching list of products or transactions hits the data store directly.
* **Why it fails under load**: Standard database systems cannot handle 300k direct concurrent reads without severe CPU throttling. 

### F. No Payload Compression
* **Problem**: Express does not apply compression algorithms (like Gzip/Brotli) to outgoing responses.
* **Why it fails under load**: Serving raw, uncompressed JSON data sets for products and transaction list responses to 300k+ users consumes massive networking bandwidth, driving up latency and network egress costs.

---

## 2. Implemented Engineering Solutions & Fixes

To achieve Promax performance capable of scaling to 300,000+ concurrent users, we are applying the following systemic upgrades:

### 1. Database Model Migration & Indexing
* **Product Model**: Created a persistent `Product` Mongoose model with compound indexes on `sku` and `isActive` for fast lookups.
* **Transaction Model**: Created a persistent `Transaction` Mongoose model with indexed fields on `transactionNumber`, `cashierId`, and `branchId`.

### 2. Node.js Clustering (CPU Multi-Threading)
* Configured `src/server/index.ts` to utilize the native Node.js `cluster` module. This forks a worker process on every CPU core, sharing the same HTTP port and scaling capacity natively based on hardware limits.

### 3. Socket.IO Redis Pub/Sub Adapter
* Configured `@socket.io/redis-adapter` inside the Socket.io manager, using Redis client instances to seamlessly forward events across clustered worker processes.

### 4. Scaled Mongoose Connection Pool
* Upgraded the Mongoose database connection configuration:
  * `maxPoolSize` scaled from `10` to `200` to allow parallel database connections.
  * Added `minPoolSize: 20` to keep active connections warmed up.
  * Configured socket timeouts and keep-alive rules for socket stability.

### 5. Redis Caching Middleware (Sub-Millisecond Read Times)
* Integrated Redis caching for GET `/products` and GET `/transactions` endpoints:
  * Cache hits are resolved in sub-milliseconds from Redis, bypassing MongoDB.
  * Configured caching invalidation (`redis.del('products:all')`) whenever a new product is created, updated, or when transaction processing decreases inventory levels.

### 6. Express Payload Compression
* Enabled `compression()` middleware to dynamically compress outgoing JSON payloads, lowering bandwidth usage by up to 80%.
