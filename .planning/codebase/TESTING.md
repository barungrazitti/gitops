# Testing Patterns

**Analysis Date:** 2026-03-26

## Test Framework

**Runner:**
- Jest 29.7.0
- Config: `jest.config.js`

**Assertion Library:**
- Built-in Jest assertions (`expect`)

**Run Commands:**
```bash
npm test              # Run all tests (1-3s)
npx jest tests/aicommit-cli.test.js  # Run single test file
npm run test:watch    # Watch mode for development
npm run test:coverage # Jest with coverage report
VERBOSE_TESTS=1 npm test # Run with console output
```

## Test File Organization

**Location:**
- Co-located in `tests/` directory at project root
- Mirrors `src/` structure where applicable

**Naming:**
- Pattern: `[module-name].test.js`
- Examples: `git-manager.test.js`, `config-manager.test.js`, `groq-provider.test.js`

**Structure:**
```
tests/
├── setup.js                    # Global test configuration
├── mocks/                      # Mock implementations
│   └── groq-mock.js
├── aicommit-cli.test.js        # CLI handler tests
├── git-manager.test.js         # Core module tests
├── config-manager.test.js      # Config tests
├── cache-manager.test.js       # Cache tests
├── activity-logger.test.js     # Logger tests
├── groq-provider.test.js       # Provider tests
└── [other module tests]
```

## Test Structure

**Suite Organization:**
```javascript
describe('ModuleName', () => {
  let instance;

  beforeEach(() => {
    // Setup: clear mocks, create fresh instance
    jest.clearAllMocks();
    instance = new ModuleName();
  });

  describe('methodName', () => {
    it('should do something specific', async () => {
      // Arrange
      const input = 'test';

      // Act
      const result = await instance.methodName(input);

      // Assert
      expect(result).toBe('expected');
    });

    it('should handle errors', async () => {
      // Test error case
      await expect(instance.methodName()).rejects.toThrow('Error message');
    });
  });

  afterEach(() => {
    // Cleanup if needed
  });
});
```

**Patterns:**

**Setup pattern:**
- Use `beforeEach` to reset mocks and create fresh instances
- Use `jest.clearAllMocks()` to clear mock calls between tests
- Use `jest.resetModules()` if testing module initialization

