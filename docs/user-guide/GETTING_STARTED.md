# Getting Started with AI Commit Generator

Automate your git workflow with AI-powered commit messages.

---

## ⚡ Quick Start (30 seconds)

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

## 📋 What It Does

The AI Commit Generator (`aic`) automates your entire git workflow:

1. **Stages** your changes
2. **Analyzes** your code with AI
3. **Generates** intelligent commit messages
4. **Commits** with quality validation
5. **Pulls** latest changes (handles conflicts!)
6. **Pushes** to remote

All in one command: `aic`

---

## 🎯 Key Features

| Feature | Description |
|---------|-------------|
| 🚀 **Fast** | Groq-first with Ollama fallback (~500ms) |
| 🧠 **Smart** | Understands your codebase context |
| 🔒 **Secure** | Auto-redacts secrets and PII |
| ✅ **Quality** | Enforces specific, reasoned messages |
| 🤖 **Auto Git** | Full workflow automation |

---

## 🛠️ Commands

### Main Command: `aic`

Complete git workflow automation:

```bash
# Full automation
aic

# Dry run (preview only)
aic --dry-run

# Skip pull
aic --skip-pull

# No push
aic --no-push

# Enterprise mode (block on sensitive data)
aic --enterprise-mode
```

### Message Generation: `aicommit`

Generate commit messages for already staged changes:

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

### Statistics

```bash
# View stats
aic stats

# Analyze activity
aic stats --analyze

# Export logs
aic stats --export --format csv
```

---

## 🔧 AI Providers

### Groq (Cloud) - Recommended

**Pros:** Fast (~500ms), high quality  
**Cons:** Requires API key

1. Get API key: [console.groq.com/keys](https://console.groq.com/keys)
2. Run: `aic setup`
3. Select Groq, enter API key

### Ollama (Local)

**Pros:** Private, no API key needed  
**Cons:** Slower, requires local setup

1. Install: [ollama.ai](https://ollama.ai/)
2. Run: `aic setup`
3. Select Ollama

---

## 📝 Example Output

```bash
$ git add .
$ aic

🔒 Scanning for sensitive information...
✅ No secrets found

🧩 Analyzing repository context...
🤖 Generating commit messages with AI...
✅ Commit messages generated successfully!

📝 Generated commit messages:

1. feat(auth): add JWT token validation to improve security

   What Changed:
   - Added JWT validation in AuthService
   - Updated login endpoint

   Why Changed:
   - To prevent unauthorized access with expired tokens

   Impact:
   - Affects 2 files that depend on AuthService

2. feat(api): enhance authentication with JWT support
...

✅ Committed: feat(auth): add JWT token validation to improve security
✓ Done in 2.3s
```

---

## 🎓 Quality Guarantees

Your commit messages are validated for:

- ✅ **Specificity** - No generic "update code" messages
- ✅ **Reasoning** - Explains WHY changes were made
- ✅ **Context** - Mentions components/files affected
- ✅ **Format** - Conventional commit standard

---

## 🔒 Security

All code is scanned BEFORE sending to AI:

- 🔑 API keys, tokens, passwords → Redacted
- 👤 Email addresses, phone numbers → Redacted
- 🏠 IP addresses, physical addresses → Redacted
- 💳 Credit card numbers, SSN → Redacted

**Enterprise Mode:** Block commits with ANY sensitive data:
```bash
aic --enterprise-mode
```

---

## ⚙️ Configuration Options

| Setting | Default | Description |
|---------|---------|-------------|
| `defaultProvider` | `groq` | AI provider (groq/ollama) |
| `model` | `llama-3.3-70b-versatile` | Groq model |
| `conventionalCommits` | `true` | Use conventional format |
| `language` | `en` | Message language |

---

## 🆘 Troubleshooting

### No staged changes
```bash
# Stage your changes first
git add .
aic
```

### API key error
```bash
# Re-run setup
aic setup
# Enter your Groq API key
```

### Rate limit exceeded
```bash
# Switch to Ollama (local)
aic config --set defaultProvider=ollama
```

### Merge conflicts
The tool will offer AI-powered conflict resolution automatically.

---

## 📚 Next Steps

- [Installation Guide](INSTALLATION.md) - Detailed installation
- [Configuration](CONFIGURATION.md) - Advanced settings
- [Usage Guide](USAGE.md) - All commands explained
- [Best Practices](BEST_PRACTICES.md) - Tips for best results

---

## 🆘 Getting Help

- 📖 [Full Documentation](../docs/INDEX.md)
- 🐛 [Report Issues](https://github.com/barungrazitti/gitops/issues)
- 💬 [Discussions](https://github.com/barungrazitti/gitops/discussions)

---

*Last updated: 2026-03-27*
