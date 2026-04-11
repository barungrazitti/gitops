# Phase 3: Improve Commit Message Relevance - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve the relevance and quality of AI-generated commit messages by implementing diff-size-aware strategies. This enhances the existing AI Commit Generator by tailoring prompt generation and message evaluation to the characteristics of small vs large diffs.

</domain>

<decisions>
## Implementation Decisions

### Diff Size Categorization
- **Hybrid approach** using 3 metrics: token count, file count, entity count
- **Fixed thresholds**: Tokens (<100 small, 100-2K medium, >2K large), Files (1-2 small, 3-10 medium, >10 large), Entities (<5 small, 5-20 medium, >20 large)
- **Strict combination logic**: All 3 metrics must agree for categorization
- **Default to smallest category** when metrics disagree (conservative approach for edge cases)
- **Include category in prompt** so AI knows which strategy to apply
- **Always calculate fresh** (no caching) - categorization on every run
- **User-configurable thresholds** via `aic config set categorization.small.tokens <value>`
- **Entity detection via regex patterns** (lighter than AST/tree-sitter)
- **Use tiktoken library** for accurate token counting (not approximation)

### Small Diff Prompt Strategy
- **Entity-centric approach** - Focus AI on changed entities only (functions, variables, classes)
- **List all entities explicitly** in prompt: "Changed: calculateTotal, updateDisplay, handleSubmit"
- **Categorize entities by type** (functions, variables, classes) in the prompt
- **Forced specificity instructions** added to prompt: "DO NOT use generic phrases like 'update file'. Be specific about WHAT changed."
- **Limited surrounding context** - include 2-3 lines before/after each change
- **Special handling for single-line changes** - add highlighting to ensure exact modification is reflected

### Large Diff Prompt Strategy
- **Hierarchical summarization** approach (OpenAI's book summarization method)
- **Reuse existing chunking** (maxPromptLength: 8000 tokens) with added summarization step
- **Extract key changes per chunk** - ask AI to "Summarize this chunk into 1-2 key changes"
- **Combine all summaries** into final commit message with instruction: "Combine these into one commit message"

### Relevance Evaluation
- **Automated metrics scoring** via `--evaluate` flag
- **Core metrics**: Specificity score (entity mentions), Conventional format compliance, Length check
- **Show metrics by default**, use `--quiet` to suppress
- **Score categories**: 0-60 Poor, 61-80 Fair, 81-90 Good, 91-100 Excellent

### Claude's Discretion
- Exact wording of specificity instructions
- Number of surrounding context lines for small diffs (2-3 recommended)
- Scoring algorithm details for automated metrics
- Threshold values for score categories

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research & Architecture
- `.planning/phases/03-improve-the-relevance-of-the-git-commit-messages-for-small-and-large-diffs/03-RESEARCH.md` — Technical research on diff sizing, relevance techniques, and standard stack

### Current Implementation
- `src/utils/efficient-prompt-builder.js` — Current prompt generation with chunking logic
- `src/core/message-formatter.js` — Commit message formatting and conventional commits
- `src/utils/optimized-diff-processor.js` — Diff processing and chunking

### Prior Phase Decisions
- `.planning/phases/02-quality-standards/02-CONTEXT.md` — Airbnb style guide, manual formatting, strict linting established

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **EfficientPromptBuilder** - Already has chunking (maxPromptLength: 8000), change analysis, impact analysis, problematic case detection
- **MessageFormatter** - Conventional commit types, scope inference, description cleaning
- **OptimizedDiffProcessor** - Handles large diffs with current chunking approach
- **AnalysisEngine** - Semantic analysis, file type detection, WordPress detection

### Established Patterns
- **Prompt structure**: Base prompt + CRITICAL instructions + relevance requirements + change-specific guidance + conventional format
- **Chunking**: Uses maxPromptLength for large diffs already
- **Change detection**: Analyzes diff for change type and impact before prompt building
- **Entity overlap**: Already has entity overlap scoring (should be preserved and enhanced)

### Integration Points
- **EfficientPromptBuilder.buildPrompt()** - Add diff categorization logic before prompt building
- **MessageFormatter** - Add evaluation metrics scoring
- **CLI commands** - Add --evaluate flag for quality metrics display

</code_context>

<specifics>
## Specific Ideas

- **tiktoken integration**: Install and use tiktoken library for accurate token counting instead of length / 4 approximation
- **Entity detection**: Regex patterns for functions (/function\s+\w+/, /const\s+\w+\s*=/, /class\s+\w+/), variables, classes
- **Prompt template for small diffs**: "Small diff detected (<100 tokens, 1-2 files, <5 entities). Changed entities: [list by type]. Focus on WHAT specifically changed, not generic updates."
- **Prompt template for large diffs**: "Large diff detected. Processing {N} chunks in parallel... [after chunk summaries] Combine these {N} summaries into one commit message."
- **Quality metrics display**: Show in console after commit: "Quality: 85/100 (Good) - Specificity: ✓ Conventional: ✓ Length: ✓"

</specifics>

<deferred>
## Deferred Ideas

- User feedback mechanism for commit quality rating - future enhancement
- Semantic coherence metric - requires more complex NLP analysis
- Adaptive thresholds based on usage patterns - Phase 4+
- Progressive combination for hierarchical summarization - current combine-all approach is simpler

</deferred>

---

*Phase: 03-improve-the-relevance-of-the-git-commit-messages-for-small-and-large-diffs*
*Context gathered: 2026-03-20*