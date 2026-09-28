# Plan 004: Make the security claims true (enterprise mode, scanner gaps, log perms, key masking, hook seam)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c4269a2..HEAD -- src/utils/secret-scanner.js src/core/activity-logger.js src/core/config-manager.js src/cli-presenter.js src/auto-git.js src/core/generation-pipeline.js bin/aic.js tests/secret-scanner.test.js tests/core/generation-pipeline.test.js tests/cli-presenter.test.js`
> Plans 001–003 legitimately touch `src/auto-git.js`,
> `src/core/generation-pipeline.js`, `src/core/config-manager.js`,
  `src/cli-presenter.js`, `bin/aic.js` is untouched by them. Compare
  excerpts; on an unexplained mismatch, STOP.

## Status

- **Priority**: P1 (security)
- **Effort**: M
- **Risk**: MED (enterprise mode blocks commits on heuristic matches — needs
  the override UX in Step 1)
- **Depends on**: plans/001-green-baseline-ci.md, plans/003-correctness-remainder.md
  (Step 5 reuses the fixed `sanitizeCommitMessage`)
- **Category**: security
- **Planned at**: commit `c4269a2`, 2026-09-27

## Why this matters

The README sells security ("Enterprise mode blocks commits with ANY
sensitive data", "Auto-redacts 20+ secret/PII patterns", "API key masked in
config output") but: `--enterprise-mode` is declared in the CLI and then read
by nothing; the scanner misses entire token families and cannot match PEM
keys inside diff lines (the `+`/`-` prefix breaks its regexes) — so a
credential-rotation diff, the most secret-dense diff there is, is sent
verbatim to the cloud; activity logs persist full prompts (containing diffs)
to a world-readable directory for 30 days; the API key sits in a conf store
that was observed with mode 0666; and `config --get apiKey` / `--set
apiKey=...` echo the raw key to the terminal. A false security boundary is
worse than none — this plan makes the boundary real.

## Current state

- `bin/aic.js` line 129 declares
  `.option('--enterprise-mode', 'Block commits with ANY sensitive data (strict security)')`
  and line 143 spreads it into `autoGit.run({ ...options, manualMessage })`
  → `options.enterpriseMode` is available inside `run()`.
- `src/auto-git.js` — `run()` (lines 36–150) never reads `enterpriseMode`.
  `generateCommitMessage(_options)` (line 254) ignores its argument; it calls
  `this.generateMessages(diff, {...})` at two sites (the cleaned-diff branch
  and the main branch) with options objects that include
  `preferredProvider`, `conventional`, `language`, `count: 1`.
- `src/core/generation-pipeline.js` — `generate(diff, options)` redacts at
  lines 83–98 inside `if (options.sanitize !== false)`; `redactionSummary`
  is scoped inside that block. The pipeline constructor accepts an
  injectable `secretScanner` (line 42) and `providerFactory` — use both for
  tests.
- `src/utils/secret-scanner.js` — pattern list in the constructor
  (lines ~12–172). Verified gaps (each confirmed by executing the module):
  - Line 26: GitHub covers only `ghp_`. Missing: `github_pat_` (fine-grained
    PAT), `gho_`, `ghu_`, `ghs_`, `ghr_`.
  - Line 48: `\b(?:aws_)?secret[_-]?key` does not match
    `aws_secret_access_key` / `AWS_SECRET_ACCESS_KEY`.
  - Lines 56–57: PEM pattern requires `\n-----END ... PRIVATE KEY-----` —
    in a diff every change line starts with `+`/`-`, so `+-----END ...` never
    matches; a private key staged as added lines passes through unredacted.
  - No patterns for: GitLab `glpat-`, SendGrid `SG.`, npm `npm_`, Stripe
    `rk_live_`/`sk_live_`, Twilio `SK` + 32 hex.
- `src/core/activity-logger.js` — `initializeLogDirectory` (lines 44–52) uses
  `fs.ensureDir(this.logDir)` with no mode; `logActivity` (line 144) uses
  `fs.appendFile` with no mode (default umask → world-readable).
  `logAIInteraction` (lines ~230–252) stores the full prompt (truncated at
  10,000 chars) and response. NOTE: lines 260–469 contain analysis/export
  methods — BEFORE changing the `prompt` field, grep them for `.prompt`
  readers (see Step 3 escape hatch).
- `src/core/config-manager.js` — `Conf` store (`config-manager.js:20-23`);
  the store file was observed at mode 0666 on this machine. `set`
  (line 154), `setMultiple` (line 178), `reset` (line 193) all write without
  permission hardening. `Conf` exposes the file path as `this.config.path`.
- `src/cli-presenter.js` — `config(options)` (lines 113–131): `--list`
  masks `apiKey` → `'***configured***'` (line 126), but `--get` (lines
  118–120) prints the raw value and `--set` (lines 114–117) echoes
  `Configuration updated: apiKey = <raw value>`.
- `src/auto-git.js` dry-run branch (lines 40–63): prints
  `options.manualMessage` or the AI-generated `messages[0]` to stdout
  verbatim. The git hook (`src/core/hook-manager.js:135`) pipes that stdout
  straight into `COMMIT_EDITMSG` (`aic --dry-run | head -1 > "$1"`), and
  `generation-pipeline.js:298-310` deliberately preserves
  `Co-authored-by:`/`Refs:` continuation blocks from provider output —
  i.e. provider text can inject git trailers via the hook. Plan 003's
  `sanitizeCommitMessage` fix (control-chars only) is the right sanitizer
  for this seam.
- No secrets are committed to the repo (full history verified) — no rotation
  required. `.env` and `.aic-logs/` are gitignored.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests (all) | `npm test --silent 2>&1 \| tail -5` | 0 failed |
| One suite | `npx jest tests/secret-scanner.test.js --silent` | all pass |
| Scanner probe | see Step 2 verify | all probe strings redacted |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope**:
- `src/core/generation-pipeline.js` (enterprise-mode gate only)
- `src/auto-git.js` (enterpriseMode plumbing + dry-run seam sanitize)
- `src/utils/secret-scanner.js` (pattern fixes/additions only)
- `src/core/activity-logger.js` (dir/file modes + prompt hashing)
- `src/core/config-manager.js` (chmod after writes)
- `src/cli-presenter.js` (masking in `config()`)
- `tests/secret-scanner.test.js`, `tests/core/generation-pipeline.test.js`,
  `tests/cli-presenter.test.js`, `tests/config-manager.test.js`,
  `tests/activity-logger.test.js`

**Out of scope** (do NOT touch):
- `CONFLICT_MARKER_REGEX` / redaction call-sites in
  `src/core/conflict-resolver.js` — they already redact both sides; they
  inherit the pattern fixes automatically.
- The git hook script template in `src/core/hook-manager.js` — the fix is on
  the producer side (dry-run stdout), not the script.
- `.env` override behavior (`_applyEnvOverrides`) — working as designed.
- At-rest ENCRYPTION of the conf store — perms hardening only here; encryption
  is a separate future decision (see Maintenance notes).

## Git workflow

- Branch: `advisor/004-security-hardening`. Requires plans 001+003 landed.
- One commit per step, conventional style, e.g.
  `fix(security): enforce --enterprise-mode block at the pipeline boundary Refs:`

## Steps

### Step 1: Implement `--enterprise-mode`

1. `src/auto-git.js` `run()`: after the dry-run block, before Step "Generate
   or use provided commit message", nothing changes; instead pass the flag
   through in `generateCommitMessage`:
   - Change signature to `async generateCommitMessage(options = {})`.
   - In BOTH `this.generateMessages(diff, {...})` call-sites, add
     `enterpriseMode: options.enterpriseMode === true,` to the options
     object.
   - In `run()`, the two call sites of `generateCommitMessage` already pass
     `options` (line 49 dry-run: `this.generateCommitMessage(options)`; line
     96: same) — verify and keep.
2. `src/core/generation-pipeline.js` `generate()`: restructure the redaction
   block (lines 83–98) so the summary escapes the `if`:

   ```js
    // SECURITY: redact secrets/PII at the pipeline boundary so EVERY caller is
    // covered. Enterprise mode forces sanitization ON and blocks on any find.
    let safeDiff = diff;
    let redactionSummary = { found: false, redacted: 0 };
    if (options.sanitize !== false || options.enterpriseMode) {
      const originalLength = diff.length;
      safeDiff = this.secretScanner.scanAndRedact(diff, true);
      redactionSummary = this.secretScanner.getRedactionSummary();
      if (redactionSummary.found) {
        await this.activityLogger.warn('sensitive_data_redacted', {
          source: 'generation_pipeline',
          redacted: redactionSummary.redacted,
          byCategory: redactionSummary.byCategory,
          originalSize: originalLength,
          sanitizedSize: safeDiff.length,
        });
      }
      this.secretScanner.clearRedactionLog();
    }

    if (options.enterpriseMode && redactionSummary.found) {
      await this.activityLogger.error('enterprise_mode_blocked', {
        redacted: redactionSummary.redacted,
        byCategory: redactionSummary.byCategory,
      });
      throw new Error(
        `Enterprise mode: ${redactionSummary.redacted} sensitive item(s) detected in staged changes — commit blocked. ` +
          'Remove the secrets, or re-run without --enterprise-mode.'
      );
    }
   ```

3. Tests in `tests/core/generation-pipeline.test.js` (constructor injects
   `secretScanner` and `providerFactory` — stub both):
   - enterpriseMode + scanner summary `{ found: true, redacted: 2 }` →
     `generate` rejects with /Enterprise mode/; `providerFactory.create`
     never called.
   - enterpriseMode + `{ found: false }` → proceeds to provider normally.
   - enterpriseMode + `sanitize: false` explicitly passed → STILL redacts
     and blocks (enterprise forces sanitization).

**Verify**: `npx jest tests/core/generation-pipeline.test.js --silent` → all pass.

### Step 2: Close the scanner gaps

In `src/utils/secret-scanner.js`:

1. Line 48 — broaden the AWS secret label:
   ```js
   pattern: /\b(?:aws_)?secret[_-]?(?:access[_-]?)?key[\s:=]+['"]?([A-Za-z0-9\/+]{40})['"]?/gi,
   ```
2. Lines 56–57 — make the PEM pattern tolerate diff prefixes on the END
   line (BEGIN matches mid-line already since it is unanchored):
   ```js
   pattern:
     /-----BEGIN (?:RSA |EC |DSA |SSH2 |OPENSSH )?PRIVATE KEY-----(?:\n|\r\n)[\s\S]*?(?:\n|\r\n)[+\- ]?-----END (?:RSA |EC |DSA |SSH2 |OPENSSH )?PRIVATE KEY-----/g,
   ```
   (Added `OPENSSH` to both alternations and `[+\- ]?` before END.)
3. Line 26 — extend GitHub coverage and add the missing vendors as NEW
   pattern entries (keep the existing entry, widen it):
   ```js
   { name: 'github_token',
     pattern: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,40}|github_pat_[A-Za-z0-9_]{40,90}/g,
     replacement: '[REDACTED_GITHUB_TOKEN]', category: 'secret' },
   { name: 'gitlab_token',
     pattern: /glpat-[A-Za-z0-9_\-]{20,}/g,
     replacement: '[REDACTED_GITLAB_TOKEN]', category: 'secret' },
   { name: 'sendgrid_token',
     pattern: /SG\.[A-Za-z0-9_\-]{16,}\.[A-Za-z0-9_\-]{16,}/g,
     replacement: '[REDACTED_SENDGRID_TOKEN]', category: 'secret' },
   { name: 'npm_token',
     pattern: /npm_[A-Za-z0-9]{30,}/g,
     replacement: '[REDACTED_NPM_TOKEN]', category: 'secret' },
   { name: 'stripe_token',
     pattern: /(?:rk|sk)_live_[A-Za-z0-9]{20,}/g,
     replacement: '[REDACTED_STRIPE_TOKEN]', category: 'secret' },
   { name: 'twilio_token',
     pattern: /SK[0-9a-fA-F]{32}/g,
     replacement: '[REDACTED_TWILIO_TOKEN]', category: 'secret' },
   ```

Add tests in `tests/secret-scanner.test.js` — each of these inputs must be
redacted (follow the file's existing assertion style):
- A PEM block where EVERY line is prefixed `+` (diff form).
- `+AWS_SECRET_ACCESS_KEY=` + 40 chars of `[A-Za-z0-9/+]`.
- `github_pat_` + 60 alphanumerics; `gho_` + 36.
- `glpat-` + 20; `SG.` id `.` secret; `npm_` + 36; `rk_live_` + 24;
  `SK` + 32 hex.

**Verify**: run this probe —
```bash
node -e "
const S = require('./src/utils/secret-scanner');
const s = new S();
const diffForm = '+-----BEGIN RSA PRIVATE KEY-----\n+MIIE...\n+-----END RSA PRIVATE KEY-----';
for (const t of [diffForm, '+AWS_SECRET_ACCESS_KEY='+'A'.repeat(40), 'github_pat_'+'a'.repeat(60), 'glpat-'+'x'.repeat(20), 'SG.'+'a'.repeat(20)+'.'+'b'.repeat(20), 'npm_'+'a'.repeat(36), 'rk_live_'+'a'.repeat(24), 'SK'+'a'.repeat(32)]) {
  const out = s.scanAndRedact(t, false);
  if (!out.includes('[REDACTED')) { console.error('MISSED:', t.slice(0, 40)); process.exit(1); }
}
console.log('all redacted');"
```
→ prints `all redacted`, exit 0. Plus
`npx jest tests/secret-scanner.test.js --silent` → all pass.

### Step 3: Log hygiene — modes + prompt hashing

In `src/core/activity-logger.js`:

1. BEFORE changing the `prompt` field, run:
   `grep -n "\.prompt" src/core/activity-logger.js` and check the analysis
   methods (lines ~260–469). If any reads `entry.data.prompt` (or similar),
   ALSO keep a `promptPreview: prompt?.substring(0, 200)` field so that
   consumer degrades gracefully instead of breaking. If none reads it,
   skip the preview.
2. `initializeLogDirectory` (lines 44–52): change to
   ```js
      await fs.ensureDir(this.logDir, { mode: 0o700 });
      await fs.chmod(this.logDir, 0o700).catch(() => {});
   ```
   (ensureDir does not chmod an existing dir — the explicit chmod covers it.)
3. In `logActivity` (after the `fs.appendFile` at line 144), secure the file
   once per file handle:
   ```js
        if (!this._logFileSecured) {
          await fs.chmod(this.currentLogFile, 0o600).catch(() => {});
          this._logFileSecured = true;
        }
   ```
   Initialize `this._logFileSecured = false` in the constructor and reset it
   to `false` wherever `this.currentLogFile` is reassigned (rotation and
   `initializeLogDirectory`).
4. `logAIInteraction` (lines ~230–252): replace the raw `prompt` field with
   length + hash by default, full content only when opted in:
   ```js
   const includeContent = process.env.AIC_LOG_PROMPTS === '1';
   const crypto = require('crypto');
   // ...inside the info() data object:
   prompt: includeContent
     ? (prompt && prompt.length > 10000 ? `${prompt.substring(0, 10000)}...[TRUNCATED]` : prompt)
     : undefined,
   promptLength: prompt?.length || 0,
   promptHash: prompt
     ? crypto.createHash('sha256').update(prompt).digest('hex').substring(0, 12)
     : null,
   ```
   Add `const crypto = require('crypto');` at the top of the file (module
   scope). Leave the `response` field as-is (AI commit messages, low
   sensitivity).

Add a test in `tests/activity-logger.test.js` (read the file first — it
mocks `fs-extra`; capture the appendFile payload): assert the serialized
entry contains `promptHash` and `promptLength` and does NOT contain the raw
prompt text when `AIC_LOG_PROMPTS` is unset; restore the env var after.

**Verify**: `npx jest tests/activity-logger.test.js --silent` → all pass.
`npm test --silent 2>&1 | tail -5` → 0 failed.

### Step 4: Harden the conf store permissions

In `src/core/config-manager.js`:

1. Add `const fs = require('fs');` to the top imports.
2. Add a private helper:
   ```js
  _secureStoreFile() {
    try {
      fs.chmodSync(this.config.path, 0o600);
    } catch (_) {
      // Non-fatal: store may not exist yet or fs unsupported.
    }
  }
   ```
3. Call `this._secureStoreFile()` at the end of `set`, `setMultiple`
   (after the forEach), and `reset`.

Test in `tests/config-manager.test.js`: the suite already mocks `conf`
(returns `{ store: {}, path: '/test/config.json', ... }`); add
`jest.spyOn(fs, 'chmodSync')` (mock `fs` via `jest.spyOn` on the real
module, restore after) and assert it was called with
`('/test/config.json', 0o600)` after `setMultiple`.

**Verify**: `npx jest tests/config-manager.test.js --silent` → all pass.

### Step 5: Mask the API key on every config output path

In `src/cli-presenter.js` `config(options)` (lines 113–131):

1. `--get` branch — mask like `--list` does:
   ```js
   } else if (options.get) {
     const value = await this.configManager.get(options.get);
     const display = options.get === 'apiKey' && value ? '***configured***' : value;
     console.log(`${options.get}: ${display || 'not set'}`);
   }
   ```
2. `--set` branch — never echo the raw value for `apiKey`:
   ```js
   if (options.set) {
     const [key, value] = options.set.split('=');
     await this.configManager.set(key, value);
     const shown = key === 'apiKey' ? '***masked***' : value;
     console.log(chalk.green(`✅ Configuration updated: ${key} = ${shown}`));
   }
   ```

Tests in `tests/cli-presenter.test.js`: fake `configManager.get` → raw
`gsk_test` value; spy console.log; `config({ get: 'apiKey' })` prints
`***configured***`, and `config({ set: 'apiKey=gsk_test' })` prints
`***masked***` and never the raw value. Follow the file's fake-readline/
mock-deps pattern.

**Verify**: `npx jest tests/cli-presenter.test.js --silent` → all pass.

### Step 6: Sanitize the dry-run stdout seam (hook trailer injection)

In `src/auto-git.js` dry-run branch (lines 40–63): the seam
`aic --dry-run | head -1 > "$1"` (hook-manager.js:135) consumes stdout
verbatim. Sanitize before printing:

```js
      if (dryRunMessage) {
        const InputSanitizer = require('./utils/input-sanitizer');
        console.log(InputSanitizer.sanitizeCommitMessage(dryRunMessage));
      }
```

(Plan 003 Step 1 redefined `sanitizeCommitMessage` to strip only control
characters + trim + cap — safe for legit messages, removes stream-control
characters. This plan depends on 003 for that reason.)

Test in `tests/auto-git.test.js`: run `autoGit.run({ dryRun: true })` with
`generateCommitMessage` mocked to return a message containing `\x1b` escape
and newlines; spy console.log; assert the printed line contains no `\x1b`.

**Verify**: `npm test --silent 2>&1 | tail -5` → 0 failed.

## Test plan

- Enterprise gate: 3 tests (block, pass, sanitize-false-forced) — pipeline suite.
- Scanner: 8+ new redaction cases incl. diff-form PEM — scanner suite.
- Logger: hash-not-content test — activity-logger suite.
- Conf chmod: spy test — config-manager suite.
- Masking: 2 tests — cli-presenter suite.
- Seam: control-char scrub test — auto-git suite.
- Final full run green.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm test --silent 2>&1 | tail -5` → 0 failed
- [ ] `npm run lint` exits 0
- [ ] Step 2 probe script prints `all redacted` (run it, paste output in report)
- [ ] `grep -n "enterprise_mode_blocked" src/core/generation-pipeline.js` → exists
- [ ] `grep -n "promptHash" src/core/activity-logger.js` → exists
- [ ] `grep -n "0o600" src/core/config-manager.js src/core/activity-logger.js` → both files
- [ ] `grep -rn "apiKey = \${value}" src/cli-presenter.js` → no matches
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The analysis methods in `activity-logger.js` (lines 260–469) consume
  `data.prompt` in a way that a preview cannot satisfy (e.g. regex matching
  deep in the prompt) — report the exact consumer; hashing may need a
  follow-up design.
- Enterprise-mode blocking breaks an existing pipeline test in a way that
  reveals the test relied on `sanitize: false` skipping redaction entirely —
  report; do not weaken the gate.
- Any new scanner pattern causes an existing legit fixture in
  `tests/secret-scanner.test.js` to be redacted (false positive) — narrow
  that pattern rather than deleting the test.

## Maintenance notes

- At-rest ENCRYPTION of the API key (the vestigial `encryptedApiKey` schema
  field hints it was once planned) is deliberately deferred: perms + env-var
  path first; encryption changes backup/recovery stories and deserves its
  own plan.
- New vendor token patterns belong in `secret-scanner.js` with a test each —
  the suite is the registry.
- If a future feature needs full prompts logged by default, change the
  default consciously and document the exposure; `AIC_LOG_PROMPTS=1` is the
  escape hatch added here.
