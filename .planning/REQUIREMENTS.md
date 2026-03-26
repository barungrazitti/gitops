# Requirements

**Project:** AI Commit Generator v2
**Date:** 2026-03-26

## v1 Requirements

### Architecture

#### ARCH-01: Modular Architecture
The system shall be organized into three primary modules with clear boundaries:
- **Core** - Git operations, AI orchestration, diff processing
- **Detectors** - Codebase analysis, component identification, convention detection
- **Formatters** - Commit message generation with context-aware formatting

#### ARCH-02: Separation of Concerns
Each module shall have minimal coupling and well-defined interfaces:
- Detectors shall not depend on Formatters
- Formatters shall not depend on AI providers
- Core shall coordinate but not implement detection or formatting logic

#### ARCH-03: Plugin-Ready Structure
Module boundaries shall support future extensions:
- Detector plugins for different languages/frameworks
- Formatter plugins for different commit styles
- Provider plugins for additional AI services

### Detectors Module

#### DET-01: Component Boundary Detection
The system shall identify which components changed:
- Parse file paths to map to modules/services/packages
- Detect monorepo package boundaries (package.json, go.mod, etc.)
- Identify microservice boundaries in distributed systems
- Support custom component mappings via configuration

#### DET-02: Convention Analysis
The system shall learn project conventions through static analysis:
- Naming patterns (camelCase, snake_case, kebab-case)
- File structure patterns (flat, nested, feature-based)
- Import/export conventions (absolute vs relative paths)
- Code organization patterns (module grouping, separation of concerns)

#### DET-03: File Type Identification
The system shall detect and categorize file types:
- Programming languages (JavaScript, TypeScript, Python, etc.)
- Configuration files (JSON, YAML, TOML, etc.)
- Documentation (Markdown, text, etc.)
- Assets (images, styles, fonts)

#### DET-04: Dependency Mapping
The system shall understand code relationships:
- Parse import/export statements to build dependency graph
- Track which modules depend on which
- Detect circular dependencies
- Identify downstream effects of changes

### Formatters Module

#### FMT-01: What Changed Section
Commit messages shall describe what changed:
- Specific files/components affected
- Nature of changes (added, removed, modified)
- Scope of changes (single function vs. system-wide)

#### FMT-02: Why Changed Section
Commit messages shall explain motivation:
- Problem or requirement that prompted the change
- User-visible benefit or behavior change
- Technical debt addressed or refactoring rationale

#### FMT-03: Impact Section
Commit messages shall document consequences:
- Breaking changes or API modifications
- Side effects on other components
- Performance implications
- Migration notes if applicable

#### FMT-04: Conventional Commit Format
The system shall support conventional commits:
- Format: `type(scope): description`
- Supported types: feat, fix, refactor, docs, test, chore, style, perf, ci, build, revert
- Optional body and footer sections
- Automatic scope detection from component boundaries

### Core Module

#### CORE-01: Git Operations
The system shall provide full git workflow support:
- Stage changes (selective or all)
- Create commits with generated messages
- Pull from remote with merge/rebase options
- Push to remote branch
- Merge conflict detection

#### CORE-02: AI Provider Abstraction
The system shall support multiple AI providers:
- Groq (primary, cloud-based)
- Ollama (fallback, local)
- Sequential fallback on provider failure
- Configurable timeouts and retry logic

#### CORE-03: Diff Processing
The system shall handle code changes efficiently:
- Parse git diffs for staged changes
- Chunk large diffs to fit AI token limits
- Preserve file context and line numbers
- Handle binary files gracefully

#### CORE-04: Secret Detection
The system shall protect sensitive data:
- Detect API keys, passwords, tokens
- Redact secrets before sending to AI
- Support custom secret patterns
- Log redaction events

#### CORE-05: Semantic Caching
The system shall avoid redundant AI generations:
- Cache key based on diff semantic similarity
- Jaccard similarity for content comparison
- Configurable TTL and cache size
- Cache statistics and management

### Auto-Git Workflow

#### AUTO-01: Automatic Staging
The system shall support automatic workflow:
- Stage all changed files by default
- Support interactive staging selection
- Detect merge conflicts before staging
- Validate git repository state

#### AUTO-02: Pull-Before-Push
The system shall integrate with remote workflows:
- Pull latest changes before committing
- Detect upstream changes
- Fast-forward merge by default
- Detect divergent branches

