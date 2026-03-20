# Phase 1: Stability & Error Recovery - Research

**Researched:** 2026-03-20
**Domain:** Error Handling & AI-Powered Recovery
**Confidence:** HIGH

## Summary

This research focuses on fixing a critical crash in the `ai-commit-generator` caused by a missing `provideErrorSuggestions` method and implementing a robust error recovery system using AI-powered suggestions. The goal is to move from a silent or crashing failure mode to a helpful, informative, and resilient one.

**Primary recommendation:** Implement `provideErrorSuggestions` in `src/index.js` using a "smart fallback" pattern: try AI-powered suggestions first if a provider is available and functional; otherwise, fall back to a comprehensive local knowledge base of common Git and AI errors.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| axios | ^1.7.9 | HTTP requests | Used for Ollama and Groq API calls. |
| chalk | ^4.1.2 | Terminal styling | Standard for CLI output in this project. |
| groq-sdk | ^0.33.0 | Groq Cloud AI | Official SDK for Groq integration. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ora | ^5.4.1 | Terminal spinners | Used for showing progress during long-running AI tasks. |

## Architecture Patterns

### Recommended Implementation Structure
The `provideErrorSuggestions` method should be added to the `AICommitGenerator` class in `src/index.js`.

```javascript
/**
 * Provide helpful suggestions based on error type
 */
async provideErrorSuggestions(error, options = {}) {
  // 1. Identify error type
  const errorType = this.identifyErrorType(error);
  
  // 2. Try AI-powered suggestion if possible
  if (this.isAIAvailable(options)) {
    try {
      const suggestion = await this.getAISuggestion(error, options);
      if (suggestion) {
        console.log(chalk.yellow(`\n💡 AI Suggestion: ${suggestion}`));
        return;
      }
    } catch (aiError) {
      // Silently fall back to local suggestions
    }
  }

  // 3. Fallback to local suggestions
  const localSuggestion = this.getLocalSuggestion(errorType);
  if (localSuggestion) {
    console.log(chalk.yellow(`\n💡 Suggestion: ${localSuggestion}`));
  }
}
```

### Error Taxonomy
| Error Category | Indicators | Suggested Action |
|----------------|------------|------------------|
| **Git: No Changes** | `No staged changes` | `git add <file>` |
| **Git: Not a Repo** | `not a git repository` | `git init` |
| **AI: Auth** | `401`, `API key not configured` | `aic setup` |
| **AI: Rate Limit** | `429` | Wait or switch provider |
| **AI: Connection** | `ECONNREFUSED` | Start Ollama / Check internet |
| **AI: Context Limit** | `context length exceeded` | Stage fewer files / smaller diff |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AI interaction | Raw axios calls for Groq | `groq-sdk` | Handles retries, types, and auth better. |
| Config management | Manual JSON parsing | `conf` | Already integrated; handles cross-platform paths and defaults. |
| Terminal styling | ANSI escape codes | `chalk` | Cleaner API and auto-detection of color support. |

## Common Pitfalls

### Pitfall 1: Infinite Loops in Error Handling
**What goes wrong:** `provideErrorSuggestions` itself causes an error (e.g., trying to use AI when AI is failing), which triggers the error handler again.
**How to avoid:** Always wrap AI-powered suggestions in a try-catch block that fails silently to local suggestions.

### Pitfall 2: Silent Failures
**What goes wrong:** Errors are logged but the user isn't told what to do next.
**How to avoid:** Ensure every error path leads to an actionable suggestion for the user.

### Pitfall 3: Version Stale SDKs
**What goes wrong:** Using outdated `groq-sdk` might miss new models or stability fixes.
**How to avoid:** Regularly check `npm view groq-sdk version`. (Current is 1.1.1, package uses 0.33.0).

## Code Examples

### AI-Powered Error Suggestion Prompt
```javascript
const prompt = `I encountered an error while trying to generate a git commit message.
Error: ${error.message}
Operation: ${options.operation}
Context: ${options.provider} provider was being used.

Please provide a short, 1-sentence actionable suggestion for the developer to fix this.
Do not explain the error, just provide the solution.`;

// In GroqProvider/OllamaProvider:
await provider.generateResponse(prompt, { maxTokens: 100 });
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 |
| Config file | jest.config.js |
| Quick run command | `npm test tests/error-handling.test.js` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STAB-01 | Fix crash from missing `provideErrorSuggestions` | unit | `jest tests/index.test.js` | ✅ |
| STAB-02 | Implement AI-powered suggestions | integration | `jest tests/error-handling.test.js` | ❌ Wave 0 |
| STAB-03 | Fallback suggestions for AI failure | unit | `jest tests/error-handling.test.js` | ❌ Wave 0 |
| STAB-04 | Handle common Git errors specifically | unit | `jest tests/error-handling.test.js` | ❌ Wave 0 |

### Wave 0 Gaps
- [ ] `tests/error-handling.test.js` — covers new requirements.
- [ ] Mock for `BaseProvider.generateResponse` to simulate AI success/failure during error suggestion.

## Sources

### Primary (HIGH confidence)
- `src/index.js` - Call site identified at L205.
- `src/providers/base-provider.js` - `generateResponse` interface identified.
- `src/core/activity-logger.js` - Error logging patterns identified.

### Secondary (MEDIUM confidence)
- `npm view` - Package versions verified.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified via package.json and npm.
- Architecture: HIGH - Clear missing method and established provider pattern.
- Pitfalls: MEDIUM - Based on common CLI tool experience.

**Research date:** 2026-03-20
**Valid until:** 2026-04-20
