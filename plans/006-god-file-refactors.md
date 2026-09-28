# Plan 006: Characterize and split the god files (diff-shaper.js, analysis-engine.js, activity-logger.js — DEBT-02/03)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat HEAD -- src/core/diff-shaper.js src/core/analysis-engine.js src/core/activity-logger.js`
> must be empty (plan authored at commit `aec450d` + the README/docs commit
> that follows it). On any mismatch with the line counts in "Current state",
> STOP — re-baseline the plan against the current files.

## Status

- **Priority**: P3 (structural debt, no correctness impact)
- **Effort**: L (characterization for two files + three structural splits)
- **Risk**: MEDIUM (pure code movement, but touches the diff-budget owner)
- **Depends on**: plans/001-green-baseline-ci.md (green suite), plans/005-tests-release-hygiene.md (final test counts recorded)
- **Category**: refactor / tests
- **Planned at**: commit `aec450d`, 2026-09-28

## Why this matters

Three files dominate the codebase by size — `diff-shaper.js` (1074 lines),
`analysis-engine.js` (690), `activity-logger.js` (492) — and two of them
are also the least trusted: analysis-engine sits at 50% statements / 35%
branch coverage, activity-logger at 50% / 33% (its entire read/analyze/export
half, lines 293–488, has zero tests). Splitting without first pinning
behavior would turn a refactor into a behavior-change lottery; testing first
means every later movement step is verified by tests that already passed
against the unsplit code.

## Current state (baseline, commit `aec450d`)

- **`src/core/diff-shaper.js` — 1074 lines, 89.0% stmts / 80.2% branch.**
  Single class `DiffShaper` (line 9), 30 methods. Cohesion groups by line:
  - *Filtering* (16–178): `filterBinaryFiles`, `splitDiffIntoFileBlocks`,
    `extractBinaryFileSummary`, `filterLockfiles`, `isWhitespaceOnly`
  - *Orchestration* (179–271): **`manageDiffForAI`** — THE public entry
    (AGENTS.md architecture rule 1: one interface in, budget owned here)
  - *Truncation/chunking* (272–635): `smartTruncateDiff`,
    `buildOversizedChunkExcerpt`, `buildSkippedFileSummary`,
    `parseDiffIntoFileChunks`, `pushFileChunk`, `scoreFileChunk`,
    `collapseRebuildPairs`, `extractRebuildPairs`, `extractContentLines`,
    `buildRebuildPairChunk`
  - *Analysis* (636–1004): `analyzeDiffType`, `limitContextLines`,
    `extractActualChangeText`, `getCompatibleTypeHint`,
    `extractChangedFilePaths`, `inferTypeFromChangedFiles`,
    `shouldPreferFileTypeFallback`, `isTestFile`/`isDocsFile`/`isStyleFile`/
    `isDependencyFile`/`isConfigFile`/`isMarkupFile`
  - Uncovered lines are concentrated in the oversized-summary builders
    (430–493) and chunk-pair edges (562–612).
- **`src/core/analysis-engine.js` — 690 lines, 50.2% stmts / 34.8% branch.**
  Class `AnalysisEngine`, 14 methods:
  - *Repo orchestration* (18–103): `analyzeRepository`, `getRecentCommits`,
    `analyzeFileContext`
  - *Classification* (104–356): `categorizeFiles`, `inferScope`,
    `detectCommitType` — partially tested
  - *Semantic* (357–553): `analyzeSemanticContext`,
    `analyzeJavaScriptFile`, `analyzePHPFile`, `analyzePythonFile` — the
    language analyzers are the biggest holes (456–550 uncovered)
  - *Environment* (554–689): `detectWordPressContext` (large, mostly
    uncovered), `detectProjectType`
- **`src/core/activity-logger.js` — 492 lines, 50.0% stmts / 32.9% branch.**
  Class `ActivityLogger`, 25 methods:
  - *Core logging* (12–248): constructor, init/rotation/level plumbing — covered
  - *Typed emitters* (250–327): `logAIInteraction`, `logGitOperation`,
    `logConflictResolution`, `logDetailedError` — covered (plan 005)
  - *Read/analyze/export* (328–492): `getRecentLogs`, `analyzeLogs`,
    `extractCommitType`, `exportLogs`, `convertToCSV` — **lines 293–488
    effectively untested**
