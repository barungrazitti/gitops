# Phase 2: Detectors Module — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 02-detectors-module-codebase-intelligence
**Areas discussed:** Component boundary detection, Convention analysis approach, Dependency mapping strategy, Detector output format & integration

---

## Component Boundary Detection

### Extend vs Replace project-type-detector.js

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing | Build ComponentDetector on top of project-type-detector.js. Reuse monorepo/WordPress detection. | ✓ |
| Replace with new module | Build from scratch in src/detectors/. More control but duplicates logic. | |
| Wrap existing | ComponentDetector delegates to project-type-detector.js. Clean separation but adds indirection. | |

**User's choice:** Extend existing

### Custom Component Mappings

| Option | Description | Selected |
|--------|-------------|----------|
| Config file only | Mappings in config.json under componentMap key. Simple. | |
| Config + auto-detect | Config priority + auto-detect packages/apps/services dirs, package.json names. | ✓ |
| You decide | Agent chooses best approach. | |

**User's choice:** Config + auto-detect

---

## Convention Analysis Approach

### Analysis Method

| Option | Description | Selected |
|--------|-------------|----------|
| Lightweight heuristics | File name sampling + regex. Fast (<100ms), no deps. | ✓ |
| AST-based analysis | Parse with acorn/babel. More accurate, adds dependency, slower. | |
| Hybrid | Heuristics for naming/structure, AST for imports. | |

**User's choice:** Lightweight heuristics

---

## Dependency Mapping Strategy

### Import Parsing Method

| Option | Description | Selected |
|--------|-------------|----------|
| Regex-based parsing | Match require()/import patterns. Fast, no deps. Misses dynamic imports. | ✓ |
| AST-based parsing | acorn AST nodes. Catches all forms. Adds dependency. | |
| Hybrid | Regex initial, AST fallback for suspicious patterns. | |

**User's choice:** Regex-based parsing

### Downstream Effect Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Direct dependents only | Files that directly import changed file. Fast, sufficient. | ✓ |
| Full transitive closure | Trace entire dependency graph. Expensive. | |
| Configurable depth | Default direct, config sets depth. Flexible but complex. | |

**User's choice:** Direct dependents only

---

## Detector Output Format & Integration

### Result Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Flat context object | Plain objects: { component: '...', conventions: {...} }. Simple, matches existing patterns. | ✓ |
| Structured report with metadata | { result, confidence, method, timestamp }. Richer but complex downstream. | |
| You decide | Agent chooses. | |

**User's choice:** Flat context object

---

## Agent's Discretion

- File type detection approach
- Exact auto-detect patterns for component boundaries
- Regex patterns for import parsing edge cases

## Deferred Ideas

None
