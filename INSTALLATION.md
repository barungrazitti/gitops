# 📦 Installation Guide

**Complete guide for installing AI Commit Generator by cloning the repository on macOS, Windows, and Linux**

---

## 🚀 Quick Start (3 Commands)

```bash
# 1. Install Node.js (if not already installed)
# Visit: https://nodejs.org and download LTS version

# 2. Clone and install the tool
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator
npm install
npm link

# 3. Setup your AI provider
aic setup
```

That's it! You're ready to use `aic` anywhere.

---

## 📋 Prerequisites

### Required Software
- **Node.js** (v16 or higher) - [Download Node.js](https://nodejs.org)
- **Git** - [Download Git](https://git-scm.com)
- **AI Provider API Key** (Groq, OpenAI, etc.)

### Verify Installation
```bash
# Check Node.js version
node --version

# Check npm version  
npm --version

# Check Git version
git --version
```

---

## 🖥️ Platform-Specific Installation

### 🍎 macOS Installation

#### Method 1: Clone with Global Link (Recommended)
```bash
# Clone the repository
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator

# Install dependencies
npm install

# Link globally to make commands available everywhere
npm link

# Setup your AI provider
aic setup

# Verify installation
aic --version
```

#### Method 2: Clone for Local Use Only
```bash
# Clone the repository
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator

# Install dependencies
npm install

# Run directly without global installation
node bin/aic setup
node bin/aic --version

# Or use npx to run commands
npx aic setup
npx aic --version
```

### 🪟 Windows Installation

#### Method 1: Clone with Global Link (Recommended)
```powershell
# Clone repository
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator

# Install dependencies
npm install

# Link globally to make commands available everywhere
npm link

# Setup your AI provider
aic setup

# Verify installation
aic --version
```

#### Method 2: Clone for Local Use Only
```powershell
# Clone repository
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator

# Install dependencies
npm install

# Run directly without global installation
node bin/aic setup
node bin/aic --version

# Or use npx to run commands
npx aic setup
npx aic --version
```

#### Method 2: Using Chocolatey
```powershell
# Install Node.js if not present
choco install nodejs

# Install the tool
npm install -g ai-commit-generator

# Setup
aic setup
```

#### Method 3: Clone Repository (Development/Local)
```powershell
# Clone the repository
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator

# Install dependencies
npm install

# Link globally to make commands available
npm link

# Setup your AI provider
aic setup

# Verify installation
aic --version
```

#### Method 4: Clone Repository (Local Use Only)
```powershell
# Clone the repository
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator

# Install dependencies
npm install

# Run directly without global installation
node bin/aic setup
node bin/aic --version

# Or use npx to run commands
npx aic setup
npx aic --version
```

#### Windows-Specific Notes
- Use **PowerShell** or **Git Bash** (Command Prompt may have issues)
- If you get permission errors, run PowerShell as **Administrator**
- Windows Defender might flag the tool - allow it through

### 🐧 Linux Installation

#### Ubuntu/Debian
```bash
# Update package list
sudo apt update

# Install Node.js and npm
sudo apt install nodejs npm

# Clone and install the tool
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator
npm install
sudo npm link

# Setup
aic setup
```

#### CentOS/RHEL/Fedora
```bash
# Install Node.js
sudo dnf install nodejs npm  # Fedora
# or
sudo yum install nodejs npm  # CentOS/RHEL

# Clone and install the tool
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator
npm install
sudo npm link

# Setup
aic setup
```

#### Arch Linux
```bash
# Install Node.js
sudo pacman -S nodejs npm

# Clone and install the tool
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator
npm install
sudo npm link

# Setup
aic setup
```

#### Linux-Specific Notes
- Use `sudo` for global npm linking
- If you encounter permission issues, consider using [nvm](https://github.com/nvm-sh/nvm)
- Some systems may require adding npm global path to PATH

#### Method 3: Clone Repository (Development/Local)
```bash
# Clone the repository
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator

# Install dependencies
npm install

# Link globally to make commands available
sudo npm link

# Setup your AI provider
aic setup

# Verify installation
aic --version
```

#### Method 4: Clone Repository (Local Use Only)
```bash
# Clone the repository
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator

# Install dependencies
npm install

# Run directly without global installation
node bin/aic setup
node bin/aic --version

# Or use npx to run commands
npx aic setup
npx aic --version
```

---

## ⚙️ Configuration Setup

### Interactive Setup (Recommended)
```bash
aic setup
```

This will guide you through:
1. **AI Provider Selection** (Groq, OpenAI, Ollama, etc.)
2. **API Key Configuration**
3. **Commit Message Preferences**
4. **Language and Format Options**

### Manual Configuration

#### Set API Key
```bash
# For Groq (recommended - fast and affordable)
aic config --set provider=groq
aic config --set apiKey=your_groq_api_key_here

# For OpenAI
aic config --set provider=openai
aic config --set apiKey=your_openai_api_key_here

# For Ollama (local AI - no API key needed)
aic config --set provider=ollama
```

#### Get API Keys
- **Groq**: [console.groq.com/keys](https://console.groq.com/keys) - Fast & affordable
- **OpenAI**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Anthropic**: [console.anthropic.com](https://console.anthropic.com/)
- **Ollama**: [ollama.ai](https://ollama.ai/) - Local AI, no API key needed

#### Verify Configuration
```bash
# Check current configuration
aic config --list

# Test AI connection
aic test
```

---

## 🚀 Deployment Options

### Option 1: Individual Developer Setup

#### For Personal Use
```bash
# Install on your machine
npm install -g ai-commit-generator

# Setup once
aic setup

# Use in any git repository
cd your-project
aic
```

### Option 2: Team Deployment

#### Shared Configuration Script
Create a team setup script `setup-team.sh`:

```bash
#!/bin/bash
echo "🚀 Setting up AI Commit Generator for team..."

# Install globally
npm install -g ai-commit-generator

# Set team-standard configuration
aic config --set provider=groq
aic config --set conventionalCommits=true
aic config --set language=en
aic config --set messageCount=3

echo "✅ Setup complete! Each team member should:"
echo "1. Get their Groq API key from console.groq.com"
echo "2. Run: aic config --set apiKey=their_api_key_here"
echo "3. Test with: aic test"
```

#### Docker Deployment (Optional)
```dockerfile
FROM node:18-alpine

# Install the tool
RUN npm install -g ai-commit-generator

# Create app directory
WORKDIR /app

# Copy setup script
COPY setup.sh /usr/local/bin/setup.sh
RUN chmod +x /usr/local/bin/setup.sh

# Set entrypoint
ENTRYPOINT ["aic"]
```

### Option 3: Enterprise Deployment

#### CI/CD Integration
Add to your pipeline:

**GitHub Actions Example:**
```yaml
- name: Setup AI Commit Generator
  run: |
    npm install -g ai-commit-generator
    aic config --set provider=${{ secrets.AI_PROVIDER }}
    aic config --set apiKey=${{ secrets.AI_API_KEY }}

- name: AI Commit
  run: aic "ci: automated commit"
```

**Jenkins Pipeline Example:**
```groovy
stage('AI Commit') {
    steps {
        sh 'npm install -g ai-commit-generator'
        sh 'aic config --set provider=groq'
        sh 'aic config --set apiKey=${AI_API_KEY}'
        sh 'aic "ci: automated commit"'
    }
}
```

---

## 🔧 Environment Configuration

### Environment Variables
Create `.env` file in your project root:

```bash
# AI Provider Configuration
AI_PROVIDER=groq
AI_API_KEY=your_api_key_here

# Optional Configuration
AI_CONVENTIONAL_COMMITS=true
AI_LANGUAGE=en
AI_MESSAGE_COUNT=3
AI_CACHE=true
```

### Git Integration
```bash
# Install git hook for automatic commit messages
aic hook --install

# This will create .git/hooks/prepare-commit-msg
# Now git commit will automatically suggest AI messages
```

---

## 🛠️ Troubleshooting

### Common Issues & Solutions

#### Permission Denied (macOS/Linux)
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Or use nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
npm install -g ai-commit-generator
```

#### Command Not Found (Windows)
```powershell
# Add npm global path to PATH
echo $env:PATH

# If npm global path missing, add it:
[Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";C:\Users\$env:USERNAME\AppData\Roaming\npm", "User")
```

#### API Key Issues
```bash
# Verify API key is set
aic config --get apiKey

# Test connection
aic test

# Reset and reconfigure
aic config --reset
aic setup
```

#### Git Issues
```bash
# Check if you're in a git repository
git status

# Initialize git if needed
git init

# Check remote configuration
git remote -v
```

#### Network/Proxy Issues
```bash
# Set proxy if behind corporate firewall
aic config --set proxy=http://proxy.company.com:8080

# Or use environment variables
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080
```

### Platform-Specific Debugging

#### macOS
```bash
# Check installation location
which aic
ls -la $(which aic)

# Check Node.js installation
brew list node
node --version
```

#### Windows
```powershell
# Check installation location
Get-Command aic

# Check npm global modules
npm list -g --depth=0

# Reset PATH if needed
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine")
```

#### Linux
```bash
# Check installation
which aic
ls -la $(which aic)

# Check npm global path
npm config get prefix
echo $PATH
```

---

## 📱 Verification & Testing

### Basic Functionality Test
```bash
# 1. Create a test repository
mkdir test-aic && cd test-aic
git init

# 2. Create a test file
echo "console.log('Hello AI Commit!');" > test.js

# 3. Add and commit with AI
aic

# 4. Verify commit was created
git log --oneline -1
```

### Advanced Testing
```bash
# Test configuration
aic config --list

# Test AI connection
aic test

# Test statistics
aic stats

# Test help
aic --help
```

---

## 🔄 Updates & Maintenance

### Update the Tool
```bash
# Update to latest version
npm update -g ai-commit-generator

# Or reinstall for fresh installation
npm uninstall -g ai-commit-generator
npm install -g ai-commit-generator
```

### Backup Configuration
```bash
# Export current configuration
aic config --list > aic-config-backup.txt

# Restore configuration (manual)
aic config --set provider=groq
aic config --set apiKey=your_key_here
# ... restore other settings
```

### Clean Installation
```bash
# Complete uninstall
npm uninstall -g ai-commit-generator

# Remove configuration files
rm -rf ~/.config/ai-commit-generator

# Fresh install
npm install -g ai-commit-generator
aic setup
```

---

## 📞 Support & Resources

### Getting Help
```bash
# Built-in help
aic --help

# Check status
aic status

# View logs for debugging
aic logs
```

### Useful Resources
- **GitHub Repository**: [github.com/baruntayenjam/ai-commit-generator](https://github.com/baruntayenjam/ai-commit-generator)
- **API Keys**: Get keys from your AI provider's console
- **Documentation**: Check EXAMPLES.md for detailed usage examples

### Community
- **Issues**: Report bugs on GitHub Issues
- **Features**: Request features on GitHub Discussions
- **Contributing**: See CONTRIBUTING.md for development setup

---

## ✅ Installation Checklist

### Pre-Installation
- [ ] Node.js v16+ installed
- [ ] Git installed and configured
- [ ] AI provider account created
- [ ] API key obtained

### Installation
- [ ] Tool installed globally (`npm install -g ai-commit-generator`)
- [ ] Command available in terminal (`aic --version`)
- [ ] Configuration completed (`aic setup`)
- [ ] API key configured
- [ ] Connection tested (`aic test`)

### Post-Installation
- [ ] Basic functionality tested
- [ ] Git hook installed (optional)
- [ ] Team deployment script created (if needed)
- [ ] CI/CD integration configured (if needed)

---

## 🎉 You're Ready!

Once you've completed the installation and setup, you can use AI Commit Generator anywhere:

```bash
# In any git repository
cd your-project
aic

# That's it! AI will handle staging, committing, and pushing
```

**Happy coding with AI-powered commits! 🚀**