**Teardown pattern:**
- Use `afterEach` for cleanup (rarely needed with Jest's auto-cleanup)
- Use `afterAll` to restore mocks if needed

**Assertion pattern:**
- Use `expect().toBe()` for strict equality
- Use `expect().toEqual()` for object/array equality
- Use `expect().toHaveBeenCalled()` for mock verification
- Use `expect().rejects.toThrow()` for async error testing

## Mocking

**Framework:** Jest built-in mocking

**Patterns:**

**Mock entire module:**
```javascript
// Mock at top of file, before imports
jest.mock('simple-git');
jest.mock('node-cache');

const GitManager = require('../src/core/git-manager');
const simpleGit = require('simple-git');
```

**Mock with custom implementation:**
```javascript
jest.mock('conf', () => {
  return jest.fn().mockImplementation(() => ({
    store: {},
    path: '/test/config.json',
    get: jest.fn((key) => 'test-value'),
    set: jest.fn(),
    clear: jest.fn(),
  }));
});
```

**Mock constructor and return value:**
```javascript
beforeEach(() => {
  mockGit = {
    checkIsRepo: jest.fn().mockResolvedValue(true),
    diff: jest.fn().mockResolvedValue('diff content'),
    log: jest.fn().mockResolvedValue({ all: [] }),
  };

  simpleGit.mockReturnValue(mockGit);
  gitManager = new GitManager();
});
```

**Mock specific methods:**
```javascript
jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(process, 'exit').mockImplementation(() => {});
```

**What to Mock:**
- External dependencies: `simple-git`, `fs-extra`, `node-cache`, `conf`
- AI provider SDKs: `groq-sdk`
- Node.js built-ins: `fs`, `path`, `crypto`, `os`
- Console methods in CLI tests

**What NOT to Mock:**
- Pure functions in the same module
- Simple data transformations
- Business logic being tested

**Mock location:**
- Simple mocks: Inline in test file
- Complex mocks: `tests/mocks/` directory
- Shared mocks: Reusable mock files (e.g., `tests/mocks/groq-mock.js`)

## Fixtures and Factories

**Test Data:**
```javascript
// Global test utilities in tests/setup.js
global.testUtils = {
  createMockDiff: (files = ['test.js']) => {
    return files.map(file => `
diff --git a/${file} b/${file}
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/${file}
@@ -0,0 +1,3 @@
+function test() {
+  return 'Hello World';
+}
    `).join('\n');
  },

  createMockConfig: (overrides = {}) => {
    return {
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      conventional: true,
      cache: true,
      ...overrides
    };
  },

  wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms))
};
```

**Location:**
- Global fixtures: `tests/setup.js`
- Test-specific fixtures: In test file or local `beforeEach`

**Usage in tests:**
```javascript
it('should handle mock diff', async () => {
  const mockDiff = global.testUtils.createMockDiff(['file1.js', 'file2.js']);
  const result = await processor.process(mockDiff);
  expect(result).toBeDefined();
});
```

## Coverage

**Requirements:** Coverage collected but no minimum enforced

**View Coverage:**
```bash
npm run test:coverage
```

**Configuration in `jest.config.js`:**
```javascript
collectCoverage: true,
coverageDirectory: 'coverage',
coverageReporters: ['text', 'lcov', 'html'],
collectCoverageFrom: [
  'src/**/*.js',
  'bin/**/*.js',
  '!src/**/*.test.js',
  '!**/node_modules/**'
]
```

**Coverage files excluded:**
- Test files themselves
- node_modules
- Non-source files

## Test Types

**Unit Tests:**
- Scope: Individual methods and classes
- Approach: Mock all external dependencies
- Examples: `git-manager.test.js`, `config-manager.test.js`, `cache-manager.test.js`

**Integration Tests:**
- Scope: Multiple modules working together
- Approach: Mock only external services (AI providers, git operations)
- Examples: `aicommit-cli.test.js`, `auto-git.test.js`

**E2E Tests:**
- Framework: Not used
- Manual testing required for full CLI workflows

## Common Patterns

**Async Testing:**
```javascript
it('should handle async operations', async () => {
  // Use async/await
  const result = await gitManager.getStagedDiff();

  // Or use expect().resolves
  await expect(gitManager.validateRepository()).resolves.toBe(true);

  // Or use expect().rejects for errors
  await expect(gitManager.commit()).rejects.toThrow('Failed to commit');
});
```

**Error Testing:**
```javascript
it('should handle validation errors', async () => {
  mockGit.checkIsRepo.mockResolvedValue(false);

  await expect(gitManager.validateRepository())
    .rejects.toThrow('Not a git repository');
});

it('should log an error and exit if generate fails', async () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

  mockGenerate.mockRejectedValue(new Error('Generate failed'));
  await handleGenerate({});

  expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'), 'Generate failed');
  expect(exitSpy).toHaveBeenCalledWith(1);

  errorSpy.mockRestore();
  exitSpy.mockRestore();
});
```

**Mock timing:**
```javascript
it('should wait for async operations', async () => {
  await global.testUtils.wait(100);
  // Continue testing...
});
```

## Test Configuration

**Global setup (`tests/setup.js`):**
```javascript
// Increase timeout for async operations
jest.setTimeout(30000);

// Mock console methods to reduce noise
beforeEach(() => {
  if (!process.env.VERBOSE_TESTS) {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  }
});

afterEach(() => {
  // Restore console methods
  if (!process.env.VERBOSE_TESTS) {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  }
});

// Global test utilities
global.testUtils = {
  createMockDiff: (files) => { /* ... */ },
  createMockConfig: (overrides) => { /* ... */ },
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};
```

**Jest config highlights:**
- Test timeout: 30 seconds (`testTimeout: 30000`)
- Clear mocks between tests: `clearMocks: true`
- Restore mocks after each test: `restoreMocks: true`
- Setup file: `tests/setup.js`
- Transform ignore patterns for ES modules in node_modules
- Module name mapping for mocked SDKs

## Test Isolation

**Per-test isolation:**
- Use `beforeEach` to create fresh instances
- Use `jest.clearAllMocks()` to reset mock calls
- Use `jest.resetModules()` for module-level state

**Example:**
```javascript
describe('CacheManager', () => {
  let cacheManager;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Setup mocks
    NodeCache.mockImplementation(() => mockNodeCache);

    // Import and create instance
    CacheManager = require('../src/core/cache-manager');
    cacheManager = new CacheManager();
  });
});
```

## CI/CD Integration

**Run in CI:**
- Tests run automatically via GitHub Actions
- Coverage reports generated on each run
- No test deployment steps configured

**Test scripts in `package.json`:**
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:verbose": "VERBOSE_TESTS=1 jest --verbose"
  }
}
```

---

*Testing analysis: 2026-03-26*
