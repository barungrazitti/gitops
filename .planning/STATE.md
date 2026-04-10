# Project State: Git-Ops Stability & Quality Refactoring

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value**: A more stable, maintainable, and developer-friendly codebase with reliable error reporting and consistent style.
**Current focus**: Phase 3: Improve Commit Message Relevance

## Phase Progress

| #   | Phase                            | Status | Progress         |
| --- | -------------------------------- | ------ | ---------------- |
| 1   | Stability & Error Recovery       | ✓      | 100%             |
| 2   | Quality & Standards              | ✓      | 100%             |
| 3   | Improve Commit Message Relevance | ✓      | 100% (4/4 plans) |

## Current Context

- **Active Phase**: 3 - Improve Commit Message Relevance
- **Active Plan**: Phase 3 complete
- **Recent Completion**: 03-04 - Message quality metrics scoring
- **Active Plan**: 03-03 (next: implement medium/large diff strategies)
- **Recent Completion**: 03-02 - Entity-centric prompts for small diffs (entity extraction, handlebars templates, context limiting)

## Decisions Log

### Roadmap Evolution

- Phase 3 added: Improve the relevance of git commit messages for small and large diffs

### Phase 3: Plan 01 - Token Counting & Categorization

- **Tiktoken integration**: Use tiktoken library for accurate token counting (not character/4 approximation)
- **Hybrid categorization**: 3 metrics (tokens, files, entities) with strict AND logic
- **Conservative defaulting**: When metrics disagree, default to smallest category
- **User-configurable thresholds**: Dot notation config for 'categorization.small.tokens' style access
- **Entity extraction**: Regex patterns for functions, classes, variables (lighter than AST)

### Technical Decisions

- **TokenCounter**: Cache encoding objects for performance
- **DiffCategorizer**: Strict AND logic - all 3 metrics must agree for category assignment
- **ConfigManager**: Added dot notation helpers (getNestedValue, setNestedValue, buildNestedObject)
- **EntityExtractor**: Regex patterns for functions, classes, variables with false positive filtering
- **PromptTemplates**: Handlebars templates for small/large diffs
- **ContextLimiting**: Max 3 lines surrounding changes for small diffs
- **DiffSummarizer**: parse-diff integration for hierarchical summarization
- **ChunkCombination**: Merge chunk summaries into one commit message
- **MetricsScorer**: Quality scoring (specificity, conventional, length)

---

_Last activity: 2026-04-10 - Quick task 260410-h09: Fix binary file diff detection_

### Quick Tasks Completed

| #          | Description                                                                | Date       | Commit  | Directory                                                                                                           |
| ---------- | -------------------------------------------------------------------------- | ---------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| 260407-hwa | Fix Groq 413 error when truncated diff still too large for model TPM limit | 2026-04-07 | ed81f83 | [260407-hwa-fix-groq-413-error-when-truncated-diff-s](./quick/260407-hwa-fix-groq-413-error-when-truncated-diff-s/) |
| 260410-h09 | Fix binary file diff detection generates incorrect commit message       | 2026-04-10 |         | [260410-h09-fix-binary-file-diff-detection-generates](./quick/260410-h09-fix-binary-file-diff-detection-generates/) |
