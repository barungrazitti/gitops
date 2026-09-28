# Plan 001: Restore a green verification baseline (failing tests, lockfile, CI, jest config)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c4269a2..HEAD -- tests/index.test.js .gitignore jest.config.js scripts/ .github/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx / tests
- **Planned at**: commit `c4269a2`, 2026-09-27

## Why this matters

`npm test` currently fails 3 of 467 tests, `package-lock.json` is gitignored
while `scripts/build.sh` runs `npm ci` (which hard-fails without a lockfile),
and there is no CI. Concretely: every change starts from a red baseline, the
release scripts (`build.sh`, `deploy.sh`) abort at their test gates, and a
fresh clone cannot build. This plan makes `npm test` green, makes installs
reproducible, and adds a minimal GitHub Actions workflow so it stays that way.
Every other plan's verification depends on this one landing first.

## Current state

- `tests/index.test.js` — unit tests for `AICommitGenerator`. The `generate`
  describe's `beforeEach` (lines 82–97) stubs collaborators but NOT the
  generation pipeline. The class constructor (`src/index.js:80-90`) builds a
  real `GenerationPipeline` when not injected, and `src/index.js:311` calls
  `this.generationPipeline.generate(diff, {...})`. The module-level
  `jest.config.js:42` maps `groq-sdk` to `tests/mocks/groq-mock.js` whose
  `create` is an unstubbed `jest.fn()`, so the real pipeline's provider chain
  throws "All AI providers failed..." (`src/core/generation-pipeline.js:255`).
  Three tests fail this way:
  - line 133 `should re-generate messages when user selects regenerate`
  - line 162 `should cancel without committing`
  - line 170 `should stop after maximum regenerate attempts`
  The passing sibling at line 145 (`should re-generate from scratch on
  regenerate, bypassing cache`) proves the fix: it stubs
  `generator.generationPipeline.generate = jest.fn().mockResolvedValueOnce(...)`.
  Current `beforeEach` (lines 82–97):
  ```js
  beforeEach(() => {
    generator.gitManager.validateRepository = jest.fn().mockResolvedValue(true);
    generator.gitManager.getStagedDiff = jest.fn().mockResolvedValue(mockDiff);
    generator.cacheManager.getValidated = jest.fn().mockResolvedValue(null);
    generator.cacheManager.setValidated = jest.fn().mockResolvedValue();
    generator.analysisEngine.analyzeRepository = jest.fn().mockResolvedValue({ files: {} });
    generator.messageFormatter.format = jest.fn(msg => msg);
    generator.configManager.load = jest.fn().mockResolvedValue({
      defaultProvider: 'groq',
      conventionalCommits: true,
    });
    generator.cliPresenter.selectMessage = jest
      .fn()
      .mockResolvedValue({ action: 'commit', message: mockMessages[0] });
    generator.gitManager.commit = jest.fn().mockResolvedValue({});
  });
  ```
- `.gitignore` — line 6 is `package-lock.json` (under the `# Dependencies`
  block). `git ls-files package-lock.json` returns nothing; the file exists on
  disk (untracked, ~276KB).
- `scripts/build.sh` — line 30 `npm ci --silent` (fails on fresh clone without
  lockfile); lines 37–42 run `npm test` then `npm run test:coverage`
  (duplicate instrumented run once jest coverage is off by default).
- `scripts/deploy.sh` — same duplicate: line 58 `npm test`, line 67
  `npm run test:coverage`.
- `jest.config.js` — line 13 `collectCoverage: true` (every plain `npm test`
  pays ~15% overhead); line 50 `verbose: true` (840+ lines of output per
  run); lines 38–44 `moduleNameMapper` maps `@mistralai/mistralai`,
  `@anthropic-ai/sdk`, `@google/generative-ai`, `cohere-ai` to mock files that
  DO NOT exist (`tests/mocks/` contains only `groq-mock.js`); lines 32–35
  `transformIgnorePatterns` whitelists the same four phantom SDKs.
- `.github/` — does not exist. No CI of any kind.
- Repo conventions: CommonJS `require()`, ESLint airbnb-base (`npm run lint`
  must be 0 errors 0 warnings), Jest, conventional commit messages with a
  `Refs:` trailer (see `git log --oneline -5`).
- NOTE: the working tree has 5 modified files (`src/auto-git.js`,
  `src/cli-presenter.js`, `src/core/config-manager.js`,
  `src/utils/efficient-prompt-builder.js`, `tests/auto-git.test.js`) — a
  verified `aic setup` language fix from a prior session. Step 0 commits them
  so the tree is clean.

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Tests (one file) | `npx jest tests/index.test.js --silent` | all pass, 0 failed |
| Tests (all) | `npm test --silent 2>&1 \| tail -5` | `Tests: ... 0 failed` |
| Lint      | `npm run lint`                   | exit 0 |
| Smoke     | `node bin/aic.js --version`      | prints `1.5.0` |

## Scope

