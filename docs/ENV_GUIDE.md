# Stockora Enterprise: Environment Variable Reference

This document details all configuration parameters expected by the environment loader (`src/config/environment.ts`).

## 1. Core Server Parameters
- **PORT**: Port number for the Express server (defaults to `8080` locally).
- **NODE_ENV**: Current build phase environment (`development`, `production`, `test`).
- **CORS_ORIGIN**: Allowed origin URL for browser client connections (defaults to `http://localhost:3000`).

## 2. Infrastructure Bindings
- **MONGODB_URI**: Connection string for MongoDB (e.g. `mongodb://127.0.0.1:27017/stockora`).
- **REDIS_URL**: Connection string for the Redis memory cache instance (e.g. `redis://127.0.0.1:6379`).

## 3. Security Credentials
- **JWT_SECRET**: Random cryptographic key used to sign client Access JSON Web Tokens.
- **JWT_REFRESH_SECRET**: Cryptographic key used to sign client Session Refresh Tokens.
- **COOKIE_SECRET**: Key used to cryptographically sign session state cookie parameters.
