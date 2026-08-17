#!/usr/bin/env node
/**
 * AIC (AI Commit) - Super simple git workflow automation
 *
 * Usage:
 *   aic           - Auto commit, pull, resolve conflicts, push
 *   aic generate  - Generate AI commit message (skips AI generation if message provided)
 *   aic setup     - Setup AI provider
 *   aic config    - Show configuration
 *   aic stats     - Show usage statistics and activity analysis
 *   aic --help    - Show help
 */

const { program } = require('commander');
const chalk = require('chalk');
const { version } = require('../package.json');
const AICommitGenerator = require('../src/index');

program
  .name('aic')
  .description('AI Commit - Super simple git workflow automation')
  .version(version, '-v, --version', 'display version number');

program
  .command('auto', { isDefault: true })
  .description('Auto commit, pull, resolve conflicts, push')
  .argument('[message]', 'Optional commit message (skips AI generation)')
  .option('-f, --force', 'Force run even if no changes detected')
  .option('-p, --provider <provider>', 'AI provider to use')
  .option('-s, --skip-pull', 'Skip pulling before push')
  .option('-n, --no-push', "Don't push after commit")
  .option('--dry-run', 'Show what would be done without executing')
  .option('--enterprise-mode', 'Block commits with ANY sensitive data (strict security)')
  .action(async (message, options) => {
    try {
      const generator = new AICommitGenerator();
      const autoGit = new (require('../src/auto-git'))({
        gitManager: generator.gitManager,
        analysisEngine: generator.analysisEngine,
        configManager: generator.configManager,
        generateMessages: (diff, options) => generator.generationPipeline.generate(diff, options),
        conflictResolver: generator.conflictResolver,
        activityLogger: generator.activityLogger,
      });
      await autoGit.run(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Show configuration')
  .option('--list', 'List all configuration values')
  .option('--set <key=value>', 'Set a configuration value')
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

program
  .command('stats')
  .description('Show usage statistics')
  .option('--analyze', 'Analyze recent activity')
  .option('--export', 'Export detailed logs to file')
  .action(async (options) => {
    try {
      const generator = new AICommitGenerator();
      await generator.stats(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('help')
  .description('display help')
  .action(() => program.help());

const main = () => {
  program.parse(process.argv);
};

if (require.main === module) {
  main();
}

module.exports = {
  program,
};
