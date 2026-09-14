# Stockora Enterprise — AI Decision Intelligence & Assistant

## Architecture
The Decision Intelligence system extends the central `AIService` using the `ResilientExecutor` pattern (exponential backoff, jitter, circuit breakers, and mock AI fallback).

## Core Capabilities
1. **Executive Strategic Assistant**: Answers complex queries concerning business trajectory, branch discrepancies, margin loss, and supplier reliability.
2. **Evidence-Backed Citations**: Every AI recommendation includes supporting operational evidence derived directly from live database aggregations.
3. **Role & Tenant Isolation**: The AI service never accesses data outside the authenticated user's tenant or authorization scope.
4. **Confidence Indicators**: Clear labels (`HIGH`, `MEDIUM`, `LOW`) indicating predictive certainty.
