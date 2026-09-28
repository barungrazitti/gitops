# Plan 003: Fix the six remaining correctness defects (sanitizer, whitespace-only, syntax check, breaker, error path, cache key)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c4269a2..HEAD -- src/utils/input-sanitizer.js src/core/generation-pipeline.js src/core/git-manager.js src/providers/ai-provider-factory.js src/index.js src/core/cache-manager.js tests/input-sanitizer.test.js tests/core/generation-pipeline.test.js tests/cache-manager.test.js`
> `src/index.js` is not touched by plans 001/002 — any diff there is drift.
> On a mismatch with the excerpts below, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW–MED (breaker sharing changes object lifetimes; rest is small)
- **Depends on**: plans/001-green-baseline-ci.md
- **Category**: bug
- **Planned at**: commit `c4269a2`, 2026-09-27

## Why this matters

Six verified defects degrade every-day behavior: the commit-message
sanitizer silently strips legitimate characters AND destroys multi-line
bodies (bullets/Refs trailers the prompt explicitly asks for); whitespace-only
diffs still burn a cloud AI call; the "syntax check of staged files" actually
checks the working tree and mislabels every failure as "node not available";
the circuit breaker can mathematically never trip; the generate error path
loses its diagnostics (always logs `diffLength: 0`) and races process exit on
the AI suggestion; and the cache key ignores +/- direction, so adding and
removing the same line share one cached commit message.

## Current state

