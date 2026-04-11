# Changelog

All notable changes to the AI Commit Generator will be documented in this file.

## [1.4.0] - 2026-04-11

### Added

#### Phase 1: Stability & Error Recovery

- Implemented `provideErrorSuggestions()` method with AI-powered troubleshooting
- Added `isAIAvailable()` and `getAISuggestion()` for intelligent error handling
- Added local fallback suggestions when AI is unavailable
- Comprehensive error handling test suite (13 tests)
- Fixed critical crash from missing `provideErrorSuggestions` method

#### Phase 2: Quality & Standards

- ESLint configuration with Airbnb base style guide
- Prettier configuration (single quotes, trailing commas, 2-space indent)
- Fixed 640 ESLint errors to achieve 0 errors
- Found and fixed 2 undefined variable bugs during linting (activity-logger.js, config-manager.js)
- Removed 46 unused variables and imports across codebase
- Refactored 47 for-of loops to forEach for Airbnb compliance

#### Phase 3: Improve Commit Message Relevance

- Tiktoken-based accurate token counting (replacing character/4 approximation)
- Hybrid diff categorization with 3 metrics (tokens, files, entities) and configurable thresholds
- Entity extraction from diffs (functions, classes, variables) via regex
- Size-specific prompt strategies with Handlebars templates
- Entity-centric prompts for small diffs with context limiting (3 lines max)
- Hierarchical summarization for large diffs using parse-diff
- Automated quality metrics scoring (specificity, conventional format, length)
- CLI `--quiet` / `-q` flag to suppress quality scores

### Changed

- Refactored monolithic modules into clean architecture
- All code now passes Airbnb ESLint + Prettier validation

### Security

- 23 secret/PII detection patterns enforced
- Enterprise mode for strict security compliance

## [1.0.0] - 2025-06-30

### Added

- Initial release of AI Commit Generator
- Groq-first AI generation with Ollama fallback
- Full git workflow automation (stage, commit, pull, push)
- AI-powered git merge conflict resolution
- Secret scanning and PII detection
- Comprehensive activity logging and analysis
- Plugin update detection for smart diff handling

---

_Format based on [Keep a Changelog](https://keepachangelog.com/)_
