#!/usr/bin/env node

/**
 * AI Commit Message Generator CLI Entry Point
 */

const { program } = require('commander');
const chalk = require('chalk');
const { version } = require('../package.json');
const AICommitGenerator = require('../src/index.js');

// --- Action Handlers ---

async function handleGenerate(options) {
  try {
    const generator = new AICommitGenerator();
    await generator.generate(options);
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

async function handleConfig(options) {
  try {
    const generator = new AICommitGenerator();
    await generator.config(options);
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

async function handleSetup() {
  try {
    const generator = new AICommitGenerator();
    await generator.setup();
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

async function handleHook(options) {
  try {
    const generator = new AICommitGenerator();
    await generator.hook(options);
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

async function handleStats(options) {
  try {
    const generator = new AICommitGenerator();
    await generator.stats(options);
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}


// --- CLI Configuration ---

program
  .name('aicommit')
  .description('AI-powered commit message generator')
  .version(version, '-v, --version', 'display version number');

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
  .action(handleGenerate);

program
  .command('config')
  .description('Manage configuration settings')
  .option('--set <key=value>', 'Set a configuration value')
  .option('--get <key>', 'Get a configuration value')
  .option('--list', 'List all configuration values')
  .option('--reset', 'Reset configuration to defaults')
  .action(handleConfig);

program
  .command('setup')
  .description('Interactive setup wizard')
  .action(handleSetup);

program
  .command('hook')
  .description('Install/uninstall git hooks')
  .option('--install', 'Install prepare-commit-msg hook')
  .option('--uninstall', 'Uninstall prepare-commit-msg hook')
  .action(handleHook);

program
  .command('stats')
  .description('Show usage statistics')
  .option('--reset', 'Reset statistics')
  .action(handleStats);

// --- Main Execution ---

const main = () => {
  program.parse(process.argv);
};

if (require.main === module) {
  main();
}

module.exports = {
  program,
  handleGenerate,
  handleConfig,
  handleSetup,
  handleHook,
  handleStats,
};