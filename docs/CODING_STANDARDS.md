# Stockora Enterprise: Coding Standards

This document establishes the programming guidelines and code quality metrics for the developers working on **Stockora Enterprise**.

## 1. Code Style and Formatting
- **Linter**: ESLint is configured to scan client React/Vite assets and server Node/Express files using separate runtime global scopes.
- **Formatter**: Prettier is configured as the official formatting engine. Run `npm run format` to format files automatically.
- **Pre-commit Checks**: Husky and `lint-staged` execute formatting and linting scripts before code can be committed to Git.

## 2. TypeScript & Strong Typing
- **Strict Compile Checks**: All codebases must compile under strict flags. No implicit `any` usage is allowed.
- **Type-Only Imports**: Imports of interfaces or types must utilize the explicit `import type { ... }` syntax to satisfy the `verbatimModuleSyntax` compiler rule.

## 3. Architecture Principles
- **Separation of Concerns**: Divide directories into frontend (`src/client`), backend (`src/server`), and common models (`src/shared`).
- **SOLID Design**: Ensure classes, functions, and React components serve a single, focused responsibility.

## 4. Security Standards
- **No hardcoded secrets**: Secrets are loaded dynamically from environment files via `dotenv.config()`.
- **Validation**: Validate all inbound payloads using Zod schemas before processing DB operations.
- **Rate Limiting**: Always configure middleware-level rate limits on public API pathways.
