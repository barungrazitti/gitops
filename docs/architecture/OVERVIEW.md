# Architecture Overview

High-level architecture of AI Commit Generator.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLI Layer                            │
│  aic.js (main)  │  aicommit.js (generator)             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  Command Layer                          │
│  generate │ config │ setup │ stats │ hook              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   Core Layer                            │
│  GitManager │ ConfigManager │ CacheManager              │
│  CommitGenerator │ MessageValidator                     │
│  ActivityLogger │ StatsManager                          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Analysis & Detection Layer                 │
│  AnalysisEngine │ ComponentDetector                     │
│  FileTypeDetector │ DependencyMapper                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                Security Layer                           │
│  SecretScanner │ InputSanitizer                         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  AI Provider Layer                      │
│  ProviderFactory │ GroqProvider │ OllamaProvider        │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 Module Breakdown

### Core Layer (src/core/)

| Module | Lines | Tests | Purpose |
|--------|-------|-------|---------|
| `git-manager.js` | 415 | ✅ | Git operations |
| `config-manager.js` | 442 | ✅ | Configuration |
| `cache-manager.js` | 385 | ✅ | Intelligent caching |
| `commit-generator.js` | 338 | 19 | Pipeline orchestration |
| `message-validator.js` | 365 | 31 | Quality validation |
| `activity-logger.js` | 521 | ✅ | Activity logging |
| `stats-manager.js` | 316 | ✅ | Usage statistics |

### Detection Layer (src/detectors/)

| Module | Lines | Tests | Purpose |
|--------|-------|-------|---------|
| `component-detector.js` | 287 | ✅ | Component boundaries |
| `file-type-detector.js` | 224 | ✅ | File categorization |
| `dependency-mapper.js` | 355 | ✅ | Import/export tracking |
| `convention-detector.js` | 394 | ✅ | Code conventions |

### Formatting Layer (src/formatters/)

| Module | Lines | Tests | Purpose |
|--------|-------|-------|---------|
| `formatter-factory.js` | 289 | ✅ | Strategy selection |
| `sections/what-changed.js` | 215 | ✅ | Change descriptions |
| `sections/why-changed.js` | 373 | ✅ | Motivation detection |
| `sections/impact.js` | 261 | ✅ | Impact analysis |

### Security Layer (src/utils/)

| Module | Lines | Tests | Purpose |
|--------|-------|-------|---------|
| `secret-scanner.js` | 437 | ✅ | Secret/PII detection |
| `input-sanitizer.js` | 213 | ✅ | Input validation |

---

## 🔄 Data Flow

### Commit Generation Flow

```
1. User runs: aic
        ↓
2. Stage changes: gitManager.getStagedDiff()
        ↓
3. Security scan: SecretScanner.scanAndRedact()
        ↓
4. Run detectors: ComponentDetector, FileTypeDetector, DependencyMapper
        ↓
5. Build context: AnalysisEngine.analyzeRepository()
        ↓
6. Generate messages: ProviderOrchestrator.generateWithSequentialFallback()
        ↓
7. Validate: MessageValidator.validateBatch()
        ↓
8. Format: MessageFormatter.formatWithContext()
        ↓
9. Commit: gitManager.commit()
        ↓
10. Log: ActivityLogger.info()
```

---

## 🔌 AI Provider Integration

### Provider Factory Pattern

```javascript
AIProviderFactory.create('groq')  // Cloud provider
AIProviderFactory.create('ollama') // Local provider
```

### Sequential Fallback

```
Preferred Provider (Groq)
        ↓ (if fails)
Backup Provider (Ollama)
        ↓ (if fails)
Error: "All providers failed"
```

---

## 🗄️ Data Storage

### Configuration

- **Location**: `~/.config/ai-commit-generator/config.json`
- **Encryption**: AES-256-GCM for sensitive values
- **Schema**: Joi validation

### Cache

- **Location**: `~/.cache/ai-commit-generator/`
- **Strategy**: Semantic similarity + exact match
- **TTL**: 7 days (configurable)
- **Max Size**: 1000 entries

### Activity Logs

- **Location**: `~/.local/share/ai-commit-generator/logs/`
- **Retention**: 30 days (auto-cleanup)
- **Format**: JSON lines
- **Rotation**: Daily

---

## 🔒 Security Architecture

### Layers of Protection

```
┌─────────────────────────────────────┐
│ Layer 1: Input Validation           │
│ - Path sanitization                 │
│ - Command injection prevention      │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ Layer 2: Secret Scanning            │
│ - 15+ secret patterns               │
│ - 8 PII patterns                    │
│ - Auto-redaction                    │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ Layer 3: Quality Validation         │
│ - Specificity checks                │
│ - Reasoning requirements            │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ Layer 4: Audit Logging              │
│ - All operations logged             │
│ - 30-day retention                  │
└─────────────────────────────────────┘
```

---

## 📊 Quality Gates

### QUAL-01: Specificity

- **Requirement**: <5% generic messages
- **Enforcement**: MessageValidator
- **Patterns**: 10+ generic patterns detected
- **Score**: -30 for generic, -50 for banned

### QUAL-02: Reasoning

- **Requirement**: >90% messages with reasoning
- **Enforcement**: MessageValidator
- **Patterns**: 12+ reasoning indicators
- **Score**: +15 for reasoning detected

---

## 🧩 Module Dependencies

```
Commands → Core → Detectors/Formatters
              ↓
           Providers
              ↓
           Utils (Security)
```

**Key Principle**: One-way dependencies (no circular imports)

---

## 📈 Performance

### Response Times

| Operation | Target | Actual |
|-----------|--------|--------|
| Cache Hit | <1s | ~100ms |
| AI Generation | <10s | ~500ms (Groq) |
| Security Scan | <200ms | ~150ms |
| Startup | <500ms | ~300ms |

### Memory Usage

| Component | Usage |
|-----------|-------|
| Base Application | ~50MB |
| With Cache | ~100MB |
| Peak (large diff) | ~200MB |

---

## 🔗 Related Documentation

- [Module Guide](../developer-guide/MODULES.md)
- [Data Flow](DATA_FLOW.md)
- [AI Integration](AI_INTEGRATION.md)
- [Security Overview](../security/OVERVIEW.md)

---

*Last updated: 2026-03-27*
