#!/usr/bin/env node

/**
 * AIC (AI Commit) - Super simple git workflow automation
 *
 * Usage:
 *   aic           - Auto commit, pull, resolve conflicts, push
 *   aic setup     - Setup AI provider
 *   aic config    - Show configuration
 *   aic stats     - Show usage statistics and activity analysis
 *   aic --help    - Show help
 */

const { program } = require('commander');
const chalk = require('chalk');
const { version } = require('../package.json');
const AutoGit = require('../src/auto-git.js');
const AICommitGenerator = require('../src/index.js');

// Configure CLI program
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
        steps.push('3. Generate AI commit message (or use provided)');
        steps.push('4. Commit changes');
        
        if (!options.skipPull) {
          steps.push('5. Pull latest changes');
        }
        
        steps.push('6. Auto-resolve conflicts if possible');
        
        if (options.push !== false) {
          steps.push('7. Push changes');
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

// Stats command
program
  .command('stats')
  .description('Show usage statistics and activity analysis')
  .option('--analyze', 'Analyze recent activity logs')
  .option('--export', 'Export activity logs')
  .option('--format <format>', 'Export format (json|csv)', 'json')
  .option('--days <days>', 'Number of days to analyze', '30')
  .option('--reset', 'Reset all statistics')
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
program.parse(process.argv);