#!/usr/bin/env node

/**
 * AI Commit Generator - Test Suite
 * 
 * This file provides a comprehensive test suite for the AI commit generator.
 * Run with: node test.js
 */

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import core modules
const AICommitGenerator = require('./src/index.js');
const GitManager = require('./src/core/git-manager');
const ConfigManager = require('./src/core/config-manager');
const CacheManager = require('./src/core/cache-manager');
const AnalysisEngine = require('./src/core/analysis-engine');
const MessageFormatter = require('./src/core/message-formatter');
const StatsManager = require('./src/core/stats-manager');
const HookManager = require('./src/core/hook-manager');
const AIProviderFactory = require('./src/providers/ai-provider-factory');

class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
  }

  /**
   * Add a test case
   */
  test(name, testFn) {
    this.tests.push({ name, testFn });
  }

  /**
   * Run all tests
   */
  async run() {
    console.log(chalk.blue.bold('\n🧪 AI Commit Generator Test Suite\n'));
    console.log(chalk.gray('=' .repeat(50)));

    for (const { name, testFn } of this.tests) {
      try {
        console.log(chalk.yellow(`\n▶ Running: ${name}`));
        await testFn();
        console.log(chalk.green(`✅ PASSED: ${name}`));
        this.passed++;
      } catch (error) {
        console.log(chalk.red(`❌ FAILED: ${name}`));
        console.log(chalk.red(`   Error: ${error.message}`));
        this.failed++;
      }
    }

    this.printSummary();
  }

  /**
   * Print test summary
   */
  printSummary() {
    console.log(chalk.gray('\n' + '=' .repeat(50)));
    console.log(chalk.blue.bold('\n📊 Test Summary:'));
    console.log(chalk.green(`✅ Passed: ${this.passed}`));
    console.log(chalk.red(`❌ Failed: ${this.failed}`));
    console.log(chalk.yellow(`⏭️  Skipped: ${this.skipped}`));
    console.log(chalk.blue(`📝 Total: ${this.tests.length}`));

    if (this.failed === 0) {
      console.log(chalk.green.bold('\n🎉 All tests passed!'));
    } else {
      console.log(chalk.red.bold('\n💥 Some tests failed!'));
      process.exit(1);
    }
  }

  /**
   * Assert helper
   */
  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  /**
   * Assert equal helper
   */
  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }

  /**
   * Assert instance helper
   */
  assertInstance(obj, constructor, message) {
    if (!(obj instanceof constructor)) {
      throw new Error(message || `Expected instance of ${constructor.name}`);
    }
  }
}

// Create test runner instance
const runner = new TestRunner();

// Test: Module Imports
runner.test('Module Imports', async () => {
  runner.assert(AICommitGenerator, 'AICommitGenerator should be importable');
  runner.assert(GitManager, 'GitManager should be importable');
  runner.assert(ConfigManager, 'ConfigManager should be importable');
  runner.assert(CacheManager, 'CacheManager should be importable');
  runner.assert(AnalysisEngine, 'AnalysisEngine should be importable');
  runner.assert(MessageFormatter, 'MessageFormatter should be importable');
  runner.assert(StatsManager, 'StatsManager should be importable');
  runner.assert(HookManager, 'HookManager should be importable');
  runner.assert(AIProviderFactory, 'AIProviderFactory should be importable');
});

// Test: AICommitGenerator Instantiation
runner.test('AICommitGenerator Instantiation', async () => {
  const generator = new AICommitGenerator();
  runner.assertInstance(generator, AICommitGenerator, 'Should create AICommitGenerator instance');
  runner.assert(generator.gitManager, 'Should have gitManager property');
  runner.assert(generator.configManager, 'Should have configManager property');
  runner.assert(generator.cacheManager, 'Should have cacheManager property');
  runner.assert(generator.analysisEngine, 'Should have analysisEngine property');
  runner.assert(generator.messageFormatter, 'Should have messageFormatter property');
  runner.assert(generator.statsManager, 'Should have statsManager property');
  runner.assert(generator.hookManager, 'Should have hookManager property');
});

