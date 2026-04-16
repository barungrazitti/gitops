# Phase 2: Quality & Standards - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Establishing consistent code style and automated linting using the Airbnb JavaScript guide for the entire project. This phase will add ESLint and Prettier configurations, integrate them into the development workflow, and fix critical style issues to establish a baseline for code quality.

</domain>

<decisions>
## Implementation Decisions

### Prettier Integration
- **Manual execution only** — Prettier will run via `npm run format` command, not automated via pre-commit hooks or on-save
- **Developer controls when formatting happens** — no forced automation during commit workflow

### ESLint Strictness
- **Strict from day one** — All Airbnb rules enforced as errors immediately
- **Fix all issues upfront** — Slower initial setup but cleaner codebase from the start

### Linting Scope
- **All JavaScript files** — ESLint will lint `src/`, `tests/`, `bin/`, and `scripts/` directories
- **One style standard across entire project** — No exempt files

### Format-on-Save Behavior
- **Yes, recommend it** — Include format-on-save setting in project documentation
- **Best for team consistency** — Especially if multiple developers join

### ESLint Configuration Approach
- **Use eslint-config-airbnb-base as-is** — No custom overrides
- **Strict Airbnb rules from day one** — Accept all Airbnb opinions

### Prettier/ESLint Conflict Resolution
- **Yes, use eslint-config-prettier** — Disable ESLint formatting rules that conflict with Prettier
- **Recommended approach** — Prevents conflicting auto-fixes during development

### Test File Rules
- **Single .eslintrc.json for all files** — Tests and application code share the same rule set
- **Add `env: { jest: true }`** — Allows Jest globals in all files

### Claude's Discretion
- **Specific rule overrides** — If Airbnb rules are blocking core functionality (not just preference), Claude can add targeted overrides on a case-by-case basis
- **Order of ESLint/Prettier configs** — Claude can decide the optimal extends order in .eslintrc.json

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements
- `.planning/REQUIREMENTS.md` — QUAL-01, QUAL-02, QUAL-03 acceptance criteria
- `.planning/PROJECT.md` — Project constraints and style guide decision

### External Documentation
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript) — The authoritative source for ESLint rules being implemented
- [eslint-config-prettier](https://github.com/prettier/eslint-config-prettier) — How to disable conflicting ESLint formatting rules
- [Prettier Documentation](https://prettier.io/docs/en/) — Prettier configuration options

</canonical_refs>

<code_context>
## Existing Code Insights

### Project Structure
- **~30 source files** in `src/` directory organized by `core/`, `providers/`, `utils/`
- **CommonJS project** — Using `require()` not ES modules (affects ESLint parser options)
- **No existing linting configs** — Clean slate for ESLint/Prettier setup
- **JSDoc comments already in use** — Code has some documentation style to consider

### Package Management
- **package.json exists** — Needs scripts added (lint, format, lint:fix)
- **devDependencies has jest** — Test runner already configured
- **Node.js >= 18.0.0** — Modern Node, full ESLint feature support

### Integration Points
- **bin/ directory** — Contains CLI entrypoints (aic.js, aicommit.js)
- **tests/ directory** — Jest test files exist
- **scripts/ directory** — Build and deploy scripts exist

</code_context>

<specifics>
## Specific Ideas

- **npm scripts to add**: `npm run lint`, `npm run lint:fix`, `npm run format`, `npm run format:check`
- **ESLint extends order**: `['airbnb-base', 'prettier']` (prettier must be last to disable conflicting rules)
- **Prettier defaults**: Use Prettier defaults (single quotes, trailing commas, 2 spaces, semicolons)
- **IDE recommendation**: Document VS Code format-on-save setting in CONTRIBUTING.md or similar

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-quality-standards*
*Context gathered: 2026-03-20*