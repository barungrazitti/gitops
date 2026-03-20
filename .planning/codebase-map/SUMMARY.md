# Codebase Summary

## Technology Stack (STACK.md)
- **Runtime**: Node.js >=18.0.0
- **Languages**: JavaScript (CommonJS)
- **Key Libraries**:
  - `simple-git`: Git command wrapper
  - `groq-sdk`: AI Provider
  - `inquirer`, `ora`, `chalk`: CLI UI interaction
- **Testing**: Jest (Unit testing)

## Architecture (ARCHITECTURE.md)
- **Pattern**: Modular Monolith with Provider/Strategy pattern for AI services.
- **Entry Point**: `src/index.js` (Class `AICommitGenerator`) orchestrated via `bin/aic.js`.
- **Core Layers**:
  - **Managers** (src/core/): `GitManager`, `ConfigManager`, `CacheManager`.
  - **Providers** (src/providers/): `AIProviderFactory` creates `GroqProvider` or `OllamaProvider`.
  - **Utilities** (src/utils/): `SecretScanner`, `InputSanitizer`.
- **Data Flow**: `Git Diff` → `SecretScanner` → `PromptBuilder` → `AI Provider` → `Formatter` → `User Selection` → `Git Commit`.

## Concerns & Bugs (CONCERNS.md)
- **CRITICAL BUG**: In `src/index.js`, the method `this.provideErrorSuggestions(error, mergedOptions)` is called in the `catch` block (line 205), but the method definition was NOT found in the file. This will cause the error handler to crash.
- **Tech Debt**: `AICommitGenerator.generate()` is a large "God Method" mixing UI, logic, and error handling.
- **Quality**: No linting configuration (.eslintrc, .prettierrc) was detected, leading to potential style drift.

## Quality & Conventions (CONVENTIONS.md)
- **Naming**: Kebab-case for files (git-manager.js), PascalCase for classes (GitManager).
- **Testing**: Tests are co-located in tests/ directory, mirroring src/ structure.
- **Security**: Explicit `SecretScanner` used to redact PII/Secrets from diffs before sending to LLMs.
