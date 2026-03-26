# Phase 1: Foundation — Research

**Phase:** 1 of 5
**Created:** 2026-03-26

---

## Current Architecture Analysis

### src/index.js Structure (1804 lines)

The main `AICommitGenerator` class contains 11 methods that can be categorized:

| Method | Lines | Category | Extraction Target |
|--------|-------|----------|-------------------|
| `generate()` | 170 | Orchestration | Keep as facade (slim down) |
| `selectMessage()` | 60 | UI/Interactive | Extract to `src/ui/message-selector.js` |
| `config()` | 20 | CLI Command | Extract to `src/commands/config.js` |
| `setup()` | 70 | CLI Command | Extract to `src/commands/setup.js` |
| `hook()` | 500+ | CLI Command | Extract to `src/commands/hook.js` |
| `generateWithSequentialFallback()` | 35 | Orchestration | Extract to `src/core/provider-orchestrator.js` |
| `generateWithSequentialProviders()` | 150 | Orchestration | Extract to `src/core/provider-orchestrator.js` |
| `manageDiffForAI()` | 40 | Diff Processing | Extract to `src/core/diff-manager.js` |
| `smartTruncateDiff()` | 85 | Diff Processing | Extract to `src/core/diff-manager.js` |
| `buildSkippedFileSummary()` | 70 | Diff Processing | Extract to `src/core/diff-manager.js` |
| `resolveConflictWithAI()` | 55 | Conflict | Extract to `src/core/conflict-resolver.js` |
| `handleConflictMarkers()` | 70 | Conflict | Extract to `src/core/conflict-resolver.js` |
| `detectAndCleanupConflictMarkers()` | 150 | Conflict | Extract to `src/core/conflict-resolver.js` |
| `stats()` | 90 | CLI Command | Extract to `src/commands/stats.js` |

### src/providers/base-provider.js (1220 lines)

The base provider class is too large. It contains:

| Section | Approx Lines | Extraction Target |
|---------|--------------|-------------------|
| Constructor & config | ~100 | Keep |
| Prompt building | ~200 | Extract to `src/utils/prompt-builder.js` |
| Response parsing | ~150 | Extract to `src/utils/response-parser.js` |
| Diff processing | ~200 | Already in `src/utils/optimized-diff-processor.js` |
| Token management | ~100 | Extract to `src/utils/token-manager.js` |
| Core generation | ~470 | Keep (abstract methods + common logic) |

### src/core/message-formatter.js (871 lines)

Should be split using strategy pattern:

| Formatter | Responsibility |
|-----------|----------------|
| `conventional-formatter.js` | type(scope): description format |
| `freeform-formatter.js` | Natural language format |
| `formatter-factory.js` | Select based on config |

---

## Proposed Module Structure

### New Directory Layout

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

## Dependency Graph (Target)

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

## Extraction Order

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

### Step 4: Extract Conflict Resolution (Medium Risk)
1. Create `src/core/conflict-resolver.js`
   - Move `resolveConflictWithAI()`
   - Move `handleConflictMarkers()`
   - Move `detectAndCleanupConflictMarkers()`

### Step 5: Slim Base Provider (Higher Risk)
1. Extract prompt building → `src/utils/prompt-builder.js`
2. Extract response parsing → `src/utils/response-parser.js`
3. Extract token management → `src/utils/token-manager.js`

### Step 6: Refactor Message Formatter (Phase 3 prep)
1. Create strategy pattern structure
2. Split into conventional/freeform formatters

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking imports | High | Update all require() paths carefully |
| Behavioral changes | High | Run tests after each extraction |
| Circular dependencies | Medium | Follow one-way dependency rule |
| State management | Medium | Keep state in commit-generator.js |

---

*Research for Phase 1: Foundation*
