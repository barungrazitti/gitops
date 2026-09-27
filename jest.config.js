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
  collectCoverage: false,
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
    'node_modules/(?!groq-sdk/)'
  ],
  
  // Module name mapping for ES modules
  moduleNameMapper: {
    '^groq-sdk$': '<rootDir>/tests/mocks/groq-mock.js'
  },
  
  // Test timeout
  testTimeout: 30000,
  
  // Verbose output
  verbose: false,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true
};