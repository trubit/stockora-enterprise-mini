# Stockora Enterprise — Integration & Multi-Tenant Security Model

## 1. Multi-Tenant Isolation Guarantees

* Every integration record, credential, webhook, API key, and import/export job is indexed and partitioned by `tenantId`.
* Tenant A (e.g. Harn) cannot query, update, delete, or invoke Tenant B's (e.g. Hanson) connectors.
* API key authentication strictly resolves the owning tenant context from the secret hash.

## 2. Credential Encryption Vault

* All OAuth tokens, API secrets, and webhook secrets are encrypted at rest using **AES-256-GCM** with unique initialization vectors and authentication tags.
* Decrypted credentials are only instantiated transiently during outbound HTTP execution and are never logged or returned over the network.

## 3. Centralized Secret Redaction

* Centralized redaction ensures passwords, tokens, API keys, and authorization headers are cleansed from all logging streams.