- `src/utils/input-sanitizer.js` — `sanitizeCommitMessage` (lines 64–88):
  ```js
  let sanitized = message.replace(/[\x00-\x1f\x7f]/g, '');   // line 70 — \x0a is \n: strips ALL newlines
  sanitized = sanitized.replace(/[;&|$`]/g, '');             // line 73 — strips legit chars; simple-git passes argv (no shell) so this guards nothing
  sanitized = sanitized
    .split(/\r?\n/)                                          // line 77 — dead: newlines already removed at line 70
    .map(l => l.trimEnd())
    .join('\n');
  ```
  Caller: `src/core/git-manager.js:253` — every commit (AI, manual, hook).
  Meanwhile `src/core/generation-pipeline.js:298-310` deliberately preserves
  multi-line candidates (bullets, `Refs:` trailers) — which the sanitizer
  then flattens at commit time.
- `src/core/generation-pipeline.js` — `generate()` special-cases
  `'binary-only'` locally (lines 111–130) but NOT `'whitespace-only'`;
  `src/core/diff-shaper.js:214-228` returns
  `{ strategy: 'whitespace-only', data: '' }` with the comment "skip AI", yet
  the empty diff flows into `generateWithSequentialProviders` and a provider
  is called with an empty ```diff``` block.
- `src/core/git-manager.js` — `syntaxCheck` (lines 354–375) runs
  `execFileAsync('node', ['--check', file])` on the working-tree PATH of
  staged files. `src/auto-git.js:245-248` catches ANY error and reports
  'node not available', returning `true`.
- `src/providers/ai-provider-factory.js` — `create()` (lines 18–35) returns a
  NEW provider (with a NEW `CircuitBreaker`) on every call. Call sites:
  `src/core/generation-pipeline.js:155`, `src/core/conflict-resolver.js:200`,
  `src/index.js:133`. Groq's breaker threshold is 5
  (`src/providers/groq-provider.js:18-22`) but `withRetry` runs at most 3
  attempts (`src/providers/base-provider.js:69-71`), so failureCount can never
  reach 5 on a fresh instance — OPEN is unreachable in production wiring.
- `src/index.js` — line 185 declares `let diff = '';` at function scope;
  line 203 (inside `try`) re-declares `let diff = await
  this.gitManager.getStagedDiff();` — the inner declaration SHADOWS the outer,
  so the catch at line 413 (`diffLength: diff?.length`) always sees `''`.
  Line 419: `this.provideErrorSuggestions(error, mergedOptions);` is not
  awaited before `throw error` at line 421 — the network round-trip
  (`src/utils/error-handler.js` → `getAISuggestion`) races process exit.
- `src/core/cache-manager.js` — `extractSemanticFingerprint` (lines 52–70):
  filters lines starting `+`/`-` but maps `line.substring(1).trim()` — the
  sign character is DISCARDED, and `+++ b/...` / `--- a/...` header lines
  pass the filter (trimmed length > 3), polluting the fingerprint. Result:
  `+const x = 1;` and `-const x = 1;` in the same file hash identically;
  `getValidated` (lines 87–119) never compares the stored `diffHash` field.
- Conventions: CommonJS, JSDoc on public methods, DI, error format
  `Failed to [action]: ${error.message}`. AGENTS.md rule 8: providers receive
  shared collaborators via `AIProviderFactory.create(name, deps)` — never
  fabricated per call. This plan EXTENDS that rule to instance identity.
- Tests live in `tests/<module>.test.js` or `tests/core/<module>.test.js`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests (all) | `npm test --silent 2>&1 \| tail -5` | 0 failed |
| One suite | `npx jest tests/input-sanitizer.test.js --silent` | all pass |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope**:
- `src/utils/input-sanitizer.js`
- `src/core/generation-pipeline.js` (whitespace-only branch only)
- `src/core/git-manager.js` (`syntaxCheck` only)
- `src/auto-git.js` (the syntaxCheck catch message only — lines ~245–248)
- `src/providers/ai-provider-factory.js`
- `src/index.js` (two lines: 203 shadow, 419 await)
- `src/core/cache-manager.js` (`extractSemanticFingerprint` only)
- `tests/input-sanitizer.test.js`, `tests/core/generation-pipeline.test.js`,
  `tests/cache-manager.test.js`, `tests/ai-provider-factory.test.js` (create)

**Out of scope** (do NOT touch):
- `src/core/diff-shaper.js` — its `whitespace-only` strategy/return shape is
  correct; only the pipeline consumer changes.
- `src/core/circuit-breaker.js` — the breaker itself is sound; the wiring is
  the defect. Do not lower thresholds.
- `src/providers/groq-provider.js`, `src/providers/ollama-provider.js`,
  `src/providers/base-provider.js`.
- The length cap (1000 chars) and trimEnd behavior in the sanitizer — keep.

## Git workflow

- Branch: `advisor/003-correctness-remainder`. Requires plan 001 landed.
- One commit per defect, conventional style, e.g.
  `fix(sanitizer): stop stripping shell metacharacters and flattening multi-line bodies Refs:`

## Steps

### Step 1: Sanitizer — preserve newlines, drop the metachar strip

In `src/utils/input-sanitizer.js` `sanitizeCommitMessage`:

1. Replace line 70 with a class that preserves `\n` (`\x0a`) and `\r`
   handling stays via the later split:
   ```js
   let sanitized = message.replace(/[\x00-\x09\x0b-\x1f\x7f]/g, '');
   ```
   (This keeps tab `\x09`? No — `\x00-\x09` includes tab. Tab preservation is
   not required; keep the range exactly as written: it removes tabs and all
   control chars EXCEPT `\n` (`\x0a`).)
2. DELETE line 73 (`sanitized = sanitized.replace(/[;&|$`]/g, '');`) —
   simple-git passes messages as argv, no shell is involved, and the strip
   silently rewrites legitimate messages ("fix: handle $ref forwarding").
3. The split/trimEnd/join block (lines 77–80) now actually works — leave it.

Update `tests/input-sanitizer.test.js`: read it first; assertions expecting
`;&|$` removal must now expect preservation. Add regression tests:
- multi-line input with `- bullets` and a `Refs: #123` trailer survives with
  newlines intact;
- `'fix: handle $ref forwarding and a || b'` passes through unchanged;
- `'\x00\x07'` control chars are still removed;
- 1000-char cap still applies.

**Verify**: `npx jest tests/input-sanitizer.test.js --silent` → all pass.
`grep -n '&|\\$`' src/utils/input-sanitizer.js` → the metachar regex is gone.

### Step 2: Whitespace-only diffs skip the provider

In `src/core/generation-pipeline.js` `generate()`, immediately after the
`binary-only` block (ends at line 130), add:

```js
    // Whitespace-only change: nothing semantic for the AI to analyze;
    // synthesize locally like the binary-only branch.
    if (diffManagement.strategy === 'whitespace-only') {
      const messages = ['style: apply whitespace formatting'];
      await this.activityLogger.info('diff_management', {
        ...diffManagement.info,
        provider: 'local',
        responseTime: 0,
        success: true,
      });
      return messages;
    }
```

Add a test in `tests/core/generation-pipeline.test.js`: stub
`diffShaper.manageDiffForAI` to return
`{ strategy: 'whitespace-only', data: '', info: { strategy: 'whitespace-only' } }`;
stub `providerFactory.create` with a jest.fn(); assert `generate` resolves to
`['style: apply whitespace formatting']` AND `providerFactory.create` was
never called. Model the setup on the file's existing binary-only test.

**Verify**: `npx jest tests/core/generation-pipeline.test.js --silent` → all pass.

### Step 3: Syntax check reads STAGED content

Rewrite `syntaxCheck` in `src/core/git-manager.js` (lines 354–375) to check
the index blob, not the working tree:

```js
  async syntaxCheck() {
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const crypto = require('crypto');
    const execFileAsync = promisify(execFile);

    const files = await this.getStagedFiles();
    const jsFiles = files.filter(f => f.endsWith('.js'));
    const errors = [];

    for (const file of jsFiles) {
      let content;
      try {
        content = await this.git.show([`:${file}`]);
      } catch (_) {
        continue; // deleted/renamed staged path — nothing to check
      }

      const tmp = path.join(
        os.tmpdir(),
        `aic-synchk-${crypto.randomBytes(6).toString('hex')}.js`
      );
      try {
        fs.writeFileSync(tmp, content);
        await execFileAsync('node', ['--check', tmp]);
      } catch (err) {
        if (err.code === 'ENOENT' && !err.stderr) {
          // node binary unavailable — skip the gate entirely
          return { valid: true, errors: [], skipped: true };
        }
        errors.push({ file, error: (err.stderr || err.message || '').trim() });
      } finally {
        try { fs.unlinkSync(tmp); } catch (_) {} // eslint-disable-line no-empty
      }
    }

    return { valid: errors.length === 0, errors };
  }
```

In `src/auto-git.js` (lines ~218–248, `syntaxCheck` wrapper): keep the
try/catch, but the catch must no longer claim "node not available" for
arbitrary failures — change the catch's user-facing message to
`Syntax check could not run: ${error.message}` and still return `true`
(degrade-open, as today). The `skipped: true` case needs no special handling
in auto-git (valid=true flows through).

Add a test in `tests/git-manager.test.js`: stage-simulation is hard with the
existing simple-git mock; instead test via the real-git pattern introduced by
plan 002's integration test if available, otherwise unit-test the ENOENT path
by stubbing `execFile` — minimum viable: a test that constructs GitManager
with a mock `git.show` returning broken JS (`'const = ;'`) and a mock
`getStagedFiles` returning `['bad.js']`, asserting
`{ valid: false, errors: [{ file: 'bad.js', ... }] }`. (You will need to
jest.mock('child_process') — follow the mocking style in
`tests/git-manager.test.js` for simple-git.)

**Verify**: `npx jest tests/git-manager.test.js --silent` → all pass.

### Step 4: Share provider instances (and their breakers) in the factory

In `src/providers/ai-provider-factory.js`, add a module-level instance cache
keyed by provider name, invalidated when the injected deps change identity
(so tests that pass distinct mock objects keep getting fresh instances):

```js
const instances = new Map();

class AIProviderFactory {
  /**
   * Create (or return the cached) AI provider instance. Providers own
   * stateful CircuitBreakers — a fresh instance per call made the breaker
   * unreachable, so instances are reused per (name, deps identity).
   */
  static create(providerName, deps = {}) {
    if (!providerName) {
      throw new Error(
        `Provider name is required. Got: ${providerName}. Available providers: groq, ollama`
      );
    }

    const key = providerName.toLowerCase();
    const cached = instances.get(key);
    if (
      cached &&
      cached.deps.configManager === deps.configManager &&
      cached.deps.activityLogger === deps.activityLogger
    ) {
      return cached.instance;
    }

    let instance;
    switch (key) {
      case 'groq':
        instance = new GroqProvider(deps);
        break;
      case 'ollama':
        instance = new OllamaProvider(deps);
        break;
      default:
        throw new Error(
          `Unsupported AI provider: ${providerName}. Supported providers: groq, ollama`
        );
    }

    instances.set(key, { instance, deps });
    return instance;
  }

  /** Test hook: drop cached instances. */
  static resetInstances() {
    instances.clear();
  }
}
```

Create `tests/ai-provider-factory.test.js`:
- two `create('groq', sameDepsObject)` calls return the SAME instance;
- `create('groq', differentDeps)` returns a new instance;
- `resetInstances()` forces a new instance;
- breaker continuity: `const p = AIProviderFactory.create('groq', deps);`
  `p.circuitBreaker` survives a second `create` call (same object).

Add `afterEach(() => AIProviderFactory.resetInstances())` in that new test
file. Existing provider tests construct providers directly — unaffected.

**Verify**: `npx jest tests/ai-provider-factory.test.js tests/groq-provider.test.js tests/ollama-provider.test.js --silent` → all pass.

### Step 5: Fix the generate() error path in src/index.js

1. Line 203: change `let diff = await this.gitManager.getStagedDiff();` to
   `diff = await this.gitManager.getStagedDiff();` (assign the outer
   variable declared at line 185 — remove the shadowing `let`).
2. Line 419: change `this.provideErrorSuggestions(error, mergedOptions);` to
   `await this.provideErrorSuggestions(error, mergedOptions);`
   (`provideErrorSuggestions` already catches internally — awaiting cannot
   throw).

**Verify**: `npx jest tests/index.test.js --silent` → all pass (the
error-path test at line 182 mocks `provideErrorSuggestions` — still fine).

### Step 6: Cache fingerprint keeps the +/- sign and drops headers

In `src/core/cache-manager.js` `extractSemanticFingerprint` (lines 52–70):

```js
    const semanticLines = lines
      .filter(line => {
        const trimmed = line.substring(1).trim();
        return (
          (line.startsWith('+') || line.startsWith('-')) &&
          !line.startsWith('+++') &&
          !line.startsWith('---') &&
          trimmed.length > 3 &&
          !trimmed.startsWith('//') &&
          !trimmed.startsWith('*') &&
          !trimmed.startsWith('*/')
        );
      })
      .map(line => line[0] + line.substring(1).trim())
      .join('|');
```

(The only changes: two header exclusions in the filter, and `line[0] +` in
the map so the sign survives.)

Add tests in `tests/cache-manager.test.js`:
- `cm.generateKey('+const x = 1;\n')` !== `cm.generateKey('-const x = 1;\n')`
  (wrap each in a minimal `diff --git a/f.js b/f.js\n` header if the file's
  existing tests do so);
- two diffs that differ ONLY in `+++`/`---` header lines produce the same
  key as without headers (headers no longer pollute).

**Verify**: `npx jest tests/cache-manager.test.js --silent` → all pass.

## Test plan

- Step 1: sanitizer regressions (multi-line survival, metachar preservation,
  control-char removal, length cap) — update + extend
  `tests/input-sanitizer.test.js`.
- Step 2: whitespace-only local synthesis + provider-not-called — extend
  `tests/core/generation-pipeline.test.js`.
- Step 3: staged-content check (broken staged JS → invalid) — extend
  `tests/git-manager.test.js`.
- Step 4: factory identity/continuity — new
  `tests/ai-provider-factory.test.js`.
- Step 6: sign-sensitive cache keys — extend `tests/cache-manager.test.js`.
- Final: full `npm test --silent 2>&1 | tail -5` → 0 failed.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm test --silent 2>&1 | tail -5` → 0 failed
- [ ] `npm run lint` exits 0
- [ ] `grep -n "\[;&|\\$\`\]" src/utils/input-sanitizer.js` → no matches
- [ ] `node -e "const S=require('./src/utils/input-sanitizer'); const m=S.sanitizeCommitMessage('feat: x\n\n- bullet\nRefs: #1'); process.exit(m.includes('\n')?0:1)"` → exit 0
- [ ] `grep -n "whitespace-only" src/core/generation-pipeline.js` → a local-synthesis branch exists
- [ ] `grep -n "'--check', file" src/core/git-manager.js` → no matches (staged-content path only)
- [ ] `grep -n "resetInstances" src/providers/ai-provider-factory.js` → exists
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any existing test asserts the OLD flattening/metachar-stripping behavior in
  a way that is NOT covered by the excerpt above (e.g. a security test that
  explicitly requires `;&|$` removal) — that is a design conflict; report it.
- The `tests/core/generation-pipeline.test.js` structure does not expose
  `diffShaper`/`providerFactory` for stubbing (its constructor injects them —
  it should; if not, report).
- jest.mock('child_process') fights the existing git-manager test setup —
  report rather than rearchitecting the suite.

## Maintenance notes

- The factory cache changes provider lifetime: a long-lived process (none
  exists today — the CLI is one-shot) would keep breaker state across
  invocations, which is the point. If a daemon mode is ever added, add
  breaker reset on config change.
- Plan 004 (security) Step 5 reuses `sanitizeCommitMessage` on the dry-run
  stdout seam — it RELIES on this plan's Step 1 having landed (otherwise the
  seam would strip legitimate characters). Keep execution order 003 → 004.
- The sanitizer keeps its 1000-char cap; if conventional bodies with bullets
  routinely exceed it, raise in a separate change with tests.
