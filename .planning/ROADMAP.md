# Roadmap: Git-Ops Stability & Quality Refactoring

## Overview

**2 phases** | **8 requirements mapped** | All v1 requirements covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Stability & Error Recovery | Fix critical crash and implement AI-powered error suggestions | STAB-01, STAB-02, STAB-03, STAB-04, QUAL-04 | 5 |
| 2 | 3/3 | Complete   | 2026-03-20 | 3 |

---

## Phase 1: Stability & Error Recovery
**Goal**: Resolve the critical bug where the error handler crashes and implement intelligent AI-powered error suggestions.

**Requirements**:
- **STAB-01**: Implement `provideErrorSuggestions(error, options)` method.
- **STAB-02**: Use AI provider for intelligent troubleshooting.
- **STAB-03**: Basic fallbacks if AI fails.
- **STAB-04**: Unit tests for error handling.
- **QUAL-04**: Fix identified crash due to missing method.

**Plans**: 3 plans
- [x] 01-01-PLAN.md — Foundation & Error Identification (Wave 1)
- [x] 01-02-PLAN.md — AI-Powered Troubleshooting (Wave 2)
- [ ] 01-03-PLAN.md — Verification & Robustness (Wave 3)

**Success Criteria**:
1. Calling `this.provideErrorSuggestions()` in the catch block of `src/index.js` no longer crashes.
2. AI-powered suggestions are displayed for common errors (e.g., "API key missing").
3. Fallback messages are shown if AI is unavailable.
4. `tests/error-handling.test.js` exists and passes.
5. All existing tests pass.

---

## Phase 2: Quality & Standards
**Goal**: Establish consistent code style and automated linting using the Airbnb JavaScript guide.

**Requirements**:
- **QUAL-01**: ESLint configuration with Airbnb base.
- **QUAL-02**: Prettier configuration.
- **QUAL-03**: Pass linting for `src/` directory.

**Success Criteria**:
1. `npm run lint` successfully runs and reports 0 errors in `src/`.
2. Code is automatically formatted on save/manual run via Prettier.
3. `.eslintrc.json` and `.prettierrc` are present in the project root.

### Phase 3: improve the relevance of the git commit messages for small and large diffs

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 2
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 3 to break down)

---
*Roadmap updated: 2026-03-20*
