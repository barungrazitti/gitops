---
phase: 03-improve-the-relevance-of-the-git-commit-messages-for-small-and-large-diffs
plan: 02
subsystem: core-utilities
tags: [entity-extraction, prompt-templates, small-diff-prompts, handlebars]

# Dependency graph
requires:
  - phase: 03-01
    provides: Diff categorization (small/medium/large), token counting
provides:
  - Entity extraction from diffs (functions, classes, variables)
  - Handlebars-based prompt templates for small diffs
  - Context line limiting (3 lines max) for small diffs
  - Single-line change detection and highlighting
affects:
  - prompt-generation, diff-processing

# Tech tracking
tech-stack:
  added: [handlebars@4.7.8 - template engine for prompts]
  patterns: [entity-extraction, template-prompts, context-limiting]

key-files:
  created:
    - src/utils/entity-extractor.js - Extract functions, classes, variables from diffs
    - src/utils/prompt-templates.js - Handlebars templates for small diff prompts
    - tests/entity-extractor.test.js - Unit tests for entity extraction
  modified:
    - src/utils/efficient-prompt-builder.js - Integrated entity extraction and templates
    - package.json - Added handlebars dependency

key-decisions:
  - 'Use regex patterns for entity extraction (lighter than AST)'
  - 'Filter common false positives: if, for, while, return, etc.'
  - 'Handlebars templates enable dynamic prompt construction'
  - 'Context limited to 3 lines before/after changes for small diffs'
  - 'Single-line changes get special highlighting with ⬅️ marker'

patterns-established:
  - 'Pattern: Entity extraction via regex - extract functions, classes, variables'
  - 'Pattern: Template-based prompts - Handlebars for dynamic prompt building'
  - 'Pattern: Context limiting - max 3 lines surrounding changes'

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-04-09T15:30:00+05:30
---

# Phase 3 Plan 2: Entity-Centric Prompts for Small Diffs Summary

**Entity extraction and size-specific prompt strategies for improved commit message relevance**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-09T15:20:00+05:30
- **Completed:** 2026-04-09T15:30:00+05:30
- **Tasks:** 7
- **Files modified:** 3

## Accomplishments

- Created EntityExtractor module to identify functions, classes, variables in diffs
- Implemented Handlebars-based prompt templates for small diffs
- Added forced specificity instructions ("DO NOT use generic phrases")
- Integrated entity extraction into EfficientPromptBuilder
- Added context line limiting (3 lines max) for small diffs
- Added single-line change detection and highlighting

## Task Commits

1. **Task 1: Install handlebars** - `bca2b64` (feat)
2. **Task 2: Create entity-extractor.js** - `bca2b64` (feat)
3. **Task 3: Create entity-extractor tests** - `bca2b64` (feat)
4. **Task 4: Create prompt-templates.js** - `bca2b64` (feat)
5. **Task 5: Integrate entity extraction** - `bca2b64` (feat)
6. **Task 6: Implement context limiting** - `bca2b64` (feat)
7. **Task 7: Add single-line highlighting** - `bca2b64` (feat)

## Files Created/Modified

- `src/utils/entity-extractor.js` - Extracts functions, classes, variables from diffs using regex
- `src/utils/prompt-templates.js` - Handlebars templates for small diff prompts
- `tests/entity-extractor.test.js` - Unit tests (10 tests, 100% pass)
- `src/utils/efficient-prompt-builder.js` - Integrated entity extraction, context limiting, single-line detection
- `package.json` - Added handlebars@4.7.8 dependency

## Decisions Made

- Used regex patterns for entity extraction (lighter than AST/tree-sitter)
- Filtered common false positives: if, for, while, return, class, const, etc.
- Default max context lines set to 3 for small diffs
- Single-line changes highlighted with ⬅️ marker in prompt
- Entity list formatted by type: "Functions: X, Y; Classes: Z"

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

None - npm permission issue resolved, all tasks completed, tests pass.

## Next Phase Readiness

- Entity extraction ready for prompt optimization
- Small diff prompts now include specific entity information
- Context limiting reduces noise for small changes
- Ready for next plan: medium/large diff prompt strategies

---

_Phase: 03-improve-the-relevance-of-the-git-commit-messages-for-small-and-large-diffs_
_Plan: 02_
_Completed: 2026-04-09_
