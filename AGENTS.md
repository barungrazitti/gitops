# AI Commit Generator - Agent Guidelines

## Build/Lint/Test Commands

### Testing

- `npm test` - Run full Jest test suite (501 tests, 26 suites)
- `npx jest tests/auto-git.test.js` - Run single test file
- `npm run test:coverage` - Jest with coverage report
- `npm run test:watch` - Jest in watch mode

### CLI Verification

- `./bin/aic --help` - List all commands
- `./bin/aic config --list` - View config (API key masked)
- `./bin/aic --dry-run` - Smoke-test the auto workflow
- `./bin/aic.js <cmd>` - Run directly without the shell shim

### Code Quality

- `npm run lint` - Run ESLint (must be 0 errors, 0 warnings)
- `npm run lint:fix` - Auto-fix linting issues

## Code Style Guidelines

### Imports & Structure

- Use CommonJS require() statements (not ES modules)
- Group imports: external libs first, then internal modules
- Use relative paths for internal modules: `./core/git-manager`

### Naming Conventions

- Classes: PascalCase (e.g., `GitManager`, `AICommitGenerator`)
- Methods/Variables: camelCase (e.g., `getStagedDiff`, `configManager`)
- Files: kebab-case (e.g., `diff-shaper.js`)
- Constants: UPPER_SNAKE_CASE

### Error Handling

- Always wrap async operations in try-catch blocks
- Throw descriptive Error objects with context
- Use consistent error message format: `Failed to [action]: ${error.message}`

### Code Patterns

- Use JSDoc comments for all classes and public methods
- Maintain consistent async/await pattern (no Promise chains)
- Use object destructuring for options: `const { provider, count } = options`
- Validate inputs early and fail fast
- Deep modules: one interface in (`manageDiffForAI`), complexity hidden inside

### Testing

- Write unit tests in `tests/` directory with `.test.js` extension
- Use Jest describe/test blocks with descriptive names
- Mock external dependencies (simple-git, ora, inquirer, Groq SDK)
- Test both success and error cases
- Use beforeEach for test isolation

## Architecture (post-refactor, 2026-08-17)

### Key Design Rules

1. **DiffShaper owns the diff budget.** `src/core/diff-shaper.js` is the ONLY module that truncates/chunks diffs (MAX_SAFE_SIZE = 18000 chars). The prompt builder and providers must NOT re-truncate. The pipeline pre-computes `diffAnalysis` + `typeHint` and hands them to the prompt builder; the builder only falls back for direct construction.
2. **AutoGit is dependency-injected.** `new AutoGit({ gitManager, analysisEngine, configManager, generateMessages, conflictResolver, activityLogger })` — never reach through `aiCommit.*` properties.
3. **Conflict resolution uses `generateResponse`**, NOT `generateCommitMessages` (the commit path wraps prompts in commit-only instructions).
4. **Conflict-marker detection must be line-anchored** (`/^<{7}|^={7}\s*$|^>{7}/m`) — substring matches false-positive on source code that merely mentions markers. Diff text gets the `DIFF_MARKER_REGEX` variant (allows the `+` prefix on added marker lines); both live in `conflict-resolver.js` and are exported for `auto-git.js`.
5. **Reasoning models (gpt-oss) need higher max_tokens** — groq-provider enforces a 2000-token floor for them; a low budget yields empty `message.content`.
6. **`.env` overrides config** via `ConfigManager._applyEnvOverrides()` (`GROQ_API_KEY`, `AIC_MODEL`, `AIC_PROVIDER`). Env values are never persisted to the conf store.
7. **Secrets are masked in output** — never print `config.apiKey` raw.
8. **`bin/aic.js` is the single composition root.** `buildGenerator()` builds every collaborator once and injects them into `AICommitGenerator` + `AutoGit`. Providers receive shared `configManager`/`activityLogger` via `AIProviderFactory.create(name, deps)` — never fabricated per call. `AICommitGenerator` accepts `deps` with fresh-instance defaults.
9. **The dry-run stdout seam**: `auto-git` dry-run prints the candidate commit message to stdout (`aic --dry-run | head -1` for hooks), silently when none can be generated.

### Core Modules

| Module | Responsibility |
|--------|---------------|
| `src/index.js` | `AICommitGenerator` — generation pipeline orchestrator (~850 lines) |
| `src/auto-git.js` | `AutoGit` — stage/commit/pull/AI-resolve/push workflow |
| `src/cli-presenter.js` | Console UI (menus, config/setup/stats display) |
| `src/core/diff-shaper.js` | Diff budget owner: filtering, truncation, chunking |
| `src/core/message-ranker.js` | Message scoring/ranking |
| `src/core/conflict-resolver.js` | AI merge-conflict resolution (with secret redaction) |
| `src/core/message-validator.js` | QUAL-01/02 quality gates (logged per generation) |
| `src/core/git-manager.js` | Git operations |
| `src/core/config-manager.js` | Config + .env overrides (dotenv) |
| `src/core/cache-manager.js` | Diff-keyed message cache |
| `src/core/analysis-engine.js` | Repository context analysis |
| `src/core/stats-manager.js` | Usage statistics |
| `src/core/activity-logger.js` | Structured logs in `.aic-logs/` |
| `src/core/circuit-breaker.js` | Provider failure protection |
| `src/core/hook-manager.js` | Git hook management |
| `src/core/message-formatter.js` | Conventional commit formatting |
| `src/providers/*` | Groq + Ollama adapters on `base-provider.js` |
| `src/utils/efficient-prompt-builder.js` | Prompt assembly (NO size management) |

### Removed (do not re-add)

- Shadow modules: `src/detectors/`, 9 dead utils, `optimized-diff-processor`, `commit-generator`, `provider-orchestrator`, duplicate circuit-breaker
- Dead base-provider methods (~600 lines: analyzeDiffContent, WithValidation, etc.)
- `bin/aicommit.js`, `bin/aic.c` — single `aic` entry point now
- All `docs/` directory and secondary .md files (only README.md + AGENTS.md remain)
- `src/formatters/` (formatter-factory + sections, ~1,000 lines) — only consumer was dead `MessageFormatter.formatWithContext`
- `src/utils/performance-utils.js` (291 lines) — zero callers
- Dead cache/stats surface: `findSimilar*`, `quickHash`, `recordCacheHit/Miss/Error`, duplicate `isSafe`, `sanitizeDiffContent`, `TokenCounter.estimateCost/clearCache`, unused prompt-template builders, `DiffCategorizer.getDefaults/validateThresholds`
- Dead provider-factory statics: `getDefaultProvider`, `getProviderConfig`, `isProviderAvailable`, `testProvider`, `getProviderModels`, `setProviderConfig`, `getAllAvailableModels`, `getBestAvailableModel`, `autoConfigureProvider`, `getAvailableProviders` (only `create(name, deps)` + `validateProvider` remain)

## Project Status

| Metric | Status |
|--------|--------|
| Tests | 501 tests, 26 suites ✅ |
| Lint | 0 errors, 0 warnings ✅ |
| Default model | `openai/gpt-oss-20b` (Groq) |
| Entry point | `bin/aic` (single command) |
| Config | `.env` overrides + conf store |

---

*Last updated: 2026-08-17*