- Import surface: `diff-shaper` required by `src/index.js:28`,
  `bin/aic.js`, prompt-builder (injected only since DEBT-01 fix), pipeline.
  `analysis-engine` required by `src/index.js` (+ light path). `activity-logger`
  required by `src/index.js`, `bin/aic.js`, providers (via deps).

## Commands you will need

```bash
npm test                                    # full suite (527 baseline)
npm run lint                                # must stay 0/0
npm run test:coverage                       # per-file coverage gate
npx jest tests/core/diff-shaper.test.js     # fast inner loop
npx jest tests/analysis-engine.test.js tests/activity-logger.test.js
```

## Scope

**In scope**: characterization tests for analysis-engine + activity-logger
uncovered halves; structural split of all three files behind unchanged
public facades; docs touch-up (AGENTS.md rule-1 path wording, README
structure section) if file layout changes.

**Out of scope**: any behavior change (including "obvious" cleanups);
renaming public methods or classes; moving modules across layers (nothing
leaves `src/core/`); coverage work on other files; performance tuning of
the chunk scorer.

## Design rules (locked before Step 1)

1. **Facade pattern.** The class keeps its name, file path, and every
   public method signature. Extracted concerns become plain modules the
   facade requires and delegates to. Zero importer changes —
   `require('./core/diff-shaper')` etc. keep resolving exactly as today.
2. **No cross-layer moves.** Extracted helpers stay in `src/core/` (sibling
   files such as `src/core/diff-chunking.js`) or in a subdirectory
   (`src/core/diff-shaper/*.js` resolved by the same require path). They
   must NOT land in `src/utils/` — that would recreate DEBT-01 in reverse.
3. **AGENTS.md rule 1 survives**: `manageDiffForAI` remains the single
   diff-budget entry point; no second truncation path is exposed to the
   prompt builder or pipeline.
4. **Characterization before movement**: a file is only split after its
   coverage gate passes on the UNMODIFIED file.

## Git workflow

One branch: `advisor/006-god-file-refactors`. One commit per step below.
Run the full suite + lint before each commit.

## Steps

### Step 0 — Drift check + baseline

Run the drift command in the header. Record `npm run test:coverage`
numbers for the three files (they are the gates for Steps 1–2 and 5–7).

### Step 1 — Characterize `analysis-engine.js` (gate: ≥75% stmts, ≥60% branch)

New/extended `tests/analysis-engine.test.js`, asserting CURRENT behavior
(no src changes in this step):
- `inferScope`: file-set → scope mapping (mixed frontend/backend sets,
  empty set, single extension) — lock the precedence rules as they are.
- `detectCommitType`: type precedence (new file vs modified vs docs/tests).
- `analyzeJavaScriptFile` / `analyzePHPFile` / `analyzePythonFile`: what
  each returns for (a) code with recognizable patterns (React component,
  WP hook, Python def), (b) garbage/empty input.
- `detectWordPressContext`: the 456–550 block — plugin/theme/mu-plugin
  detection from paths, `style.css` headers, PHP hooks.
