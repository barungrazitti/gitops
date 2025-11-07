# 🔄 Clone Installation Guide

**Install AI Commit Generator by cloning the repository - perfect for development, testing, or offline use**

---

## 🎯 Why Clone Installation?

### Choose Clone Installation When:
- 🛠️ **Development**: Want to modify or contribute to the code
- 🧪 **Testing**: Need to test specific versions or branches
- 📦 **Offline**: Need to work without internet access
- 🔒 **Security**: Corporate policy prevents npm registry access
- 🎛️ **Control**: Want exact version control and reproducibility

### vs npm Installation:
| Feature | npm Install | Clone Install |
|---------|-------------|---------------|
| **Simplicity** | ✅ One command | ⚠️ Multiple steps |
| **Updates** | ✅ `npm update` | ⚠️ `git pull` |
| **Development** | ❌ No source code | ✅ Full source |
| **Offline Use** | ❌ Requires internet | ✅ Works offline |
| **Customization** | ❌ Cannot modify | ✅ Can edit code |

---

## 🚀 Quick Clone Installation

### Method 1: Global Link (Recommended)
```bash
# Clone the repository
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator

# Install dependencies
npm install

# Link globally (makes commands available everywhere)
npm link

# Setup and use
aic setup
aic --version
```

### Method 2: Local Use Only
```bash
# Clone the repository
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator

# Install dependencies
npm install

# Run directly
node bin/aic setup
node bin/aic --version

# Or use npx
npx aic setup
npx aic --version
```

---

## 🖥️ Platform-Specific Instructions

### 🍎 macOS

#### Prerequisites
```bash
# Install Xcode Command Line Tools (if not installed)
xcode-select --install

# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node
```

#### Clone Installation
```bash
# Clone and install
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator
npm install
npm link

# Verify
aic --version
```

#### Development Setup
```bash
# For development with auto-reload
npm run dev

# Run tests
npm test

# Build for production
npm run build:prod
```

### 🪟 Windows

#### Prerequisites
```powershell
# Install Git for Windows
# Download from: https://git-scm.com/download/win

# Install Node.js
# Download from: https://nodejs.org or use Chocolatey:
choco install nodejs git

# Open PowerShell as Administrator
```

#### Clone Installation (PowerShell)
```powershell
# Clone and install
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator
npm install
npm link

# Verify
aic --version
```

#### Development Setup
```powershell
# For development
npm run dev

# Run tests
npm test

# Build for production
npm run build:prod
```

### 🐧 Linux

#### Ubuntu/Debian
```bash
# Install prerequisites
sudo apt update
sudo apt install git nodejs npm build-essential

# Clone and install
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator
npm install
sudo npm link

# Verify
aic --version
```

#### CentOS/RHEL/Fedora
```bash
# Install prerequisites
sudo dnf install git nodejs npm

# Clone and install
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator
npm install
sudo npm link

# Verify
aic --version
```

#### Using NVM (Recommended for Linux)
```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Install Node.js
nvm install 18
nvm use 18

# Clone and install
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator
npm install
npm link

# Verify
aic --version
```

---

## 🔧 Advanced Clone Installation

### Install Specific Branch
```bash
# Clone specific branch
git clone -b develop https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator
npm install
npm link
```

### Install Specific Tag/Version
```bash
# Clone specific version
git clone --branch v1.0.0 https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator
npm install
npm link
```

### Install from Fork
```bash
# Clone your fork
git clone https://github.com/your-username/ai-commit-generator.git
cd ai-commit-generator
npm install
npm link

# Add upstream for updates
git remote add upstream https://github.com/baruntayenjam/ai-commit-generator.git
```

### Development Workflow
```bash
# Clone your fork
git clone https://github.com/your-username/ai-commit-generator.git
cd ai-commit-generator

# Install dependencies
npm install

# Create feature branch
git checkout -b feature/new-feature

# Link for development
npm link

# Make changes and test
npm run dev
npm test

# Commit changes
git add .
git commit -m "feat: add new feature"

# Push to fork
git push origin feature/new-feature
```

---

## 🔄 Updating Clone Installation

### Update to Latest Version
```bash
# Navigate to repository
cd ai-commit-generator

# Pull latest changes
git pull origin main

# Update dependencies
npm update

# Re-link if needed
npm link
```

### Update Specific Branch
```bash
# Switch to branch
git checkout develop

# Pull latest changes
git pull origin develop

# Update dependencies
npm update

# Re-link
npm link
```

