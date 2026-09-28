# Plan 005: Close the test gaps and repo hygiene (coverage for the composition root, stats, env overrides, cache; release guards; doc accuracy; drop idle deps)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c4269a2..HEAD -- bin/aic.js src/core/stats-manager.js src/core/cache-manager.js src/core/config-manager.js src/utils/token-counter.js src/utils/prompt-templates.js src/providers/ollama-provider.js package.json scripts/deploy.sh README.md AGENTS.md`
> Plans 001–004 legitimately touch `src/core/config-manager.js`,
> `src/core/cache-manager.js` (fingerprint only), `bin/aic.js` is UNTOUCHED
> by them; `package.json` is untouched by them. On an unexplained mismatch
> with the excerpts, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (dep removals each gated by their own green run)
- **Depends on**: plans/001-green-baseline-ci.md (execute LAST overall — the
  docs step records final test counts)
- **Category**: tests / dx / deps / docs
- **Planned at**: commit `c4269a2`, 2026-09-27

## Why this matters

The parts of the system that wiring depends on are the least tested:
`bin/aic.js` — the composition root that builds every collaborator — has 0%
coverage; `StatsManager` (on the live generation path) 9%; the documented
`.env` override rule and the cache's entire persistence half are untested.
Meanwhile `deploy.sh --publish` can ship an npm release with no matching git
tag (v1.5.0 is published in `package.json` but the tag doesn't exist —
latest tag is v1.4.0), every build drops an untracked `build-info.json` into
the repo root, README documents a deleted `src/formatters/` directory and a
test count that is wrong, and three heavyweight dependencies (tiktoken,
handlebars, axios) do near-zero work.

## Current state

- `bin/aic.js` — 336 lines. Exports only `{ program }` (line 334-335);
  `buildFullGenerator` (line 22) and `buildLightGenerator` (line 106) are
  internal. Guard at line 330: `if (require.main === module) { main(); }` —
  requiring the module from a test is SAFE (no CLI runs).
- `src/core/stats-manager.js` — 131 lines, `Conf`-backed
  (`projectName: 'ai-commit-generator-stats'`), methods `recordCommit`
  (lines 27–60) and `getStats` (lines 65–127). No test file references it.
- `src/core/config-manager.js` — `_applyEnvOverrides` (lines 71–82) reads
  `GROQ_API_KEY` / `AIC_MODEL` / `AIC_PROVIDER` in `load()`; env values must
  never persist to the store. Untested.
- `src/core/cache-manager.js` — constructor sets
  `this.cacheDir = path.join(os.homedir(), '.ai-commit-generator', 'cache')`
  (line 20); `setValidated` (124–145) writes `<key>.json` with
  `{ messages, timestamp, diffHash, ... }`; `getValidated` (87–119) enforces
  the 24h TTL; `cleanup()` (150–206) removes expired/corrupted files and
  enforces a 500-file cap. Persistence half untested. NOTE: constructor
  fire-and-forgets `cleanup()` against the REAL home dir — tests should
  override `cacheDir` immediately after construction and be tolerant of that
  first cleanup touching the user's real cache (it only deletes expired
  entries; acceptable).
- `tests/setup.js` — global `beforeEach` mocks console (lines 23–29);
  `global.testUtils.createMockConfig` (lines 62–71) still defaults to
  `provider: 'openai', model: 'gpt-3.5-turbo'` — a provider this app never
  shipped; stale defaults seed future mock-drift bugs.
- `tests/index.test.js` — contains TWO tests with the identical name
  `should filter out node_modules files` (lines 365 and 488) — Jest warns.
- `scripts/deploy.sh` — lines 93–170 write a `.npmignore` (only if absent)
  listing files that no longer exist (`TODO.md`, `TESTING.md`,
  `FORMATTING_GUIDE.md`, `EXAMPLES.md` at lines 108–112) and omitting real
  ones (`plans/`, `build-info.json`, `scripts/`, `.github/`, `install.sh`).
  The `--publish` path (lines 176–184) is a bare `npm publish` — no version↔
  tag check. `git tag --list` top entry is `v1.4.0`; `package.json` version
  is `1.5.0`.
- `scripts/build.sh` — lines 70–79 write `build-info.json` into the repo
  root; `git check-ignore build-info.json` exits 1 (not ignored).