#### AUTO-03: AI Conflict Resolution
The system shall resolve merge conflicts intelligently:
- Parse conflict markers
- Analyze original, current, and incoming changes
- Use AI to merge intelligently
- Support manual resolution fallback

#### AUTO-04: Automatic Push
The system shall complete the workflow:
- Push after successful commit
- Handle push failures gracefully
- Retry on network errors
- Log all operations

### Cross-Cutting Concerns

#### CROSS-01: Activity Logging
The system shall log comprehensive activity data:
- AI prompts and responses (truncated)
- Git operations and results
- Error messages and stack traces
- Performance metrics (response times)
- Session management with unique IDs
- 30-day log retention with auto-cleanup

#### CROSS-02: Usage Statistics
The system shall track usage patterns:
- Commit counts by time period
- Provider usage and success rates
- Cache hit/miss ratios
- Error frequency and types
- Peak usage hours

#### CROSS-03: Configuration Management
The system shall provide persistent configuration:
- AI provider selection and API keys
- Cache settings (size, TTL)
- Workflow preferences (auto-git, staging mode)
- Custom component mappings
- Commit message conventions

#### CROSS-04: CLI Interface
The system shall provide user-friendly CLI:
- Interactive prompts for commit selection
- Color-coded output for readability
- Progress indicators for long operations
- Help documentation and examples
- Configuration commands (setup, config, stats)

### Quality Requirements

#### QUAL-01: Specific Commit Messages
The system shall generate specific, non-generic messages:
- No generic "update code" or "fix bug" messages
- Always include component/module context
- Describe concrete changes, not abstractions
- Measured by: <5% generic messages in sampling

#### QUAL-02: Complete Reasoning
The system shall include motivation in commit messages:
- Explain why the change was made
- Link to problems or requirements
- Document design decisions
- Measured by: >90% messages include reasoning

#### QUAL-03: Performance
The system shall meet performance targets:
- Commit generation <10 seconds for typical diffs (<1000 lines)
- Cache hit response <1 second
- CLI startup <500ms
- Memory usage <200MB

#### QUAL-04: Cache Effectiveness
The system shall maximize cache hits:
- Semantic similarity detection for related changes
- >95% cache hit rate for similar changes
- Cache size optimization (max 1000 entries)
- Configurable cache invalidation

## v2 Requirements (Deferred)

- [ ] Multi-language detector plugins (Python, Go, Rust, etc.)
- [ ] Custom formatter templates
- [ ] Git history learning from past commits
- [ ] Web UI for configuration and stats
- [ ] Team sharing of conventions and templates
- [ ] Integration with CI/CD systems

## Out of Scope

- **Multi-VCS support** — Git-only, no Mercurial, SVN, etc.
- **Real-time monitoring** — No file watchers or daemon mode
- **Alternative AI providers** — Groq and Ollama only (no OpenAI, Anthropic, etc.)
- **Distributed configuration** — No remote config syncing, local only
- **Collaborative features** — No team sharing, comments, or approval workflows

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| ARCH-01 | TBD | Pending |
| ARCH-02 | TBD | Pending |
| ARCH-03 | TBD | Pending |
| DET-01 | TBD | Pending |
| DET-02 | TBD | Pending |
| DET-03 | TBD | Pending |
| DET-04 | TBD | Pending |
| FMT-01 | TBD | Pending |
| FMT-02 | TBD | Pending |
| FMT-03 | TBD | Pending |
| FMT-04 | TBD | Pending |
| CORE-01 | TBD | Pending |
| CORE-02 | TBD | Pending |
| CORE-03 | TBD | Pending |
| CORE-04 | TBD | Pending |
| CORE-05 | TBD | Pending |
| AUTO-01 | TBD | Pending |
| AUTO-02 | TBD | Pending |
| AUTO-03 | TBD | Pending |
| AUTO-04 | TBD | Pending |
| CROSS-01 | TBD | Pending |
| CROSS-02 | TBD | Pending |
| CROSS-03 | TBD | Pending |
| CROSS-04 | TBD | Pending |
| QUAL-01 | TBD | Pending |
| QUAL-02 | TBD | Pending |
| QUAL-03 | TBD | Pending |
| QUAL-04 | TBD | Pending |

---

*Requirements generated: 2026-03-26*
