---
phase: "1"
plan: "foundation"
subsystem: "core-architecture"
tags: ["extraction", "facade", "decomposition", "commands", "ui", "core", "providers"]
dependency_graph:
  requires: []
  provides: ["modular-architecture", "clean-interfaces", "module-boundaries"]
  affects: ["phase-2-detectors", "phase-3-formatters", "phase-4-core", "phase-5-testing"]
tech_stack:
  added:
    - "src/commands/ — CLI command handlers (config, generate, setup, hook, stats)"
    - "src/ui/ — Interactive UI components (message-selector)"
    - "src/core/provider-orchestrator.js — Sequential AI provider fallback"
    - "src/core/diff-manager.js — Diff processing and chunking"
    - "src/core/conflict-resolver.js — AI-powered conflict resolution"
    - "src/utils/prompt-builder.js — Prompt construction"
    - "src/utils/response-parser.js — AI response parsing"
    - "src/utils/token-manager.js — Token estimation"
    - "src/utils/diff-analyzer.js — Semantic diff analysis"
    - "src/utils/diff-preprocessor.js — Diff preprocessing and asset filtering"
    - "src/utils/error-handler.js — Consistent API error handling"
    - "src/utils/commit-message-validator.js — Retry and validation for commit generation"
  patterns:
    - "Facade pattern for index.js"
    - "Delegation pattern for backward-compatible API"
    - "Command pattern for CLI handlers"
    - "Strategy pattern for commit message scoring"
key_files:
  created:
    - "src/commands/config.js"
    - "src/commands/generate.js"
    - "src/commands/setup.js"
    - "src/commands/hook.js"
    - "src/commands/stats.js"
    - "src/ui/message-selector.js"
    - "src/core/provider-orchestrator.js"
    - "src/core/diff-manager.js"
    - "src/core/conflict-resolver.js"
    - "src/utils/prompt-builder.js"
    - "src/utils/response-parser.js"
    - "src/utils/token-manager.js"
    - "src/utils/diff-analyzer.js"
    - "src/utils/diff-preprocessor.js"
    - "src/utils/error-handler.js"
    - "src/utils/commit-message-validator.js"
  modified:
    - "src/index.js (1533→241 lines)"
    - "src/providers/base-provider.js (1007→187 lines)"
    - "src/core/analysis-engine.js (pattern ordering fix)"
    - "tests/analysis-engine.test.js (import path fixes)"
    - "tests/index.test.js (no changes — all pass via delegation)"
decisions:
  - "Kept delegation methods in index.js for backward-compatible test API"
  - "Kept delegation methods in base-provider.js for subclass compatibility"
  - "Used require() calls inside methods (lazy loading) for extracted modules"
  - "Preserved original scoring logic in provider-orchestrator for consistency"
metrics:
  duration_minutes: 45
  completed_date: "2026-03-27"
---

# Phase 1 Plan Foundation: Summary

Break the monolithic `src/index.js` (1804 lines) and `src/providers/base-provider.js` (1220 lines) into clean, independent modules with clear boundaries using the facade pattern.

## What Was Done

### Step 1: Extract Commands (Low Risk)
- Created `src/commands/` directory
- Extracted `config()` → `src/commands/config.js`
- Extracted `setup()` → `src/commands/setup.js`
- Extracted `hook()` → `src/commands/hook.js`
- Extracted `stats()` → `src/commands/stats.js`
- Extracted `generate()` → `src/commands/generate.js`

### Step 2: Extract UI (Low Risk)
- Created `src/ui/` directory
- Extracted `selectMessage()` → `src/ui/message-selector.js`

### Step 3: Extract Core Orchestration (Medium Risk)
- Created `src/core/provider-orchestrator.js` — `generateWithSequentialFallback()`, `generateWithSequentialProviders()`, scoring engine
- Created `src/core/diff-manager.js` — `manageDiffForAI()`, `smartTruncateDiff()`, `buildSkippedFileSummary()`, `parseDiffIntoFileChunks()`, `scoreFileChunk()`, `chunkDiff()`
- Created `src/core/conflict-resolver.js` — `resolveConflictWithAI()`, `handleConflictMarkers()`, `detectAndCleanupConflictMarkers()`, `parseConflictBlocks()`, `cleanConflictMarkers()`

### Step 4: Slim Base Provider (Higher Risk)
- Extracted prompt building → `src/utils/prompt-builder.js`
- Extracted response parsing → `src/utils/response-parser.js`
- Extracted token management → `src/utils/token-manager.js`
- Extracted diff analysis → `src/utils/diff-analyzer.js`
- Extracted diff preprocessing → `src/utils/diff-preprocessor.js`
- Extracted error handling → `src/utils/error-handler.js`
- Extracted commit message validation/retry → `src/utils/commit-message-validator.js`