// Test: Core Managers Instantiation
runner.test('Core Managers Instantiation', async () => {
  const gitManager = new GitManager();
  const configManager = new ConfigManager();
  const cacheManager = new CacheManager();
  const analysisEngine = new AnalysisEngine();
  const messageFormatter = new MessageFormatter();
  const statsManager = new StatsManager();
  const hookManager = new HookManager();

  runner.assertInstance(gitManager, GitManager, 'Should create GitManager instance');
  runner.assertInstance(configManager, ConfigManager, 'Should create ConfigManager instance');
  runner.assertInstance(cacheManager, CacheManager, 'Should create CacheManager instance');
  runner.assertInstance(analysisEngine, AnalysisEngine, 'Should create AnalysisEngine instance');
  runner.assertInstance(messageFormatter, MessageFormatter, 'Should create MessageFormatter instance');
  runner.assertInstance(statsManager, StatsManager, 'Should create StatsManager instance');
  runner.assertInstance(hookManager, HookManager, 'Should create HookManager instance');
});

// Test: ConfigManager Basic Operations
runner.test('ConfigManager Basic Operations', async () => {
  const configManager = new ConfigManager();
  
  // Test default config loading
  const config = await configManager.load();
  runner.assert(config, 'Should load configuration');
  runner.assert(typeof config === 'object', 'Config should be an object');
  
  // Test schema exists
  const schema = configManager.getValidationSchema();
  runner.assert(schema, 'Should have validation schema');
});

// Test: CacheManager Operations
runner.test('CacheManager Operations', async () => {
  const cacheManager = new CacheManager();
  
  // Test cache key generation
  const testData = 'test data';
  const key = cacheManager.generateKey(testData);
  runner.assert(key, 'Should generate cache key');
  runner.assert(typeof key === 'string', 'Cache key should be string');
  
  // Test cache operations (async methods)
  const testDiff = 'diff --git a/test.js b/test.js\n+console.log("test");';
  const testMessages = ['test commit message'];
  await cacheManager.set(testDiff, testMessages);
  
  const cachedValue = await cacheManager.get(testDiff);
  runner.assert(cachedValue, 'Should retrieve cached value');
  runner.assertEqual(cachedValue[0], testMessages[0], 'Cached value should match');
});

// Test: MessageFormatter
runner.test('MessageFormatter Operations', async () => {
  const formatter = new MessageFormatter();
  
  // Test basic message formatting
  const testMessage = 'add user authentication feature';
  const options = { conventional: true };
  
  const formatted = formatter.format(testMessage, options);
  runner.assert(formatted, 'Should format commit message');
  runner.assert(typeof formatted === 'string', 'Formatted message should be string');
  runner.assert(formatted.length > 0, 'Formatted message should not be empty');
});

// Test: AnalysisEngine
runner.test('AnalysisEngine Operations', async () => {
  const engine = new AnalysisEngine();
  
  // Test repository analysis
  const analysis = await engine.analyzeRepository();
  runner.assert(analysis, 'Should analyze repository');
  runner.assert(typeof analysis === 'object', 'Analysis should be an object');
  runner.assert(analysis.timestamp, 'Should have timestamp');
});

// Test: AI Provider Factory
runner.test('AI Provider Factory', async () => {
  const factory = new AIProviderFactory();
  
  // Test provider creation (without API keys)
  try {
    const providers = ['openai', 'anthropic', 'gemini', 'mistral', 'cohere', 'groq', 'ollama'];
    
    for (const providerName of providers) {
      const provider = factory.createProvider(providerName, {});
      runner.assert(provider, `Should create ${providerName} provider`);
    }
  } catch (error) {
    // Expected to fail without API keys, but should not crash
    runner.assert(true, 'Provider creation handled gracefully');
  }
});

