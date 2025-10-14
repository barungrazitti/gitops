# AIC Complete Guide & Examples

Complete installation, setup, and usage guide with real-world examples.

## 📦 Installation & Setup

### Installation Options

**Global Installation (Recommended):**

```bash
npm install -g ai-commit-generator
```

**Local Installation:**

```bash
# In your project directory
npm install ai-commit-generator

# Use with npx
npx aic
```

**From Source (Development):**

```bash
git clone <repository-url>
cd ai-commit-generator
npm install
npm link  # Makes 'aic' available globally
```

### Initial Setup

**Run Setup Wizard:**

```bash
aic setup
```

**Example Setup Flow:**

```bash
$ aic setup

🚀 AI Commit Generator Setup Wizard

? Select your preferred AI provider:
❯ OpenAI (GPT-3.5/GPT-4)
  Anthropic Claude
  Google Gemini
  Mistral AI
  Cohere
  Groq
  Ollama (Local)

? Enter your API key: [hidden]
? Use conventional commit format? Yes
? Select commit message language: English

✅ Setup completed successfully!
```

### Getting API Keys

| Provider          | URL                                                               | Notes                           |
| ----------------- | ----------------------------------------------------------------- | ------------------------------- |
| **OpenAI**        | [platform.openai.com](https://platform.openai.com/api-keys)       | Most popular, starts with `sk-` |
| **Anthropic**     | [console.anthropic.com](https://console.anthropic.com/)           | Claude 3 models                 |
| **Google Gemini** | [makersuite.google.com](https://makersuite.google.com/app/apikey) | Free tier available             |
| **Ollama**        | [ollama.ai](https://ollama.ai/)                                   | Local models, no API key needed |

### Verification

**Check if everything is working:**

```bash
aic status
```

**Expected output:**

```
📊 AIC Status

✅ Git Repository
   Branch: main
   Remote: origin
   Changes: 0 files

✅ AI Configuration
   Provider: openai
   API Key: ***configured***
   Format: conventional
   Language: en
```

## 🚀 Basic Usage Guide

### First Commit Example

1. **Navigate to your project:**

   ```bash
   cd my-project
   ```

2. **Make some changes:**

   ```bash
   echo "console.log('Hello World');" > app.js
   echo "# My Project" > README.md
   ```

3. **Run AIC:**

   ```bash
   aic
   ```

4. **Select commit message:**

   ```
   ? Select commit message:
   ❯ 1. feat: add hello world application and project documentation
     2. chore: initialize project with app.js and README
     3. docs: create initial project structure
     ✏️  Write custom message
     ❌ Cancel
   ```

5. **Done!** Your changes are committed and pushed! 🎉

### Common Commands

```bash
aic                           # Full auto workflow
aic "custom message"          # Use your own message
aic quick                     # "chore: quick update"
aic quick feat                # "feat: quick update"
aic --dry-run                 # Preview without executing
aic --no-push                 # Commit & pull but don't push
aic status                    # Check configuration
aic config --list             # Show all settings
```

## 🚨 Troubleshooting

### Common Issues & Solutions

**"Command not found: aic"**

```bash
# Reinstall globally
npm install -g ai-commit-generator

# Check if installed
which aic

# Or use npx
npx aic
```

**"Not a git repository"**

```bash
# Initialize git
git init

# Add remote (if you have one)
git remote add origin https://github.com/username/repo.git
```

**"AI provider not configured"**

```bash
# Run setup again
aic setup

# Or set manually
aic config --set provider=openai
aic config --set apiKey=your-api-key
```

**"No changes detected"**

```bash
# Check git status
git status

# Make sure you have changes
echo "test" >> file.txt

# Or force run
aic --force
```

**"API key invalid"**

```bash
# Check current key
aic config --get apiKey

# Reset and setup again
aic config --reset
aic setup
```

**"Push failed"**

```bash
# Check git authentication
git push origin main

# Check remote
git remote -v
```

## 🚀 Daily Development

### Morning Routine

```bash
# Pull latest changes and start working
git pull

# Make your changes...
echo "new feature" >> src/app.js
echo "updated docs" >> README.md

# One command to commit and push everything
aic
# ✅ AI generates: "feat: add new feature and update documentation"
```

### Quick Fixes

```bash
# Fix a bug
sed -i 's/bug/fixed/g' src/utils.js

# Quick commit
aic "fix: resolve utils bug"
# ✅ Commits with your message, pulls, pushes
```

### End of Day

```bash
# Commit all your work
aic
# ✅ AI analyzes all changes and creates meaningful commit
```

## 🔧 Different Project Types

### Frontend Development

```bash
# Working on React components
touch src/components/NewButton.jsx
echo "export default function NewButton() {}" > src/components/NewButton.jsx

aic
# ✅ AI generates: "feat(ui): add NewButton component"
```

### Backend API

```bash
# Add new API endpoint
echo "app.get('/api/users', handler)" >> server.js

aic
# ✅ AI generates: "feat(api): add users endpoint"
```

### Documentation Updates

```bash
# Update README
echo "## New Section" >> README.md

aic
# ✅ AI generates: "docs: add new section to README"
```

### Configuration Changes

```bash
# Update package.json
npm install express

aic
# ✅ AI generates: "chore(deps): add express dependency"
```

## 🎯 Team Workflows

### Feature Development

```bash
# Create feature branch
git checkout -b feature/user-auth

# Develop feature...
mkdir src/auth
echo "auth logic" > src/auth/login.js

# Commit progress
aic
# ✅ AI generates: "feat(auth): implement login functionality"

# Continue development...
echo "tests" > src/auth/login.test.js

aic
# ✅ AI generates: "test(auth): add login tests"

# Ready to merge
git checkout main
git merge feature/user-auth
```

### Bug Fixes

```bash
# Hotfix branch
git checkout -b hotfix/critical-bug

# Fix the issue
sed -i 's/undefined/null/g' src/critical.js

aic "fix: resolve undefined reference in critical module"
# ✅ Uses your specific message

# Deploy immediately
git checkout main
git merge hotfix/critical-bug
```

### Code Reviews

```bash
# Address review comments
echo "// Added comment as requested" >> src/app.js

aic
# ✅ AI generates: "refactor: add comments based on code review"
```

## 🔄 Conflict Resolution Examples

### Automatic Resolution

```bash
# Someone else pushed changes
aic
# ✅ Auto-pulls, detects conflicts in package-lock.json
# ✅ Auto-resolves by taking your version
# ✅ Continues with push
```

### Manual Resolution

```bash
# Complex conflict in source code
aic
# ⚠️  Conflict detected in src/app.js
# 🛠️  Opens file in your editor
# ✋ Waits for you to resolve
# ✅ Continues after you confirm resolution
```

## 🎨 Customization Examples

### Provider Switching

```bash
# Use different AI provider for this commit
aic --provider anthropic

# Or set permanently
aic config --set defaultProvider=anthropic
```

### Language Preferences

```bash
# Spanish commit messages
aic config --set language=es
aic
# ✅ AI generates: "feat: agregar nueva funcionalidad"
```

### Conventional Commits

```bash
# Enable conventional commits
aic config --set conventionalCommits=true
aic
# ✅ AI generates: "feat(api): add user authentication endpoint"
```

## 🚀 Advanced Scenarios

### Monorepo Management

```bash
# Working in packages/frontend
cd packages/frontend
echo "new component" > Button.jsx

aic
# ✅ AI generates: "feat(frontend): add Button component"

# Working in packages/backend
cd ../backend
echo "new route" > routes.js

aic
# ✅ AI generates: "feat(backend): add new routes"
```

### Release Preparation

```bash
# Update version
npm version patch

# Update changelog
echo "## v1.0.1 - Bug fixes" >> CHANGELOG.md

aic "chore: prepare v1.0.1 release"
# ✅ Uses your release message
```

### Emergency Fixes

```bash
# Critical production issue
echo "emergency fix" > hotfix.js

# Skip AI, use urgent message
aic "fix: critical production hotfix - deploy immediately"
# ✅ Fast commit with clear urgency
```

## 🛠️ Integration Examples

### CI/CD Integration

```bash
# In your CI script
if [ "$CI" != "true" ]; then
  aic --no-push  # Only commit locally in CI
fi
```

### Git Hooks

```bash
# Pre-commit hook using AIC
#!/bin/sh
if [ -n "$(git diff --cached)" ]; then
  aic --dry-run  # Validate before commit
fi
```

### IDE Integration

```bash
# VS Code task
{
  "label": "AIC Commit",
  "type": "shell",
  "command": "aic",
  "group": "build"
}
```

## 📊 Productivity Examples

### Before AIC

```bash
git add .
git status
# Think of commit message...
git commit -m "update stuff"
git pull
# Resolve conflicts manually...
git add .
git commit -m "merge"
git push
# 😫 10+ commands, 5+ minutes
```

### With AIC

```bash
aic
# 😎 1 command, 30 seconds
```

### Time Savings

- **Daily commits**: 5 minutes → 30 seconds
- **Conflict resolution**: 10 minutes → 2 minutes
- **Message quality**: Poor → AI-generated excellence
- **Workflow errors**: Common → Rare

## 🎯 Best Practices from Examples

### Do's ✅

- Use `aic` for regular development
- Use custom messages for releases: `aic "v1.0.0"`
- Use `--dry-run` when unsure
- Use `aic quick` for minor changes
- Let AI learn your patterns

### Don'ts ❌

- Don't use for sensitive commits without review
- Don't ignore conflict resolution prompts
- Don't skip `aic setup` configuration
- Don't force push after AIC (it handles pushing)

## 🔍 Debugging Examples

### Check Status

```bash
aic status
# Shows git state, AI config, pending changes
```

### Dry Run First

```bash
aic --dry-run
# See what would happen without doing it
```

### Manual Fallback

```bash
# If AIC fails, you can always fall back:
git add .
git commit -m "manual commit"
git pull
git push
```

---

**💡 Pro Tip**: Start with simple `aic` commands and gradually explore advanced options as you get comfortable!

---

**Created by [Barun Tayenjam](https://github.com/baruntayenjam)**