### Update from Upstream (Forks)
```bash
# Add upstream if not already added
git remote add upstream https://github.com/baruntayenjam/ai-commit-generator.git

# Fetch upstream changes
git fetch upstream

# Switch to main branch
git checkout main

# Merge upstream changes
git merge upstream/main

# Update dependencies
npm update

# Re-link
npm link
```

---

## 🛠️ Development & Customization

### Project Structure
```
ai-commit-generator/
├── bin/                    # Executable scripts
│   ├── aic.js             # Main CLI command
│   └── aicommit.js        # Alternative CLI
├── src/                   # Source code
│   ├── core/              # Core functionality
│   ├── providers/         # AI providers
│   ├── utils/             # Utilities
│   └── index.js           # Main entry point
├── tests/                 # Test files
├── scripts/               # Build scripts
├── docs/                  # Documentation
└── package.json           # Project configuration
```

### Making Changes
```bash
# Navigate to repository
cd ai-commit-generator

# Make your changes
# Edit files in src/ directory

# Test your changes
npm test
npm run dev

# Link to test globally
npm link

# Test your changes
aic --version
aic setup
```

### Adding New Features
```bash
# Create feature branch
git checkout -b feature/new-ai-provider

# Implement your feature
# Edit src/providers/new-provider.js

# Add tests
# Create tests/providers/new-provider.test.js

# Run tests
npm test

# Commit changes
git add .
git commit -m "feat: add new AI provider"

# Push to fork/origin
git push origin feature/new-ai-provider
```

### Building for Production
```bash
# Run production build
npm run build:prod

# This will:
# - Run linting and tests
# - Validate package.json
# - Create build information
# - Prepare for deployment
```

---

## 🔒 Security & Permissions

### Fixing Permission Issues

#### macOS/Linux
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Or use NVM (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
```

#### Windows
```powershell
# Run PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Install with admin privileges
npm link
```

### Corporate Proxy Setup
```bash
# Configure git for corporate proxy
git config --global http.proxy http://proxy.company.com:8080
git config --global https.proxy https://proxy.company.com:8080

# Configure npm proxy
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy https://proxy.company.com:8080

# Clone repository
git clone https://github.com/baruntayenjam/ai-commit-generator.git
```

---

## 📦 Distribution & Deployment

### Create Distribution Package
```bash
# Create tarball
npm pack

# This creates: ai-commit-generator-1.0.0.tgz
# Can be installed with: npm install ai-commit-generator-1.0.0.tgz
```

### Install from Local Package
```bash
# Install from local tarball
npm install ./ai-commit-generator-1.0.0.tgz

# Or install directly from directory
npm install ./ai-commit-generator
```

### Team Distribution
```bash
# Create shared installation script
cat > install-team.sh << 'EOF'
#!/bin/bash
echo "Installing AI Commit Generator for team..."

# Clone from internal mirror
git clone https://git.company.com/ai-commit-generator.git
cd ai-commit-generator
npm install
npm link

echo "Installation complete!"
aic --version
EOF

chmod +x install-team.sh
```

---

## 🆘 Troubleshooting Clone Installation

### Common Issues

#### Git Clone Fails
```bash
# If GitHub is blocked, try alternative mirrors
git clone https://gitlab.com/baruntayenjam/ai-commit-generator.git

# Or use SSH (if configured)
git clone git@github.com:baruntayenjam/ai-commit-generator.git
```

#### npm Install Fails
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Try again
npm install
```

#### npm Link Fails
```bash
# Check npm global prefix
npm config get prefix

# Add to PATH if needed
export PATH="$PATH:$(npm config get prefix)/bin"

# Try linking again
npm link
```

#### Permission Denied
```bash
# macOS/Linux: Use sudo with npm link
sudo npm link

# Or fix npm permissions
sudo chown -R $(whoami) ~/.npm
```

#### Command Not Found
```bash
# Check if linked properly
which aic

# If not found, try full path
$(npm config get prefix)/bin/aic --version

# Or use npx
npx aic --version
```

### Verification Steps
```bash
# Check installation
aic --version

# Check configuration
aic config --list

# Test AI connection
aic test

# Run help
aic --help
```

---

## 🎉 Success!

You now have AI Commit Generator installed from source! 

### Next Steps:
1. **Configure AI provider**: `aic setup`
2. **Test functionality**: `aic test`
3. **Start using**: `aic` in any git repository
4. **Contribute**: Make changes and submit pull requests

### Benefits of Clone Installation:
- ✅ **Full source code access**
- ✅ **Can modify and customize**
- ✅ **Works offline after initial clone**
- ✅ **Exact version control**
- ✅ **Development and testing capabilities**

**Happy coding with AI-powered commits! 🚀**