- Keep tests table-driven (the file's existing tests already use that style).

### Step 2 — Characterize `activity-logger.js` read/analyze/export
(gate: ≥75% stmts, ≥60% branch on the file)

- `getRecentLogs(days)`: window filtering, malformed JSON lines skipped,
  missing dir → `[]`.
- `analyzeLogs(days)`: aggregation shape from fixture log files in a temp
  dir (override the log dir — do NOT touch the real `~/.aic-logs`).
- `extractCommitType`: conventional message → type, no-type fallback.
- `exportLogs` + `convertToCSV`: JSON and CSV output shape, header row,
  quoting of commas/quotes in fields, day filtering.

### Step 3 — Split `diff-shaper.js` (safe first: 89% covered)

Extract in this order, one commit each if the diff stays reviewable
(two commits max otherwise):
1. Filtering group → `src/core/diff-filtering.js` (binary, lockfile,
   whitespace, file-block splitting).
2. Truncation/chunking group → `src/core/diff-chunking.js` (the budget
   math moves here; `smartTruncateDiff` remains delegated from the facade).
3. Analysis group → `src/core/diff-analysis.js` (type analysis,
   context limiting, file-type predicates).

`DiffShaper` stays in `src/core/diff-shaper.js` as the orchestrating
facade: same class, same 30 public methods (now one-line delegations where
they were bodies), `manageDiffForAI` unchanged. Gates per sub-commit:
full suite green, lint 0, `diff-shaper`-family coverage NOT lower than
Step 0 baseline.

### Step 4 — Split `analysis-engine.js` (after Step 1 gate)

- Classification (`categorizeFiles`, `inferScope`, `detectCommitType`) →
  `src/core/repo-classification.js`
- Language/semantic analyzers (`analyze*File`, `analyzeSemanticContext`) →
  `src/core/semantic-analysis.js`
- WordPress detection → `src/core/wordpress-detection.js`
- `AnalysisEngine` keeps orchestration (`analyzeRepository`,
  `getRecentCommits`, `analyzeFileContext`, `detectProjectType`) and
  delegates. Same gate as Step 3.

### Step 5 — Split `activity-logger.js` (after Step 2 gate)

- Read/analyze/export (`getRecentLogs`, `analyzeLogs`, `extractCommitType`,
  `exportLogs`, `convertToCSV`) → `src/core/activity-insights.js`
- `ActivityLogger` keeps lifecycle + typed emitters + delegation.
  Same gate as Step 3.

### Step 6 — Docs touch-up

- AGENTS.md architecture rule 1: update the path wording if
  `diff-shaper.js` layout changed (e.g. "diff-shaper.js + its
  `src/core/diff-*` helpers"), keeping the single-entry-point rule intact.
- AGENTS.md Core Modules table + README Code Structure section: reflect new
  file names and the new test count (update the README badge too).
- `plans/README.md`: row 006 → DONE with final numbers.

## Test plan

- Per step: `npm test` + `npm run lint` green before commit.
- Steps 1–2 gates read from `npm run test:coverage` for the target file.
- Steps 3–5: coverage per file must be ≥ its Step 0 baseline; full suite
  total must not drop below baseline + new tests added.
- Manual smoke after Step 3 (the riskiest move): `aic --dry-run` in a
  throwaway git repo with a multi-file staged diff — confirms the budget
  path still produces a prompt (mock-free end-to-end check of the facade).

## Done criteria

- [ ] analysis-engine ≥75% stmts / ≥60% branch; activity-logger ≥75% / ≥60%
- [ ] All three files ≤ ~400 lines each (facade + delegation), no file
      requires another split
- [ ] Zero public signature changes; `grep -rn "require.*diff-shaper\|analysis-engine\|activity-logger" src/ bin/` shows only facade paths
- [ ] Full suite green with coverage ≥ baseline per touched file; lint 0
- [ ] `aic --dry-run` smoke passes post-split
- [ ] AGENTS.md + README updated; row 006 marked DONE

## STOP conditions

- **Any behavior change is needed** to make a split work — stop; the plan
  author re-scopes (this plan is movement-only).
- **A characterization gate (Step 1/2) cannot be met** because current
  behavior is incoherent/buggy — stop and report which assertion exposed it;
  do NOT encode a bug fix into a characterization test without approval.
- **A split forces changes in `src/index.js` / `bin/aic.js` / prompt-builder
  requires or call sites** beyond adding nothing — the facade rule broke.
- **Coverage on any of the three files drops below its Step 0 baseline.**
- **Suite or lint red** after a movement commit and the cause isn't a
  trivial import path typo.

## Maintenance notes

- Future features touching diff budget logic edit `diff-shaper.js`
  (facade) or the specific helper — never the prompt builder (AGENTS.md
  rule 1 unchanged).
- The 50%→75% coverage floors here are the same discipline as plans 005's
  QUAL gates: recorded in this plan, verified by `npm run test:coverage`.
- If a later plan needs `analysis-engine` language analyzers for other
  file types, extend `semantic-analysis.js` — the split was designed so
  new languages are one file-level addition.
