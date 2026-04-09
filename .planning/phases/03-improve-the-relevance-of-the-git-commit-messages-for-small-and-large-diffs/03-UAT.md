---
status: testing
phase: 03-improve-the-relevance-of-the-git-commit-messages-for-small-and-large-diffs
source: 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md
started: 2026-04-09T16:10:00+05:30
updated: 2026-04-09T16:20:00+05:30
---

## Current Test

number: 3
name: Single-Line Change Highlighting
expected: |
When a diff has only one line of change, it should be highlighted with a special marker (⬅️) in the prompt.
awaiting: user response

## Tests

### 1. Small Diff Entity Extraction

expected: When staging a small diff (few lines), the commit message should specifically mention the functions, classes, or variables that changed - not generic phrases like "update file".
result: pass

### 2. Context Limiting

expected: For small diffs, the context around changes should be limited (only 2-3 lines), making prompts more focused.
result: pass

### 3. Single-Line Change Highlighting

expected: When a diff has only one line of change, it should be highlighted with a special marker (⬅️) in the prompt.
result: pass

### 4. Large Diff Chunk Summarization

expected: When staging a large diff (many files), the system should process chunks in parallel and combine summaries into one cohesive message.
result: [pending]

### 5. Quality Score Display

expected: After generating commit messages, each should show a quality score (0-100) with category (Poor/Fair/Good/Excellent) in color-coded format.
result: [pending]

### 6. Quality Score Accuracy

expected: A specific, conventional-format message with good entity overlap should score higher (Good/Excellent) than a generic message.
result: [pending]

### 7. Quiet Mode Suppresses Scores

expected: Using --quiet or -q flag should suppress the quality score display.
result: [pending]

## Summary

total: 7
passed: 3
issues: 0
pending: 4
skipped: 0

## Gaps

[none]
