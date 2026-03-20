---
phase: 03-improve-the-relevance-of-the-git-commit-messages-for-small-and-large-diffs
plan: 01
subsystem: core-utilities
tags: [tiktoken, token-counting, diff-categorization, config-management]

# Dependency graph
requires:
  - phase: 02-quality-standards
    provides: ESLint, Prettier, code quality foundation
provides:
  - Accurate token counting using tiktoken library
  - Diff categorization by size (small/medium/large) using hybrid metrics
  - User-configurable categorization thresholds
  - Foundation for size-specific prompt strategies
affects:
  - prompt-generation, diff-processing, configuration

# Tech tracking
tech-stack:
  added: [tiktoken@1.0.22 - accurate token counting library]
  patterns: [token-counting, diff-categorization, dot-notation-config]

key-files:
  created:
    - src/utils/token-counter.js - Token counting with tiktoken
    - src/utils/diff-categorizer.js - Diff size categorization
  modified:
    - src/utils/efficient-prompt-builder.js - Integrated token counting and categorization
    - src/utils/optimized-diff-processor.js - Replaced estimation with accurate counting
    - src/core/config-manager.js - Added categorization thresholds and dot notation support
    - package.json - Added tiktoken dependency

key-decisions:
  - "Use tiktoken for accurate token counting instead of character/4 approximation"
  - "Hybrid metrics (tokens, files, entities) with strict AND logic for categorization"
  - "Default to smallest category when metrics disagree (conservative approach)"
  - "Dot notation support in config manager for 'categorization.small.tokens' style access"

patterns-established:
  - "Pattern: Token counter caching - cache encoding objects for performance"
  - "Pattern: Strict AND logic - all metrics must agree for category assignment"
  - "Pattern: Dot notation config - support nested access via 'parent.child.key' syntax"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-03-20T22:59:19+05:30
---

# Phase 3 Plan 1: Accurate Token Counting and Diff Categorization Summary

**Tiktoken-based accurate token counting and hybrid diff categorization with user-configurable thresholds**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T22:56:40+05:30
- **Completed:** 2026-03-20T22:59:19+05:30
- **Tasks:** 7
- **Files modified:** 5

## Accomplishments

- Replaced character-based token estimation (length / 4) with accurate tiktoken counting
- Implemented diff categorization using 3 metrics: tokens, files, entities
- Added user-configurable categorization thresholds via dot notation config
- Integrated categorization into prompt builder for size-specific strategies

## Task Commits

Each task was committed atomically:

1. **Task 1: Install tiktoken package** - `ea5aeb0` (feat)
2. **Task 2: Create token-counter module** - `5bc4c99` (feat)
3. **Task 3: Integrate token counting in prompt builder** - `5c7eaa6` (feat)
4. **Task 4: Integrate token counting in diff processor** - `f652233` (feat)
5. **Task 5: Create diff-categorizer module** - `dc35bae` (feat)
6. **Task 6: Add categorization thresholds to config** - `85719c3` (feat)
7. **Task 7: Integrate categorization into prompt builder** - `aea4898` (feat)

**Plan metadata:** (to be committed with SUMMARY.md)

## Files Created/Modified

- `src/utils/token-counter.js` - Token counting with tiktoken, encoding caching, cost estimation
- `src/utils/diff-categorizer.js` - Hybrid metrics categorization (tokens, files, entities) with strict AND logic
- `src/utils/efficient-prompt-builder.js` - Integrated TokenCounter and DiffCategorizer, replaced character-based checks
- `src/utils/optimized-diff-processor.js` - Replaced Math.ceil(text.length / 4) with tokenCounter.countTokens()
- `src/core/config-manager.js` - Added categorization thresholds, dot notation get/set helpers
- `package.json` - Added tiktoken@1.0.22 dependency

## Decisions Made

- Used tiktoken for accurate token counting instead of approximation
- Implemented hybrid categorization (3 metrics) with strict AND logic requiring all metrics to agree
- Default to smallest category when metrics disagree - conservative approach for edge cases
- Entity extraction via regex patterns instead of AST/tree-sitter for simplicity
- Dot notation support in config manager enables user commands like `aic config set categorization.small.tokens 150`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed successfully, verification tests pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Token counting infrastructure ready for small/large diff prompt strategies
- Diff categorization provides size information for prompt optimization
- Configurable thresholds allow users to customize categorization behavior
- Ready for next plan: implement size-specific prompt strategies

---
*Phase: 03-improve-the-relevance-of-the-git-commit-messages-for-small-and-large-diffs*
*Plan: 01*
*Completed: 2026-03-20*
