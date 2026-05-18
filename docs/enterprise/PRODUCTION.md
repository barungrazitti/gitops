# Production Readiness Guide

## Overview

This guide covers the production-ready features of the AI Commit Generator and how to deploy it in enterprise environments.

## Production Features

### 1. Caching System

The project includes two cache managers for optimal performance:

#### CacheManager (src/core/cache-manager.js)
- **Purpose**: Primary cache for AI commit message responses
- **Features**:
  - Dual-layer caching (memory + persistent disk)
  - SHA-256 content fingerprinting
  - Semantic similarity validation
  - 24-hour TTL default
  - Configurable via config

```javascript
// Usage in code
const cacheManager = new CacheManager();
const messages = await cacheManager.getValidated(diff);
if (!messages) {
  // Generate new messages
  messages = await generateMessages(diff);
  await cacheManager.setValidated(diff, messages);
}
```

#### MemoryEfficientCacheManager (src/core/memory-efficient-cache-manager.js)
- **Purpose**: Lightweight in-memory cache with size limits
- **Features**:
  - Max 50MB cache size
  - Max 1000 keys
  - Automatic LRU eviction
  - Configurable TTL

### 2. Rate Limiting

Rate limiting protects against API abuse and ensures fair usage.

#### RateLimiter (src/utils/rate-limiter.js)
- **Default Limits**: 60 requests per minute
- **Configurable**: Custom maxRequests and windowMs

```javascript
const rateLimiter = new RateLimiter({ maxRequests: 30, windowMs: 60000 });

if (!rateLimiter.canMakeRequest()) {
  const waitTime = rateLimiter.getWaitTime();
  console.log(`Rate limit reached. Wait ${waitTime}ms`);
  return;
}
rateLimiter.recordRequest();
```

### 3. Circuit Breaker

Prevents cascading failures when AI providers are unavailable.

#### CircuitBreaker (src/utils/circuit-breaker.js)
- **States**: CLOSED → OPEN → HALF_OPEN → CLOSED
- **Defaults**: 5 failures threshold, 30s reset timeout

```javascript
const circuitBreaker = new CircuitBreaker({ threshold: 3, timeout: 60000 });

try {
  const result = await circuitBreaker.execute(async () => {
    return await aiProvider.generate(diff);
  });
} catch (error) {
  if (error.message.includes('Circuit breaker is OPEN')) {
    // Fall back to alternative provider
  }
}
```

### 4. Health Monitoring

Track system health and performance metrics.

#### HealthCheck (src/utils/health-check.js)
```javascript
const { HealthCheck, MetricsCollector } = require('./src/utils/health-check');

const health = new HealthCheck();
health.registerCheck('ai_provider', async () => {
  return await checkProviderHealth();
});

const results = await health.runChecks();
console.log(`System status: ${results.status}`);
```

#### MetricsCollector
```javascript
const metrics = new MetricsCollector();
metrics.record('responseTime', 150);
metrics.record('responseTime', 200);

const stats = metrics.getStats('responseTime');
console.log(`Avg: ${stats.avg}ms, Min: ${stats.min}ms, Max: ${stats.max}ms`);
```

### 5. Error Handling

Comprehensive error handling with fallbacks.

#### ErrorHandler (src/utils/error-handler.js)
- Handles HTTP errors (401, 403, 429, 500s)
- Handles network errors (ECONNREFUSED, ETIMEDOUT)
- Provides user-friendly error messages

### 6. Security Features

#### SecretScanner (src/utils/secret-scanner.js)
- Scans diffs for secrets before AI processing
- Redacts API keys, tokens, passwords
- Supports enterprise mode for strict blocking

```javascript
const scanner = new SecretScanner({ enterpriseMode: true });
const redacted = scanner.scanAndRedact(diff, true);
const summary = scanner.getRedactionSummary();

if (summary.found && summary.redacted > 0) {
  console.log(`Redacted ${summary.redacted} sensitive items`);
}
```

### 7. AI Provider Fallback

Groq → Ollama automatic failover ensures availability.

```javascript
// Sequential fallback in provider-orchestrator.js
const messages = await generateWithSequentialFallback(diff, {
  preferredProvider: 'groq',
  // Falls back to ollama if groq fails
});
```

## Configuration

### Environment Variables

```bash
# AI Provider Configuration
GROQ_API_KEY=your_groq_api_key
OLLAMA_BASE_URL=http://localhost:11434

# Cache Settings
CACHE_TTL=86400
CACHE_DIR=~/.ai-commit-generator/cache

# Rate Limiting
RATE_LIMIT_MAX=60
RATE_LIMIT_WINDOW=60000

# Circuit Breaker
CIRCUIT_THRESHOLD=5
CIRCUIT_TIMEOUT=30000
```

### Config File

Located at `~/.ai-commit-generator/config.json`:

```json
{
  "defaultProvider": "groq",
  "model": "llama-3.1-8b-instant",
  "conventionalCommits": true,
  "maxRetries": 3,
  "timeout": 60000,
  "cache": {
    "enabled": true,
    "ttl": 86400
  },
  "rateLimit": {
    "maxRequests": 60,
    "windowMs": 60000
  }
}
```

## Graceful Degradation

### When Groq Fails
1. Circuit breaker opens after 5 consecutive failures
2. Automatic switch to Ollama (local AI)
3. User notification of fallback
4. Recovery attempt after timeout

### When Ollama Fails
1. Error message with troubleshooting tips
2. Suggestion to check Ollama installation
3. Fall back to local suggestions

### When Both Fail
1. AI-powered suggestions unavailable
2. Fallback to local error messages
3. User can still manually write commit messages

### Network Issues
1. Timeout after 60s (configurable)
2. Retry with exponential backoff
3. Clear error messages for user

## Performance Considerations

### Token Optimization
- Tiktoken-based accurate token counting
- Automatic diff chunking for large changes
- Configurable thresholds

### Memory Management
- MemoryEfficientCacheManager with size limits
- Automatic eviction of old entries
- No memory leaks in long-running processes

## Monitoring

### Health Checks
```bash
# Run health checks
node -e "const {HealthCheck} = require('./src/utils/health-check'); const h = new HealthCheck(); h.registerCheck('git', () => require('simple-git')().checkIsRepo(); h.runChecks().then(r => console.log(JSON.stringify(r, null, 2)));"
```

### Statistics
```bash
# View usage statistics
aic stats

# Analyze recent activity
aic stats --analyze

# Export logs
aic stats --export --format json
```

## Testing

### Production Simulation
```bash
# Test with mock failures
node -e "
const CircuitBreaker = require('./src/utils/circuit-breaker');
const cb = new CircuitBreaker({threshold: 2, timeout: 5000});
for (let i = 0; i < 3; i++) {
  try { await cb.execute(() => {throw new Error('fail')}); }
  catch (e) { console.log('Attempt', i+1, ':', e.message); }
}
console.log('State:', cb.state);
"
```

## Deployment Checklist

- [ ] Configure API keys (GROQ_API_KEY or Ollama)
- [ ] Test AI provider connectivity
- [ ] Verify caching works (`aic --dry-run` twice)
- [ ] Check rate limiting behavior
- [ ] Review error messages
- [ ] Test circuit breaker (`aic` repeatedly until provider fails)
- [ ] Verify security scanning (`aic` with test secrets)
- [ ] Run full test suite: `npm test`
- [ ] Run linting: `npm run lint`
- [ ] Check formatting: `npm run format:check`

## Support

For production issues:
1. Check logs: `aic stats --analyze`
2. Export logs: `aic stats --export --format json`
3. Run with verbose: `VERBOSE=1 aic`