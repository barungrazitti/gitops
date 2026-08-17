# Architecture Refactor & Cleanup Plan

**Date:** 17 August 2026  
**Baseline:** Post-`b39d16b` (57 modules / ~16.5K src lines; 37 suites / 715 tests green).  
**Goal:** Fix remaining architectural friction, delete the second shadow layer, clean up duplicate truncations, fix the stats double-count bug, and clean up the auto-git seam.

---

## Execution Order

1. **Phase 1: Pure Deletion (The Second Shadow Layer)** — Zero risk, removes ~2,900 lines of dead code and test suites.
2. **Phase 2: Bug Fixes & Seam Cleanup** — Fix stats double-count, auto-git reach-through, and base-provider dead methods.
3. **Phase 3: Pipeline Deepening** — Collapse triple truncation between DiffShaper and EfficientPromptBuilder.
4. **Phase 4: Presentation & Polish** — Extract CLI presentation from index.js; merge bin entry points.

---

## Phase 1: Delete the Second Shadow Layer (~2,900 lines)

### 1.1 `src/detectors/` (All 4 files — 1,284 lines + tests)
- **Files to delete:**
  - `src/detectors/component-detector.js`
  - `src/detectors/convention-detector.js`
  - `src/detectors/dependency-mapper.js`
  - `src/detectors/file-type-detector.js`
  - `tests/detectors/*` (4 test suites)
- **Evidence:** Zero production callers (`src/` and `bin/` import none of these; only `tests/detectors/` references them).
- **Verification:** `npm test` (should pass after deleting matching test files).

### 1.2 Unused / Duplicate Utilities
- **Files to delete:**
  - `src/utils/config-validator.js` (314 lines — not even tested, Joi schema already in config-manager)
  - `src/utils/retry-utility.js` (186 lines — 0% coverage, base-provider has own `withRetry`)
  - `src/utils/health-check.js` (157 lines — test-only)
  - `src/utils/circuit-breaker.js` (110 lines — duplicate of live `src/core/circuit-breaker.js`)
  - `src/utils/rate-limiter.js` (68 lines — test-only)
  - `src/utils/error-handler.js` (47 lines — test-only)
  - `src/utils/input-validator.js` (14 lines — test-only)
  - `src/utils/date-utils.js` (21 lines — test-only)
  - `src/utils/diff-fact-analyzer.js` (458 lines — `options.diffFacts` never passed by anyone)
  - Corresponding test suites under `tests/utils/` for each deleted utility.
- **Verification:** `npm test` && `npm run lint`.

### 1.3 Dead GitManager Methods
- **File:** `src/core/git-manager.js`
- **Lines to remove:** 225–381 (`createValidationBranch`, `createDualCommits`, `stashChanges`, etc. — zero production callers).
- **Verification:** `npm test`.

---

## Phase 2: Bug Fixes & Seam Cleanup

### 2.1 Fix Stats Double-Count Bug
- **Files:** `src/index.js`
- **Problem:** `AICommitGenerator.generate()` records a commit twice: once at `src/index.js:275` (upon generation success) and again at `src/index.js:723`.
- **Fix:** Remove the duplicate `recordCommit` call at line 275 (keep only the one at commit/generation time).
- **Verification:** Test stats recording count before/after.

### 2.2 Clean Auto-Git Seam (`src/auto-git.js`)
- **Files:** `src/auto-git.js`, `src/index.js`
- **Problem:** AutoGit reaches through 5 `aiCommit.*` properties (`analysisEngine`, `configManager`, `generateWithSequentialFallback`, `detectAndCleanupConflictMarkers`, `resolveConflictWithAI`), duplicates GitManager staging/commit, and runs a parallel conflict loop.
- **Fix:** 
  1. Inject collaborators via constructor: `constructor({ gitManager, generateMessages, conflictResolver, activityLogger })`.
  2. Replace `aiCommit.` property access with injected method calls.
  3. Remove the object-form normalization shim in `ConflictResolver` if AutoGit is updated to match the standard signature, OR keep the shim robust.
- **Verification:** `tests/auto-git.test.js`.

### 2.3 Trim `src/providers/base-provider.js` (~600 dead lines)
- **Files:** `src/providers/base-provider.js`, `src/providers/groq-provider.js`, `src/core/message-formatter.js`
- **Problem:** Methods with zero callers in src/bin/tests: `analyzeDiffContent` (53–220), `generateCommitMessagesWithValidation` (328–510), `generateCommitMessagesWithEnhancedPrompt` (515–555), `getLanguageName` (225–235), `analyzeDiff`/`extractKeyChanges`/`extractSemanticChanges`/`inferLikelyPurpose` (646–851), `buildRequest`, `makeDirectAPIRequest`, `validateCommitMessage`. Groq also duplicates `parseResponse` and `validateMessage` verbatim.
- **Fix:** 
  1. Delete all listed dead methods from `base-provider.js`.
  2. Remove groq's duplicate `parseResponse`/`validateMessage` overrides, inheriting base implementations.
  3. Remove dead methods in `message-formatter.js` that served only the deleted validation chain.
- **Verification:** `npm test`.

---

## Phase 3: Pipeline Deepening (Collapse Triple Truncation)

### 3.1 Unify Diff Budget Ownership (`src/core/diff-shaper.js` & `src/utils/efficient-prompt-builder.js`)
- **Problem:** Diff is truncated by DiffShaper @ 18K, then re-truncated by EfficientPromptBuilder @ 4,500, re-chunked by `diffProcessor.processDiffWithStrategy`, and truncated a third time in Groq provider @ 18K.
- **Fix:**
  1. Make `DiffShaper.manageDiffForAI()` return the definitive, budget-fitted diff artifact (guaranteed under 18K chars, pre-chunked if needed).
  2. Remove EfficientPromptBuilder's internal truncation and duplicate chunking path. EPB becomes pure prompt template assembly.
  3. Remove Groq provider's redundant re-truncation (rely on DiffShaper).
- **Verification:** `tests/efficient-prompt-builder.test.js` and `tests/index.test.js`.

---

## Phase 4: Presentation & Polish

### 4.1 Extract CLI Presentation from `AICommitGenerator`
- **Files:** `src/index.js`, new `src/cli-presenter.js` (or similar)
- **Problem:** ~490 lines of console rendering (setup wizard, stats tables, interactive selectMessage UI, error suggestions) live inside the domain class.
- **Fix:** Move console prompts, ora spinners, and chalk formatting out of `AICommitGenerator` into a presentation layer. `AICommitGenerator` returns pure data/promises.
- **Verification:** `npm test` (cli tests).

### 4.2 Merge Duplicate Bin Entry Points
- **Files:** `bin/aic.js`, `bin/aicommit.js`, delete `bin/aic.c`
- **Problem:** Two separate Commander programs duplicate `handleSetup`, `handleConfig`, `handleStats` try/catch/exit boilerplate.
- **Fix:** Unify into a single CLI entry point (e.g., `bin/aic.js` handling both command names via symlink or commander aliases).
- **Verification:** `aic` and `aicommit` smoke tests.

---

## Verification Commands
```bash
npm test              # Must pass all suites (715+ tests)
npm run lint          # ESLint (0 errors, 0 warnings)
npm run format:check  # Prettier check
```
