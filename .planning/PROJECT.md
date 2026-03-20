# Project: Git-Ops Stability & Quality Refactoring

## What This Is
A focused refactoring and improvement project for the `git-ops` (AI Commit Generator) codebase. This project aims to resolve critical bugs, implement industry-standard linting/formatting (Airbnb), and enhance error handling with AI-powered suggestions.

## Core Value
The project's success is defined by a more stable, maintainable, and developer-friendly codebase with reliable error reporting and consistent style.

## Requirements

### Active
- [ ] **STAB-01**: Implement `provideErrorSuggestions()` method in `AICommitGenerator` with AI-powered troubleshooting.
- [ ] **QUAL-01**: Configure ESLint with Airbnb style guide.
- [ ] **QUAL-02**: Configure Prettier for consistent formatting.
- [ ] **QUAL-03**: Fix all critical linting/formatting errors in `src/`.
- [ ] **STAB-02**: Ensure all current tests pass and add a test case for `provideErrorSuggestions()`.

### Out of Scope
- [ ] Full rewrite of `AICommitGenerator.generate()` "God Method" (deferred to future phase).
- [ ] Migration to TypeScript (deferred to future milestone).
- [ ] Adding new AI providers beyond Groq/Ollama.

## Context
- **Codebase State**: Existing Node.js project using CommonJS.
- **Key Pain Point**: Missing `provideErrorSuggestions()` method causes crashes in error paths.
- **Tech Debt**: Lack of linting/formatting configs leading to style drift.
- **Dependency**: Uses `groq-sdk` and `simple-git`.

## Constraints
- **Runtime**: Node.js >=18.0.0.
- **Style**: Airbnb JavaScript style guide.
- **Provider**: Prioritize Groq/Ollama for error suggestions.

## Key Decisions
| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Airbnb Style Guide | Industry standard for JavaScript, ensures consistency and quality. | — Pending |
| AI-Powered Suggestions | Leverages existing AI infrastructure to provide better UX for common errors. | — Pending |

---
*Last updated: 2026-03-20 after project initialization*