- `README.md` — line 6 badge `tests-480 passing`; line 161 "(480 tests, 25
  suites)"; line 193 documents `└── formatters/ # Message section formatters`
  (directory deleted weeks ago; AGENTS.md bans re-adding); Quick Start
  (lines 18–36) never puts `aic` on PATH (the symlink instructions live in
  Troubleshooting, lines 204–210, and `install.sh` — which automates exactly
  this — is mentioned nowhere: `grep -c install.sh README.md` → 0).
- `AGENTS.md` — "472 tests, 26 suites ✅" (now stale), "`src/index.js` …
  (~850 lines)" (actual: 445), Rule 8 says `buildGenerator()` (actual:
  `buildFullGenerator()` + `buildLightGenerator()`), Core Modules table
  omits `src/core/generation-pipeline.js` and 10 of 11 `src/utils/` modules.
- Dependencies (verified by grep of src/, bin/, scripts/):
  - `tiktoken` → only `src/utils/token-counter.js:9`; its only caller is
    `src/utils/diff-categorizer.js:73` (`tokens: this.tokenCounter.countTokens(diff)`);
    `token-counter.js:37` already falls back to `Math.ceil(text.length / 4)`;
    `groq-provider.js:131-133` has its own `estimateTokens` (length/4).
  - `handlebars` → only `src/utils/prompt-templates.js` (4 compiled
    templates — plain string interpolation, no partials/helpers/logic beyond
    one `{{#if}}`).
  - `axios` → only `src/providers/ollama-provider.js:1,41,75`; `engines` is
    node >= 18 where global `fetch` exists; no other src file uses any HTTP
    client.
- Conventions: Jest suites at `tests/<name>.test.js` or
  `tests/core/<name>.test.js`; `jest.mock('conf', ...)` pattern for Conf
  classes in `tests/config-manager.test.js:8-19`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests (all) | `npm test --silent 2>&1 \| tail -5` | 0 failed |
| Coverage | `npm run test:coverage -- --silent 2>&1 \| tail -30` | runs, threshold-free |
| Deps install | `npm install --silent` | exit 0 after removals |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope**:
- `tests/bin-aic.test.js` (create), `tests/stats-manager.test.js` (create)
- `tests/config-manager.test.js`, `tests/cache-manager.test.js`,
  `tests/index.test.js`, `tests/setup.js` (defaults only),
  `tests/ollama-provider.test.js` (axios→fetch mock rewrite)
- `scripts/deploy.sh`, `.gitignore` (one line)
- `README.md`, `AGENTS.md`
- `src/utils/token-counter.js`, `src/utils/prompt-templates.js`,
  `src/providers/ollama-provider.js`, `package.json` (+ lockfile via npm)

**Out of scope** (do NOT touch):
- `src/utils/diff-categorizer.js` logic — it keeps calling
  `countTokens`; only the counter's implementation changes.
- `scripts/build.sh` except nothing — leave it (plan 001 already trimmed
  its duplicate test run; `build-info.json` becomes ignored, still written).
- `install.sh` — works; README will finally reference it.
- jest.config.js (plan 001 owns it).

## Git workflow

- Branch: `advisor/005-tests-hygiene`. Execute after 001–004.
- One commit per logical unit, conventional style, e.g.
  `test(stats): cover recordCommit/getStats round-trip Refs:`

## Steps

### Step 1: Composition-root smoke test + small test hygiene

1. Create `tests/bin-aic.test.js`:
   ```js
   const { execFile } = require('child_process');
   const { promisify } = require('util');
   const execFileAsync = promisify(execFile);

   describe('bin/aic.js (composition root smoke)', () => {
     it('requires cleanly without executing the CLI', () => {
       const aic = require('../bin/aic');
       expect(aic.program).toBeDefined();
       expect(typeof aic.program.name).toBe('function');
     });

     it('prints a version via subprocess', async () => {
       const { stdout } = await execFileAsync('node', ['bin/aic.js', '--version'], {
         cwd: expect.getState().testPath.replace(/\/tests\/.*$/, ''),
       });
       expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
     }, 15000);

     it('lists commands via --help', async () => {
       const { stdout } = await execFileAsync('node', ['bin/aic.js', '--help'], {
         cwd: expect.getState().testPath.replace(/\/tests\/.*$/, ''),
       });
       expect(stdout).toContain('auto');
       expect(stdout).toContain('setup');
     }, 15000);
   });
   ```
   (If the cwd trick is fragile in this environment, hardcode
   `process.cwd()` — jest roots include the repo root.)
