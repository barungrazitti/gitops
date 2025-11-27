# 🤖 AI Commit Message Generator

**Transform your git workflow with AI-powered commit messages that actually make sense!**

A powerful, context-aware AI commit message generator built in Node.js that combines the best features from successful tools like aicommits, aicommit2, and gcop. This tool analyzes git diffs, learns from repository history, and generates meaningful commit messages using multiple AI providers.

> **One command to rule them all:** `aic` - Just type and let AI handle your entire git workflow! 🚀

## 📋 About

AI Commit Message Generator is your intelligent git companion that writes perfect commit messages every time. Powered by cutting-edge AI models from OpenAI, Anthropic, Google, and more, it understands your code changes and crafts commit messages that follow best practices.

### 🎯 Why Choose This Tool?

- **🧠 Smart Context**: Analyzes your actual code changes, not just file names
- **🎨 Local AI Models**: Choose from Ollama local models or cloud providers like Groq
- **📝 Conventional Commits**: Automatically follows conventional commit standards
- **⚡ Lightning Fast**: One command does everything - stage, commit, push
- **🔧 Highly Configurable**: Customize prompts, providers, and workflows
- **🌍 Enterprise Ready**: Proxy support, team collaboration, and statistics

### 🚀 Perfect For

- **Solo Developers** who want consistent, professional commit messages
- **Teams** that need standardized commit formats across projects
- **Open Source Maintainers** handling contributions from multiple developers
- **Enterprise Teams** requiring audit trails and conventional commits
- **Anyone** who wants to spend less time writing commit messages and more time coding

## 🎉 Version 1.0.0 Release

We're excited to announce the first stable release of AI Commit Message Generator! This milestone represents months of development and testing, bringing you a production-ready tool for intelligent commit message generation.

### ✨ What's New in v1.0.0

- **🔧 Enhanced Configuration Management**: Environment-driven configuration with provider-specific model handling
- **🛡️ Improved Security**: Added AuthService with password hashing and JWT token support
- **📊 Smart Analysis Engine**: WordPress-specific pattern detection and enhanced file analysis
- **🔄 Better Error Handling**: Comprehensive error handling across all AI providers
- **🎯 Refined Message Generation**: Improved context awareness and commit message relevance
- **🧪 Extensive Testing**: Comprehensive test coverage for all core components
- **📚 Better Documentation**: Updated examples and improved setup guides

### 🚀 Key Features Delivered

- Multi-AI provider support (OpenAI, Anthropic, Gemini, Mistral, Cohere, Groq, Ollama)
- Simple one-command workflow with `aic`
- Interactive mode with message regeneration
- Git hook integration
- Conventional commits support
- Smart caching and statistics
- Team style adaptation
- Proxy support for enterprise environments

## 🚀 Simple Workflow

**Clone, install, and let AI handle your entire git workflow!**

```bash
# Clone and install
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator
npm install
npm link

# Setup (one time)
aic setup

# Use the full automation command - does everything automatically:
aic
```

**What `aic` does:**

1. 🔍 Checks repository & changes
2. 📦 Stages all changes
3. 🤖 Generates AI commit message
4. 💾 Commits changes
5. ⬇️ Pulls latest changes
6. 🔧 Auto-resolves conflicts
7. ⬆️ Pushes to remote

**Alternative: Generate commit messages only**

If you prefer to generate commit messages without the full automation:

```bash
# First stage your changes manually
git add .

# Generate AI commit message
aicommit
```

## 🚀 **Available Commands**

The tool provides two main command-line interfaces:

### `aic` - Full Git Automation

Complete git workflow automation in one command.

```bash
# Auto stage, commit, pull, resolve, push
aic

# With custom message
aic "fix: resolve login issue"

# Skip pull step
aic --skip-pull

# Don't push after commit
aic --no-push

# Dry run
aic --dry-run

# Setup AI provider
aic setup

# Configuration
aic config --list
aic config --set provider=ollama

# Statistics
aic stats
aic stats --analyze
```

## 📦 Installation

### Prerequisites

