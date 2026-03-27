---
phase: "02"
plan: "01"
subsystem: detectors
tags: [detectors, component, convention, context, tdd]
dependency_graph:
  requires: [phase-1-foundation]
  provides: [component-detector, convention-detector]
  affects: [phase-4-core]
tech_stack:
  added: []
  patterns: [flat-context-objects, regex-heuristics, module-mocking]
key_files:
  created:
    - src/detectors/component-detector.js
    - src/detectors/convention-detector.js
    - tests/detectors/component-detector.test.js
    - tests/detectors/convention-detector.test.js
  modified: []
decisions:
  - id: D-01
    summary: Extended existing project-type-detector.js for monorepo detection via require()
  - id: D-02
    summary: Custom component mappings read from conf package componentMap key
  - id: D-03
    summary: Lightweight regex heuristics for convention analysis, no AST dependencies
  - id: D-06
    summary: All detectors return flat plain-JS context objects with no metadata wrappers
metrics:
  duration_minutes: 8
  completed_date: "2026-03-27"
---

# Phase 2 Plan 01: ComponentDetector + ConventionDetector Summary

Component boundary detection and convention analysis for AI commit message enrichment. Maps changed files to logical components (monorepo packages, services, modules) and identifies project-wide naming, structure, and import conventions.

## What Was Built

**ComponentDetector** (`src/detectors/component-detector.js`, 210 lines)
- Maps file paths to components via 4-tier detection: custom config → monorepo packages → auto-detect patterns → meaningful directory fallback
- Supports `componentMap` config key for custom path-to-component mappings (longest prefix match)
- Reuses `ProjectTypeDetector.detectMonorepo()` for monorepo boundary detection
- Auto-detects `packages/`, `apps/`, `services/`, `modules/`, `libs/`, `components/` patterns
- `detectBatch()` and `getComponentsSummary()` for batch processing with aggregation

**ConventionDetector** (`src/detectors/convention-detector.js`, 252 lines)
- Naming detection: samples file names, classifies as camelCase/snake_case/kebab-case/PascalCase/mixed/unknown (>50% threshold)
- Structure detection: classifies as feature-based/layered/nested/flat/unknown by analyzing directory organization
- Import convention: scans JS files for relative vs absolute import patterns (>70% threshold)
- Lightweight regex heuristics, no AST dependencies, targets <100ms execution
- `analyze()` for full repo analysis, `analyzeFiles()` for specific file paths

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Custom config access | `conf` package (already project dep) | Consistent with existing `config-manager.js` |
| Monorepo detection | Delegate to `ProjectTypeDetector` | Reuse existing logic per D-01 |
| Feature-based detection | Common subdirectory intersection | Parallel dirs with shared subdirs = feature structure |
| Import threshold | 70% for dominance | Relative is most common, need higher threshold |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mock isolation for ProjectTypeDetector**
- **Found during:** Task 1 (ComponentDetector RED phase)
- **Issue:** Top-level `fs-extra` mock caused 14/14 tests to fail due to mock contamination across module boundary
- **Fix:** Replaced `fs-extra` mock with direct `ProjectTypeDetector` module mock using `jest.mock()` with factory function
- **Files modified:** tests/detectors/component-detector.test.js
- **Commit:** 6d8f34b

**2. [Rule 1 - Bug] fs-extra mock OOM in ConventionDetector tests**
- **Found during:** Task 2 (ConventionDetector RED/GREEN phase)
- **Issue:** `jest.spyOn` + `jest.resetModules()` created separate `fs-extra` references between test and source module, causing infinite recursion and OOM crash
- **Fix:** Switched to module-level `jest.mock('fs-extra')` with factory function, removed `jest.resetModules()` from beforeEach
- **Files modified:** tests/detectors/convention-detector.test.js
- **Commit:** a8cca69

**3. [Rule 3 - Blocking] Jest memory limit for detector tests**
- **Found during:** All convention-detector tests
- **Issue:** Jest OOM with default heap on detector tests due to coverage collection overhead
- **Fix:** Used `NODE_OPTIONS="--max-old-space-size=512"` for test execution
- **Note:** Not a code change — test runner configuration. Pre-existing issue with jest config `collectCoverage: true` being always-on.

## Auth Gates

None encountered.

## Known Stubs

None — all methods fully implemented with real logic.

## Test Coverage

| Test Suite | Tests | Status |
|-----------|-------|--------|
| component-detector.test.js | 14 | All pass |
| convention-detector.test.js | 14 | All pass |
| **Total** | **28** | **All pass** |

## Self-Check: PASSED

- ✅ `src/detectors/component-detector.js` exists (210 lines, >100 min)
- ✅ `src/detectors/convention-detector.js` exists (252 lines, >80 min)
- ✅ `tests/detectors/component-detector.test.js` exists (14 tests, >60 lines min)
- ✅ `tests/detectors/convention-detector.test.js` exists (14 tests, >60 lines min)
- ✅ Commit 6d8f34b exists
- ✅ Commit a8cca69 exists
- ✅ Zero formatter imports in `src/detectors/` (ARCH-02 verified)
- ✅ Flat context objects returned (no metadata wrappers)
