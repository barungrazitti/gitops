#!/usr/bin/env node

/**
 * AI Commit Message Generator CLI Entry Point
 */

const { program } = require('commander');
const chalk = require('chalk');
const { version } = require('../package.json');
const AICommitGenerator = require('../src/index.js');

// Configure the CLI program
program
  .name('aicommit')
  .description('AI-powered commit message generator')
  .version(version, '-v, --version', 'display version number');

// Main generate command
program
  .command('generate', { isDefault: true })
  .alias('gen')
  .description('Generate AI commit messages for staged changes')
  .option('-p, --provider <provider>', 'AI provider to use (openai, anthropic, gemini, etc.)')
  .option('-m, --model <model>', 'Specific model to use')
  .option('-c, --count <number>', 'Number of commit messages to generate', '3')
  .option('-t, --type <type>', 'Commit type (conventional commits)')
  .option('-l, --language <lang>', 'Language for commit messages', 'en')
  .option('--no-cache', 'Disable caching')
  .option('--dry-run', 'Show what would be committed without making changes')
  .option('--conventional', 'Force conventional commit format')
  .action(async (options) => {
    try {
      const generator = new AICommitGenerator();
      await generator.generate(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Configuration commands
program
  .command('config')
  .description('Manage configuration settings')
  .option('--set <key=value>', 'Set a configuration value')
  .option('--get <key>', 'Get a configuration value')
  .option('--list', 'List all configuration values')
  .option('--reset', 'Reset configuration to defaults')
  .action(async (options) => {
    try {
      const generator = new AICommitGenerator();
      await generator.config(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Setup command for initial configuration
program
  .command('setup')
  .description('Interactive setup wizard')
  .action(async () => {
    try {
      const generator = new AICommitGenerator();
      await generator.setup();
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Hook installation command
program
  .command('hook')
  .description('Install/uninstall git hooks')
  .option('--install', 'Install prepare-commit-msg hook')
  .option('--uninstall', 'Uninstall prepare-commit-msg hook')
  .action(async (options) => {
    try {
      const generator = new AICommitGenerator();
      await generator.hook(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Statistics command
program
  .command('stats')
  .description('Show usage statistics')
  .option('--reset', 'Reset statistics')
  .action(async (options) => {
    try {
      const generator = new AICommitGenerator();
      await generator.stats(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();