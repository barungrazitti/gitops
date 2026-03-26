# Coding Conventions

**Analysis Date:** 2026-03-26

## Naming Patterns

**Files:**
- Classes and core modules: `PascalCase.js` (e.g., `GitManager.js`, `ConfigManager.js`)
- Utilities and helpers: `kebab-case.js` (e.g., `message-formatter.js`, `input-sanitizer.js`)
- Executables: `kebab-case.js` (e.g., `aic.js`, `aicommit.js`)
- Test files: `*.test.js` (e.g., `git-manager.test.js`, `groq-provider.test.js`)

**Functions:**
- Methods: `camelCase` (e.g., `getStagedDiff`, `validateRepository`, `generateCommitMessages`)
- Public methods: Descriptive verbs (e.g., `initializeClient`, `parseResponse`, `handleGenerate`)
- Private helpers: Also `camelCase`, typically prefixed with underscore when truly private

**Variables:**
- Local variables: `camelCase` (e.g., `mockGit`, `cacheManager`, `originalLength`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `stdTTL`, `checkperiod`)
- Class properties: `camelCase` (e.g., `this.git`, `this.client`, `this.config`)

**Types:**
- Classes: `PascalCase` (e.g., `class GitManager`, `class ConfigManager`)
- Constructor functions: `PascalCase`

## Code Style

**Formatting:**
- No automated formatting tools (ESLint, Prettier removed per user request)
- 2-space indentation (standard for Node.js projects)
- Single quotes for strings preferred but not enforced
- Semicolons required

**Linting:**
- No linting tools in use (removed per user request)
- Manual code review for consistency

## Import Organization

**Order:**
1. Node.js built-in modules (`const path = require('path');`)
2. External dependencies (`const chalk = require('chalk');`)
3. Internal modules (`const GitManager = require('./core/git-manager');`)

**Path Aliases:**
- No path aliases configured
- Use relative paths: `./core/git-manager`, `./utils/input-sanitizer`
- Use absolute paths from project root: `require('/src/core/git-manager')`

**Example from `src/index.js`:**
```javascript
const path = require('path');           // Built-in
const chalk = require('chalk');         // External
const GitManager = require('./core/git-manager');  // Internal
const ConfigManager = require('./core/config-manager');
```

## Error Handling

**Patterns:**
- Always wrap async operations in try-catch blocks
- Throw descriptive Error objects with context
- Use consistent error message format: `Failed to [action]: ${error.message}`
- Validate inputs early and fail fast

**Examples:**

**Try-catch with descriptive error:**
```javascript
async validateRepository() {
  try {
    const isRepo = await this.git.checkIsRepo();
    if (!isRepo) {
      throw new Error(
        'Not a git repository. Please run this command from within a git repository.'
      );
    }
    return true;
  } catch (error) {
    throw new Error(`Git repository validation failed: ${error.message}`);
  }
}
```

**Input validation:**
```javascript
sanitizeFilePath(inputPath) {
  if (!inputPath) return null;

  const normalizedPath = path.normalize(inputPath);

  if (normalizedPath.includes('..')) {
    throw new Error('Invalid path: Directory traversal detected');
  }

  return normalizedPath;
}
```

**Error handling with logging:**
```javascript
async ensureCacheDir() {
  try {
    await fs.ensureDir(this.cacheDir);
  } catch (error) {
    console.warn('Failed to create cache directory:', error.message);
  }
}
```

## Logging

**Framework:** `console` methods (log, error, warn, info) and `ora` spinner for CLI operations

**Patterns:**
- Use `ora` spinners for long-running operations with progress indication
- Use `chalk` for colored output in CLI
- Use `console.warn` for non-fatal errors
- Use `console.error` for fatal errors
- Activity logging through `ActivityLogger` class for audit trails

**Spinner pattern:**
```javascript
const spinner = ora({
  text: chalk.blue('🚀 Initializing AI commit generator...'),
  spinner: 'clock'
}).start();

spinner.text = chalk.blue('📋 Analyzing staged changes...');
spinner.succeed(chalk.green('✅ Complete'));
spinner.fail(chalk.red('❌ Failed'));
```

**Console mocking in tests:**
- Console methods are mocked by default in tests (see `tests/setup.js`)
- Set `VERBOSE_TESTS=1` environment variable to see console output during testing

## Comments

**When to Comment:**
- JSDoc comments required for all classes
- JSDoc comments required for all public methods
- Inline comments for complex logic or business rules
- Comment security-sensitive operations

