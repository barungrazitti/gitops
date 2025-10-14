# AI Commit Message Generator

A powerful, context-aware AI commit message generator built in Node.js that combines the best features from successful tools like aicommits, aicommit2, and gcop. This tool analyzes git diffs, learns from repository history, and generates meaningful commit messages using multiple AI providers.

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

## 🚀 **NEW: Super Simple Workflow**

**Just type `aic` and let AI handle your entire git workflow!**

```bash
# Install
npm install -g ai-commit-generator

# Setup (one time)
aic setup

# Use anywhere - does everything automatically:
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

**[👉 See Simple Workflow Guide](SIMPLE_WORKFLOW.md)**

## 🚀 Features

### ✨ Core Features

- **Multi-AI Provider Support**: OpenAI, Anthropic Claude, Google Gemini, Mistral, Cohere, Groq, Ollama
- **Context-Aware Generation**: Analyzes staged changes via `git diff`
- **Repository Learning**: Learns from commit history to match team style
- **Conventional Commits**: Full support for conventional commit format
- **Interactive Selection**: Multiple message suggestions with user selection
- **Git Hook Integration**: Seamless integration with `prepare-commit-msg` hook
- **Smart Caching**: Cache similar diffs to reduce API calls
- **Multi-language Support**: Localization for commit messages

### 🔧 Advanced Features

- **Team Style Adaptation**: Automatically adapt to project-specific commit patterns
- **File-specific Analysis**: Analyze changes per file for better context
- **Statistics & Analytics**: Track usage and AI provider performance
- **Proxy Support**: HTTP/HTTPS proxy configuration for enterprise environments

## 📦 Installation

### Global Installation (Recommended)

```bash
npm install -g ai-commit-generator
```

### Local Installation

```bash
npm install ai-commit-generator
npx aicommit setup
```

## 🛠️ Setup

Run the interactive setup wizard to configure your preferred AI provider:

```bash
aicommit setup
```

This will guide you through:

- Selecting an AI provider
- Configuring API keys
- Setting commit message preferences
- Choosing language and format options

## 🎯 Usage

### Installation

```bash
npm install -g ai-commit-generator
```

### Setup (One Time)

```bash
aic setup
```

### Basic Usage

```bash
# One command does everything:
aic

# With custom message:
aic "fix: resolve login issue"

# Quick commits:
aic quick feat
```

**What `aic` does:**

1. 🔍 Checks repository & changes
2. 📦 Stages all changes
3. 🤖 Generates AI commit message
4. 💾 Commits changes
5. ⬇️ Pulls latest changes
6. 🔧 Auto-resolves conflicts
7. ⬆️ Pushes to remote

### Check Status

```bash
aic status    # Show git and AI configuration
aic --help    # Show all commands
```

### Interactive Mode

When you run `aicommit` without a message, it enters interactive mode, which presents you with a list of AI-generated commit messages. In this mode, you have several options:

- **Select a message:** Choose one of the generated messages to use for your commit.
- **Regenerate messages:** If you're not satisfied with the suggestions, select this option to request a new batch of messages from the AI.
- **Write custom message:** Choose this option to write your own commit message from scratch.
- **Cancel:** Exit the interactive mode without making a commit.

**📖 For detailed installation, setup, and usage examples, see [EXAMPLES.md](EXAMPLES.md)**

### Command Options

```bash
# Generate with specific provider
aicommit --provider openai

# Generate specific number of messages
aicommit --count 5

# Use conventional commit format
aicommit --conventional

# Dry run (see messages without committing)
aicommit --dry-run

# Specify commit type
aicommit --type feat

# Use different language
aicommit --language es
```

### Git Hook Integration

Install the git hook to automatically generate commit messages:

```bash
# Install hook
aicommit hook --install

# Uninstall hook
aicommit hook --uninstall
```

## 🤖 Supported AI Providers

| Provider          | Models                         | API Key Required | Local |
| ----------------- | ------------------------------ | ---------------- | ----- |
| **OpenAI**        | GPT-3.5, GPT-4                 | ✅               | ❌    |
| **Anthropic**     | Claude 3 (Haiku, Sonnet, Opus) | ✅               | ❌    |
| **Google Gemini** | Gemini Pro                     | ✅               | ❌    |
| **Mistral**       | Tiny, Small, Medium, Large     | ✅               | ❌    |
| **Cohere**        | Command, Command Light         | ✅               | ❌    |
| **Groq**          | Mixtral, Llama 2, Gemma        | ✅               | ❌    |
| **Ollama**        | Any local model                | ❌               | ✅    |

### Getting API Keys

- **OpenAI**: [platform.openai.com](https://platform.openai.com/api-keys)
- **Anthropic**: [console.anthropic.com](https://console.anthropic.com/)
- **Google Gemini**: [makersuite.google.com](https://makersuite.google.com/app/apikey)
- **Mistral**: [console.mistral.ai](https://console.mistral.ai/)
- **Cohere**: [dashboard.cohere.ai](https://dashboard.cohere.ai/api-keys)
- **Groq**: [console.groq.com](https://console.groq.com/keys)
- **Ollama**: [ollama.ai](https://ollama.ai/) (local installation)

## ⚙️ Configuration

### Configuration Commands

```bash
# View current configuration
aicommit config --list

# Set configuration value
aicommit config --set provider=anthropic

# Get specific value
aicommit config --get provider

# Reset to defaults
aicommit config --reset
```

### Configuration Options

| Option                | Description                    | Default  |
| --------------------- | ------------------------------ | -------- |
| `defaultProvider`     | AI provider to use             | `openai` |
| `apiKey`              | API key for the provider       | `null`   |
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
aicommit stats

# Reset statistics
aicommit stats --reset
```

## 🔧 Advanced Usage

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

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-username/ai-commit-generator.git
cd ai-commit-generator

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Created by [Barun Tayenjam](https://github.com/baruntayenjam) with the help of [RovoDev](https://rovodev.com)**

## 🙏 Acknowledgments

Inspired by:

- [aicommits](https://github.com/Nutlope/aicommits) by Nutlope
- [aicommit2](https://github.com/tak-bro/aicommit2) by tak-bro
- [gcop](https://github.com/yegor256/gcop) by yegor256

## 📞 Support

- 📧 Email: support@ai-commit-generator.com
- 🐛 Issues: [GitHub Issues](https://github.com/your-username/ai-commit-generator/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/your-username/ai-commit-generator/discussions)

## 📋 Changelog

### v1.0.0 (2025-10-14) - Initial Stable Release

#### 🎯 Major Features

- **Multi-AI Provider Support**: Full integration with OpenAI, Anthropic, Gemini, Mistral, Cohere, Groq, and Ollama
- **Simple Workflow**: One-command `aic` that handles entire git workflow automatically
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

#### 📚 Documentation

- **Updated README**: Comprehensive installation, setup, and usage guides
- **Examples**: Detailed examples for different use cases
- **Agent Guidelines**: Development and contribution guidelines

#### 🐛 Bug Fixes

- **API Key Management**: Fixed API key overwrite issues during setup
- **Provider Configuration**: Resolved undefined endpoints error in AI providers
- **Model Validation**: Enhanced provider-specific model validation

---

Made with ❤️ by [Barun Tayenjam](https://github.com/baruntayenjam) with the help of [RovoDev](https://rovodev.com)
