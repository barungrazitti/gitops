# AI Commit Generator v2 — Roadmap

**Created:** 2026-03-26
**Milestone:** v2 Rebuild
**Scope:** Modular architecture with deep codebase awareness

---

## Milestone: Clean Modular Architecture

**Goal:** Transform the monolithic codebase into a clean, modular architecture with deep context awareness that generates complete commit messages explaining what changed AND why.

**Success Criteria:**
- [x] Core module reduced to <300 lines (from 1804) (**241 lines**)
- [ ] Detectors module with component/convention/dependency analysis
- [ ] Formatters module with what/why/impact sections
- [ ] All QUAL-* requirements met (<5% generic messages, >90% include reasoning)
- [ ] Integration tests covering full pipeline

---

## Phase 1: Foundation — Architecture Refactoring

**Goal:** Break the monolithic `src/index.js` god class into clean, independent modules.

**Requirements:** ARCH-01, ARCH-02, ARCH-03

### Plan: Extract Core Modules

1. **Create module boundaries** — Define `src/core/`, `src/detectors/`, `src/formatters/` directory structure
2. **Extract CommitGenerator** — Move commit generation orchestration from `src/index.js` to `src/core/commit-generator.js`
3. **Extract GitWorkflow** — Move git operations orchestration to `src/core/git-workflow.js`
4. **Extract AutoGit logic** — Move auto-git workflow from `src/auto-git.js` orchestration to `src/core/auto-workflow.js`
5. **Reduce src/index.js** — Ensure main class is <300 lines, acting as facade only

### Plan: Provider Cleanup

6. **Reduce BaseProvider** — Extract preprocessing, formatting, analysis to utilities (target <300 lines)
7. **Simplify provider interface** — Clear contract: `generate(diff, context) → messages[]`

### Exit Criteria
- [x] `src/index.js` < 300 lines (**241 lines**)
- [x] `src/providers/base-provider.js` < 300 lines (**187 lines**)
- [x] Module dependency graph: Core → Detectors/Formatters (one-way)
- [x] All existing tests pass (0 new regressions, 3 net fixes)

---

## Phase 2: Detectors Module — Codebase Intelligence

**Goal:** Build detectors that understand component boundaries, conventions, and dependencies.

**Requirements:** DET-01, DET-02, DET-03, DET-04

**Plans:** 2 plans

Plans:
- [x] 02-01-PLAN.md — ComponentDetector (DET-01) and ConventionDetector (DET-02)
- [x] 02-02-PLAN.md — FileTypeDetector (DET-03) and DependencyMapper (DET-04)

### Exit Criteria
- [x] All detectors return consistent context objects
- [x] Detectors have no dependency on Formatters
- [x] Unit tests for each detector (92 tests total)
- [ ] Integration with CommitGenerator context enrichment

---

## Phase 3: Formatters Module — Complete Commit Messages

**Goal:** Generate commit messages with what changed, why changed, and impact.

**Requirements:** FMT-01, FMT-02, FMT-03, FMT-04

### Plan: Refactor MessageFormatter

1. **Split into strategy pattern** — `src/formatters/`
   - `conventional-formatter.js` — type(scope): description format
   - `freeform-formatter.js` — Natural language format
   - `formatter-factory.js` — Select based on config

### Plan: What Changed Section

2. **Implement WhatChangedFormatter** — `src/formatters/sections/what-changed.js`
   - Use ComponentDetector output for scope
   - List specific files/components affected
   - Describe nature of changes (added, removed, modified)

### Plan: Why Changed Section

3. **Implement WhyChangedFormatter** — `src/formatters/sections/why-changed.js`
   - Analyze commit context for motivation
   - Detect: bug fix, feature, refactor, docs
   - Explain problem or requirement

### Plan: Impact Section

4. **Implement ImpactFormatter** — `src/formatters/sections/impact.js`
   - Use DependencyMapper output for affected components
   - Document breaking changes
   - Note performance implications

### Exit Criteria
- [ ] `src/core/message-formatter.js` < 200 lines
- [ ] Commit messages include what/why/impact when context available
- [ ] Conventional commit format supported
- [ ] <5% generic messages in test suite

---

## Phase 4: Core Module — Orchestration & Quality

**Goal:** Wire everything together with proper orchestration and quality gates.

**Requirements:** CORE-01 through CORE-05, QUAL-01 through QUAL-04

### Plan: CommitGenerator Orchestration

1. **Enrich prompt building** — Use detector outputs in AI prompts
   - Pass component context to providers
   - Include convention information
   - Add dependency awareness

### Plan: Quality Gates

2. **Add message validator** — `src/core/message-validator.js`
   - Check for generic patterns ("update code", "fix bug")
   - Require component scope when detected
   - Require reasoning when motivation detectable
   - Reject messages below quality threshold

### Plan: Integration

3. **Wire detectors to generators** — Update `src/core/commit-generator.js`
   - Run detectors before AI generation
   - Pass enriched context to providers
   - Validate output before presenting

### Exit Criteria
- [ ] Context enrichment pipeline working
- [ ] Quality validation enforcing requirements
- [ ] End-to-end flow: git diff → detect → generate → validate → commit

---

## Phase 5: Testing & Polish

**Goal:** Comprehensive testing and performance optimization.

**Requirements:** QUAL-03, QUAL-04

### Plan: Integration Tests

1. **Full pipeline tests** — `tests/integration/`
   - Test with real git repositories
   - Verify what/why/impact generation
   - Test quality validation
   - Test error scenarios

### Plan: Performance

2. **Optimize hot paths**
   - Detector caching (avoid re-analyzing unchanged files)
   - Prompt size optimization
   - Response time targets met (<10s for typical diffs)

### Exit Criteria
- [ ] Integration test coverage >80%
- [ ] Performance targets met
- [ ] All QUAL-* requirements validated

---

## Phase Dependencies

```
Phase 1 (Foundation)
    ↓
Phase 2 (Detectors) ←───────┐
    ↓                        │
Phase 3 (Formatters)         │ (parallel OK)
    ↓                        │
Phase 4 (Core) ←────────────┘
    ↓
Phase 5 (Testing)
```

---

## Out of Scope (v2)

- Multi-language detectors (Python, Go, Rust)
- Web UI
- Team collaboration features
- CI/CD integrations

---

*Last updated: 2026-03-26*
