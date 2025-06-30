#!/usr/bin/env node

/**
 * Quick Test Script for AI Commit Generator
 * 
 * This is a minimal test script that quickly validates the core functionality.
 * Run with: node test-quick.js
 */

const chalk = require('chalk');

console.log(chalk.blue.bold('🚀 Quick Test - AI Commit Generator\n'));

async function quickTest() {
  let passed = 0;
  let failed = 0;

  function test(name, testFn) {
    try {
      testFn();
      console.log(chalk.green(`✅ ${name}`));
      passed++;
    } catch (error) {
      console.log(chalk.red(`❌ ${name}: ${error.message}`));
      failed++;
    }
  }

  async function asyncTest(name, testFn) {
    try {
      await testFn();
      console.log(chalk.green(`✅ ${name}`));
      passed++;
    } catch (error) {
      console.log(chalk.red(`❌ ${name}: ${error.message}`));
      failed++;
    }
  }

  // Test 1: Basic imports
  test('Module imports', () => {
    const AICommitGenerator = require('./src/index.js');
    if (!AICommitGenerator) throw new Error('Failed to import main module');
  });

  // Test 2: Instantiation
  test('Class instantiation', () => {
    const AICommitGenerator = require('./src/index.js');
    const generator = new AICommitGenerator();
    if (!generator) throw new Error('Failed to instantiate generator');
  });

  // Test 3: Configuration
  await asyncTest('Configuration loading', async () => {
    const ConfigManager = require('./src/core/config-manager.js');
    const configManager = new ConfigManager();
    const config = await configManager.load();
    if (!config || typeof config !== 'object') throw new Error('Failed to load config');
  });

  // Test 4: Cache operations
  await asyncTest('Cache operations', async () => {
    const CacheManager = require('./src/core/cache-manager.js');
    const cacheManager = new CacheManager();
    const key = cacheManager.generateKey('test');
    if (!key) throw new Error('Failed to generate cache key');
  });

  // Test 5: Stats
  await asyncTest('Statistics tracking', async () => {
    const StatsManager = require('./src/core/stats-manager.js');
    const statsManager = new StatsManager();
    const stats = await statsManager.getStats();
    if (!stats || typeof stats !== 'object') throw new Error('Failed to get stats');
  });

  // Test 6: Message formatting
  test('Message formatting', () => {
    const MessageFormatter = require('./src/core/message-formatter.js');
    const formatter = new MessageFormatter();
    const formatted = formatter.format('test message', {});
    if (!formatted) throw new Error('Failed to format message');
  });

  // Test 7: Package.json validation
  test('Package.json validation', () => {
    const fs = require('fs');
    const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    if (!packageJson.name || !packageJson.version) throw new Error('Invalid package.json');
  });

  // Summary
  console.log(chalk.gray('\n' + '='.repeat(40)));
  console.log(chalk.blue.bold('📊 Quick Test Results:'));
  console.log(chalk.green(`✅ Passed: ${passed}`));
  console.log(chalk.red(`❌ Failed: ${failed}`));
  
  if (failed === 0) {
    console.log(chalk.green.bold('\n🎉 All quick tests passed! The AI commit generator is ready to use.'));
    console.log(chalk.yellow('\nTo run comprehensive tests:'));
    console.log(chalk.gray('  npm run test:simple  # Simple test suite'));
    console.log(chalk.gray('  npm test             # Full Jest test suite'));
  } else {
    console.log(chalk.red.bold('\n💥 Some tests failed. Please check the installation.'));
    process.exit(1);
  }
}

quickTest().catch(error => {
  console.error(chalk.red('\n💥 Quick test failed:'), error.message);
  process.exit(1);
});