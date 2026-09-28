# Plan 002: Make AI conflict resolution actually work against real git

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c4269a2..HEAD -- src/auto-git.js src/core/git-manager.js src/core/conflict-resolver.js tests/auto-git.test.js`
> Note: `src/auto-git.js` and `tests/auto-git.test.js` legitimately contain a
> small committed change from plan 001 Step 0 (setup-language fix). Compare
> the "Current state" excerpts against the live code; on a mismatch beyond
> that, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW–MED (touches the conflict workflow; mitigated by new tests)
- **Depends on**: plans/001-green-baseline-ci.md (green baseline required to
  verify anything)
- **Category**: bug
- **Planned at**: commit `c4269a2`, 2026-09-27

## Why this matters

The product's headline feature — "pull, resolve conflicts with AI" — is
provably broken against real git. Four defects combine: (1) `showIndexSide`
runs `git show --ours :file`, and `git show` has no `--ours` flag
(`fatal: unrecognized argument: --ours`, verified on git 2.55.0), so EVERY
AI-resolution attempt throws and drops the user into a manual fallback;
(2) the merge-fallback path calls `pull()` unguarded, so a real conflict
throws before the strategy menu and strands the repo mid-merge with
`MERGE_HEAD` set; (3) the multi-round rebase loop is unreachable because an
over-broad error regex matches git's own "resolve all conflicts manually"
hint and rethrows it; (4) when conflict-marker cleanup fails, auto mode falls
through and asks the AI to write a commit message for a marker-laden diff —
the exact thing the interactive path refuses. Unit tests never caught any of
this because `gitManager` is mocked.

## Current state

- `src/core/git-manager.js` — git facade built on simple-git. Lines 189–202:
  ```js
  async showIndexSide(filePath, side) {
    const VALID_SIDES = ['ours', 'theirs'];
    if (!VALID_SIDES.includes(side)) {
      throw new Error(`Invalid show side: ${side} (expected ours or theirs)`);
    }
    if (typeof filePath !== 'string' || filePath.length === 0) {
      throw new Error('Show requires a file path');
    }
    try {
      return await this.git.show([`--${side}`, `:${filePath}`]);
    } catch (error) {
      throw new Error(`Failed to show ${side} version of ${filePath}: ${error.message}`);
    }
  }
  ```
  Constructor (lines 8–13) is `constructor() { this.git = simpleGit(); ... }`
  — no baseDir argument, so tests cannot point it at a temp repo.
- `src/auto-git.js` — the workflow class (DI: gitManager, analysisEngine,
  configManager, generateMessages, conflictResolver, activityLogger).
  - Lines 714–734 `resolveFileConflictsWithAI`: calls
    `showIndexSide(filePath, 'ours'|'theirs')` (lines 716–717), then resolves
    with a HARDCODED language at line 724:
    `language: filePath.split('.').pop() === 'php' ? 'php' : 'javascript',`
  - Lines 523–547 `handleRebaseConflicts` try/catch:
    ```js
    } catch (error) {
      if (/cancelled|Manual|discarded/i.test(error.message)) {
        throw error;
      }
      // --continue can surface the NEXT commit's conflicts; loop with a cap.
      const remaining = await this.conflictedFiles();
      if (remaining.length > 0 && round < AutoGit.MAX_SYNC_ROUNDS) {
    ```
    User-abort throw sites whose messages the regex intends to match:
    line 641 `'Operation cancelled due to resolution failure'`,
    line 694 `'AI resolution discarded. Your branch is unchanged.'`,
    lines 699–701 `'AI resolution set aside. Resolve manually and run again.'`.
    The false positive: `GitManager.rebaseContinue`
    (`src/core/git-manager.js:207-213`) rethrows
    `"Failed to continue rebase: " + <raw git stderr>`, and git's standard
    conflict hint contains "Resolve all conflicts **manually**" — matched by
    `/manual/i` (case-insensitive), so the round loop is skipped exactly when
    `--continue` surfaces the next commit's conflicts.
  - Lines 556–592 `pullAndMerge`: `await this.gitManager.pull();` at line 559
    is NOT wrapped — a conflicting merge makes git exit non-zero,
    `GitManager.pull` throws, and lines 566–592 (strategy menu + resolution +
    merge commit) are dead code. The caller path is: user picks
    "Fall back to merge" at `handleRebaseConflicts` line 517 → `rebaseAbort()`
    → `pullAndMerge()` → throw. Compare the CORRECT pattern at lines 351–358
    (`pullAndHandleConflicts` wraps `pull({rebase:true})`, catches, checks
    `conflictedFiles()`).
  - Lines 270–306 `generateCommitMessage`: if the staged diff matches
    `DIFF_MARKER_REGEX`, runs `detectAndCleanupConflictMarkers()`; when
    `cleanupResult.cleaned` is falsy OR the cleaned diff is empty, control
    FALLS THROUGH to line 298–306 which calls
    `this.generateMessages(diff, ...)` with the ORIGINAL marker-containing
    diff. The interactive path (`src/index.js:220-233`) refuses exactly this
    input with 'Staged changes contain merge-conflict markers'.
  - Line 9 already imports from the resolver:
    `const { DIFF_MARKER_REGEX } = require('./core/conflict-resolver');`
- `src/core/conflict-resolver.js` — `languageForFile` (lines 39–42) is the
  single source of truth for language hints (maps js/ts/py/php/... via
  `LANG_MAP`), but it is NOT exported. Exports at line 342–343:
  `module.exports = ConflictResolver; module.exports.DIFF_MARKER_REGEX = ...`.
  Also lines 327–329: the per-file loop in `detectAndCleanupConflictMarkers`
  swallows ALL read errors with an empty catch (`// File might not exist
  (deleted), skip`).
- `tests/auto-git.test.js` — existing suite with DI mocks (mockGitManager at
  lines 31–49, including `showIndexSide` NOT in the mock — it IS: check;
  if absent add it). inquirer is mocked at line 8. Use this file's structure
  for all new tests.
- Conventions: error format `Failed to [action]: ${error.message}`; JSDoc on
  public methods; dependency injection; no comments beyond JSDoc.
- AGENTS.md rule: conflict-marker detection must stay line-anchored; do not
  touch the regexes.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests (all) | `npm test --silent 2>&1 \| tail -5` | 0 failed |
| One suite | `npx jest tests/auto-git.test.js --silent` | all pass |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope**:
- `src/core/git-manager.js` (constructor baseDir arg + `showIndexSide` only)
- `src/core/conflict-resolver.js` (export `languageForFile`; log swallowed errors)
- `src/auto-git.js` (the four defect sites only)
- `tests/auto-git.test.js` (new tests)
- `tests/git-manager.test.js` (new integration test)
- `tests/core/conflict-resolver.test.js` (only if adding the error-log assertion there is more natural)

**Out of scope** (do NOT touch):
- `resolveWithSide` / `sideForIntent` / `promptSyncStrategy` semantics —
  the ours/theirs swapping logic is correct; do not "fix" it.
- `CONFLICT_MARKER_REGEX` / `DIFF_MARKER_REGEX` definitions.
- The provider/prompt layers (`generation-pipeline.js`, providers).
- `bin/aic.js`.

## Git workflow

- Branch: `advisor/002-conflict-resolution` (requires plan 001 merged or
  cherry-picked; verify `npm test` is green before starting).
- One commit per defect + one for tests, conventional style, e.g.
  `fix(conflicts): read conflict stages via :2:/:3: instead of git show --ours Refs:`

## Steps

### Step 1: Fix `showIndexSide` to use stage syntax

In `src/core/git-manager.js`, replace the try-body of `showIndexSide` so the
side maps to an index stage number (`ours` = stage 2, `theirs` = stage 3 —
this is the plumbing form; `git show` accepts `:2:path` / `:3:path`):

```js
    try {
      const stage = side === 'ours' ? 2 : 3;
      return await this.git.show([`:${stage}:${filePath}`]);
    } catch (error) {
      throw new Error(`Failed to show ${side} version of ${filePath}: ${error.message}`);
    }
```

Also give the constructor an optional base dir (needed by the Step 6
integration test; backward compatible):

```js
  constructor(baseDir) {
    this.git = simpleGit(baseDir);
    this._statusCache = null;
    this._statusCacheTime = 0;
  }
```

**Verify**: `npx jest tests/git-manager.test.js tests/auto-git.test.js --silent` →
all pass (existing tests mock `show`, unaffected).

### Step 2: Use `languageForFile` instead of the hardcoded ternary

1. In `src/core/conflict-resolver.js`, after line 343
   (`module.exports.DIFF_MARKER_REGEX = DIFF_MARKER_REGEX;`) add:
   ```js
   module.exports.languageForFile = languageForFile;
   ```
2. In `src/auto-git.js`, change the line-9 require to:
   ```js
   const { DIFF_MARKER_REGEX, languageForFile } = require('./core/conflict-resolver');
   ```
3. Replace line 724's hardcoded ternary with:
   ```js
   language: languageForFile(filePath),
   ```

**Verify**: `grep -n "php' : 'javascript" src/auto-git.js` → no matches.

### Step 3: Replace the over-broad cancellation regex with an explicit marker

In `src/auto-git.js`:

1. Add a helper near the top of the class (after the `static` fields):
   ```js
   /**
    * Mark and detect user-chosen aborts. git stderr (e.g. "resolve all
    * conflicts manually") must never be classified as a user abort.
    */
   static userAbort(message) {
     const error = new Error(message);
     error.aicUserAbort = true;
     return error;
   }
   ```
2. Replace the throw at the three in-flow sites so they throw
   `AutoGit.userAbort(...)` instead of `new Error(...)`:
   - line 641: `throw AutoGit.userAbort('Operation cancelled due to resolution failure');`
   - line 694: `throw AutoGit.userAbort('AI resolution discarded. Your branch is unchanged.');`
   - lines 699–701: `throw AutoGit.userAbort('AI resolution set aside. Resolve manually and run again.');`
3. Change the catch at line 532 from the regex to:
   ```js
   if (error.aicUserAbort === true) {
     throw error;
   }
   ```

Do not change the other `throw new Error(...)` sites (507, 512, 572, 577) —
they are outside the try flow, but leave their messages untouched.

**Verify**: `grep -n "cancelled|Manual|discarded" src/auto-git.js` → no
matches.

### Step 4: Guard the merge-fallback pull

In `src/auto-git.js` `pullAndMerge`, replace lines 558–564 with the same
catch-and-inspect pattern `pullAndHandleConflicts` uses:

```js
    this.syncOperation = 'merge';
    this.spinner.start('Pulling latest changes (merge)...');
    let pullResult;
    try {
      pullResult = await this.gitManager.pull();
    } catch (error) {
      const conflicted = await this.conflictedFiles();
      if (conflicted.length === 0) {
        throw error;
      }
      pullResult = null;
    }
    const conflicted = pullResult ? await this.conflictedFiles() : await this.conflictedFiles();
    if (conflicted.length === 0) {
      this.spinner.succeed('Pulled with merge, no conflicts');
      return;
    }
    // ... rest of the method (strategy menu) unchanged from line 566
```

(If you can express it more cleanly without the double `conflictedFiles()`
call, do — the requirement is: pull failure with conflicted files present →
fall through to the strategy menu; pull failure with NO conflicts → rethrow;
success → existing behavior. Keep `this.syncOperation = 'merge'` set BEFORE
the pull so side-swapping stays correct.)

**Verify**: `npm test --silent 2>&1 | tail -5` → 0 failed.

### Step 5: Stop the conflict-marker fall-through

In `src/auto-git.js` `generateCommitMessage` (lines 270–306), restructure the
marker branch so there is no path from a failed cleanup back to the normal
generation call. Target shape:

```js
      // Check for and clean up conflict markers before generating commit
      if (DIFF_MARKER_REGEX.test(diff)) {
        this.spinner.text = chalk.yellow('Conflict markers detected, cleaning up...');
        const cleanupResult = await this.conflictResolver.detectAndCleanupConflictMarkers();

        if (cleanupResult.cleaned) {
          await this.gitManager.stageAll();
          const newDiff = await this.gitManager.getStagedDiff();

          if (newDiff && newDiff.trim().length > 0) {
            const config = await this.configManager.getAll();
            const messages = await this.generateMessages(newDiff, {
              context,
              count: 1,
              conventional: config.conventionalCommits !== false,
              language: config.language || 'en',
              preferredProvider: config.defaultProvider || 'groq',
            });
            this.spinner.succeed('AI commit message generated from cleaned diff');
            return messages[0];
          }
        }

        throw new Error(
          'Staged changes contain merge-conflict markers that could not be cleaned automatically. Resolve conflicts first (git status), then run again.'
        );
      }
```

(The `language: config.language` / `conventional: config.conventionalCommits`
options on the SECOND generateMessages call at old lines 298–304 stay as they
are after the branch — match the shown shape.)

**Verify**: `npm test --silent 2>&1 | tail -5` → 0 failed.

### Step 6: Log (not swallow) per-file cleanup errors

In `src/core/conflict-resolver.js` `detectAndCleanupConflictMarkers`,
replace the empty catch at lines 327–329 with:

```js
      } catch (e) {
        await this.activityLogger.warn('conflict_cleanup_file_skipped', {
          file: file.fileB,
          error: e.message,
        });
      }
```

**Verify**: `npm test --silent 2>&1 | tail -5` → 0 failed.

### Step 7: New tests

Add to `tests/auto-git.test.js` (reuse the file's existing mock scaffolding;
`inquirer.prompt` is already module-mocked — set return values per test):

1. **Multi-round rebase loop reachable**: mock `promptSyncStrategy`-driven
   flow — strategy `'ai'`; `resolveConflictsWithAI` resolves; first
   `rebaseContinue` call rejects with
   `new Error('Failed to continue rebase: could not apply... Resolve all conflicts manually, mark them as resolved...')`;
   `gitManager.getStatus` first returns `{ conflicted: ['a.js'] }`, then on
   round 2 the strategy is `'keep-mine'` (mock inquirer to return values in
   order), `checkoutSide` resolves, second `rebaseContinue` resolves.
   Assert: no throw, `rebaseContinue` called twice, `checkoutSide` called
   with `('a.js', 'theirs')` (rebase swaps keep-mine → theirs).
2. **User abort still rethrows**: `resolveConflictsWithAI` rejects with an
   error where `aicUserAbort = true`; assert `handleRebaseConflicts` rejects
   (no loop).
3. **Merge fallback with conflicts**: call `pullAndMerge` with
   `gitManager.pull` rejecting; `getStatus` → `{ conflicted: ['b.js'] }`;
   inquirer strategy `'keep-mine'`. Assert: `mergeAbort` NOT called,
   `checkoutSide` called with `('b.js', 'ours')` (merge: keep-mine = ours),
   `commit` called with the merge message.
4. **Merge fallback with no conflicts on failure**: `pull` rejects,
   `getStatus` → `{ conflicted: [] }`. Assert `pullAndMerge` rejects.
5. **Cleanup fall-through throws**: `getStagedDiff` returns a diff containing
   `+<<<<<<< HEAD`; `conflictResolver.detectAndCleanupConflictMarkers`
   resolves `{ cleaned: false }`. Assert `generateCommitMessage` rejects with
   /merge-conflict markers/.

Add to `tests/git-manager.test.js` a REAL-git integration test (new pattern
for this repo — spell it out exactly):

```js
describe('showIndexSide (real git integration)', () => {
  it('returns stage 2 (ours) and stage 3 (theirs) content', async () => {
    const { execSync } = require('child_process');
    const fs = require('fs-extra');
    const os = require('os');
    const path = require('path');
    const GitManager = require('../src/core/git-manager');

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aic-conflict-'));
    const git = (cmd) => execSync(`git ${cmd}`, { cwd: dir });
    git('init -q');
    git('config user.email t@t.test');
    git('config user.name t');
    fs.writeFileSync(path.join(dir, 'f.txt'), 'base\n');
    git('add .'); git('commit -qm base');
    git('checkout -qb side');
    fs.writeFileSync(path.join(dir, 'f.txt'), 'theirs\n');
    git('add .'); git('commit -qm theirs');
    git('checkout -q main 2>/dev/null || git checkout -q master');
    fs.writeFileSync(path.join(dir, 'f.txt'), 'ours\n');
    git('add .'); git('commit -qm ours');
    git('merge side || true'); // exits non-zero on conflict — that's expected

    const gm = new GitManager(dir);
    await expect(gm.showIndexSide('f.txt', 'ours')).resolves.toContain('ours');
    await expect(gm.showIndexSide('f.txt', 'theirs')).resolves.toContain('theirs');
    fs.removeSync(dir);
  }, 30000);
});
```

**Verify**: `npx jest tests/auto-git.test.js tests/git-manager.test.js --silent`
→ all pass, including the 6 new tests.

## Test plan

Covered in Step 7: the regression this plan fixes (stage syntax, verified
against real git), the multi-round loop that was unreachable, both merge
fallback branches, the marker fall-through, and the user-abort sentinel.
Structural pattern: existing `tests/auto-git.test.js` DI mocks; the real-git
test is intentionally the ONLY one that touches the filesystem — keep it that
way.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm test --silent 2>&1 | tail -5` → 0 failed
- [ ] `npm run lint` exits 0
- [ ] `grep -n '\-\${side}' src/core/git-manager.js` → no matches
- [ ] `grep -n "php' : 'javascript" src/auto-git.js` → no matches
- [ ] `grep -n "cancelled|Manual|discarded" src/auto-git.js` → no matches
- [ ] The real-git integration test exists and passes
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `git show :2:f.txt` (run by hand in a scratch conflicted repo you create)
  does NOT return the "ours" content — the stage-number mapping assumption
  is wrong for this git version.
- The existing `tests/auto-git.test.js` mock list does not include
  `showIndexSide`/`rebaseContinue` after all — extend the mock object rather
  than reworking the suite, and note it in your report.
- Making `handleRebaseConflicts` testable requires changing
  `promptSyncStrategy` (it should not — it is inquirer-driven and inquirer is
  module-mocked).

## Maintenance notes

- The real-git test pins behavior to git's index-stage semantics; if git
  changes (unlikely — plumbing), that test is the tripwire.
- The `aicUserAbort` flag is a repo-wide convention candidate: if other
  modules need user-abort classification later, promote it to a shared util
  rather than duplicating the flag.
- Reviewers: scrutinize that `sideForIntent` results are unchanged — Step 7's
  assertions (`'theirs'` under rebase, `'ours'` under merge) encode the swap
  contract.
