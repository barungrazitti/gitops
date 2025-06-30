module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/test.js',
    '**/__tests__/**/*.js'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.js',
    'bin/**/*.js',
    '!src/**/*.test.js',
    '!**/node_modules/**'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Module paths
  roots: ['<rootDir>/src', '<rootDir>/tests', '<rootDir>/bin'],
  
  // Transform configuration
  transform: {},
  
  // Transform ignore patterns - allow ES modules in node_modules
  transformIgnorePatterns: [
    'node_modules/(?!(@mistralai|@anthropic-ai|@google|groq-sdk|cohere-ai)/)'
  ],
  
  // Module name mapping for ES modules
  moduleNameMapper: {
    '^@mistralai/mistralai$': '<rootDir>/tests/mocks/mistral-mock.js',
    '^@anthropic-ai/sdk$': '<rootDir>/tests/mocks/anthropic-mock.js',
    '^@google/generative-ai$': '<rootDir>/tests/mocks/gemini-mock.js',
    '^groq-sdk$': '<rootDir>/tests/mocks/groq-mock.js',
    '^cohere-ai$': '<rootDir>/tests/mocks/cohere-mock.js'
  },
  
  // Test timeout
  testTimeout: 30000,
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true
};