# External Integrations

**Analysis Date:** 2026-03-26

## APIs & External Services

**AI Providers:**

- **Groq** (Cloud AI - Primary)
  - Purpose: Fast inference for commit message generation
  - SDK/Client: `groq-sdk` (official SDK)
  - Auth: API key stored in config (`apiKey`)
  - Implementation: `src/providers/groq-provider.js`
  - Default model: `llama-3.1-8b-instant`
  - Available models: `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `openai/gpt-oss-120b`, `qwen/qwen3-32b`
  - Circuit breaker: 5 failure threshold, 60s timeout
  - Endpoint: Chat completions API
  - Max tokens: 150 (commit messages), 2000 (code fixing)
  - Temperature: 0.3 (low temperature for focused output)

- **Ollama** (Local AI - Fallback)
  - Purpose: Local inference when Groq unavailable or for privacy
  - SDK/Client: HTTP requests via `axios` to local API
  - Auth: None required (local service)
  - Implementation: `src/providers/ollama-provider.js`
  - Base URL: `http://localhost:11434`
  - Default model: `qwen2.5-coder:latest`
  - Available models: `deepseek-v3.1:671b-cloud`, `qwen3-coder:480b-cloud`, `qwen2.5-coder:latest`, `mistral:7b-instruct`, `deepseek-r1:8b`
  - Circuit breaker: 3 failure threshold, 120s timeout (longer for local models)
  - Endpoint: `/api/generate` and `/api/tags`
  - Model pulling: `/api/pull` endpoint supported

## Data Storage

**Databases:**
- None detected

**Configuration Storage:**
- **Local JSON files** via `conf` package
  - Location: `~/.config/ai-commit-generator/config.json`
  - Format: JSON
  - Persistence: Automatic on config changes
  - Validation: Joi schema validation before storage

**File Storage:**
- Local filesystem only (git repository operations)
- No cloud storage integration

**Caching:**
- **In-memory cache** via `node-cache`
  - Implementation: `src/core/cache-manager.js`
  - Default TTL: 24 hours (86400000ms)
  - Cacheable: AI-generated commit messages
  - Key generation: Based on diff content hash

**Activity Logs:**
- Local JSON file storage
  - Implementation: `src/core/activity-logger.js`
  - Location: Managed by app (likely config directory)
  - Retention: 30-day automatic cleanup
  - Export: JSON and CSV formats supported

## Authentication & Identity

**Auth Provider:**
- Custom (no external auth services)
  - API keys stored locally in config
  - No OAuth or external identity providers
  - Groq API key validation on first use
  - Ollama: No authentication (local service)

**Secrets Management:**
- Configuration-based (not a dedicated secrets manager)
  - API keys stored in `~/.config/ai-commit-generator/config.json`
  - Sanitization: Built-in secret redaction via `src/utils/secret-scanner.js`
  - No integration with external vaults (HashiCorp, AWS Secrets Manager, etc.)

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Rollbar, etc.)

**Logs:**
- **Custom activity logging** via `src/core/activity-logger.js`
  - Logs: AI interactions, git operations, user choices
  - Prompt logging: Truncated at 10KB for quality analysis
  - Response logging: Truncated at 2KB
  - Performance metrics: Response times, success rates
  - Session tracking: Unique session IDs
  - Analysis tools: Built-in via `aic stats --analyze`
  - Export: JSON/CSV via `aic stats --export`

**Performance Monitoring:**
- Custom metrics via `src/core/stats-manager.js`
  - Usage statistics tracking
  - Provider performance comparison
  - Activity patterns (peak hours, commit patterns)
  - View via: `aic stats` command

## CI/CD & Deployment

**Hosting:**
- npm registry (public package)
  - Package name: `ai-commit-generator`
  - Version: 1.3.0
  - Global install: `npm install -g ai-commit-generator`

**CI Pipeline:**
- None detected (no GitHub Actions, GitLab CI, etc.)
  - Manual deployment via scripts: `scripts/deploy.sh`
  - Build script: `scripts/build.sh`

**Deployment:**
- Manual npm publish workflow
  - No automated CI/CD pipelines detected
  - Shell scripts for build and deployment

## Environment Configuration

**Required env vars:**
- None - Configuration managed via `conf` package, not environment variables

**Optional env vars:**
- `VERBOSE_TESTS=1` - Enable verbose Jest output
- Test commands configurable via config (e.g., `testCommand: 'npm run test:quick'`)

**Secrets location:**
- `~/.config/ai-commit-generator/config.json` (plain JSON, not encrypted)
  - API key field: `apiKey`
  - No encryption detected
  - Sanitization available for diff content before sending to AI

## Webhooks & Callbacks

**Incoming:**
- None detected (no webhook endpoints)

**Outgoing:**
- None detected (no outgoing webhooks)
  - AI providers are called via SDK/HTTP, not webhooks

## Git Integration

**Git Operations:**
- **simple-git** library wrapper
  - Implementation: `src/core/git-manager.js`
  - Operations: diff, status, commit, log, branch, stash, push
  - Repository validation: Checks for valid git repo
  - Pattern learning: Analyzes commit history for conventions

**Git Hooks:**
- Custom hook management via `src/core/hook-manager.js`
  - Pre-commit hooks support
  - No external git hook services detected

---

*Integration audit: 2026-03-26*
