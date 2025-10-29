#!/usr/bin/env node

/**
 * AIC (AI Commit) - Super simple git workflow automation
 *
 * Usage:
 *   aic           - Auto commit, pull, resolve conflicts, push
 *   aic setup     - Setup AI provider
 *   aic config    - Show configuration
 *   aic --help    - Show help
 */

const { program } = require('commander');
const chalk = require('chalk');
const { version } = require('../package.json');
const AutoGit = require('../src/auto-git.js');
const AICommitGenerator = require('../src/index.js');

// Configure the CLI program
program
  .name('aic')
  .description('AI Commit - Super simple git workflow automation')
  .version(version, '-v, --version', 'display version number');

// Main command (default) - Auto git workflow
program
  .argument('[message]', 'Optional commit message (skips AI generation)')
  .option('-f, --force', 'Force run even if no changes detected')
  .option('-p, --provider <provider>', 'AI provider to use')
  .option('-s, --skip-pull', 'Skip pulling before push')
  .option('-n, --no-push', "Don't push after commit")
  .option('--dry-run', 'Show what would be done without executing')
  .option('--test-validate', 'Run tests and auto-fix errors before committing')
  .option('--no-auto-fix', 'Disable automatic error fixing')
  .option('--format-code', 'Run advanced multi-language code formatting')
  .option('--no-format', 'Disable code formatting')
  .option('--lint', 'Run syntax linting before committing (default: enabled)')
  .option('--no-lint', 'Disable syntax linting')
  .option(
    '--no-lint-fix',
    'Disable auto-fixing of linting errors (default: enabled)'
  )
  .option(
    '--ai-lint',
    'Use AI to fix unfixable linting errors (default: enabled)'
  )
  .option('--no-ai-lint', 'Disable AI linting fixes')
  .action(async (message, options) => {
    try {
      const autoGit = new AutoGit();

      if (options.dryRun) {
        console.log(
          chalk.cyan('🔍 Dry run mode - showing what would be done:\n')
        );
        const steps = [];
        steps.push('1. Check git repository');
        steps.push('2. Stage all changes');

        if (options.lint !== false) {
          steps.push('3. Run syntax linting');
          if (options.lintFix !== false) {
            steps.push('4. Auto-fix linting errors');
          }
          steps.push(
            options.lintFix !== false
              ? '5. Generate AI commit message (or use provided)'
              : '4. Generate AI commit message (or use provided)'
          );
          steps.push(
            options.lintFix !== false
              ? '6. Commit changes'
              : '5. Commit changes'
          );
          if (!options.skipPull) {
            steps.push(
              options.lintFix !== false
                ? '7. Pull latest changes'
                : '6. Pull latest changes'
            );
          }
          steps.push(
            options.lintFix !== false
              ? '8. Auto-resolve conflicts if possible'
              : '7. Auto-resolve conflicts if possible'
          );
          if (options.push !== false) {
            steps.push(
              options.lintFix !== false ? '9. Push changes' : '8. Push changes'
            );
          }
        } else {
          steps.push('3. Generate AI commit message (or use provided)');
          steps.push('4. Commit changes');
          if (!options.skipPull) {
            steps.push('5. Pull latest changes');
          }
          steps.push('6. Auto-resolve conflicts if possible');
          if (options.push !== false) {
            steps.push('7. Push changes');
          }
        }

        if (options.testValidate) {
          const testStepIndex = steps.findIndex((s) =>
            s.includes('Generate AI commit message')
          );
          steps.splice(
            testStepIndex,
            0,
            'Run tests and validation',
            'Auto-fix any issues found'
          );
        }

        steps.forEach((step) => console.log(step));
        return;
      }

      // If message provided, skip AI generation
      if (message) {
        options.manualMessage = message;
      }

      await autoGit.run(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Setup command
program
  .command('setup')
  .description('Setup AI provider configuration')
  .action(async () => {
    try {
      const generator = new AICommitGenerator();
      await generator.setup();
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Show current configuration')
  .option('--set <key=value>', 'Set a configuration value')
  .option('--get <key>', 'Get a configuration value')
  .option('--reset', 'Reset configuration to defaults')
  .action(async (options) => {
    try {
      // Implement config command logic here
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);
