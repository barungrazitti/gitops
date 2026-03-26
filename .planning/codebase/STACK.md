# Technology Stack

**Analysis Date:** 2026-03-26

## Languages

**Primary:**
- JavaScript (Node.js) - Core application logic, CLI tooling, and all modules

**Secondary:**
- None detected

## Runtime

**Environment:**
- Node.js >=18.0.0 - Required runtime engine
- npm >=8.0.0 - Package manager

**Package Manager:**
- npm - Primary package manager
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Commander 11.1.0 - CLI framework for command parsing and program structure
- Inquirer 8.2.6 - Interactive command-line prompts for user input

**Testing:**
- Jest 29.7.0 - Test runner and assertion framework
  - Config: `jest.config.js`
  - Coverage: Built-in with text, lcov, and html reporters

**Build/Dev:**
- None detected - Pure JavaScript, no build step required

## Key Dependencies

**Critical:**
- groq-sdk 0.33.0 - Groq AI provider SDK for cloud-based inference
- axios 1.7.9 - HTTP client for Ollama API communication
- simple-git 3.20.0 - Git operations wrapper

**Infrastructure:**
- conf 10.2.0 - Persistent configuration management (stores in `~/.config/ai-commit-generator/`)
- fs-extra 11.1.1 - Enhanced file system operations
- node-cache 5.1.2 - In-memory caching with TTL support

**CLI/UX:**
- chalk 4.1.2 - Terminal string styling and colors
- ora 5.4.1 - Terminal loading spinners
- inquirer 8.2.6 - Interactive prompts
- commander 11.1.0 - CLI command framework

**Validation:**
- joi 17.11.0 - Schema validation for configuration

## Configuration

**Environment:**
- No environment files detected (`.env` not present)
- Configuration managed via `conf` package
- Config location: `~/.config/ai-commit-generator/config.json`
- Validation: Joi schema for type-safe config

**Build:**
- No build configuration - Pure Node.js CommonJS modules
- No TypeScript, Babel, or transpilation required

## Platform Requirements

**Development:**
- Node.js 18+ (ES2021 features supported)
- npm 8+
- Git repository required for operation
- Ollama service (optional, for local AI) running on `http://localhost:11434`

**Production:**
- Deployed as npm package: `ai-commit-generator`
- Executables: `bin/aic.js` and `bin/aicommit.js`
- Installation: `npm install -g ai-commit-generator`

---

*Stack analysis: 2026-03-26*
