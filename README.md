# 🤖 AI Commit Generator

![Version](https://img.shields.io/badge/version-1.5.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![Tests](https://img.shields.io/badge/tests-480%20passing-brightgreen)

**Automate your git workflow with AI-powered commit messages**

A Node.js CLI tool that generates intelligent commit messages using Groq (cloud) or Ollama (local). One command stages, commits, pulls, resolves merge conflicts with AI, and pushes.

> **One command to rule them all:** `aic` 🚀

---

## ⚡ Quick Start

```bash
# 1. Install
git clone https://github.com/barungrazitti/gitops.git
cd gitops
npm install

# 2. Configure — either create a .env file:
cat > .env << 'EOF'
GROQ_API_KEY=your_key_from_console.groq.com
AIC_MODEL=openai/gpt-oss-20b
AIC_PROVIDER=groq
EOF

#    ...or run the interactive wizard:
aic setup

# 3. Use it!
aic
```

---

## ✨ Features

| Feature           | Description                                        |
| ----------------- | -------------------------------------------------- |
| **🚀 Fast**       | Groq-first with Ollama fallback                    |
| **🧠 Smart**      | Semantic analysis of your diff and repo context    |
| **🔒 Secure**     | Auto-redacts 20+ secret/PII patterns before AI     |
| **🤖 Auto Git**   | Stage, commit, pull, AI-resolve conflicts, push    |
| **🏢 Enterprise** | Strict mode blocks commits with ANY sensitive data |

---

## 🚀 Usage

### Full Automation (default command)

```bash
aic                        # Stage → AI commit message → pull → resolve → push
aic "fix the login bug"    # Use provided message, skip AI generation
aic --dry-run              # Preview what would happen
aic --skip-pull            # Skip pulling before push
aic --no-push              # Don't push after commit
aic --enterprise-mode      # Block commits with ANY sensitive data
aic -f                     # Force run even if no changes detected
```

### Configuration

```bash
aic config --list                    # View config (API key masked)
aic config --set defaultProvider=ollama
aic config --reset
aic setup                            # Interactive wizard
```

### .env Support

Settings in `.env` override the stored config — no setup prompts needed:

```bash
GROQ_API_KEY=gsk_...         # Groq API key
AIC_MODEL=openai/gpt-oss-20b # Any Groq model id
AIC_PROVIDER=groq            # groq | ollama
```

### Statistics

```bash
aic stats            # Usage statistics
aic stats --analyze  # Recent activity analysis
aic stats --reset    # Reset stats
```

### Git Hooks

```bash
aic hook --install     # Install prepare-commit-msg hook
aic hook --uninstall
```

---

## 🤖 AI Providers

### Groq (Cloud) — Default

Fast, good quality. Default model: **`openai/gpt-oss-20b`** (reasoning model; the tool automatically raises the token budget for it).

- Get an API key at [console.groq.com/keys](https://console.groq.com/keys)
- Configure via `.env` (`GROQ_API_KEY`) or `aic setup`

Other Groq models available: `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `qwen/qwen3-32b`.

### Ollama (Local)

Private, no API key. Install from [ollama.ai](https://ollama.ai/), then:

```bash
aic config --set defaultProvider=ollama
```

---

## 🔒 Security

All diffs are scanned and redacted **before** being sent to any AI provider:

| Category       | Patterns | Examples                                     |
| -------------- | -------- | -------------------------------------------- |
| **🔑 Secrets** | 15+      | API keys, tokens, passwords, SSH keys        |
| **👤 PII**     | 8        | Emails, phones, SSN, addresses, credit cards |

Enterprise mode (`--enterprise-mode`) blocks commits containing ANY sensitive data.

---

## 🧭 How It Works

```
staged diff ──▶ SecretScanner (redact) ──▶ DiffShaper (18KB budget, smart truncation)
                  │                              │
                  ▼                              ▼
             CacheManager ──── miss ───▶ Groq ──fail──▶ Ollama
                                                 │
                                                 ▼
                                  MessageRanker (score & rank)
                                                 │
                                                 ▼
                                  MessageValidator (QUAL-01/02 gates)
```

- **DiffShaper** owns the token budget: one module decides what the AI sees (file headers preserved, high-significance chunks prioritized)
- **Merge conflicts** are resolved block-by-block by AI (`generateResponse` path), with a keep-HEAD fallback if AI fails
- **QUAL-01/QUAL-02** quality gates log message quality on every generation

---

## 🛠️ Development

```bash
npm install         # Install dependencies
npm test            # Run test suite (480 tests, 25 suites)
npm run lint        # ESLint
npm run test:coverage
```

### Code Structure

```
src/
├── index.js           # AICommitGenerator — generation pipeline orchestrator
├── auto-git.js        # AutoGit — full workflow (stage/commit/pull/resolve/push)
├── cli-presenter.js   # Console UI (selection menus, config/setup/stats display)
├── core/
│   ├── diff-shaper.js       # THE diff budget owner (truncation, chunking)
│   ├── message-ranker.js    # Commit message scoring & ranking
│   ├── conflict-resolver.js # AI merge-conflict resolution
│   ├── message-validator.js # QUAL-01/02 quality gates
│   ├── git-manager.js       # Git operations
│   ├── config-manager.js    # Config + .env overrides
│   ├── cache-manager.js     # Diff-keyed message cache
│   ├── analysis-engine.js   # Repository context analysis
│   ├── stats-manager.js     # Usage statistics
│   ├── activity-logger.js   # Structured activity logs (.aic-logs/)
│   ├── hook-manager.js      # Git hook management
│   ├── circuit-breaker.js   # Provider failure protection
│   └── message-formatter.js # Conventional commit formatting
├── providers/
│   ├── base-provider.js     # Abstract provider (retry, parse, errors)
│   ├── groq-provider.js     # Groq adapter
│   ├── ollama-provider.js   # Ollama adapter
│   └── ai-provider-factory.js
├── utils/             # Secret scanner, prompt builder, sanitizers, etc.
└── formatters/        # Message section formatters
bin/
├── aic                # Shell shim
└── aic.js             # CLI entry point (all commands)
tests/                 # Jest suites (mirrors src/ layout)
```

---

## 🆘 Troubleshooting

### Command Not Found

```bash
mkdir -p ~/.local/bin
ln -sf "$(pwd)/bin/aic.js" ~/.local/bin/aic
export PATH="$HOME/.local/bin:$PATH"
```

### Groq returns empty responses

Reasoning models (`gpt-oss`) need a larger token budget — the tool handles this automatically. If problems persist, verify your API key (`aic config --list`) or switch models via `.env` (`AIC_MODEL=llama-3.1-8b-instant`).

### Ollama issues

```bash
ollama serve                          # Ensure Ollama is running
curl http://localhost:11434/api/tags  # Test connection
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

_Made with ❤️ by [Barun Tayenjam](https://github.com/barungrazitti)_
