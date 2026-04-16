# Project: Git-Ops (AI Commit Generator)

## What This Is

A focused refactoring and improvement project for the `git-ops` (AI Commit Generator) codebase. This project resolves critical bugs, implements industry-standard linting/formatting (Airbnb), enhances error handling with AI-powered suggestions, and improves commit message relevance with diff-size-aware strategies.

## Core Value

A more stable, maintainable, and developer-friendly codebase with reliable error reporting, consistent style, and relevant AI-generated commit messages.

## Current State

**Shipped v1.0** — Stability & Quality Refactoring (2026-04-11)
- 3 phases, 10 plans, 39 tasks complete
- 21,774 LOC JavaScript (src/)
- 213 git commits over 285 days
- 423 tests passing

## Requirements

### Validated

- ✓ **STAB-01**: Implement `provideErrorSuggestions()` method — v1.0
- ✓ **STAB-02**: AI-powered troubleshooting suggestions via Groq/Ollama — v1.0
- ✓ **STAB-03**: Graceful fallback to local suggestions when AI fails — v1.0
- ✓ **STAB-04**: Comprehensive test coverage for error handling (13 tests) — v1.0
- ✓ **QUAL-01**: ESLint with Airbnb base style guide — v1.0
- ✓ **QUAL-02**: Prettier configuration (single quotes, trailing commas, 2-space) — v1.0
- ✓ **QUAL-03**: 0 ESLint errors in src/ (640 errors fixed, 2 bug fixes found) — v1.0
- ✓ **QUAL-04**: Fixed crash from missing `provideErrorSuggestions` — v1.0

### Active

- [ ] **STAB-05**: Automated self-fixing for common configuration errors.
- [ ] **QUAL-05**: Full refactoring of "God Methods" in `src/index.js` and `src/auto-git.js`.

### Out of Scope

- TypeScript Migration — Deferred for future stability milestone.
- New Providers — Focus on improving existing Groq/Ollama integration.

## Next Milestone Goals

- Address STAB-05 (automated self-fixing) and QUAL-05 (God Method refactoring)
- Improve test coverage thresholds
- Performance optimization for large repositories

## Context

- **Codebase State**: Node.js project using CommonJS, 21,774 LOC in src/
- **Tech Stack**: Groq SDK, simple-git, tiktoken, handlebars, parse-diff, Jest
- **Key Architecture**: Clean module separation (core/, providers/, utils/)
- **Linting**: ESLint (Airbnb) + Prettier, 0 errors
- **Testing**: 423 tests across 19 suites
- **AI Providers**: Groq (primary) + Ollama (fallback)

## Constraints

- **Runtime**: Node.js >=18.0.0
- **Style**: Airbnb JavaScript style guide
- **Provider**: Prioritize Groq/Ollama for AI features

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Airbnb Style Guide | Industry standard for JavaScript, ensures consistency and quality | ✓ Good — 640 errors fixed, 0 remaining |
| AI-Powered Suggestions | Leverages existing AI infrastructure for better UX | ✓ Good — implemented with graceful fallback |
| Tiktoken for token counting | Accurate vs character/4 approximation | ✓ Good — enables precise diff categorization |
| Hybrid diff categorization | 3 metrics (tokens, files, entities) with strict AND logic | ✓ Good — conservative, configurable |
| Regex entity extraction | Lighter than AST, sufficient for prompts | ✓ Good — handles functions, classes, variables |
| Handlebars templates | Dynamic prompt construction | ✓ Good — clean template-based prompts |
| parse-diff for large diffs | Structured parsing vs regex | ✓ Good — hierarchical summarization |
| ESLint commonjs sourceType: script | CommonJS requires explicit extensions | ✓ Good — disabled import/extensions |

---
*Last updated: 2026-04-11 after v1.0 milestone*
