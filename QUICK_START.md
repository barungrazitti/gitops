# 📋 Quick Setup Guide

**Get AI Commit Generator running in 3 minutes on any platform**

---

## 🚀 Super Quick Setup

### 1. Install Node.js (if needed)
- **Download**: https://nodejs.org (LTS version)
- **Or use package manager**:
  - macOS: `brew install node`
  - Windows: `choco install node`
  - Linux: `sudo apt install nodejs npm`

### 2. Install AI Commit Generator

**Clone and Install (Only Method)**
```bash
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator
npm install
npm link  # Makes commands available globally
```

### 3. Setup & Configure
```bash
# Interactive setup (easiest)
aic setup

# Or manual setup
aic config --set provider=groq
aic config --set apiKey=your_groq_api_key_here
```

### 4. Start Using
```bash
# In any git repository
aic
```

---

## 🎯 One-Command Team Setup

### For Teams (macOS/Linux)
```bash
curl -sSL https://raw.githubusercontent.com/baruntayenjam/ai-commit-generator/main/setup-team.sh | bash
```

### For Teams (Windows)
```powershell
# Download and run setup-team.bat
# Or run these commands:
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator
npm install
npm link
aic config --set provider=groq
aic config --set conventionalCommits=true
```

---

## 🔑 Get API Key

### Groq (Recommended - Fast & Affordable)
1. Go to [console.groq.com/keys](https://console.groq.com/keys)
2. Sign up/login
3. Create new API key
4. Copy key

### Alternative Providers
- **OpenAI**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Anthropic**: [console.anthropic.com](https://console.anthropic.com/)
- **Ollama**: Local AI, no API key needed ([ollama.ai](https://ollama.ai/))

---

## ✅ Verification

```bash
# Check installation
aic --version

# Test AI connection
aic test

# Check configuration
aic config --list
```

---

## 🆘 Troubleshooting

### Command Not Found
```bash
# Restart terminal or add npm to PATH
export PATH="$PATH:$(npm config get prefix)/bin"
```

### Permission Issues
```bash
# macOS/Linux
sudo chown -R $(whoami) ~/.npm
sudo npm install -g ai-commit-generator

# Windows (Run as Administrator)
npm install -g ai-commit-generator
```

### API Key Issues
```bash
# Reset and reconfigure
aic config --reset
aic setup
```

---

## 📚 Need More Help?

- **Full Installation Guide**: [INSTALLATION.md](INSTALLATION.md)
- **Enterprise Deployment**: [DEPLOYMENT.md]
- **Usage Examples**: [EXAMPLES.md](EXAMPLES.md)
- **Report Issues**: [GitHub Issues](https://github.com/baruntayenjam/ai-commit-generator/issues)

---

## 🎉 You're Ready!

Once setup is complete, just run `aic` in any git repository and AI will handle the rest!

**Happy coding with AI-powered commits! 🚀**