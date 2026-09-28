# AI Commit Generator (`aic`)

<p align="center">
  <strong>One command for your whole git workflow — stage, write the message, pull, resolve conflicts, push.</strong>
</p>

<p align="center">
  <a href="https://github.com/barungrazitti/gitops"><img src="https://img.shields.io/badge/version-1.5.0-blue?style=flat-square" alt="version" /></a>
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="license" />
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square" alt="node" />
  <img src="https://img.shields.io/badge/tests-523%20passing-brightgreen?style=flat-square" alt="tests" />
  <img src="https://img.shields.io/badge/conventional%20commits-1.0.0-yellow?style=flat-square" alt="conventional commits" />
</p>

`aic` generates intelligent [Conventional Commit](https://www.conventionalcommits.org/) messages from your diff using **Groq (cloud, default)** or **Ollama (local, private)** — then finishes the boring parts for you.

```bash
$ aic
✔ Staged 4 files
✔ Generated: feat(auth): add PKCE flow to OAuth callback
✔ Pulled origin/main — clean
✔ Pushed in 6.2s
```

---

## Table of contents

- [Why aic?](#why-aic)
- [Quick start](#quick-start)
- [Usage](#usage)
- [Configuration](#configuration)
- [Providers](#providers)
- [How it works](#how-it-works)
- [Security](#security)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Why aic?

| Without `aic` | With `aic` |
|---|---|
| `git add -p`, stare at diff, write `fix stuff` | `aic` stages, analyses the diff + repo context, proposes 3 ranked messages |
| `git pull`, hit a merge conflict, lose 20 min | AI resolves conflict blocks, **you review each one** before anything is staged |
| Secrets accidentally pushed to the remote | 20+ secret/PII patterns redacted **before** anything leaves your machine |
| Inconsistent message styles across the team | Conventional-commit output, validated by quality gates on every run |

---

## Quick start

**Prerequisites:** Node.js ≥ 18, Git, and (for the default provider) a free [Groq API key](https://console.groq.com/keys).

```bash
# 1. Install
git clone https://github.com/barungrazitti/gitops.git
cd gitops
npm install
./install.sh          # guided: symlink, global, or npx — pick one

# 2. Configure (pick one)
cp .env.example .env  # then set GROQ_API_KEY=...
# ...or run the wizard:
aic setup

# 3. Use it
cd your-repo
aic                   # stage → message → pull → resolve → push
```

> No `.env`? No problem — `aic setup` stores config in your OS keychain-backed store. `.env` values always win when both exist.

---

## Usage

`aic` with no subcommand runs the full `auto` workflow.

### Full automation

```bash
aic                        # stage → AI message → pull → AI-resolve → push
aic "fix the login bug"    # skip AI generation, use your message
aic --dry-run              # preview: prints the candidate message to stdout
aic --skip-pull            # don't pull before push
aic --no-push              # commit locally only
aic --enterprise-mode      # block the commit if ANY sensitive data is found
aic -f                     # force run even with no detected changes
aic -p ollama              # one-off provider override
```

Pipe-friendly: `aic --dry-run | head -1` gives you the message for hooks and scripts.

### Generate only (interactive pick)

```bash
aic generate                  # propose 3 messages for staged changes, pick one
aic generate -c 5             # propose 5
aic generate --conventional   # force conventional-commit format
aic generate --dry-run        # print without committing
```

### Everyday commands

| Command | What it does |
|---|---|
| `aic setup` | Interactive provider + model wizard |
| `aic config --list` | Show config (API key masked) |
| `aic config --set defaultProvider=ollama` | Change one value |
| `aic config --get <key>` | Read one value (dot notation supported) |
| `aic config --reset` | Back to defaults |
| `aic stats` | Usage statistics |
| `aic stats --analyze` | Recent activity analysis |
| `aic hook --install` / `--uninstall` | Manage the `prepare-commit-msg` hook |
| `aic --verbose` | Detailed logs on console (default: log file only, in `.aic-logs/`) |

Run `aic <command> --help` for the full flag list.

---

## Configuration

Precedence (highest first): **CLI flags → `.env` → stored config → defaults**.

| Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | — | Groq API key (required for `groq` provider) |
| `AIC_PROVIDER` | `groq` | `groq` or `ollama` |
| `AIC_MODEL` | `openai/gpt-oss-20b` | Any Groq model id, or Ollama model name |

```bash
# .env
GROQ_API_KEY=gsk_...
AIC_MODEL=openai/gpt-oss-20b
AIC_PROVIDER=groq
```

See [`.env.example`](.env.example) for the template.

---

## Providers

| | **Groq** (default) | **Ollama** |
|---|---|---|
| Setup | API key from [console.groq.com/keys](https://console.groq.com/keys) | Install from [ollama.ai](https://ollama.ai/), `ollama serve` |
| Best for | Speed + quality | Privacy, offline, no API key |
| Default model | `openai/gpt-oss-20b` (reasoning model — token budget auto-raised) | whatever you have pulled |
| Other models | `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `qwen/qwen3-32b` | any local model |
| Switch | `AIC_PROVIDER=groq` or `aic setup` | `aic config --set defaultProvider=ollama` |

If Groq fails, `aic` automatically falls back to Ollama when available.

---

## How it works

```
staged diff ──▶ redact secrets ──▶ DiffShaper (18 KB budget, keeps file
                                       headers, prioritises key chunks)
                       │                        │
                 diff cache                  Groq ──fail──▶ Ollama
                                                  │
                                     rank candidates by quality
                                                  │
                                     validate (QUAL-01/02 gates)
                                                  │
                                     commit → pull → AI-resolve* → push
```

Three design decisions worth knowing:

1. **One module owns the diff budget.** `src/core/diff-shaper.js` is the only place that truncates or chunks diffs — prompts and providers never re-truncate.
2. **Conflicts are review-gated.** AI resolves merge conflicts block-by-block, then shows you each one: accept, set aside for manual resolution, or discard. Nothing is staged silently.
3. **Messages are grounded.** Scopes come from the changed code (never guessed), empty trailers are stripped, binary-only diffs are described locally without a model call.

---

## Security

All diffs are scanned and redacted **locally, before** any network call:

| Category | Coverage |
|---|---|
| Secrets (15+ patterns) | API keys, tokens, passwords, SSH keys |
| PII (8 patterns) | Emails, phones, SSNs, addresses, credit cards |

- `--enterprise-mode` aborts the commit if **any** sensitive data is detected (instead of redacting and continuing).
- API keys are masked in all console output and logs.

---

## Development

```bash
npm install            # install dependencies
npm test               # full Jest suite (523 tests, 30 suites)
npx jest tests/auto-git.test.js   # single file
npm run test:coverage  # with coverage
npm run lint           # ESLint — must be 0 errors, 0 warnings
npm run lint:fix       # auto-fix
```

Entry point is `bin/aic` → `bin/aic.js` (the composition root). Conventions: CommonJS `require()`, `PascalCase` classes, `camelCase` methods, `kebab-case` files, JSDoc on public methods, `async/await` throughout. See [AGENTS.md](AGENTS.md) for architecture rules (e.g. DiffShaper budget ownership, dependency-injected `AutoGit`).

```
src/
├── index.js            # AICommitGenerator — pipeline orchestrator
├── auto-git.js         # stage / commit / pull / resolve / push workflow
├── cli-presenter.js    # console UI
├── core/               # diff-shaper, generation-pipeline, conflict-resolver,
│                       # message-{ranker,validator,formatter}, git/config/cache/
│                       # analysis/stats/activity-log/hook/circuit-breaker
├── providers/          # base + groq + ollama + factory
└── utils/              # secret-scanner, prompt-builder, sanitizers, scorers
bin/
├── aic                 # shell shim
└── aic.js              # CLI entry point (all commands)
tests/                  # Jest suites (mirrors src/)
```

Contributions welcome — open an issue or PR. Please run `npm test` and `npm run lint` before submitting.

---

## Troubleshooting

<details>
<summary><strong><code>aic: command not found</code></strong></summary>

Re-run `./install.sh` (option 1 creates `~/.local/bin/aic`), ensure `~/.local/bin` is on your `PATH`, or just use `node bin/aic.js …` / `npx aic …` directly.

</details>

<details>
<summary><strong>Groq returns empty responses</strong></summary>

Reasoning models (`gpt-oss-*`) need a larger token budget — handled automatically. If it persists, check `aic config --list` for your key, or try a non-reasoning model: `AIC_MODEL=llama-3.1-8b-instant` in `.env`.

</details>

<details>
<summary><strong>Ollama connection errors</strong></summary>

```bash
ollama serve                          # must be running
curl http://localhost:11434/api/tags  # should list models
```

</details>

---

## License

MIT — see [LICENSE](LICENSE).

_Made by [Barun Tayenjam](https://github.com/barungrazitti)_
