# Phase 1: Foundation — Implementation Plan

**Phase:** 1 of 5  
**Status:** in-progress  
**Created:** 2026-03-26  

---

## Overview

This plan outlines the implementation steps for Phase 1: Foundation based on the CONTEXT.md and RESEARCH.md files. The goal is to break the monolithic `src/index.js` (1804 lines) god class into clean, independent modules with clear boundaries and one-way dependencies.

---

## Goals from CONTEXT.md

1. Break the monolithic `src/index.js` (1804 lines) god class into clean, independent modules
2. Establish clear module boundaries and one-way dependencies
3. Reduce `src/index.js` to <300 lines (facade pattern)
4. Reduce `src/providers/base-provider.js` to <300 lines
5. Establish Core/Detectors/Formatters directory structure
6. Define clear module interfaces

---

## Success Criteria from CONTEXT.md

- [ ] `src/index.js` reduced to <300 lines (facade pattern)
- [ ] `src/providers/base-provider.js` reduced to <300 lines
- [ ] Core module structure established
- [ ] All existing tests pass
- [ ] Module dependency graph documented

---

## Detailed Implementation Steps Based on RESEARCH.md

### Step 1: Extract Commands (Low Risk)
1. Create `src/commands/` directory
2. Extract `config()` → `src/commands/config.js`
3. Extract `setup()` → `src/commands/setup.js`
4. Extract `hook()` → `src/commands/hook.js`
5. Extract `stats()` → `src/commands/stats.js`

### Step 2: Extract UI (Low Risk)
1. Create `src/ui/` directory
2. Extract `selectMessage()` → `src/ui/message-selector.js`

### Step 3: Extract Core Orchestration (Medium Risk)
1. Create `src/core/provider-orchestrator.js`
   - Move `generateWithSequentialFallback()`
   - Move `generateWithSequentialProviders()`
2. Create `src/core/diff-manager.js`
   - Move `manageDiffForAI()`
   - Move `smartTruncateDiff()`
   - Move `buildSkippedFileSummary()`
   - Move `parseDiffIntoFileChunks()` (if exists)
3. Create `src/core/conflict-resolver.js`
   - Move `resolveConflictWithAI()`
   - Move `handleConflictMarkers()`
   - Move `detectAndCleanupConflictMarkers()`

### Step 4: Slim Base Provider (Higher Risk)
1. Extract prompt building → `src/utils/prompt-builder.js`
2. Extract response parsing → `src/utils/response-parser.js`
3. Extract token management → `src/utils/token-manager.js`

### Step 5: Refactor Message Formatter (Phase 3 prep)
1. Create strategy pattern structure
2. Split into conventional/freeform formatters

---

## Proposed Module Structure (from RESEARCH.md)

```
src/
├── index.js (facade, <200 lines)
├── core/
│   ├── commit-generator.js (NEW - orchestration)
│   ├── provider-orchestrator.js (NEW - from index.js)
│   ├── diff-manager.js (NEW - from index.js)
│   ├── conflict-resolver.js (NEW - from index.js)
│   ├── git-manager.js (existing)
│   ├── config-manager.js (existing)
│   ├── cache-manager.js (existing)
│   ├── analysis-engine.js (existing)
│   ├── message-formatter.js (refactored)
│   ├── stats-manager.js (existing)
│   ├── activity-logger.js (existing)
│   └── hook-manager.js (existing)
├── commands/ (NEW)
│   ├── generate.js (from index.js generate logic)
│   ├── config.js (from index.js config method)
│   ├── setup.js (from index.js setup method)
│   ├── hook.js (from index.js hook method)
│   └── stats.js (from index.js stats method)
├── ui/ (NEW)
│   └── message-selector.js (from index.js selectMessage)
├── providers/
│   ├── base-provider.js (refactored, <300 lines)
│   ├── ai-provider-factory.js (existing)
│   ├── groq-provider.js (existing)
│   └── ollama-provider.js (existing)
├── detectors/ (Phase 2)
│   └── (empty for now)
├── formatters/ (Phase 3)
│   ├── conventional-formatter.js (from message-formatter)
│   ├── freeform-formatter.js (from message-formatter)
│   └── formatter-factory.js (NEW)
└── utils/
    ├── secret-scanner.js (existing)
    ├── input-sanitizer.js (existing)
    ├── efficient-prompt-builder.js (existing)
    ├── prompt-builder.js (NEW - from base-provider)
    ├── response-parser.js (NEW - from base-provider)
    ├── token-manager.js (NEW - from base-provider)
    ├── performance-utils.js (existing)
    └── optimized-diff-processor.js (existing)
```

---

## Dependency Graph (Target) (from RESEARCH.md)

```
src/index.js (facade)
    ↓
src/core/commit-generator.js
    ├── src/core/provider-orchestrator.js
    ├── src/core/diff-manager.js
    ├── src/commands/generate.js
    └── src/ui/message-selector.js
        ↓
src/core/git-manager.js
src/core/config-manager.js
src/core/cache-manager.js
src/core/analysis-engine.js
src/providers/ai-provider-factory.js
    ↓
src/providers/groq-provider.js
src/providers/ollama-provider.js
    ↓
src/providers/base-provider.js
    ↓
src/utils/prompt-builder.js
src/utils/response-parser.js
```

**Rule:** Detectors (Phase 2) and Formatters (Phase 3) will be dependencies of `commit-generator.js` but never reverse.

---

## Risks & Mitigations (from RESEARCH.md)

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking imports | High | Update all require() paths carefully |
| Behavioral changes | High | Run tests after each extraction |
| Circular dependencies | Medium | Follow one-way dependency rule |
| State management | Medium | Keep state in commit-generator.js |

---

## Extraction Order (from RESEARCH.md)

1. Extract Commands (Low Risk)
2. Extract UI (Low Risk)
3. Extract Core Orchestration (Medium Risk)
4. Extract Conflict Resolution (Medium Risk)
5. Slim Base Provider (Higher Risk)
6. Refactor Message Formatter (Phase 3 prep)

---

## Next Steps

1. Begin with Step 1: Extract Commands
2. Create necessary directories
3. Extract each method to its new location
4. Update imports in src/index.js and other affected files
5. Run tests after each extraction to ensure no regressions
6. Proceed to subsequent steps as outlined

---
*Plan for Phase 1: Foundation Implementation*