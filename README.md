# 🤖 AI Commit Generator

![Version](https://img.shields.io/github/package-json/v/barungrazitti/gitops)
![License](https://img.shields.io/github/license/barungrazitti/gitops)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)

**Automate your git workflow with AI-powered commit messages**

A Node.js CLI tool that generates intelligent commit messages using Groq (cloud) or Ollama (local). Features full git automation with sequential provider fallback.

> **One command to rule them all:** `aic` - Complete git workflow automation 🚀

## ⚡ Quick Start

```bash
git clone https://github.com/barungrazitti/gitops.git
cd gitops
./install.sh
aic setup
aic
```

## ✨ Features

- **🚀 Fast** - Groq-first with Ollama fallback (sequential, no parallel overhead)
- **📦 Smart Diff Handling** - Auto-truncates at 15KB to fit AI token limits
- **🔧 Simple Config** - Just set your provider and API key
- **🤖 Auto Git** - Stage, commit, pull, resolve conflicts, and push in one command

## 📦 Installation

### Prerequisites
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Git** - [Download](https://git-scm.com/)
- Groq API key OR Ollama installed locally

### Quick Install
```bash
git clone https://github.com/barungrazitti/gitops.git
cd gitops
./install.sh
```

### Manual Install
```bash
git clone https://github.com/barungrazitti/gitops.git
cd gitops
npm install
```

#### Setup Command
```bash
aic setup
```

## 🚀 Usage

### `aic` - Full Automation
Complete git workflow in one command:
```bash
# Auto stage, commit, pull, resolve conflicts, push
aic

# Skip pull or push
aic --skip-pull
aic --no-push

# Dry run (preview only)
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
aicommit --count 3 --type feat
```

## ⚙️ Configuration

```bash
# View config
aic config --list

# Set provider
aic config --set defaultProvider=groq

# Reset to defaults
aic config --reset
```

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `defaultProvider` | `groq` | Primary AI provider (groq or ollama) |
| `model` | `llama-3.3-70b-versatile` | Groq model name |
| `conventionalCommits` | `true` | Use conventional commit format |
| `language` | `en` | Commit message language |

## 🤖 AI Providers

| Provider | Setup | Speed | Fallback |
|----------|-------|-------|----------|
| **Groq** | API key from console.groq.com | Fast (~500ms) | Primary |
| **Ollama** | Local installation | Depends on hardware | Backup |

### How It Works

1. **Preferred Provider First** - Tries your configured provider (default: Groq)
2. **Sequential Fallback** - If primary fails, tries backup (no parallel)
3. **Smart Diff Handling** - Sends diff with auto-truncation at 15KB to fit token limits

### Setup

**Groq:**
1. Get API key at [console.groq.com/keys](https://console.groq.com/keys)
2. Run `aic setup`
3. Select Groq, enter API key

**Ollama:**
1. Install from [ollama.ai](https://ollama.ai/)
2. Run `aic setup`
3. Select Ollama, no API key needed

## 📊 Statistics

```bash
# View stats
aic stats

# Analyze activity
aic stats --analyze

# Export logs
aic stats --export --format csv

# Reset stats
aic stats --reset
```

## 🔧 Troubleshooting

### Command Not Found: `aic`
```bash
# Check symlink
ls -la ~/.local/bin/aic

# Recreate if missing
mkdir -p ~/.local/bin
ln -sf "/path/to/gitops/bin/aic.js" ~/.local/bin/aic
export PATH="$HOME/.local/bin:$PATH"
source ~/.zshrc
```

### AI Provider Issues

**Groq:**
```bash
# Re-run setup
aic setup
# Enter API key from console.groq.com/keys
```

**Ollama:**
```bash
# Ensure Ollama is running
ollama serve

# Test connection
curl http://localhost:11434/api/tags
```

### Large Diffs

For diffs >15KB, content is truncated to fit AI token limits. Use `aic --dry-run` to check diff size.

### Debug Mode

```bash
# Enable verbose logging
export DEBUG=1
aic

# Reset configuration if corrupted
aic config --reset && aic setup
```

## 🛠️ Development

```bash
git clone https://github.com/barungrazitti/gitops.git
cd gitops
npm install
npm test
```

### Code Structure

```
src/
├── core/           # Core modules (git-manager, config-manager, etc.)
├── providers/      # AI providers (groq, ollama)
├── utils/          # Utility functions
└── index.js        # Main entry point
bin/
├── aic.js          # Main CLI entry
└── aicommit.js     # Commit message generator CLI
tests/              # Test files
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

Made with ❤️ by [Barun Tayenjam](https://github.com/barungrazitti)