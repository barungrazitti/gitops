/**
 * Jest Setup File
 * 
 * This file runs before each test file and sets up the testing environment.
 */

// Increase timeout for async operations
jest.setTimeout(30000);

// Mock console methods to reduce noise during testing
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Store original methods for restoration
global.originalConsole = {
  log: originalConsoleLog,
  error: originalConsoleError,
  warn: originalConsoleWarn
};

// Mock console methods during tests (can be overridden in individual tests)
beforeEach(() => {
  // Only mock if not in verbose mode
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
  // Helper to create mock git diff
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
  
  // Helper to create mock config
  createMockConfig: (overrides = {}) => {
    return {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      language: 'en',
      conventional: true,
      cache: true,
      maxTokens: 150,
      temperature: 0.7,
      ...overrides
    };
  },
  
  // Helper to wait for async operations
  wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms))
};