**In scope** (the only files you should modify or create):
- `tests/index.test.js`
- `.gitignore`
- `package-lock.json` (git-add only — do NOT hand-edit it)
- `jest.config.js`
- `scripts/build.sh`, `scripts/deploy.sh`
- `.github/workflows/ci.yml` (create)
- Committing the 5 pre-existing modified files (Step 0 — commit as-is, no edits)

**Out of scope** (do NOT touch):
- `src/**` — zero source changes in this plan.
- `tests/mocks/groq-mock.js`, `tests/setup.js` — test-infrastructure drift
  there is handled by plan 005, not here.
- Any lockfile other than `package-lock.json`.

## Git workflow

- Branch: `advisor/001-green-baseline` off `main`.
- One commit per step, conventional style with `Refs:` trailer, e.g.:
  `fix(tests): stub generation pipeline in index generate tests Refs:`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Commit the pending working-tree fix

The 5 modified files are a complete, previously-verified fix (setup wizard
language persistence). Commit them unchanged so the tree is clean:

```bash
git status --short   # must show exactly the 5 files listed above
git add src/auto-git.js src/cli-presenter.js src/core/config-manager.js src/utils/efficient-prompt-builder.js tests/auto-git.test.js
git commit -m "fix(setup): persist language config through wizard and prompt builder Refs:"
```

**Verify**: `git status --short` → empty output.

### Step 1: Stub the generation pipeline in the failing describe

In `tests/index.test.js`, inside the `describe('generate', ...)` `beforeEach`
(lines 82–97), add after the `generator.gitManager.commit` line:

```js
      generator.generationPipeline.generate = jest
        .fn()
        .mockResolvedValue(mockMessages);
```

This mirrors the passing sibling test at line 149. Do not change any test
bodies.

**Verify**: `npx jest tests/index.test.js --silent` → `Tests: 21 passed` (or the
file's full count, 0 failed). Then `npm test --silent 2>&1 | tail -5` →
`0 failed`.

### Step 2: Track the lockfile

1. Delete the single line `package-lock.json` from `.gitignore` (line 6).
   Keep the rest of the `# Dependencies` block intact.
2. `git add package-lock.json .gitignore`

**Verify**: `git ls-files package-lock.json` prints `package-lock.json`;
`npm ci --dry-run --silent 2>&1 | tail -2` exits 0.

### Step 3: Clean up jest.config.js

- Line 13: `collectCoverage: true` → `collectCoverage: false`
  (the `test:coverage` npm script still forces coverage explicitly).
- Line 50: `verbose: true` → `verbose: false`
- `moduleNameMapper`: delete the four phantom entries
  (`@mistralai/mistralai`, `@anthropic-ai/sdk`, `@google/generative-ai`,
  `cohere-ai`); keep only:
  ```js
  moduleNameMapper: {
    '^groq-sdk$': '<rootDir>/tests/mocks/groq-mock.js'
  }
  ```
- `transformIgnorePatterns`: reduce to:
  ```js
  transformIgnorePatterns: [
    'node_modules/(?!groq-sdk/)'
  ]
  ```

**Verify**: `npm test --silent 2>&1 | tail -5` → 0 failed, and the run is
noticeably shorter than before (coverage no longer collected by default).

### Step 4: Remove duplicate test runs from build/deploy scripts

- `scripts/build.sh`: delete lines 40–42 (the "Generate coverage report"
  block: `print_status`, `npm run test:coverage`). `npm test` at line 38
  stays.
- `scripts/deploy.sh`: delete lines 65–72 (the "Run test coverage" block).
  The `npm test` block at lines 56–63 stays.

**Verify**: `grep -n "test:coverage" scripts/build.sh scripts/deploy.sh` → no
matches.

### Step 5: Add minimal CI

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [18, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test -- --silent
      - run: node bin/aic.js --version
```

**Verify**: `node bin/aic.js --version` prints `1.5.0` locally; the YAML file
exists at exactly `.github/workflows/ci.yml`.

## Test plan

- No new tests. The plan's test change is Step 1 (making 3 existing tests
  pass). Pattern reference for the stub: `tests/index.test.js:149`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `git status --short` is clean after the final commit
- [ ] `npm test --silent 2>&1 | tail -5` → 0 failed (all suites green)
- [ ] `npm run lint` exits 0
- [ ] `git ls-files package-lock.json` prints the file
- [ ] `grep -rn "mistralai\|anthropic-ai\|generative-ai\|cohere-ai" jest.config.js` → no matches
- [ ] `.github/workflows/ci.yml` exists and `node bin/aic.js --version` prints a version
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `git status` at Step 0 shows modified files OTHER than the 5 listed — the
  tree has drifted; do not commit unknown changes.
- After Step 1, any test in `tests/index.test.js` still fails with "All AI
  providers failed" — the mock seam assumption is wrong for that test;
  report which one.
- `npm ci --dry-run` fails after Step 2 with a lockfile/version conflict.

## Maintenance notes

- The CI matrix (18/22) matches `engines: >=18`. If `engines` changes, update
  the matrix.
- Plans 002–005 assume this plan landed: their verification gates call
  `npm test` expecting green.
