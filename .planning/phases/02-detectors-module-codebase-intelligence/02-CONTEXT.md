# Phase 2: Detectors Module — Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the Detectors module (`src/detectors/`) with 4 detectors that analyze code changes to produce context for AI-powered commit message generation. Detectors identify component boundaries, project conventions, file types, and dependency relationships. They feed enriched context into the AI prompt pipeline (Phase 4) and are consumed by formatters (Phase 3). Per ARCH-02, detectors must have zero dependency on formatters.

</domain>

<decisions>
## Implementation Decisions

### Component Boundary Detection
- **D-01:** Extend existing `src/utils/project-type-detector.js` rather than replacing it. Build `ComponentDetector` in `src/detectors/component-detector.js` that reuses monorepo/WordPress detection from the existing module.
- **D-02:** Custom component mappings use config file + auto-detect. Users define mappings in `~/.config/ai-commit-generator/config.json` under a `componentMap` key. Auto-detect common patterns: `packages/`, `apps/`, `services/` directories, `package.json` `name` fields. Config mappings take priority over auto-detected patterns.

### Convention Analysis
- **D-03:** Use lightweight heuristics (file name sampling + regex on file contents) rather than AST-based analysis. Target <100ms execution. No additional dependencies. Accuracy sufficient for commit message context — does not need to be perfect.

### Dependency Mapping
- **D-04:** Use regex-based parsing for import/export statements (`require('...')`, `import ... from '...'`). No AST dependency. Handles CommonJS and ESM patterns.
- **D-05:** Downstream effect detection traces direct dependents only (files that directly import the changed file). No transitive closure — fast and predictable. Sufficient for commit message scope ("affects X, Y, Z").

### Detector Output & Integration
- **D-06:** Each detector returns a flat context object (plain JS object). No metadata wrappers, confidence scores, or timestamps. Matches existing `analysis-engine.js` output patterns. Easy to serialize into AI prompts.

### Agent's Discretion
- File type detection approach (regex heuristics vs extension-based — existing `project-type-detector.js` already handles most of this)
- Exact auto-detect patterns for component boundaries beyond packages/apps/services
- Regex patterns for import parsing (edge cases like dynamic requires, template literals)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — DET-01 through DET-04 define detector acceptance criteria

### Phase 1 Foundation
- `.planning/phases/phase-1-foundation/1-foundation-SUMMARY.md` — Module structure created in Phase 1 (16 new modules, facade pattern)
- `.planning/phases/phase-1-foundation/1-foundation-SUMMARY.md` §key_files — Lists all created modules and their locations

### Existing Code to Extend
- `src/utils/project-type-detector.js` — Existing project/component detection (479 lines). ComponentDetector should extend, not replace.
- `src/core/analysis-engine.js` — Existing semantic analysis and file context building (785 lines). Reference for output format patterns.
- `src/utils/diff-analyzer.js` — Semantic diff analysis (new from Phase 1). May provide input to detectors.

### Codebase Maps
- `.planning/codebase/CONVENTIONS.md` — Project coding conventions (naming, imports, error handling)
- `.planning/codebase/STRUCTURE.md` — Directory layout and module organization
- `.planning/codebase/STACK.md` — Technology stack (Node.js 18+, CommonJS, no build step)

### Roadmap
- `.planning/ROADMAP.md` §Phase 2 — Phase goal, 4 detector specifications, exit criteria

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/project-type-detector.js` — Monorepo boundary detection, WordPress detection, project type classification. ComponentDetector extends this.
- `src/core/analysis-engine.js` — File context building, semantic analysis. Reference for how context objects are structured and consumed.
- `src/utils/diff-analyzer.js` — Semantic diff analysis from Phase 1. Can feed into detectors for change understanding.

### Established Patterns
- CommonJS `module.exports` for all modules
- PascalCase class names, kebab-case filenames
- Flat context objects (no wrapper/metadata) — see analysis-engine.js output
- Lazy require() inside methods to avoid circular dependencies (Phase 1 pattern)
- JSDoc comments on all classes and public methods
- Try-catch with descriptive error messages

### Integration Points
- `src/detectors/` directory exists (created in Phase 1, empty)
- `src/core/provider-orchestrator.js` — Will consume detector output in Phase 4 for AI prompt enrichment
- `src/core/diff-manager.js` — Provides diff data that detectors analyze
- `src/core/commit-generator.js` (if created) — Orchestrates detection → generation pipeline in Phase 4

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-detectors-module-codebase-intelligence*
*Context gathered: 2026-03-27*
