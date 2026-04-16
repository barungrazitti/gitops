# 🤖 AI Commit Generator

![Version](https://img.shields.io/github/package-json/v/barungrazitti/gitops)
![License](https://img.shields.io/github/license/barungrazitti/gitops)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![Tests](https://img.shields.io/badge/tests-423%20passing-brightgreen)
![Security](https://img.shields.io/badge/security-20%2B%20patterns-brightgreen)

**Automate your git workflow with AI-powered commit messages**

A Node.js CLI tool that generates intelligent commit messages using Groq (cloud) or Ollama (local). Features full git automation, quality validation, and enterprise-grade security.

> **One command to rule them all:** `aic` - Complete git workflow automation 🚀

---

## ⚡ Quick Start

```bash
# 1. Install
git clone https://github.com/barungrazitti/gitops.git
cd gitops
./install.sh

# 2. Setup AI provider
aic setup

# 3. Use it!
git add .
aic
```

---

## ✨ Features

| Feature           | Description                                  |
| ----------------- | -------------------------------------------- |
| **🚀 Fast**       | Groq-first with Ollama fallback (~500ms)     |
| **🧠 Smart**      | Understands your codebase context            |
| **🔒 Secure**     | Auto-redacts 20+ secret/PII patterns         |
| **✅ Quality**    | Enforces specific, reasoned messages         |
| **🤖 Auto Git**   | Stage, commit, pull, resolve conflicts, push |
| **🏢 Enterprise** | Strict security mode available               |

---

## 🚀 Usage

### Full Automation

```bash
# Complete git workflow
aic

# Preview only (dry run)
aic --dry-run

# Skip pull or push
aic --skip-pull
aic --no-push

# Enterprise mode (block on sensitive data)
aic --enterprise-mode
```

### Message Generation Only

```bash
git add .
aicommit
```

### Configuration

```bash
# View config
aic config --list

# Set provider
aic config --set defaultProvider=groq

# Setup wizard
aic setup
```

### Statistics & Logs

```bash
# View stats
aic stats

# Analyze activity
aic stats --analyze

# Export logs
aic stats --export --format csv
```

---

## 📚 Documentation

Complete documentation is available in the [`docs/`](docs/INDEX.md) directory:

| Audience         | Documentation                                         |
| ---------------- | ----------------------------------------------------- |
| **Users**        | [Getting Started](docs/user-guide/GETTING_STARTED.md) |
| **Developers**   | [Developer Guide](docs/developer-guide/MODULES.md)    |
| **Security**     | [PII Protection](docs/security/PII_PROTECTION.md)     |
| **Enterprise**   | [Enterprise Features](docs/enterprise/FEATURES.md)    |
| **Architecture** | [Overview](docs/architecture/OVERVIEW.md)             |

---

## 🔒 Security

All code is scanned and sanitized **BEFORE** sending to AI:

### Protected Data Types

| Category       | Patterns | Examples                                     |
| -------------- | -------- | -------------------------------------------- |
| **🔑 Secrets** | 15+      | API keys, tokens, passwords, SSH keys        |
| **👤 PII**     | 8        | Emails, phones, SSN, addresses, credit cards |

### Enterprise Mode

For organizations with strict security requirements:

```bash
aic --enterprise-mode
```

- ✅ Blocks commits with ANY sensitive data
- ✅ Enhanced audit logging
- ✅ Compliance-ready reports

**Learn more:** [PII Protection Guide](docs/security/PII_PROTECTION.md)

---

## 🤖 AI Providers

### Groq (Cloud) - Recommended

**Pros:** Fast (~500ms), high quality  
**Setup:** Get API key from [console.groq.com/keys](https://console.groq.com/keys)

```bash
aic setup
# Select Groq, enter API key
```

### Ollama (Local)

**Pros:** Private, no API key needed  
**Setup:** Install from [ollama.ai](https://ollama.ai/)

```bash
aic setup
# Select Ollama
```

---

## ✅ Quality Guarantees

Every commit message is validated for:

- **Specificity** - No generic "update code" messages (QUAL-01: <5% generic)
- **Reasoning** - Explains WHY changes were made (QUAL-02: >90% with reasoning)
- **Context** - Mentions components/files affected
- **Format** - Conventional commit standard

### Example Output

```
feat(auth): add JWT token validation to improve security

What Changed:
- Added JWT validation in AuthService
- Updated login endpoint

Why Changed:
- To prevent unauthorized access with expired tokens

Impact:
- Affects 2 files that depend on AuthService
```

---

## 📊 Project Status

| Metric            | Status                              |
| ----------------- | ----------------------------------- |
| Latest Release    | [v1.4.0](CHANGELOG.md) (2026-04-11) |
| Test Coverage     | 423 tests, 19 suites                |
| Security Patterns | 23 detection patterns               |
| Quality Gates     | QUAL-01, QUAL-02 enforced           |
| Documentation     | Complete with 20+ guides            |

---

## 🛠️ Development

```bash
# Clone and install
git clone https://github.com/barungrazitti/gitops.git
cd gitops
npm install

# Run tests
npm test

# Run single test file
npx jest tests/core/message-validator.test.js
```

### Code Structure

```
src/
├── core/           # Core modules (git, config, cache, etc.)
├── providers/      # AI providers (Groq, Ollama)
├── detectors/      # Code analysis (components, files, dependencies)
├── formatters/     # Message formatting (what, why, impact)
├── utils/          # Utilities (security, validation, etc.)
└── commands/       # CLI commands
bin/
├── aic.js          # Main CLI entry
└── aicommit.js     # Commit generator CLI
tests/              # Test suites
docs/               # Documentation
```

---

## 🧪 Testing

```bash
# Full test suite
npm test

# Test with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

**Current Status:** 423 passing tests across 19 test suites

---

## 📦 Installation Options

### Option 1: Install Script (Recommended)

```bash
./install.sh
```

### Option 2: Manual Install

```bash
npm install
mkdir -p ~/.local/bin
ln -sf "$(pwd)/bin/aic.js" ~/.local/bin/aic
export PATH="$HOME/.local/bin:$PATH"
```

### Option 3: Use with npx

```bash
npx aic setup
npx aic
```

---

## 🆘 Troubleshooting

### Command Not Found

```bash
# Check symlink
ls -la ~/.local/bin/aic

# Recreate if missing
mkdir -p ~/.local/bin
ln -sf "$(pwd)/bin/aic.js" ~/.local/bin/aic
export PATH="$HOME/.local/bin:$PATH"
```

### AI Provider Issues

**Groq:**

```bash
aic setup
# Re-enter API key from console.groq.com/keys
```

**Ollama:**

```bash
# Ensure Ollama is running
ollama serve

# Test connection
curl http://localhost:11434/api/tags
```

### Security Redaction

If commits are blocked in enterprise mode:

1. Review redaction summary
2. Remove sensitive data from code
3. Use environment variables for secrets
4. Commit in smaller chunks

---

## 🔗 Links

- 📖 [Full Documentation](docs/INDEX.md)
- 📋 [Changelog](CHANGELOG.md)
- 🐛 [Issue Tracker](https://github.com/barungrazitti/gitops/issues)
- 💬 [Discussions](https://github.com/barungrazitti/gitops/discussions)
- 🔑 [Get Groq API Key](https://console.groq.com/keys)
- 🦙 [Ollama](https://ollama.ai/)

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

## 🙏 Acknowledgments

Made with ❤️ by [Barun Tayenjam](https://github.com/barungrazitti)

---

_Last updated: 2026-04-11_