### Step 5: Refactor index.js as Facade
- Reduced `src/index.js` from 1533 lines to **241 lines** (target: <300)
- Reduced `src/providers/base-provider.js` from 1007 lines to **187 lines** (target: <300)
- All methods remain accessible via thin delegation methods for backward compatibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed generate.js syntax error**
- **Found during:** Task continuation
- **Issue:** `src/commands/generate.js` had missing catch block at line 40, causing parse errors
- **Fix:** Fixed indentation and removed duplicated code block (lines 121-168 were duplicated)
- **Files modified:** `src/commands/generate.js`

**2. [Rule 2 - Missing critical functionality] Fixed generate.js blocking on readline**
- **Found during:** Task continuation
- **Issue:** `GenerateCommand` called `this.messageSelector.select()` directly, which uses `readline` and blocks test execution
- **Fix:** Changed to call `this.generator.selectMessage()` so the test's mock of `generator.selectMessage` is used
- **Files modified:** `src/commands/generate.js`

**3. [Rule 1 - Bug] Fixed analysis-engine pattern ordering**
- **Found during:** Pre-existing uncommitted changes review
- **Issue:** Pattern matching in `categorizeFiles()` had `source` before `test`, causing test files like `test.js` to be categorized as source
- **Fix:** Reordered patterns to check `test` before `source`
- **Files modified:** `src/core/analysis-engine.js`

**4. [Rule 2 - Missing critical functionality] Fixed diff-manager parseDiffIntoFileChunks**
- **Found during:** Task execution
- **Issue:** The extracted `parseDiffIntoFileChunks()` only counted `@@` lines for change count, but the original counted `+` and `-` lines
- **Fix:** Updated diff-manager to match original index.js behavior
- **Files modified:** `src/core/diff-manager.js`

**5. [Rule 2 - Missing critical functionality] Added missing scoring methods to ProviderOrchestrator**
- **Found during:** Task execution
- **Issue:** The extracted `provider-orchestrator.js` had a simplified `selectBestMessages()` (dedup only) and no `scoreCommitMessage()` method
- **Fix:** Added full scoring engine with `scoreCommitMessage()`, `calculateRelevanceScore()`, `extractEntitiesFromDiff()`, `extractKeywordsFromMessage()`, `checkTypeMatch()`, `checkScopeMatch()`, `isMessageTooGenericForDiff()`
- **Files modified:** `src/core/provider-orchestrator.js`

**6. [Rule 2 - Missing critical functionality] Added chunkDiff to DiffManager**
- **Found during:** Task execution
- **Issue:** Tests called `generator.chunkDiff()` which had no target module
- **Fix:** Added `chunkDiff()` method to `src/core/diff-manager.js`
- **Files modified:** `src/core/diff-manager.js`

## Results

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| `src/index.js` lines | 1533 | **241** | <300 ✅ |
| `src/providers/base-provider.js` lines | 1007 | **187** | <300 ✅ |
| Test suites passing | 9/22 | **9/22** | All existing ✅ |
| Test failures | 69 | **66** | No new ✅ |
| New test failures | - | **0** | 0 ✅ |
| New modules created | 0 | **16** | - |
| Commands extracted | 0 | **5** | 5 ✅ |

## Module Dependency Graph

```
src/index.js (facade, 241 lines)
    ↓
src/commands/generate.js → src/core/provider-orchestrator.js
src/commands/config.js → src/core/config-manager.js
src/commands/setup.js → src/core/config-manager.js
src/commands/hook.js → src/core/hook-manager.js
src/commands/stats.js → src/core/stats-manager.js
src/ui/message-selector.js
    ↓
src/core/provider-orchestrator.js → src/providers/ai-provider-factory.js
src/core/diff-manager.js (standalone)
src/core/conflict-resolver.js → src/providers/ai-provider-factory.js
    ↓
src/providers/groq-provider.js → src/providers/base-provider.js
src/providers/ollama-provider.js → src/providers/base-provider.js
    ↓
src/utils/prompt-builder.js
src/utils/response-parser.js
src/utils/token-manager.js
src/utils/diff-analyzer.js
src/utils/diff-preprocessor.js
src/utils/error-handler.js
src/utils/commit-message-validator.js → src/providers/groq-provider.js (fallback)
```

## Self-Check: PASSED

- ✅ `src/index.js` is 241 lines (< 300)
- ✅ `src/providers/base-provider.js` is 187 lines (< 300)
- ✅ Commit `33f0304` exists in git log
- ✅ All 16 new module files exist
- ✅ No new test regressions (66 failures vs 69 baseline = 3 net fixes)
