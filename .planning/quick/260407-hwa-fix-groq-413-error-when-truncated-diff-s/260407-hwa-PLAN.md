# Quick Task 260407-hwa: Fix Groq 413 Error When Truncated Diff Still Too Large

**Mode:** quick
**Date:** 2026-04-07
**Status:** ready

## Goal

Fix Groq 413 error where smart-truncated diff (55KB) still exceeds the `llama-3.1-8b-instant` model's 6,000 TPM limit on the free tier, requiring 11,490 tokens.

## Root Cause

1. `MAX_SAFE_SIZE = 60000` in `manageDiffForAI()` is too large for Groq free tier
2. `EfficientPromptBuilder.compressPrompt()` doesn't effectively reduce 55K char diffs
3. No provider-aware size limits - all providers get the same truncation target

## Tasks

### Task 1: Reduce MAX_SAFE_SIZE and add provider-aware token budget

**Files:** `src/index.js`
**Action:**
- In `manageDiffForAI()` (line ~1227): Reduce `MAX_SAFE_SIZE` from 60000 to 24000 (~6K tokens safe for free-tier Groq)
- This ensures smart truncation produces a diff that, when wrapped in prompt instructions, stays under 6K tokens
- Add a comment explaining the rationale (24KB * ~4 chars/token = ~6K tokens, leaving headroom for prompt wrapper)

**Verify:** With a 24KB max, a 560KB diff will be truncated to 24KB, which is ~6K tokens + prompt overhead should stay under 6K TPM

**Done:** `manageDiffForAI()` uses MAX_SAFE_SIZE = 24000

### Task 2: Make EfficientPromptBuilder compression more aggressive for large diffs

**Files:** `src/utils/efficient-prompt-builder.js`
**Action:**
- In `compressPrompt()` (line ~291): The condition `diff.length > this.maxPromptLength * 0.6` (4800 chars) is fine for triggering compression, but `truncateDiff()` needs to truncate to a much smaller size
- In `truncateDiff()`: Ensure it truncates to a size that fits within token limits
- The default `maxPromptLength` is 8000 tokens - the diff portion should be at most ~60% of that (4800 tokens = ~19K chars)
- Ensure the truncation actually produces output small enough

**Verify:** After compression, a 55K char diff should be reduced to ~19K chars or less

**Done:** Prompt builder effectively compresses large diffs to fit within token budgets

### Task 3: Add tests for the fix

**Files:** `tests/index.test.js`
**Action:**
- Verify existing tests for smart truncation still pass with new MAX_SAFE_SIZE
- Ensure test expectations align with the new truncation behavior

**Verify:** `npm test` passes

**Done:** All tests pass with the updated truncation limits
