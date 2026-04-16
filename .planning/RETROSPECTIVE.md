# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Stability & Quality Refactoring

**Shipped:** 2026-04-11
**Phases:** 3 | **Plans:** 10 | **Sessions:** ~6

### What Was Built
- AI-powered error recovery with provideErrorSuggestions, local fallbacks, and comprehensive tests
- ESLint (Airbnb) + Prettier code quality infrastructure with 0 errors (640 fixed)
- Tiktoken-based token counting and hybrid diff categorization (tokens, files, entities)
- Entity extraction and size-specific prompt strategies for commit messages
- Hierarchical summarization for large diffs using parse-diff
- Automated quality metrics scoring with CLI integration (--quiet flag)

### What Worked
- Atomic task commits kept changes small and verifiable
- Strict AND logic for diff categorization prevented misclassification
- Reusing existing chunking logic (OptimizedDiffProcessor) for large diffs avoided reinvention
- Linting found 2 actual bugs (undefined variables) during compliance work

### What Was Inefficient
- 47 for-of loop violations required manual refactoring to forEach across many files
- CommonJS import/extensions incompatibility with Airbnb ESLint required config adjustment mid-way
- Requirements were defined but checkboxes were never updated in REQUIREMENTS.md during execution

### Patterns Established
- All code must pass ESLint validation (0 errors)
- Regex-based entity extraction over AST for prompt-relevant extraction
- Handlebars templates for dynamic prompt construction
- Hierarchical approach for large diffs: chunk → summarize → combine
- Quality scoring: specificity + conventional format + length = overall

### Key Lessons
1. Track requirement completion as you go — don't leave all checkboxes for the end
2. ESLint strict mode catches real bugs, not just style issues (2 undefined variables found)
3. Conservative categorization (default to smallest) handles edge cases better than aggressive
4. Reuse existing infrastructure before building new (chunking logic, config manager)

### Cost Observations
- Model mix: 100% AI-assisted (Groq + Ollama)
- Sessions: ~6 sessions
- Notable: Phase 2 (Quality) was fastest at ~11 min total; Phase 3 most complex at ~26 min

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~6 | 3 | Initial GSD workflow adoption, atomic commits, plan-driven execution |

### Cumulative Quality

| Milestone | Tests | Key Metric | Notable |
|-----------|-------|------------|---------|
| v1.0 | 423 | ESLint errors: 0 | 640 errors fixed, 2 bugs found during linting |

### Top Lessons (Verified Across Milestones)

1. Track requirements in real-time, not retroactively
2. Strict linting catches real bugs — always enforce from day one