**JSDoc/TSDoc:**
- Single-line JSDoc for simple methods: `/** Validate repository */`
- Multi-line JSDoc for complex methods with parameter and return types
- Always describe what the method does, not how

**Examples:**

**Class documentation:**
```javascript
/**
 * Git Manager - Handles all git operations
 */
class GitManager {
  constructor() {
    this.git = simpleGit();
  }
}
```

**Method documentation:**
```javascript
/**
 * Get staged changes diff
 */
async getStagedDiff() {
  try {
    const diff = await this.git.diff(['--staged']);
    return diff;
  } catch (error) {
    throw new Error(`Failed to get staged diff: ${error.message}`);
  }
}
```

**Detailed JSDoc:**
```javascript
/**
 * Sanitize file paths to prevent directory traversal
 * @param {string} inputPath - The path to sanitize
 * @returns {string|null} The sanitized path or null if invalid
 * @throws {Error} If directory traversal is detected
 */
static sanitizeFilePath(inputPath) {
  // Implementation...
}
```

## Function Design

**Size:** Keep functions focused and under 50 lines when possible. Larger functions should be broken down.

**Parameters:**
- Use object destructuring for options: `const { provider, count, model } = options`
- Limit to 4-5 parameters maximum
- Use options object for multiple parameters: `async generate(diff, options = {})`

**Return Values:**
- Always return consistent types (don't sometimes return null, sometimes return string)
- Use early returns for validation
- Return promises for async operations (don't mix callbacks)

**Example:**
```javascript
async generateCommitMessages(diff, options = {}) {
  await this.initializeClient();
  const config = await this.getConfig();

  const {
    model = 'llama-3.1-8b-instant',
    count = 1,
    temperature = 0.7
  } = options;

  // Implementation...

  return messages;
}
```

## Module Design

**Exports:**
- Use CommonJS `module.exports` or `exports` (not ES modules)
- Export classes as primary export: `module.exports = GitManager;`
- Export multiple values using `exports`: `exports.helper = function() {}`

**Barrel Files:**
- No barrel file pattern detected
- Each module exports its own class/function directly

**Constructor patterns:**
- Initialize dependencies in constructor
- Set default values in constructor
- Don't do async work in constructor (use `initialize()` method instead)

**Example:**
```javascript
class CacheManager {
  constructor() {
    this.memoryCache = new NodeCache({
      stdTTL: 86400,
      checkperiod: 3600,
    });
    this.cacheDir = path.join(os.homedir(), '.ai-commit-generator', 'cache');
    this.ensureCacheDir();
  }
}
```

## Security Patterns

**Input sanitization:**
- Always sanitize user input (see `InputSanitizer` class in `src/utils/input-sanitizer.js`)
- Check for directory traversal: `if (path.includes('..'))`
- Check for command injection: `const dangerousChars = /[;&|$`]/g;`
- Validate file paths before operations

**Secret handling:**
- Scan for secrets before sending to AI (see `SecretScanner` in `src/utils/secret-scanner.js`)
- Redact sensitive information from diffs
- Log redaction activity for audit trails

**Example:**
```javascript
const secretScanner = new SecretScanner();
diff = secretScanner.scanAndRedact(diff, true);
const redactionSummary = secretScanner.getRedactionSummary();

if (redactionSummary.found) {
  await this.activityLogger.warn('sensitive_data_redacted', {
    redacted: redactionSummary.redacted,
    byCategory: redactionSummary.byCategory
  });
}
```

## Async Patterns

**Consistent async/await:**
- Always use async/await (no Promise chains or callbacks)
- Never mix async/await with Promise.then/catch
- Use Promise.all() for parallel operations

**Error handling in async:**
- Always wrap in try-catch
- Throw errors, don't return error values
- Use consistent error message format

**Example:**
```javascript
async analyzeRepository() {
  try {
    const [repoInfo, commitPatterns, fileContext, projectType] =
      await Promise.all([
        this.gitManager.getRepositoryInfo(),
        this.gitManager.getCommitPatterns(),
        this.analyzeFileContext(),
        this.detectProjectType(),
      ]);

    return {
      repository: repoInfo,
      patterns: commitPatterns,
      files: fileContext,
      project: projectType,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.warn('Repository analysis failed:', error.message);
    return { /* default values */ };
  }
}
```

---

*Convention analysis: 2026-03-26*