2. In `tests/index.test.js`, rename the SECOND occurrence (line ~488) of
   `it('should filter out node_modules files', ...)` to
   `it('should filter out node_modules files (semantic context variant)', ...)`
   — actually READ both tests first and rename each to describe its actual
   fixture (they differ: one plain, one with semantic context).
3. In `tests/setup.js`, update `createMockConfig` defaults to match reality:
   `provider: 'groq', model: 'openai/gpt-oss-20b',` (keep other keys).

**Verify**: `npx jest tests/bin-aic.test.js --silent` → 3 pass.
`npm test --silent 2>&1 | grep -i "duplicate"` → no duplicate-name warnings.

### Step 2: StatsManager suite

Create `tests/stats-manager.test.js`, mocking `conf` with the pattern from
`tests/config-manager.test.js:8-19` but backed by a mutable store object:

- `recordCommit('groq', 120)` twice → `getStats()` returns
  `totalCommits: 2`, `providerUsage.groq: 2` (via `providerBreakdown`),
  `mostUsedProvider: 'groq'`, `averageResponseTime: 120`.
- response history caps at 100 entries (record 105 → history length 100 in
  the store; assert via a 105-iteration loop against the mocked store).
- empty store → `getStats()` returns zeros and `mostUsedProvider: 'none'`.

**Verify**: `npx jest tests/stats-manager.test.js --silent` → all pass.

### Step 3: .env override tests (documents AGENTS.md rule 6)

Extend `tests/config-manager.test.js` with a describe block (save/restore env
in beforeEach/afterEach):

- set `process.env.GROQ_API_KEY='gsk_env_test'` → `load()` returns
  `apiKey: 'gsk_env_test'` AND the mocked conf `store` was never `set` with
  it (env values are never persisted).
- `AIC_MODEL='llama-3.1-8b-instant'` → `load().model` reflects it.
- `AIC_PROVIDER='ollama'` → `load().defaultProvider` is `'ollama'`.
- delete all three → store values flow through unchanged.

**Verify**: `npx jest tests/config-manager.test.js --silent` → all pass.

### Step 4: Cache persistence tests

Extend `tests/cache-manager.test.js`:

- Construction: `const cm = new CacheManager();` then immediately redirect
  `cm.cacheDir = <fs.mkdtempSync(...)>` — all tests use the temp dir.
- Round-trip: `setValidated(diffA, ['feat: x'])` then a FRESH `CacheManager`
  (same redirected dir, per-instance memory cache) `getValidated(diffA)`
  returns `['feat: x']`.
- TTL expiry: hand-write `<dir>/<key>.json` using
  `cm.generateKey(diffA)` with `{ messages: ['old'], timestamp:
  Date.now() - 86400001 }` → `getValidated(diffA)` returns null and the file
  is gone.
- Cap eviction: write 502 fake `{timestamp: Date.now()}` files → run
  `cleanup()` → `fs.readdirSync(dir).filter(f => f.endsWith('.json')).length`
  is <= 500.
- Corrupted file: write invalid JSON → `cleanup()` removes it (returns
  count >= 1).

**Verify**: `npx jest tests/cache-manager.test.js --silent` → all pass.

### Step 5: Release hygiene

1. `.gitignore`: add `build-info.json` (near the build artifacts section).
2. `scripts/deploy.sh`, in the `--publish` block (line 176), insert a guard
   BEFORE `npm publish`:
   ```bash
   if [ "$1" = "--publish" ]; then
       print_status "Publishing to npm..."

       # Guard: the published version must have a matching git tag
       VERSION=$(node -p "require('./package.json').version")
       if ! git tag --list | grep -qx "v${VERSION}"; then
           print_error "git tag v${VERSION} does not exist. Create and push it first:"
           print_error "  git tag v${VERSION} && git push origin v${VERSION}"
           exit 1
       fi

       if npm publish; then
   ```
