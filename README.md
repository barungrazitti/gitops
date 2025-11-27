# 🤖 AI Commit Generator

**Automate your git workflow with AI-powered commit messages**

A Node.js tool that generates intelligent commit messages using Groq or Ollama AI providers. Offers both full git automation and commit message generation.

> **One command to rule them all:** `aic` - Complete git workflow automation 🚀

**Quick Start:**
```bash
git clone https://github.com/barungrazitti/gitops.git
cd gitops
./install.sh
aic setup
aic "initial commit"
```

## 📦 Installation

### Prerequisites
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Git** - [Download](https://git-scm.com/)
- Groq API key OR Ollama installed locally

### Quick Install (Recommended)
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

#### Option 1: Local Symlink (Recommended)
```bash
# Create symlink in local bin (no sudo needed)
mkdir -p ~/.local/bin
ln -sf "$(pwd)/bin/aic.js" ~/.local/bin/aic
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Test installation
aic --version
aic setup
```

#### Option 2: Global Installation
```bash
# Install globally (may require sudo)
npm install -g .

# Test installation
aic --version
aic setup
```

#### Option 3: Use with npx (Fallback)
```bash
# If symlink/global install fails
npx aic --version
npx aic setup
```

### Setup
```bash
aic setup
```

**⚠️ Known Issue**: If `npm link` fails with permission errors, you may see `zsh: command not found` when running `aic`. This happens when an existing global package has wrong permissions.

**Solutions**:
1. **Quick fix** - Add project directory to your PATH by adding this line to your `.zshrc`:
   ```bash
   export PATH="/Users/barun.tayenjam/Documents/Code/git-ops:$PATH"
   ```
   Then restart your terminal.

2. **Proper fix** - Clean up the existing global package:
   ```bash
   sudo rm -rf /Users/barun.tayenjam/.nvm/versions/node/v22.14.0/lib/node_modules/ai-commit-generator
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

## 🔧 Troubleshooting

### Common Installation Issues

#### Command Not Found: `aic`
```bash
# Error: zsh: command not found: aic
# Solution: Check if symlink exists and PATH is updated

# 1. Verify symlink exists
ls -la ~/.local/bin/aic

# 2. If missing, recreate it
mkdir -p ~/.local/bin
ln -sf "/path/to/your/gitops/bin/aic.js" ~/.local/bin/aic

# 3. Update PATH (add to ~/.zshrc or ~/.bashrc)
export PATH="$HOME/.local/bin:$PATH"
source ~/.zshrc  # or source ~/.bashrc
```

#### Permission Denied Errors
```bash
# Error: EACCES: permission denied
# Solution: Use local symlink instead of global install

# Instead of: npm install -g . (requires sudo)
# Use: Local symlink method (no sudo needed)
mkdir -p ~/.local/bin
ln -sf "$(pwd)/bin/aic.js" ~/.local/bin/aic
```

#### Node.js Version Compatibility
```bash
# Error: inquirer.prompt is not a function
# Solution: Check Node.js version (requires v18+)

node --version  # Should be v18.x or higher

# If using Node.js v25+, the tool uses readline prompts instead of inquirer
# This is normal and expected behavior
```

### Common Usage Issues

#### "No staged changes found" Error
```bash
# Error: No staged changes found. Please stage your changes first.
# Solution: Use `aic` (auto-stages) or stage manually

# Option 1: Use auto-workflow (recommended)
aic  # Automatically stages all changes

# Option 2: Stage manually then use aicommit
git add .
aicommit

# Option 3: Stage specific files
git add src/ package.json
aicommit
```

#### Git Push Permission Errors
```bash
# Error: Permission to repo.git denied to user
# Solution: Check git configuration and repository access

# 1. Check current git user
git config --global user.name
git config --global user.email

# 2. Check remote URL
git remote -v

# 3. Use --no-push flag if you only want local commits
aic --no-push
```

#### AI Provider Connection Issues

**Groq API Issues:**
```bash
# Error: Invalid Groq API key
# Solution: Re-run setup with correct key

aic setup
# Choose Groq, enter valid API key from console.groq.com/keys
```

**Ollama Connection Issues:**
```bash
# Error: Failed to connect to Ollama
# Solution: Ensure Ollama is running

# Start Ollama
ollama serve

# Test connection
curl http://localhost:11434/api/tags

# Install a model if needed
ollama pull deepseek-coder
```

### Performance Issues

#### Slow Response Times
```bash
# If AI generation is slow, try:

# 1. Switch providers
aic config --set provider=ollama  # Local (faster)
# or
aic config --set provider=groq    # Cloud (consistent)

# 2. Reduce message count
aic --count 1  # Generate fewer options

# 3. Use specific model
aic --model mixtral-8x7b  # Faster model
```

#### Large Repository Issues
```bash
# For large diffs, the tool automatically:
# - Detects plugin/dependency updates (avoids chunking)
# - Intelligently chunks large changes
# - Preserves semantic context

# Monitor the process:
aic --dry-run  # See what will be done
```

### Debug Mode

#### Enable Verbose Logging
```bash
# Enable detailed logging for debugging
export DEBUG=1
aic  # Shows detailed step-by-step process

# Check activity logs
aic stats --analyze  # Review recent activity
aic stats --export   # Export logs for analysis
```

#### Reset Configuration
```bash
# If configuration is corrupted:
aic config --reset  # Reset to defaults
aic setup          # Reconfigure from scratch
```

### Edge Cases

#### Empty Repository
```bash
# In new repositories with no commits:
git init
aic  # Will create initial commit automatically
```

#### Merge Conflicts
```bash
# During merge conflicts, aic offers:
# 1. AI-powered resolution (recommended)
# 2. Keep current changes (theirs)
# 3. Use incoming changes (mine)
# 4. Manual resolution guidance
# 5. Cancel operation

# Choose option 1 for intelligent AI merging
```

#### Network Issues
```bash
# If network is down:
# 1. Use Ollama (local AI) instead of Groq
aic config --set provider=ollama

# 2. Skip pull/push operations
aic --skip-pull --no-push  # Local commit only
```

#### Multiple Git Identities
```bash
# For work/personal repository separation:
# Configure per-repository settings
cd /path/to/work-repo
aic config --set apiKey=work-api-key

cd /path/to/personal-repo  
aic config --set apiKey=personal-api-key
```

### Getting Help

```bash
# Get help for any command
aic --help
aic setup --help
aic config --help

# Check version
aic --version

# View current configuration
aic config --list

# Analyze recent activity for issues
aic stats --analyze --days 7
```

## 🛠️ Development

```bash
# Clone and develop
git clone https://github.com/barungrazitti/gitops.git
cd gitops
npm install
npm run dev

# Run tests
npm test
npm run test:coverage
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file

## 👨‍💻 Author

Created by [Barun Tayenjam](https://github.com/barungrazitti)

## 🙏 Acknowledgments

Inspired by:
- [aicommits](https://github.com/Nutlope/aicommits) by Nutlope
- [aicommit2](https://github.com/tak-bro/aicommit2) by tak-bro
- [gcop](https://github.com/yegor256/gcop) by yegor256

---

Made with ❤️ by [Barun Tayenjam](https://github.com/barungrazitti)