# Architecture

**Analysis Date:** 2026-03-26

## Pattern Overview

**Overall:** Modular Service-Oriented CLI with Provider Strategy Pattern

**Key Characteristics:**
- Layered architecture with clear separation of concerns
- Provider-based AI abstraction for flexibility
- Event-driven logging and monitoring throughout
- Sequential fallback pattern for reliability
- Smart caching with semantic similarity detection
- Comprehensive error handling with circuit breakers

## Layers

**CLI Entry Layer:**
- Purpose: Command-line interface and user interaction
- Location: `bin/aic.js`, `bin/aicommit.js`
- Contains: Commander.js CLI definitions, option parsing, command handlers
- Depends on: AICommitGenerator, AutoGit
- Used by: End users via terminal

**Orchestration Layer:**
- Purpose: Core workflow coordination and business logic
- Location: `src/index.js` (AICommitGenerator class), `src/auto-git.js` (AutoGit class)
- Contains: Main generate flow, auto-git workflow, provider orchestration
- Depends on: All core modules, all providers
- Used by: CLI layer

**Core Services Layer:**
- Purpose: Domain-specific business logic
- Location: `src/core/`
- Contains: Git operations, configuration, caching, analysis, logging, stats
- Depends on: Utilities layer, provider implementations
- Used by: Orchestration layer

**AI Provider Layer:**
- Purpose: AI abstraction with pluggable backends
- Location: `src/providers/`
- Contains: BaseProvider, GroqProvider, OllamaProvider, factory
- Depends on: Core layer (config, logging)
- Used by: Orchestration layer

**Utilities Layer:**
- Purpose: Shared helper functions and cross-cutting concerns
- Location: `src/utils/`
- Contains: Prompt building, diff processing, validation, performance utilities
- Depends on: Core layer (config)
- Used by: All layers

## Data Flow

**Commit Generation Flow:**

1. User invokes CLI (`aic` or `aicommit generate`)
2. CLI entry point creates AICommitGenerator instance
3. Generator validates git repository (GitManager)
4. GitManager retrieves staged diff
5. SecretScanner sanitizes diff (removes API keys, PII)
6. AnalysisEngine analyzes repository context (semantic analysis, file types, scope)
7. CacheManager checks for similar cached results
8. If cache miss: AIProviderFactory creates provider instance
9. Provider builds optimized prompt (EfficientPromptBuilder)
10. Provider sends request to AI service (Groq or Ollama)
11. Response parsed and validated (MessageFormatter)
12. CacheManager stores result
13. User selects message interactively
14. GitManager commits with selected message
15. StatsManager records commit, ActivityLogger logs entire workflow

**Auto-Git Workflow Flow:**

1. User runs `aic [message]`
2. AutoGit validates repository and checks for changes
3. Stage all changes automatically
4. Generate AI commit message (or use provided)
5. Commit changes
6. Pull latest changes from remote
7. If conflicts detected: offer AI-powered resolution
8. AI resolves conflicts file-by-file (chunked if large)
9. Commit resolved merge
10. Push changes to remote
11. Log all operations to activity logger

**State Management:**
- Immutable configuration (loaded once at startup)
- Ephemeral state in class instances
- Persistent cache on disk (~/.ai-commit-generator/cache)
- Stats stored in Conf (~/.config/ai-commit-generator-stats)
- Activity logs in ~/.ai-commit-generator/logs

## Key Abstractions

**AI Provider Pattern:**
- Purpose: Abstract AI service interactions behind common interface
- Examples: `src/providers/groq-provider.js`, `src/providers/ollama-provider.js`
- Pattern: BaseProvider defines contract, concrete implementations override
- Benefits: Easy to add new providers, sequential fallback, test isolation

**Semantic Analysis:**
- Purpose: Extract meaningful context from code changes
- Examples: `src/core/analysis-engine.js` (analyzeRepository, analyzeSemanticContext)
- Pattern: Parse files, extract functions/classes/hooks, categorize by type
- Usage: Enrich AI prompts with repository-specific context

