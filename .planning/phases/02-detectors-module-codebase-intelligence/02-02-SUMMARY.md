---
phase: "02"
plan: "02"
subsystem: detectors
tags: [detectors, file-type, dependency, context, tdd, regex-parsing]
dependency_graph:
  requires: [phase-1-foundation]
  provides: [file-type-detector, dependency-mapper]
  affects: [phase-4-core]
tech_stack:
  added: []
  patterns: [flat-context-objects, regex-import-parsing, direct-dependency-tracing]
key_files:
  created:
    - src/detectors/file-type-detector.js
    - src/detectors/dependency-mapper.js
    - tests/detectors/file-type-detector.test.js
    - tests/detectors/dependency-mapper.test.js
  modified: []
decisions:
  - id: D-04
    summary: Regex-based parsing for import/export — no AST dependency, handles CJS and ESM
  - id: D-05
    summary: Direct dependents only for downstream tracing — no transitive closure
  - id: D-06
    summary: All detectors return flat plain-JS context objects with no metadata wrappers
metrics:
  duration_minutes: 10
  completed_date: "2026-03-27"
---

# Phase 2 Plan 02: FileTypeDetector + DependencyMapper Summary

File type classification and dependency graph analysis for AI commit message enrichment. Categorizes files by type/language/framework and traces import/export relationships to identify affected dependents.

## What Was Built

**FileTypeDetector** (`src/detectors/file-type-detector.js`, 212 lines)
- Per-file classification: type (source/test/config/docs/asset/other), language (javascript/typescript/python/java/go/rust/php/ruby/css/html/vue/svelte), framework (react/vue/angular/nextjs/express/svelte)
- Patterns consistent with `analysis-engine.js` `categorizeFiles()` for compatibility
- Test patterns checked before source patterns (same priority fix as Phase 1)
- Content-based framework detection: scans file content for React/Angular/Next.js/Express imports
- Extension-based framework detection: Vue (.vue), Svelte (.svelte)
- `detectBatch()` returns per-file results plus aggregate summary with counts and detected frameworks

**DependencyMapper** (`src/detectors/dependency-mapper.js`, 275 lines)
- `parseImports()`: regex-based CommonJS require() and ESM import parsing
- `parseExports()`: detects named/default/re-export patterns for both CJS and ESM
- Skips dynamic requires and template literals (not statically analyzable)
- Skips non-relative imports (node_modules, builtins) — only local imports tracked
- `mapDependencies()`: builds full import/export graph with affected file detection
- `findDependents()`: scans repo source files for direct import references to changed files
- Handles circular dependencies without infinite recursion (no transitive closure per D-05)

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Import filtering | Skip non-relative imports only | Plan spec says "Skip node_modules imports (modules not starting with . or /)" |
| Framework detection | Content + extension | React/Angular need content scan; Vue/Svelte detectable by extension alone |
| Export parsing | Simple regex, no AST | Consistent with D-04 decision, fast and predictable |
| Affected file scan | Limit to `src/` directory | Efficiency — skip test/config files for dependent scanning |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing source file extensions for .vue and .svelte**
- **Found during:** Task 1 (FileTypeDetector GREEN phase)
- **Issue:** `.vue` and `.svelte` files were classified as `'other'` instead of `'source'` because SOURCE_PATTERN didn't include these extensions
- **Fix:** Added `.vue` and `.svelte` to SOURCE_PATTERN and EXT_TO_LANGUAGE mapping
- **Files modified:** src/detectors/file-type-detector.js
- **Commit:** a4afb1e

**2. [Rule 1 - Bug] Next.js detection regex too narrow**
- **Found during:** Task 1 (FileTypeDetector GREEN phase)
- **Issue:** `from 'next/server'` wasn't detected because pattern only matched `from 'next'` (exact)
- **Fix:** Changed regex to `from 'next/` or `from 'next'` using non-capturing group `(?:\/|['"])`
- **Files modified:** src/detectors/file-type-detector.js
- **Commit:** a4afb1e

**3. [Rule 1 - Bug] countByType property name mismatch**
- **Found during:** Task 1 (FileTypeDetector GREEN phase)
- **Issue:** `countByType` used `assets` (plural) as key but detector returns `type: 'asset'` (singular), causing new property instead of incrementing
- **Fix:** Changed initial key to `asset` (singular) to match detector type strings
- **Files modified:** src/detectors/file-type-detector.js
- **Commit:** a4afb1e

**4. [Rule 1 - Bug] Parent path imports filtered incorrectly**
- **Found during:** Task 2 (DependencyMapper GREEN phase)
- **Issue:** `require('../lib/helper')` was filtered out because check was `startsWith('./')` which doesn't match `../`
- **Fix:** Changed filter to `!module.startsWith('.')` to catch all relative imports
- **Files modified:** src/detectors/dependency-mapper.js
- **Commit:** b8fbebe

**5. [Rule 2 - Missing critical functionality] Import resolution for ../ paths**
- **Found during:** Task 2 (DependencyMapper GREEN phase)
- **Issue:** `importReferencesFile` didn't handle `../` imports in resolve logic — only checked `startsWith('/')`
- **Fix:** Added `startsWith('./')` and `startsWith('../')` to resolution path, always uses `path.normalize(path.join(sourceDir, importModule))`
- **Files modified:** src/detectors/dependency-mapper.js
- **Commit:** b8fbebe

**6. [Rule 1 - Bug] Syntax error in DependencyMapper test**
- **Found during:** Task 2 (DependencyMapper RED phase)
- **Issue:** Missing `]` closing bracket in circular dependency test Map literal
- **Fix:** Added missing `]`
- **Files modified:** tests/detectors/dependency-mapper.test.js
- **Commit:** b8fbebe

## Test Fix Deviations (non-code, specification alignment)

- ESM default import test updated to use relative path (`'./express'`) to be consistent with spec (skip non-relative imports)
- Both require+import test updated to use relative paths (skip non-relative imports per spec)
- Svelte language expected value updated to `'svelte'` (now correctly mapped in EXT_TO_LANGUAGE)

## Auth Gates

None encountered.

## Known Stubs

None — all methods fully implemented with real logic.

## Test Coverage

| Test Suite | Tests | Status |
|-----------|-------|--------|
| file-type-detector.test.js | 40 | All pass |
| dependency-mapper.test.js | 24 | All pass |
| **Total** | **64** | **All pass** |

## Self-Check: PASSED

- ✅ `src/detectors/file-type-detector.js` exists (212 lines, >100 min)
- ✅ `src/detectors/dependency-mapper.js` exists (275 lines, >120 min)
- ✅ `tests/detectors/file-type-detector.test.js` exists (40 tests, >60 lines min)
- ✅ `tests/detectors/dependency-mapper.test.js` exists (24 tests, >80 lines min)
- ✅ Commit a4afb1e exists
- ✅ Commit b8fbebe exists
- ✅ Zero formatter imports in `src/detectors/` (ARCH-02 verified)
- ✅ Zero transitive closure code in dependency-mapper.js (D-05 verified)
- ✅ Regex-only parsing, no AST dependencies (D-04 verified)
- ✅ All 4 detectors coexist in src/detectors/ with no circular dependencies
