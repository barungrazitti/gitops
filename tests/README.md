# AI Commit Generator - Test Suite

This directory contains the comprehensive test suite for the AI Commit Generator project.

## Quick Start

For a quick validation that everything is working:

```bash
npm run test:quick
```

This runs a minimal test that validates core functionality in seconds.

## Running Tests

### Quick Test
```bash
npm run test:quick
# or
node test-quick.js
```
**Fastest option** - Runs essential tests in under 5 seconds to verify the installation is working.

### Simple Test Suite
```bash
npm run test:simple
# or
node test.js
```
**Comprehensive but simple** - Runs a detailed test suite that validates all core functionality without requiring Jest. Great for CI/CD or when you want detailed output.

### Full Test Suite (Jest)
```bash
npm test
# or
npm run test
```
**Most comprehensive** - Runs the complete Jest test suite with proper mocking, detailed assertions, and coverage reporting.

### Test with Coverage
```bash
npm run test:coverage
```
Runs tests and generates a detailed coverage report showing which parts of the code are tested.

### Watch Mode
```bash
npm run test:watch
```
Runs tests in watch mode, automatically re-running when files change (great for development).

### Verbose Output
```bash
npm run test:verbose
```
Runs tests with verbose console output (useful for debugging test failures).

## Test Files Structure

```
├── test-quick.js          # Quick validation script
├── test.js               # Comprehensive standalone test suite
├── tests/
│   ├── README.md         # This file
│   ├── setup.js          # Jest setup and configuration
│   ├── core.test.js      # Jest-based unit tests
│   └── mocks/            # Mock implementations for AI providers
│       ├── anthropic-mock.js
│       ├── cohere-mock.js
│       ├── gemini-mock.js
│       ├── groq-mock.js
│       └── mistral-mock.js
└── jest.config.js        # Jest configuration
```

## Test Categories

The tests are organized into several categories:

### Core Functionality Tests
- **Module Imports** - Validates all modules can be imported correctly
- **Class Instantiation** - Tests that all classes can be created without errors
- **Configuration Management** - Tests config loading, validation, and schema
- **Cache Operations** - Tests caching functionality and key generation
- **Message Formatting** - Tests commit message formatting and conventions
- **Statistics Tracking** - Tests usage statistics and analytics
- **Git Operations** - Tests git repository interactions (when available)

### Project Structure Tests
- **File Structure** - Validates that all required files exist
- **Package.json** - Validates package configuration and dependencies
- **CLI Entry Points** - Tests that command-line tools are properly configured

### Environment Tests
- **Node.js Version** - Ensures compatible Node.js version (>= 18)
- **Dependencies** - Validates that all required packages are available
- **AI Provider Mocking** - Tests AI provider integrations with mock responses

## Writing New Tests

When adding new features, please add corresponding tests:

### For Jest Tests (tests/core.test.js)
```javascript
describe('New Feature', () => {
  test('should do something', () => {
    // Your test here
    expect(result).toBeDefined();
  });
});
```

### For Simple Tests (test.js)
```javascript
runner.test('New Feature Test', async () => {
  // Your test here
  runner.assert(condition, 'Error message');
});
```

### For Quick Tests (test-quick.js)
```javascript
test('New feature validation', () => {
  // Quick validation
  if (!condition) throw new Error('Feature not working');
});
```

## Test Utilities

The test setup provides several utilities:

### Global Test Utilities (Jest)
- `global.testUtils.createMockDiff(files)` - Creates mock git diff data
- `global.testUtils.createMockConfig(overrides)` - Creates mock configuration
- `global.testUtils.wait(ms)` - Helper for async operations

### Mock Providers
All AI providers are mocked during testing to avoid requiring API keys:
- Anthropic Claude
- OpenAI GPT
- Google Gemini
- Mistral AI
- Cohere
- Groq

## Continuous Integration

These tests are designed to run in CI environments and will:

- Validate the project structure and dependencies
- Test core functionality without requiring API keys
- Check for proper error handling and edge cases
- Ensure compatibility across different environments
- Generate coverage reports for code quality metrics

### Recommended CI Test Command
```bash
npm run test:simple && npm test
```

This runs both the simple test suite (for quick feedback) and the full Jest suite (for comprehensive coverage).

## Troubleshooting

### Common Issues and Solutions

#### "Module not found" errors
```bash
npm install
```
Ensure all dependencies are installed.

#### "Node.js version" errors
Upgrade to Node.js >= 18:
```bash
nvm install 18  # if using nvm
nvm use 18
```

#### "Not in a git repository" warnings
This is normal when running tests outside a git repository. Tests will still pass but some git-related functionality will be limited.

#### Jest ES module errors
The Jest configuration includes mocks for ES modules. If you encounter new ES module issues, add them to the `moduleNameMapper` in `jest.config.js`.

#### API key related errors
Tests are designed to work without API keys using mocks. If you see API key errors, ensure you're running the test suites and not the actual application.

### Getting Help

If tests continue to fail:

1. **Check the basics**: Node.js version, npm install, file permissions
2. **Run quick test first**: `npm run test:quick` to isolate the issue
3. **Check verbose output**: `npm run test:verbose` for detailed error messages
4. **Review logs**: Look for specific error messages in the test output
5. **Check dependencies**: Ensure all packages in package.json are compatible

### Test Performance

- **Quick Test**: ~2-5 seconds
- **Simple Test**: ~10-30 seconds  
- **Jest Test**: ~30-60 seconds
- **Coverage Test**: ~60-120 seconds

Choose the appropriate test level based on your needs:
- Development: Use watch mode or quick tests
- Pre-commit: Use simple tests
- CI/CD: Use full test suite with coverage