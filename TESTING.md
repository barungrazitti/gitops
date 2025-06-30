# Testing Guide - AI Commit Generator

This document provides a comprehensive guide to testing the AI Commit Generator project.

## Overview

The project includes multiple testing approaches to ensure reliability and ease of use:

1. **Quick Test** - Fast validation (2-5 seconds)
2. **Simple Test** - Comprehensive standalone testing (10-30 seconds)
3. **Jest Test Suite** - Full unit testing with mocking (30-60 seconds)

## Available Test Commands

| Command | Description | Use Case |
|---------|-------------|----------|
| `npm run test:quick` | Quick validation | Installation verification |
| `npm run test:simple` | Standalone comprehensive test | CI/CD, detailed validation |
| `npm test` | Full Jest test suite | Development, unit testing |
| `npm run test:coverage` | Jest with coverage report | Code quality analysis |
| `npm run test:watch` | Jest in watch mode | Active development |
| `npm run test:verbose` | Verbose Jest output | Debugging test failures |

## Quick Start

To verify the installation is working correctly:

```bash
npm run test:quick
```

Expected output:
```
🚀 Quick Test - AI Commit Generator

✅ Module imports
✅ Class instantiation
✅ Configuration loading
✅ Cache operations
✅ Statistics tracking
✅ Message formatting
✅ Package.json validation

🎉 All quick tests passed! The AI commit generator is ready to use.
```

## Test Files

### Core Test Files
- `test-quick.js` - Minimal validation script
- `test.js` - Comprehensive standalone test suite
- `tests/core.test.js` - Jest unit tests
- `tests/setup.js` - Jest configuration and utilities
- `jest.config.js` - Jest configuration

### Mock Files
- `tests/mocks/anthropic-mock.js` - Mock for Anthropic Claude
- `tests/mocks/cohere-mock.js` - Mock for Cohere
- `tests/mocks/gemini-mock.js` - Mock for Google Gemini
- `tests/mocks/groq-mock.js` - Mock for Groq
- `tests/mocks/mistral-mock.js` - Mock for Mistral AI

## Test Coverage

The test suite covers:

### Core Modules (100% import coverage)
- ✅ AICommitGenerator (main class)
- ✅ GitManager (git operations)
- ✅ ConfigManager (configuration handling)
- ✅ CacheManager (caching functionality)
- ✅ AnalysisEngine (repository analysis)
- ✅ MessageFormatter (commit message formatting)
- ✅ StatsManager (usage statistics)
- ✅ HookManager (git hooks)

### AI Providers (mocked)
- ✅ OpenAI GPT
- ✅ Anthropic Claude
- ✅ Google Gemini
- ✅ Mistral AI
- ✅ Cohere
- ✅ Groq
- ✅ Ollama

### Project Structure
- ✅ Package.json validation
- ✅ File structure verification
- ✅ CLI entry points
- ✅ Environment compatibility

## Running Tests in Different Environments

### Local Development
```bash
# Quick validation
npm run test:quick

# Development with auto-reload
npm run test:watch

# Full test before commit
npm run test:simple
```

### Continuous Integration
```bash
# Recommended CI command
npm run test:simple && npm test

# With coverage for quality gates
npm run test:coverage
```

### Production Validation
```bash
# Quick smoke test
npm run test:quick

# Full validation
npm run test:simple
```

## Test Results Interpretation

### Quick Test Results
- **All Passed**: Installation is correct, core modules work
- **Some Failed**: Check Node.js version, dependencies, or file permissions

### Simple Test Results
- **14/14 Passed**: Full functionality verified
- **Warnings about git repository**: Normal when not in a git repo
- **Failed tests**: Check specific error messages for guidance

### Jest Test Results
- **22+ tests passed**: All unit tests working
- **Coverage report**: Shows code coverage percentages
- **Console warnings**: Usually safe to ignore (git repository warnings)

## Troubleshooting

### Common Issues

#### Node.js Version Error
```
Error: Node.js version should be >= 18
```
**Solution**: Upgrade Node.js to version 18 or higher

#### Module Import Errors
```
Error: Cannot find module 'xyz'
```
**Solution**: Run `npm install` to install dependencies

#### Git Repository Warnings
```
Warning: Not in a git repository (some tests may be limited)
```
**Solution**: This is normal when testing outside a git repository. Tests will still pass.

#### Jest ES Module Errors
```
SyntaxError: Unexpected token 'export'
```
**Solution**: The Jest configuration includes mocks for ES modules. This should be resolved automatically.

### Getting Help

If tests continue to fail:

1. **Check Node.js version**: `node --version` (should be >= 18)
2. **Reinstall dependencies**: `rm -rf node_modules package-lock.json && npm install`
3. **Run quick test first**: `npm run test:quick` to isolate issues
4. **Check verbose output**: `npm run test:verbose` for detailed errors
5. **Verify file permissions**: Ensure all files are readable

## Best Practices

### For Contributors
- Run `npm run test:quick` before starting work
- Use `npm run test:watch` during development
- Run `npm run test:simple` before committing
- Add tests for new features

### For CI/CD
- Use `npm run test:simple && npm test` for comprehensive validation
- Set up coverage thresholds with `npm run test:coverage`
- Cache node_modules for faster test runs

### For Users
- Run `npm run test:quick` after installation
- Use `npm run test:simple` if experiencing issues
- Check this guide for troubleshooting

## Performance Benchmarks

Typical test execution times:

| Test Type | Duration | Tests Run | Coverage |
|-----------|----------|-----------|----------|
| Quick | 2-5 seconds | 7 essential | Core modules |
| Simple | 10-30 seconds | 14 comprehensive | Full functionality |
| Jest | 30-60 seconds | 22+ unit tests | Detailed coverage |
| Coverage | 60-120 seconds | 22+ with analysis | Code quality metrics |

## Contributing to Tests

When adding new features:

1. **Add quick validation** to `test-quick.js`
2. **Add comprehensive test** to `test.js`
3. **Add unit tests** to `tests/core.test.js`
4. **Update mocks** if adding new AI providers
5. **Update documentation** in this file and `tests/README.md`

### Test Writing Guidelines

- Keep tests isolated and independent
- Use descriptive test names
- Mock external dependencies
- Test both success and failure cases
- Include edge cases and error conditions

## Conclusion

The AI Commit Generator includes a robust testing framework that ensures reliability across different environments and use cases. The multi-layered approach provides quick feedback during development while maintaining comprehensive coverage for production deployments.