3. `scripts/deploy.sh` .npmignore heredoc (lines 96–168): delete the four
   dead doc lines (`TODO.md`, `TESTING.md`, `FORMATTING_GUIDE.md`,
   `EXAMPLES.md`) and add: `plans/`, `build-info.json`, `scripts/`,
   `.github/`, `install.sh`, `.eslintrc.json` (replacing `.eslintrc.js`
   which doesn't exist — verify with `ls .eslintrc*` first).

**Verify**: `bash -n scripts/deploy.sh` → exit 0 (syntax check).
`grep -n "build-info.json" .gitignore` → present.
`grep -c "TODO.md" scripts/deploy.sh` → 0.

### Step 6: Docs accuracy (README + AGENTS.md)

Run `npm test --silent 2>&1 | tail -4` and note the REAL numbers, then:

1. `README.md`:
   - Badge (line 6): replace `tests-480%20passing` with
     `tests-jest` (drop the hardcoded count — CI owns the truth).
   - Development section (line 161): `npm test  # Run test suite` — drop the
     count/suite claim.
   - Code structure tree (line 193): delete the `└── formatters/` line; add
     `│   └── generation-pipeline.js # Provider sequencing + local synthesis`
     to the `core/` listing.
   - Quick Start: insert PATH step after `npm install`:
     ```bash
     # 2. Put aic on your PATH (or run ./install.sh for the guided version)
     ln -sf "$(pwd)/bin/aic.js" ~/.local/bin/aic
     ```
     and renumber; in Troubleshooting, replace the duplicated symlink block
     with a pointer to Quick Start / `./install.sh`.
2. `AGENTS.md`:
   - Testing commands section + Project Status table: update to the real
     post-plan-004 counts (from the run above) and keep the ✅ only if true.
   - `src/index.js` row: `(~850 lines)` → `(~450 lines)`.
   - Rule 8: replace `buildGenerator()` with: "`bin/aic.js` is the single
     composition root. `buildFullGenerator()` builds every collaborator once
     for auto/generate; `buildLightGenerator()` wires the lightweight path
     for config/setup/stats/hook."
   - Core Modules table: add a row for
     `src/core/generation-pipeline.js | Provider sequencing, redaction, parsing, local synthesis`.

**Verify**: `grep -n "480" README.md` → no matches.
`grep -n "formatters" README.md` → no matches.
`grep -n "850" AGENTS.md` → no matches. (Counts/claims verified against the
actual test run output pasted in your report.)

### Step 7: Drop tiktoken

1. `src/utils/token-counter.js`: delete the tiktoken lazy-load and
   `getEncoding`; `countTokens` becomes:
   ```js
   countTokens(text) {
     if (!text || typeof text !== 'string') {
       return 0;
     }
     return Math.ceil(text.length / 4);
   }
   ```
   Delete the now-unused `encodingCache` constructor field. Update the file's
   JSDoc header comment accordingly.
2. `npm uninstall tiktoken`
3. Check `tests/` for exact token-count assertions on TokenCounter /
   diff-categorizer (grep `countTokens`): update expectations to the
   length/4 estimate.

**Verify**: `npm test --silent 2>&1 | tail -5` → 0 failed.
`grep -rn "tiktoken" src/ package.json` → no matches.

### Step 8: Drop handlebars

Rewrite `src/utils/prompt-templates.js` as plain functions (keep the exact
same exported names and output strings — the current templates are pure
interpolation plus one `{{#if conventional}}`):

```js
function buildSmallDiffPrompt(options) {
  const { category, entityList, conventional: _conventional, context } = options;
  let prompt = `Small diff detected (${category}). Changed entities: ${entityList}. Focus on WHAT specifically changed.`;
  prompt += `\n\nDO NOT use generic phrases like 'update file', 'modify code', or 'make changes'. Be specific about WHAT changed and WHY it matters.`;
  if (_conventional) {
    prompt += `\n\nUse conventional format: type(scope): description`;
  }
  if (context) {
    prompt += `\n\nContext: ${context}`;
  }
  return prompt;
}

function buildSingleLineChangePrompt(highlightedLine) {
  return `Single-line change detected: ${highlightedLine}. Reflect this exact modification in the commit message.`;
}

function buildLargeDiffPrompt(options) {
  const { chunkCount, chunkSummaries, conventional } = options;
  return `Large diff detected (${chunkCount} files/chunks). Processing in parallel for better coverage.

${chunkSummaries}
${conventional ? '\nUse conventional format: type(scope): description\n' : ''}`;
}

function entityListByType(entities) {
  const parts = [];
  if (entities.functions && entities.functions.length > 0) {
    parts.push(`Functions: ${entities.functions.join(', ')}`);
  }
  if (entities.classes && entities.classes.length > 0) {
    parts.push(`Classes: ${entities.classes.join(', ')}`);
  }
  if (entities.variables && entities.variables.length > 0) {
    parts.push(`Variables: ${entities.variables.join(', ')}`);
  }
  return parts.join('; ');
}

module.exports = {
  buildSmallDiffPrompt,
  buildSingleLineChangePrompt,
  buildLargeDiffPrompt,
  entityListByType,
};
```

(CAUTION: `efficient-prompt-builder` consumes these — the exact strings are
prompt-contract. If any existing test asserts the exact template output,
diff old vs new output for the same inputs first:
`node -e` comparing old/new outputs before deleting the old file.)
Then `npm uninstall handlebars`.

**Verify**: `npm test --silent 2>&1 | tail -5` → 0 failed (the
efficient-prompt-builder suite exercises these builders).
`grep -rn "handlebars" src/ package.json` → no matches.

### Step 9: Replace axios with global fetch in ollama-provider

`src/providers/ollama-provider.js`:

1. Delete `const axios = require('axios');`.
2. Replace the POST in `generateResponse`:
   ```js
   const response = await fetch(`${this.baseURL}/api/generate`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       model,
       prompt: fullPrompt,
       stream: false,
       options: {
         temperature: options.temperature || config.temperature || 0.3,
         num_predict: options.maxTokens || 2000,
       },
     }),
     signal: AbortSignal.timeout(config.timeout || 60000),
   });

   if (!response.ok) {
     throw new Error(`Ollama API error (${response.status}): ${response.statusText}`);
   }

   const data = await response.json();
   const content = data.response;
   if (!content) {
     throw new Error('No response content from Ollama');
   }
   return content.trim();
   ```
   (Node >= 18 guarantees global fetch and AbortSignal.timeout.)
3. Replace the GET in `validate`:
   ```js
   await fetch(`${this.baseURL}/api/tags`, { signal: AbortSignal.timeout(5000) });
   ```
   keeping the same try/catch and error message.
4. Rewrite the axios mocks in `tests/ollama-provider.test.js` to stub
   `global.fetch` (jest.spyOn(global, 'fetch')); preserve each test's intent —
   read the file fully first and map every axios mock to its fetch
   equivalent, including a network-refusal case
   (`fetch` rejecting with `TypeError: fetch failed`).
5. `npm uninstall axios`

**Verify**: `npx jest tests/ollama-provider.test.js --silent` → all pass.
`grep -rn "axios" src/ package.json` → no matches.
`npm install --silent && npm test --silent 2>&1 | tail -5` → 0 failed.

## Test plan

- New suites: bin-aic smoke (3), stats-manager (3+), plus new describes in
  config-manager (env overrides) and cache-manager (persistence).
- Dep removals: existing suites are the regression net; ollama suite is
  rewritten mock-for-mock.
- Docs: no tests; verified by grep + the recorded test-run numbers.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm test --silent 2>&1 | tail -5` → 0 failed, suite count >= 28
- [ ] `npm run lint` exits 0
- [ ] `npm install --silent` exits 0 with tiktoken/handlebars/axios absent
      from `package.json` dependencies
- [ ] `bash -n scripts/deploy.sh` exits 0 and the tag guard string
      `v${VERSION}` is present in the file
- [ ] `grep -n "build-info.json" .gitignore` → present
- [ ] `grep -rn "tiktoken\|handlebars\|axios" src/ package.json` → no matches
- [ ] `grep -n "formatters" README.md` and `grep -n "480" README.md` → no matches
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `prompt-templates.js` rewrite changes output for any input exercised
  by `tests/efficient-prompt-builder.test.js` (string-contract drift) —
  reconcile the exact output rather than updating the assertions blindly.
- `AbortSignal.timeout` is unavailable in the active Node runtime (check
  `node -e "console.log(typeof AbortSignal.timeout)"` → must print
  `function`; engines says >= 18, which has it since 17.3).
- The cache temp-dir tests interfere with the constructor's fire-and-forget
  `cleanup()` against the real home dir in a way that flakes — report; a
  constructor option `cacheDir` may be needed (small, but out of scope
  without approval).
- Real test counts after plans 001–004 contradict what Step 6 records —
  always write the number from an actual run, never from this plan.

## Maintenance notes

- `build-info.json` stays generated (build.sh) but ignored; if it is ever
  published intentionally, revisit the npmignore entry.
- After this plan, `aic stats` output is test-verified; schema changes to
  the stats store must update `tests/stats-manager.test.js` in the same PR.
- The dep removals shrink the audit surface for the deferred ESM/eslint-10
  migration (audit finding DEPS-03) — that migration remains a separate,
  deliberate project.
