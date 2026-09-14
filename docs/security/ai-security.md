# Stockora Enterprise — AI Copilot & Business Intelligence Security

## 1. Threat Vectors
- Cross-tenant data leakage in prompt generation and retrieval contexts.
- Prompt injection attempts seeking to alter system behavior or bypass safety filters.
- Unauthorized tool invocation by AI assistants without user verification.
- Sensitive credential / PII leakage into AI provider prompts.

---

## 2. Implemented Defense Controls
1. **Tenant-Scoped Context Retrieval**: RAG (Retrieval-Augmented Generation) databases, embeddings, and query pipelines strictly filter by `tenantId`. Tenant A's business metrics are never retrieved into Tenant B's prompt context.
2. **Tool Execution Authorization**: Any automated tool or database query triggered by AI Copilot must pass the user's active session permissions.
3. **Prompt Sanitization**: User inputs are stripped of system prompt overrides and sanitized against common injection patterns.
4. **PII Masking**: Secrets, credit card numbers, and raw authentication tokens are scrubbed before payloads reach external LLM endpoints.
