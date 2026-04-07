# Quick Task 260407-hwa: Fix Groq 413 Error - Summary

**Date:** 2026-04-07
**Commit:** ed81f83
**Status:** Complete

## Changes Made

### 1. Reduced MAX_SAFE_SIZE in src/index.js (line 1227)
- Before: MAX_SAFE_SIZE = 60000 (~20K tokens)
- After: MAX_SAFE_SIZE = 24000 (~6K tokens)
- Smart truncation now produces diffs that fit within Groq 6K TPM free-tier limit

### 2. Reduced maxLines in src/utils/efficient-prompt-builder.js (line 404)
- Before: maxLines = 500 in truncateDiff()
- After: maxLines = 200
- Prompt builder fallback compression is more aggressive

### 3. Updated test data in tests/index.test.js
- Increased test diff sizes to exceed new 24KB threshold (Array 500 to 700, Array 1000 to 1400)

## Root Cause
The 60KB truncation target was calculated for Groq 131K context window, not the 6K TPM rate limit on the free tier. A 55KB diff translates to ~11,490 tokens, nearly double the 6K limit.

## Fix
24KB times ~4 chars/token equals ~6K tokens, leaving ~2K tokens of headroom for the prompt wrapper (instructions, context, examples).
