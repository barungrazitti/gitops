# AI Commit Generator - Agent Guidelines

## Build/Lint/Test Commands

### Testing

- `npm test` - Run full Jest test suite (423 tests, 19 suites)
- `npx jest tests/aicommit-cli.test.js` - Run single test file
- `npm run test:coverage` - Jest with coverage report
- `npm run test:watch` - Jest in watch mode

### Setup Commands

- `aic setup` - Interactive setup wizard for AI provider configuration
- `aic config --list` - View current configuration
- `aic config --set key=value` - Set configuration value
- `aic config --reset` - Reset configuration to defaults

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
- Documentation in `docs/`
- Keep related functionality in separate modules

## Key Features Implemented

### Sequential AI Generation

- **Groq First**: Tries Groq (cloud AI) first for fast inference
- **Ollama Fallback**: Falls back to Ollama (local AI) if Groq fails
- **Default Model**: `llama-3.1-8b-instant` (Groq)
- **No Parallel Overhead**: Simpler, faster single-provider approach
- **Smart Context**: Uses semantic analysis for better commit messages
- **Diff Truncation**: Auto-truncates at 15KB to fit AI token limits (Groq's 6K TPM)

### Comprehensive Activity Logging

- **Detailed Tracking**: Logs all AI interactions, git operations, and user choices
- **Full Prompt Logging**: Captures actual prompts sent to LLM (truncated at 10KB)
- **Response Logging**: Records LLM responses (truncated at 2KB) for quality analysis
- **Performance Metrics**: Response times, success rates, and error patterns
- **Session Management**: Unique session IDs for tracking workflow sessions
- **Data Retention**: Automatic log rotation and cleanup (30-day retention)
- **Export & Analysis**: Built-in analysis tools and export capabilities (JSON/CSV)
- **Usage Patterns**: Peak hours, provider usage, commit message patterns

### Provider Support

- **Ollama**: Local AI with DeepSeek V3.1, Qwen3 Coder, Mistral models
- **Groq**: Fast cloud API with Mixtral, Llama, Gemma models
- **Chunking**: Automatic large diff handling for both providers (with plugin update exceptions)
- **Context Enrichment**: Advanced semantic analysis integration

### Intelligent Diff Management with Plugin Update Detection

- **Plugin Update Detection**: Automatically detects plugin/dependency updates and avoids chunking
- **Package Managers**: Supports package.json, composer.json, requirements.txt, yarn.lock, etc.
- **WordPress Support**: Detects WordPress plugin/theme updates in wp-content directories
- **Version Changes**: Identifies version updates and dependency modifications
- **Vendor Directories**: Recognizes changes in vendor/, node_modules/, and plugin directories
- **Smart Context**: Preserves full context for plugin updates even with large diffs
- **Visual Indicators**: Shows 🔌 plugin icon when plugin update is detected
- **Selective Processing**: Only non-plugin updates get chunked when large

### Git Merge Handling with AI

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

### Security & PII Protection (NEW)

- **20+ Detection Patterns**: Secrets (15+) and PII (8+)
- **Auto-Redaction**: All code sanitized BEFORE sending to AI
- **Enterprise Mode**: Block commits with ANY sensitive data
- **Audit Logging**: All security events logged for compliance
- **Security Report**: Detailed analysis of detected secrets/PII

### Quality Gates (NEW)

- **QUAL-01**: <5% generic messages enforced
- **QUAL-02**: >90% messages with reasoning
- **MessageValidator**: 31 tests, 365 lines
- **CommitGenerator**: 19 tests, 338 lines

### Core Modules

- `analysis-engine.js`: Advanced repository context analysis
- `cache-manager.js`: Intelligent caching with diff-based keys
- `git-manager.js`: Git operations and staging
- `message-formatter.js`: Conventional commit formatting
- `config-manager.js`: Persistent configuration management
- `stats-manager.js`: Usage tracking and analytics
- `auto-git.js`: AI-powered conflict resolution and workflow automation
- `activity-logger.js`: Comprehensive activity logging and analysis
- `secret-scanner.js`: Advanced secret and PII detection (NEW)
- `message-validator.js`: Quality validation for commit messages (NEW)
- `commit-generator.js`: Full pipeline orchestration (NEW)

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
1. **Groq-first AI generation** with Ollama fallback
2. **Simplified provider selection** - no complex merging logic
3. **Highly relevant** commit message generation
4. **Semantic analysis** for better context understanding
5. **AI-powered git conflict resolution** with intelligent merging and chunking support
6. **Enterprise-grade security** with PII protection and secret scanning
7. **Quality validation** with enforced quality gates

## Project Status

| Metric | Status |
|--------|--------|
| Test Coverage | 423 tests, 19 suites ✅ |
| Security Patterns | 23 detection patterns ✅ |
| Quality Gates | QUAL-01, QUAL-02 enforced ✅ |
| Documentation | Complete with 20+ guides ✅ |
| Console Noise | Minimal (cleaned up) ✅ |

## Documentation

All documentation is organized in the `docs/` directory:

- `docs/INDEX.md` - Documentation index
- `docs/user-guide/` - User documentation
- `docs/developer-guide/` - Developer documentation
- `docs/security/` - Security documentation
- `docs/architecture/` - Architecture documentation
- `docs/enterprise/` - Enterprise features

## Recent Changes (2026-03-27)

### Phase 4 Complete: Core Module

- ✅ MessageValidator (365 lines, 31 tests)
- ✅ CommitGenerator (338 lines, 19 tests)
- ✅ Quality gates (QUAL-01, QUAL-02)
- ✅ Context enrichment from detectors

### Security Enhancements

- ✅ Enterprise mode for strict security
- ✅ 20+ secret/PII detection patterns
- ✅ Auto-redaction before AI
- ✅ Security reports and recommendations

### Console Noise Reduction

- ✅ Removed ~50 console outputs
- ✅ Activity logging only (review with `aic stats --analyze`)
- ✅ Clean, minimal output

### Documentation Reorganization

- ✅ All non-code docs moved to `docs/`
- ✅ 20+ documentation files created
- ✅ Organized by audience (user, developer, enterprise)

---

*Last updated: 2026-03-27*