- **Node.js** (v18 or higher) - [Download Node.js](https://nodejs.org/)
- **Git** - [Download Git](https://git-scm.com/)
- Either a **Groq API key** OR **Ollama** installed locally

### Installation via GitHub Clone

```bash
# Clone the repository
git clone https://github.com/baruntayenjam/ai-commit-generator.git

# Navigate to the project directory
cd ai-commit-generator

# Install dependencies
npm install

# Link globally for command line usage
npm link

# Setup your AI provider
aic setup
```

### Platform-Specific Instructions

**macOS:**
```bash
# Clone and install
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator
npm install
npm link
```

**Windows (PowerShell):**
```powershell
# Clone and install
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator
npm install
npm link
```

**Linux:**

**Ubuntu/Debian:**
```bash
# Install Node.js if not present
sudo apt update && sudo apt install nodejs npm

# Clone and install
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator
npm install
sudo npm link
```

**CentOS/RHEL/Fedora:**
```bash
# Install Node.js if not present
sudo dnf install nodejs npm

# Clone and install
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator
npm install
sudo npm link
```

## 🛠️ Setup

Run the interactive setup wizard to configure your preferred AI provider:

```bash
# For npm installation
aic setup

# Or for clone installation
aicommit setup
```

This will guide you through:

- Selecting an AI provider (Groq or Ollama)
- Configuring API keys (except for Ollama which works locally)
- Setting commit message preferences
- Choosing language and format options

### Verify Installation

```bash
# Check installation status
aic --version

# View current configuration
aic config --list

# Show git and AI configuration
aic status
```

## 🎯 Usage

### Quick Start

```bash
# Full automation command - does everything:
aic

# With custom message:
aic "fix: resolve login issue"

# Dry run to see what would happen:
aic --dry-run
```

**For commit message generation only:**

```bash
# First stage your changes
git add .

# Generate AI commit message
aicommit

# With specific options
aicommit --provider ollama --count 5 --type feat
```

### Check Status

```bash
# Show git and AI configuration
aic status
aicommit config --list

# Show all available commands
aic --help
aicommit --help

# Show version information
aic --version
aicommit --version
```

### Interactive Mode

When you run `aicommit` without a message, it enters interactive mode, which presents you with a list of AI-generated commit messages. In this mode, you have several options:

- **Select a message:** Choose one of the generated messages to use for your commit.
- **Regenerate messages:** If you're not satisfied with the suggestions, select this option to request a new batch of messages from the AI.
- **Write custom message:** Choose this option to write your own commit message from scratch.
- **Cancel:** Exit the interactive mode without making a commit.

**📚 Documentation:**
- [AGENT.md](AGENT.md) - Development and contribution guidelines

### `aicommit` - Commit Message Generation

Generate AI commit messages for already staged changes.

```bash
# Generate commit messages (default)
aicommit

# With specific provider
aicommit --provider groq
aicommit --provider ollama

# Number of messages to generate
aicommit --count 5

# With specific options
aicommit --type feat --language es
aicommit --conventional
aicommit --dry-run

# Configuration management
aicommit config --list
aicommit config --set provider=ollama
aicommit config --get provider

# Statistics
aicommit stats
aicommit stats --reset

# Git hooks
aicommit hook --install
aicommit hook --uninstall

# Interactive setup
aicommit setup
```

## 🤖 Supported AI Providers

| Provider          | Models                         | API Key Required | Local |
| ----------------- | ------------------------------ | ---------------- | ----- |
| **Groq**          | Mixtral, Llama 2, Gemma        | ✅               | ❌    |
| **Ollama**        | Any local model                | ❌               | ✅    |

### Getting API Keys

- **Groq**: [console.groq.com](https://console.groq.com/keys)
- **Ollama**: [ollama.ai](https://ollama.ai/) (local installation)

## ⚙️ Configuration

### Configuration Commands

Both `aic` and `aicommit` use the same configuration:

```bash
# View current configuration
aicommit config --list

# Set configuration value
aicommit config --set provider=ollama

# Get specific value
aicommit config --get provider

# Reset to defaults
aicommit config --reset
```

### Configuration Options

| Option                | Description                    | Default  |
| --------------------- | ------------------------------ | -------- |
| `defaultProvider`     | AI provider to use (groq or ollama) | `groq`  |
| `apiKey`              | API key for Groq provider            | `null`   |
| `conventionalCommits` | Use conventional commit format | `true`   |
| `language`            | Commit message language        | `en`     |
| `messageCount`        | Number of messages to generate | `3`      |
| `maxTokens`           | Maximum tokens for AI response | `150`    |
| `temperature`         | AI creativity level (0-2)      | `0.7`    |
| `cache`               | Enable response caching        | `true`   |

## 📊 Statistics

View usage statistics and performance metrics:

```bash
# Show statistics
aic stats
aicommit stats

# Analyze recent activity logs
aic stats --analyze

# Export activity logs
aic stats --export --format csv

# Reset statistics
aic stats --reset
aicommit stats --reset
```

## 🔧 Advanced Usage

### Full Automation with `aic`

The `aic` command provides complete git workflow automation:

```bash
# Standard automation
aic

# With manual message
aic "feat: add user authentication"

# Skip pulling before push
aic --skip-pull

# Don't push after committing
aic --no-push

# Force run even with no changes
aic --force

# See what would happen
aic --dry-run
```

### Custom Prompts

You can customize the prompts used for different scenarios by editing the configuration:

```bash
aicommit config --set customPrompts.feat="Focus on new features and capabilities"
```

### Proxy Configuration

For enterprise environments with proxy requirements:

```bash
aicommit config --set proxy="http://proxy.company.com:8080"
```

### Exclude Files

Configure files to exclude from analysis:

```bash
aicommit config --set excludeFiles="*.log,dist/**,node_modules/**"
```



### Development

```bash
# Clone and develop locally
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator
npm install
npm run dev
```

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run tests with verbose output
npm run test:verbose
```

## 🤝 Contributing

We welcome contributions! Please see [AGENT.md](AGENT.md) for development guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Created by [Barun Tayenjam](https://github.com/baruntayenjam)**

## 🙏 Acknowledgments

Inspired by:

- [aicommits](https://github.com/Nutlope/aicommits) by Nutlope
- [aicommit2](https://github.com/tak-bro/aicommit2) by tak-bro
- [gcop](https://github.com/yegor256/gcop) by yegor256

## 📋 Changelog

### v1.0.0 (2025-01-27) - Initial Stable Release

#### 🎯 Core Features

- **Dual AI Provider Support**: Integration with Groq (cloud) and Ollama (local) for flexible AI generation
- **Full Git Automation**: `aic` command handles complete workflow (stage, commit, pull, resolve, push)
- **Commit Message Generation**: `aicommit` command analyzes staged changes to generate meaningful commit messages
- **Interactive Mode**: Message selection, regeneration, and custom message options
- **Git Hook Integration**: Seamless `prepare-commit-msg` hook integration

#### 🔧 Enhancements

- **Configuration Management**: Environment-driven configuration with provider-specific model handling
- **Analysis Engine**: Enhanced file analysis with WordPress-specific pattern detection
- **Message Formatting**: Improved context awareness and commit message relevance
- **Security Layer**: AuthService with password hashing and JWT token support

#### 🛠️ Technical Improvements

- **Error Handling**: Comprehensive error handling across all AI providers
- **Caching System**: Smart caching to reduce API calls and improve performance
- **Statistics**: Usage tracking and AI provider performance metrics
- **Testing**: Extensive test coverage for all core components
- **🧠 Semantic Analysis Engine**: Deep code understanding for precise commit messages
- **🤖 Enhanced Conflict Resolution**: File-type-aware conflict resolution strategies
- **⚡ Performance Optimizations**: Intelligent diff processing with 250-line limit
- **🔧 Multi-framework Support**: WordPress, React, TypeScript, Python patterns

#### 📚 Documentation

- **Updated README**: Comprehensive installation, setup, and usage guides
- **Examples**: Detailed examples for different use cases
- **Agent Guidelines**: Development and contribution guidelines

#### 🐛 Bug Fixes

- **API Key Management**: Fixed API key overwrite issues during setup
- **Provider Configuration**: Resolved undefined endpoints error in AI providers
- **Model Validation**: Enhanced provider-specific model validation

---

Made with ❤️ by [Barun Tayenjam](https://github.com/baruntayenjam)
test change
Final test
# test change
# aic test
## Testing aic command functionality
