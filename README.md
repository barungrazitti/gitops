# 🤖 AI Commit Generator

**Automate your git workflow with AI-powered commit messages**

A Node.js tool that generates intelligent commit messages using Groq or Ollama AI providers. Offers both full git automation and commit message generation.

> **One command to rule them all:** `aic` - Complete git workflow automation 🚀

## 📦 Installation

### Prerequisites
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Git** - [Download](https://git-scm.com/)
- Groq API key OR Ollama installed locally

### Clone and Install
```bash
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator
npm install
npm link
```

### Setup
```bash
aic setup
```

## 🚀 Usage

### `aic` - Full Automation
Complete git workflow in one command:
```bash
# Auto stage, commit, pull, resolve, push
aic

# With custom message
aic "fix: resolve login issue"

# Skip pull or push
aic --skip-pull
aic --no-push

# Dry run
aic --dry-run
```

### `aicommit` - Message Generation Only
For manually staged changes:
```bash
# Stage changes first
git add .

# Generate commit message
aicommit

# With options
aicommit --provider ollama --count 5 --type feat
```

## ⚙️ Configuration

```bash
# View config
aicommit config --list

# Set provider
aicommit config --set provider=ollama

# Reset to defaults
aicommit config --reset
```

### Options
| Setting | Default | Description |
|---------|---------|-------------|
| `defaultProvider` | `groq` | AI provider (groq or ollama) |
| `conventionalCommits` | `true` | Use conventional commit format |
| `language` | `en` | Commit message language |
| `messageCount` | `3` | Number of messages to generate |

## 🤖 AI Providers

| Provider | Setup | Local |
|----------|-------|-------|
| **Groq** | API key required | ❌ |
| **Ollama** | Local installation | ✅ |

- **Groq**: Get API key at [console.groq.com](https://console.groq.com/keys)
- **Ollama**: Install from [ollama.ai](https://ollama.ai/)

## 📊 Statistics

```bash
# View stats
aic stats
aicommit stats

# Analyze activity
aic stats --analyze

# Export logs
aic stats --export --format csv

# Reset stats
aic stats --reset
```

## 🔧 Advanced

### Git Hooks
```bash
# Install auto-commit hook
aicommit hook --install

# Uninstall
aicommit hook --uninstall
```

### Customization
```bash
# Custom prompts
aicommit config --set customPrompts.feat="Focus on new features"

# Exclude files
aicommit config --set excludeFiles="*.log,dist/**"

# Proxy (enterprise)
aicommit config --set proxy="http://proxy.company.com:8080"
```

## 🛠️ Development

```bash
# Clone and develop
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator
npm install
npm run dev

# Run tests
npm test
npm run test:coverage
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file

## 👨‍💻 Author

Created by [Barun Tayenjam](https://github.com/baruntayenjam)

## 🙏 Acknowledgments

Inspired by:
- [aicommits](https://github.com/Nutlope/aicommits) by Nutlope
- [aicommit2](https://github.com/tak-bro/aicommit2) by tak-bro
- [gcop](https://github.com/yegor256/gcop) by yegor256

---

Made with ❤️ by [Barun Tayenjam](https://github.com/baruntayenjam)