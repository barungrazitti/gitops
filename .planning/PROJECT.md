# AI Commit Generator v2

## What This Is

A complete rebuild (v2) of the AI-powered git commit helper CLI tool. The tool analyzes git diffs and generates intelligent, contextual commit messages. This version focuses on clean modular architecture with deep codebase awareness to produce complete commit messages that explain both what changed and why.

## Core Value

**High-quality, contextual commit messages that capture the full story behind code changes.**

The tool must understand component boundaries, existing patterns, and dependency relationships to generate commits that are specific and complete — not generic descriptions like "update code."

## Requirements

### Validated

✓ **Git workflow automation** — Stage, commit, pull, push with conflict resolution (existing)
✓ **AI-powered generation** — Generate commit messages using Groq (cloud) or Ollama (local) (existing)
✓ **Semantic analysis** — Analyze repository structure and file types (existing)
✓ **Secret detection** — Auto-redact API keys and sensitive data before sending to AI (existing)
✓ **Interactive CLI** — Commander-based CLI with Inquirer prompts (existing)
✓ **Caching layer** — Semantic similarity-based cache for similar changes (existing)
✓ **Activity logging** — Comprehensive logging of all operations (existing)
✓ **Clean modular architecture** — Well-separated, independent modules with clear boundaries (Validated in Phase 1: Foundation)

### Active

- [ ] **Component boundary detection** — Identify which modules/services/packages changed
- [ ] **Convention awareness** — Learn and apply existing codebase patterns (naming, structure)
- [ ] **Dependency mapping** — Understand how changes relate to imports/exports and call graphs
- [ ] **Complete commit messages** — Include both what changed AND why (motivation, impact)
- [ ] **Context-rich prompts** — Enrich AI prompts with deep project understanding

### Out of Scope

- **Multi-language support** — JavaScript/TypeScript codebases only for v2
- **GUI interface** — CLI-only in v2
- **Alternative VCS** — Git-only (no Mercurial, SVN, etc.)
- **Custom models** — Groq and Ollama only (no OpenAI, Anthropic, etc.)

## Context

**Current state (v1):**
- Functional CLI tool with core commit generation working
- Groq (primary) + Ollama (fallback) provider support
- Sequential fallback pattern for reliability
- Good semantic analysis but limited context awareness
- Commits often too generic or missing the "why"

**Technical environment:**
- Node.js 18+ CommonJS modules
- No build step or transpilation
- Pure JavaScript (TypeScript not required)
- Existing codebase has provider pattern but needs cleaner boundaries

**Known issues to address:**
- Monolithic core modules with intertwined concerns
- Limited project context understanding (basic file type detection)
- Generic commit messages without reasoning or impact
- Tight coupling between analysis, formatting, and generation logic

## Constraints

- **Runtime**: Node.js 18+ (no ESM conversion required, stay CommonJS)
- **AI Providers**: Groq (primary) and Ollama (fallback) only
- **VCS**: Git-only support
- **Deployment**: npm global package installation
- **Performance**: Must complete commit generation in <10 seconds for typical diffs
- **Compatibility**: Must work with existing ~/.config/ai-commit-generator/ config format

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Clean slate v2 rebuild | Current architecture too coupled for incremental improvement | — Pending |
| Deep context awareness | Generic commits don't explain the "why" behind changes | — Pending |
| Modular within monorepo | Keep simplicity of single package while improving organization | — Pending |
| Keep Groq/Ollama only | Existing providers work well, others add complexity | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-27 after Phase 1 completion*
