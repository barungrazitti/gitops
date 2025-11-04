# AI Commit Generator - Agent Guidelines

## Build/Lint/Test Commands

### Testing

- `npm test` - Run full Jest test suite (1-3s)
- `npx jest tests/aicommit-cli.test.js` - Run single test file
- `npm run test:coverage` - Jest with coverage report
- `npm run test:watch` - Jest in watch mode for development

### Logging & Analysis

- `aic stats` - Show basic usage statistics
- `aic stats --analyze` - Analyze recent activity logs with insights
- `aic stats --export` - Export logs to JSON/CSV for external analysis
- `aic stats --days 7` - Analyze last 7 days of activity
- `aic stats --format csv` - Export logs in CSV format
- `aic stats --reset` - Reset all statistics and logs

### Code Quality

No linting/formatting tools - removed per user request.

## Code Style Guidelines

### Imports & Structure

- Use CommonJS require() statements (not ES modules)
- Group imports: external libs first, then internal modules
- Use relative paths for internal modules: `./core/git-manager`

### Naming Conventions

- Classes: PascalCase (e.g., `GitManager`, `AICommitGenerator`)
- Methods/Variables: camelCase (e.g., `getStagedDiff`, `configManager`)
- Files: kebab-case for executables, PascalCase for classes
- Constants: UPPER_SNAKE_CASE

### Error Handling

- Always wrap async operations in try-catch blocks
- Throw descriptive Error objects with context
- Use consistent error message format: `Failed to [action]: ${error.message}`

### Code Patterns

- Use JSDoc comments for all classes and public methods
- Maintain consistent async/await pattern (no Promise chains)
- Use object destructuring for options: `const { provider, count } = options`
- Validate inputs early and fail fast

### Testing

- Write unit tests in `tests/` directory with `.test.js` extension
- Use Jest describe/test blocks with descriptive names
- Mock external dependencies in `tests/mocks/`
- Test both success and error cases
- Use beforeEach for test isolation

### File Organization

- Core logic in `src/core/`
- AI providers in `src/providers/` (only Groq + Ollama)
- Binaries in `bin/`
- Tests in `tests/`
- Keep related functionality in separate modules

## Key Features Implemented

### Sequential AI Generation

- **Ollama First**: Tries Ollama (local AI) first for better context awareness
- **Groq Fallback**: Falls back to Groq (cloud AI) if Ollama fails
- **No Parallel Overhead**: Simpler, faster single-provider approach
- **Smart Context**: Uses semantic analysis for better commit messages

### Comprehensive Activity Logging

- **Detailed Tracking**: Logs all AI interactions, git operations, and user choices
- **Session Management**: Unique session IDs for tracking workflow sessions
- **Performance Metrics**: Response times, success rates, and error patterns
- **Data Retention**: Automatic log rotation and cleanup (30-day retention)
- **Export & Analysis**: Built-in analysis tools and export capabilities (JSON/CSV)
- **Usage Patterns**: Peak hours, provider usage, commit message patterns

### Provider Support

- **Ollama**: Local AI with DeepSeek V3.1, Qwen3 Coder, Mistral models
- **Groq**: Fast cloud API with Mixtral, Llama, Gemma models
- **Chunking**: Automatic large diff handling for both providers
- **Context Enrichment**: Advanced semantic analysis integration

### Improved Git Merge Handling with AI

- **AI-Powered Resolution**: Uses Ollama/Groq to intelligently resolve merge conflicts
- **Chunking Support**: Handles large conflicts by splitting into manageable chunks
- **Multiple Resolution Strategies**: 
  - 🤖 AI-powered resolution (intelligent merge)
  - 💾 Keep current changes (theirs)
  - 📥 Use incoming changes (mine)
  - 🔧 Manual resolution guidance
  - ❌ Cancel operation
- **Smart Fallback**: If AI fails, offers traditional resolution options
- **Per-File Processing**: Resolves conflicts file by file with detailed feedback
- **Context-Aware**: Analyzes original, current, and incoming changes for intelligent merging
- **Large File Support**: Automatically chunks large conflicts for AI processing

### Core Modules

- `analysis-engine.js`: Advanced repository context analysis
- `cache-manager.js`: Intelligent caching with diff-based keys
- `git-manager.js`: Git operations and staging
- `message-formatter.js`: Conventional commit formatting
- `config-manager.js`: Persistent configuration management
- `stats-manager.js`: Usage tracking and analytics
- `auto-git.js`: AI-powered conflict resolution and workflow automation
- `activity-logger.js`: Comprehensive activity logging and analysis

## Removed Functionality

Per user request, the following has been completely removed:
- All linting code (lint-manager, auto-corrector, code-formatter)
- Test validation workflow
- Advanced formatting workflow
- Extra AI providers (OpenAI, Anthropic, Gemini, Mistral, Cohere)
- ESLint, Prettier configurations
- Stylelint dependencies
- All related CLI commands (--format-code, --test-validate, --lint, etc.)

## Current Architecture

The codebase now focuses on:
1. **Ollama-first AI generation** with Groq fallback
2. **Simplified provider selection** - no complex merging logic
3. **Highly relevant** commit message generation
4. **Semantic analysis** for better context understanding
5. **AI-powered git conflict resolution** with intelligent merging and chunking support