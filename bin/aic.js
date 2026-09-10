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
const ConfigManager = require('../src/core/config-manager');
const GitManager = require('../src/core/git-manager');
const CacheManager = require('../src/core/cache-manager');
const AnalysisEngine = require('../src/core/analysis-engine');
const MessageFormatter = require('../src/core/message-formatter');
const MessageRanker = require('../src/core/message-ranker');
const MessageValidator = require('../src/core/message-validator');
const StatsManager = require('../src/core/stats-manager');
const HookManager = require('../src/core/hook-manager');
const ActivityLogger = require('../src/core/activity-logger');
const MetricsScorer = require('../src/utils/metrics-scorer');
const DiffShaper = require('../src/core/diff-shaper');
const EfficientPromptBuilder = require('../src/utils/efficient-prompt-builder');
const GenerationPipeline = require('../src/core/generation-pipeline');
const ConflictResolver = require('../src/core/conflict-resolver');
const CLIPresenter = require('../src/cli-presenter');

// Composition root: every collaborator is built once and injected everywhere.
const buildGenerator = () => {
  const configManager = new ConfigManager();
  const activityLogger = new ActivityLogger();
  // --verbose (or AIC_VERBOSE=1) mirrors info/debug logs to the console.
  // Default is quiet: telemetry goes to the log file only.
  if (program.opts().verbose || process.env.AIC_VERBOSE === '1') {
    activityLogger.setVerbose(true);
  }
  const gitManager = new GitManager();
  const cacheManager = new CacheManager();
  const analysisEngine = new AnalysisEngine();
  const messageFormatter = new MessageFormatter();
  const messageRanker = new MessageRanker();
  const messageValidator = new MessageValidator();
  const statsManager = new StatsManager();
  const hookManager = new HookManager();
  const diffShaper = new DiffShaper();
  const metricsScorer = new MetricsScorer();

  const generationPipeline = new GenerationPipeline({
    diffShaper,
    promptBuilder: new EfficientPromptBuilder({ diffShaper }),
    messageRanker,
    messageValidator,
    activityLogger,
    statsManager,
    configManager,
  });

  const conflictResolver = new ConflictResolver({
    configManager,
    gitManager,
    activityLogger,
  });

  const cliPresenter = new CLIPresenter({
    configManager,
    statsManager,
    activityLogger,
    hookManager,
    metricsScorer,
  });

  const generator = new AICommitGenerator({
    gitManager,
    configManager,
    cacheManager,
    analysisEngine,
    messageFormatter,
    statsManager,
    hookManager,
    activityLogger,
    diffShaper,
    messageRanker,
    messageValidator,
    metricsScorer,
    generationPipeline,
    conflictResolver,
    cliPresenter,
  });

  return { generator, gitManager, analysisEngine, configManager, activityLogger, generationPipeline, conflictResolver };
};

program
  .name('aic')
  .description('AI Commit - Super simple git workflow automation')
  .version(version, '-v, --version', 'display version number')
  .option('--verbose', 'Show detailed logs on the console (default: log file only)');

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
  .option('--skip-syntax-check', 'Skip syntax checking of staged .js files')
  .action(async (message, options) => {
    try {
      const { gitManager, analysisEngine, configManager, activityLogger, generationPipeline, conflictResolver } = buildGenerator();
      const autoGit = new (require('../src/auto-git'))({
        gitManager,
        analysisEngine,
        configManager,
        generateMessages: (diff, opts) => generationPipeline.generate(diff, opts),
        conflictResolver,
        activityLogger,
      });
      await autoGit.run({ ...options, manualMessage: message || null });
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('generate')
  .description('Generate AI commit message for staged changes (interactive selection)')
  .option('-p, --provider <provider>', 'AI provider to use (groq, ollama)')
  .option('-c, --count <number>', 'Number of messages to generate', '3')
  .option('--conventional', 'Use conventional commit format')
  .option('--dry-run', 'Print messages without committing')
  .action(async (options) => {
    try {
      const { generator } = buildGenerator();
      await generator.generate({
        ...options,
        count: parseInt(options.count) || 3,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Show configuration')
  .option('--list', 'List all configuration values')
  .option('--get <key>', 'Get a specific configuration value (supports dot notation)')
  .option('--set <key=value>', 'Set a configuration value')
  .option('--reset', 'Reset configuration to defaults')
  .action(async (options) => {
    try {
      const { generator } = buildGenerator();
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
      const { generator } = buildGenerator();
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
      const { generator } = buildGenerator();
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
  .option('--reset', 'Reset statistics')
  .option('--days <number>', 'Number of days to analyze/export', '30')
  .option('--format <format>', 'Export format (json or text)', 'json')
  .action(async (options) => {
    try {
      const { generator } = buildGenerator();
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