**Smart Caching:**
- Purpose: Avoid redundant AI generations for similar changes
- Examples: `src/core/cache-manager.js` (generateKey, validateSemanticSimilarity)
- Pattern: Content fingerprinting (semantic + structural), Jaccard similarity
- Benefits: Faster responses, reduced API costs, consistent messages

**Sequential Fallback:**
- Purpose: Ensure reliability with multiple AI backends
- Examples: `src/index.js` (generateWithSequentialFallback)
- Pattern: Try Groq first, fall back to Ollama on failure
- Benefits: Always returns a result, graceful degradation

**Circuit Breaker:**
- Purpose: Prevent cascading failures from AI services
- Examples: `src/core/circuit-breaker.js`
- Pattern: Track failures, open circuit after threshold, attempt recovery
- Benefits: Fast fail when service is down, automatic recovery

## Entry Points

**CLI Entry (aic):**
- Location: `bin/aic.js`
- Triggers: User runs `aic` command
- Responsibilities: Parse args, delegate to AutoGit for full workflow
- Commands: default (auto workflow), setup, config, stats

**CLI Entry (aicommit):**
- Location: `bin/aicommit.js`
- Triggers: User runs `aicommit` or `aicommit generate`
- Responsibilities: Generate commit messages only
- Commands: generate, config, setup, hook, stats

**Main Class:**
- Location: `src/index.js`
- Triggers: Instantiated by CLI entry points
- Responsibilities: Core commit generation orchestration
- Key Methods: generate(), setup(), config(), stats()

**Auto Workflow:**
- Location: `src/auto-git.js`
- Triggers: User runs `aic` without subcommand
- Responsibilities: Full git automation (stage → commit → pull → push)
- Key Methods: run(), pullAndHandleConflicts(), resolveConflictsWithAI()

## Error Handling

**Strategy:** Multi-layered with fallback and recovery

**Patterns:**
- Try-catch blocks at all layer boundaries
- Specific error types for different failures (auth, rate limit, timeout)
- Circuit breaker prevents repeated failures
- Sequential fallback tries alternative providers
- User-friendly error messages with suggestions
- Comprehensive error logging with stack traces

**Error Categories:**
1. **User Errors:** Missing API key, no staged changes, invalid config
   - Action: Show helpful message, suggest fix
2. **Transient Errors:** Network timeout, rate limit, service unavailable
   - Action: Retry with exponential backoff, fallback provider
3. **Permanent Errors:** Invalid API key, auth failure
   - Action: Fail fast with clear instructions
4. **Conflict Errors:** Git merge conflicts
   - Action: Offer AI resolution, manual resolution, or cancel

## Cross-Cutting Concerns

**Logging:**
- Approach: Structured JSON logging to files (ActivityLogger)
- Levels: debug, info, warn, error
- Location: ~/.ai-commit-generator/logs/activity-YYYY-MM-DD.log
- Retention: 30 days, auto-cleanup
- Content: AI interactions, git operations, errors, performance metrics

**Validation:**
- Approach: Joi schemas for config, MessageFormatter validation
- Config validation on load and set
- Commit message validation before presentation to user
- Secret detection and redaction before sending to AI

**Authentication:**
- Approach: API keys stored in config (Conf)
- Groq: Requires API key (cloud service)
- Ollama: No auth required (local service)
- Keys never logged or exposed

**Performance:**
- Caching: Semantic similarity-based cache hits
- Circuit breaking: Fast fail on service issues
- Chunking: Large diffs split for AI processing
- Timeout management: Configurable per provider
- Resource tracking: Memory and CPU logging

**Security:**
- Secret scanning: Auto-redact API keys, passwords, tokens
- Input sanitization: Clean git refs, commit messages
- No credential logging: Never log sensitive data
- File access: Read-only on repository files

---

*Architecture analysis: 2026-03-26*