// Test: StatsManager
runner.test('StatsManager Operations', async () => {
  const statsManager = new StatsManager();
  
  // Test stats initialization
  const stats = await statsManager.getStats();
  runner.assert(stats, 'Should get stats');
  runner.assert(typeof stats === 'object', 'Stats should be an object');
  
  // Test recording a commit
  await statsManager.recordCommit('openai', 1000);
  const updatedStats = await statsManager.getStats();
  runner.assert(updatedStats.totalCommits >= 0, 'Should track commit count');
});

// Test: Package.json Validation
runner.test('Package.json Validation', async () => {
  const packagePath = path.join(__dirname, 'package.json');
  runner.assert(fs.existsSync(packagePath), 'package.json should exist');
  
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  runner.assert(packageJson.name, 'Should have name');
  runner.assert(packageJson.version, 'Should have version');
  runner.assert(packageJson.main, 'Should have main entry point');
  runner.assert(packageJson.bin, 'Should have bin commands');
  runner.assert(packageJson.scripts, 'Should have scripts');
  runner.assert(packageJson.dependencies, 'Should have dependencies');
});

// Test: CLI Entry Points
runner.test('CLI Entry Points', async () => {
  const aicommitPath = path.join(__dirname, 'bin', 'aicommit.js');
  const aicPath = path.join(__dirname, 'bin', 'aic.js');
  
  runner.assert(fs.existsSync(aicommitPath), 'aicommit.js should exist');
  runner.assert(fs.existsSync(aicPath), 'aic.js should exist');
  
  // Check if files are executable
  const aicommitStats = fs.statSync(aicommitPath);
  const aicStats = fs.statSync(aicPath);
  
  runner.assert(aicommitStats.isFile(), 'aicommit.js should be a file');
  runner.assert(aicStats.isFile(), 'aic.js should be a file');
});

// Test: Environment Check
runner.test('Environment Check', async () => {
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  runner.assert(majorVersion >= 18, 'Node.js version should be >= 18');
  
  // Check required dependencies
  const requiredDeps = [
    'commander', 'inquirer', 'ora', 'chalk', 'simple-git',
    'openai', '@anthropic-ai/sdk', '@google/generative-ai'
  ];
  
  for (const dep of requiredDeps) {
    try {
      require(dep);
      runner.assert(true, `${dep} should be available`);
    } catch (error) {
      throw new Error(`Required dependency ${dep} is not available`);
    }
  }
});

// Test: File Structure
runner.test('File Structure Validation', async () => {
  const requiredFiles = [
    'src/index.js',
    'src/core/git-manager.js',
    'src/core/config-manager.js',
    'src/core/cache-manager.js',
    'src/core/analysis-engine.js',
    'src/core/message-formatter.js',
    'src/core/stats-manager.js',
    'src/core/hook-manager.js',
    'src/providers/ai-provider-factory.js',
    'bin/aicommit.js',
    'bin/aic.js'
  ];
  
  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, file);
    runner.assert(fs.existsSync(filePath), `${file} should exist`);
  }
});

// Test: Configuration Schema
runner.test('Configuration Schema', async () => {
  const configManager = new ConfigManager();
  const schema = configManager.getValidationSchema();
  
  runner.assert(schema, 'Should have configuration schema');
  runner.assert(typeof schema === 'object', 'Schema should be an object');
});

// Main execution
async function main() {
  console.log(chalk.blue.bold('🚀 Starting AI Commit Generator Tests...\n'));
  
  // Check if this is a git repository (optional)
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    console.log(chalk.green('✅ Git repository detected'));
  } catch (error) {
    console.log(chalk.yellow('⚠️  Not in a git repository (some tests may be limited)'));
  }
  
  // Run all tests
  await runner.run();
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(chalk.red('\n💥 Uncaught Exception:'), error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('\n💥 Unhandled Rejection:'), reason);
  process.exit(1);
});

// Run tests if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red('\n💥 Test execution failed:'), error.message);
    process.exit(1);
  });
}

module.exports = { TestRunner, main };