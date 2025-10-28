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
  .action(async (message, options) => {
    try {
      const autoGit = new AutoGit();

      if (options.dryRun) {
        console.log(
          chalk.cyan('🔍 Dry run mode - showing what would be done:\n')
        );
        console.log('1. Check git repository');
        console.log('2. Stage all changes');
        const steps = [];
        steps.push('1. Check git repository');
        steps.push('2. Stage all changes');

        if (options.lint !== false) {
          steps.push('3. Run syntax linting');
          if (options.lintFix !== false)
            steps.push('4. Auto-fix linting errors');
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
          if (!options.skipPull)
            steps.push(
              options.lintFix !== false
                ? '7. Pull latest changes'
                : '6. Pull latest changes'
            );
          steps.push(
            options.lintFix !== false
              ? '8. Auto-resolve conflicts if possible'
              : '7. Auto-resolve conflicts if possible'
          );
          if (options.push !== false)
            steps.push(
              options.lintFix !== false ? '9. Push changes' : '8. Push changes'
            );
        } else {
          steps.push('3. Generate AI commit message (or use provided)');
          steps.push('4. Commit changes');
          if (!options.skipPull) steps.push('5. Pull latest changes');
          steps.push('6. Auto-resolve conflicts if possible');
          if (options.push !== false) steps.push('7. Push changes');
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
      const generator = new AICommitGenerator();
      await generator.config(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Status command - show git and AI status
program
  .command('status')
  .alias('st')
  .description('Show git and AI configuration status')
  .action(async () => {
    try {
      const simpleGit = require('simple-git');
      const git = simpleGit();
      const generator = new AICommitGenerator();

      console.log(chalk.cyan('📊 AIC Status\n'));

      // Git status
      try {
        const isRepo = await git.checkIsRepo();
        if (isRepo) {
          const status = await git.status();
          const branch = await git.branch();
          const remotes = await git.getRemotes();

          console.log(chalk.green('✅ Git Repository'));
          console.log(`   Branch: ${branch.current}`);
          console.log(
            `   Remote: ${remotes.length > 0 ? remotes[0].name : 'none'}`
          );
          console.log(`   Changes: ${status.files.length} files`);

          if (status.files.length > 0) {
            console.log(chalk.yellow('   Pending changes:'));
            status.files.slice(0, 5).forEach((file) => {
              console.log(
                chalk.dim(`     ${file.working_dir}${file.index} ${file.path}`)
              );
            });
            if (status.files.length > 5) {
              console.log(
                chalk.dim(`     ... and ${status.files.length - 5} more`)
              );
            }
          }
        } else {
          console.log(chalk.red('❌ Not a git repository'));
        }
      } catch (error) {
        console.log(chalk.red('❌ Git error:'), error.message);
      }

      console.log();

      // AI Configuration status
      try {
        const config = await generator.configManager.load();
        console.log(chalk.green('✅ AI Configuration'));
        console.log(`   Provider: ${config.defaultProvider}`);
        console.log(
          `   API Key: ${config.apiKey ? '***configured***' : 'not set'}`
        );
        console.log(
          `   Format: ${config.conventionalCommits ? 'conventional' : 'free-form'}`
        );
        console.log(`   Language: ${config.language}`);

        if (!config.apiKey && config.defaultProvider !== 'ollama') {
          console.log(
            chalk.yellow(
              '\n⚠️  AI provider not configured. Run "aic setup" to configure.'
            )
          );
        }
      } catch (error) {
        console.log(chalk.red('❌ AI config error:'), error.message);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Models command - show available models
program
  .command('models')
  .alias('m')
  .description('Show available AI models')
  .option('--provider <provider>', 'Show models for specific provider')
  .option('--refresh', 'Force refresh model cache')
  .action(async (options) => {
    try {
      const AIProviderFactory = require('../src/providers/ai-provider-factory.js');
      const generator = new AICommitGenerator();
      const config = await generator.configManager.load();

      console.log(chalk.cyan('🤖 Available AI Models\n'));

      if (options.provider) {
        // Show models for specific provider
        console.log(chalk.blue(`📋 ${options.provider.toUpperCase()} Models:`));
        try {
          const providerConfig = { apiKey: config.apiKey };
          const models = await AIProviderFactory.getProviderModels(
            options.provider,
            providerConfig
          );

          if (models.length === 0) {
            console.log(
              chalk.yellow('   No models available or provider not configured')
            );
          } else {
            models.forEach((model) => {
              const status = model.available
                ? chalk.green('✅')
                : chalk.red('❌');
              const recommended = model.recommended ? chalk.yellow('⭐') : '  ';
              console.log(
                `   ${status} ${recommended} ${model.name || model.id}`
              );
              if (model.description) {
                console.log(chalk.dim(`      ${model.description}`));
              }
            });
          }
        } catch (error) {
          console.log(chalk.red(`   Error: ${error.message}`));
        }
        return; // Exit early for specific provider
      } else {
        // Show all providers and their models
        const allConfigs = {
          openai: { apiKey: config.apiKey },
          anthropic: { apiKey: config.apiKey },
          gemini: { apiKey: config.apiKey },
          mistral: { apiKey: config.apiKey },
          cohere: { apiKey: config.apiKey },
          groq: { apiKey: config.apiKey },
          ollama: {},
        };

        const allModels =
          await AIProviderFactory.getAllAvailableModels(allConfigs);

        for (const [providerName, providerData] of Object.entries(allModels)) {
          const status = providerData.available
            ? chalk.green('✅')
            : chalk.red('❌');
          console.log(`${status} ${chalk.blue(providerData.displayName)}`);

          if (providerData.models && providerData.models.length > 0) {
            providerData.models.slice(0, 3).forEach((model) => {
              const recommended = model.recommended ? chalk.yellow('⭐') : '  ';
              const available =
                model.available !== false ? chalk.green('✓') : chalk.red('✗');
              console.log(
                `   ${available} ${recommended} ${model.name || model.id}`
              );
            });
            if (providerData.models.length > 3) {
              console.log(
                chalk.dim(`   ... and ${providerData.models.length - 3} more`)
              );
            }
          } else {
            console.log(chalk.dim('   No models available'));
          }
          console.log();
        }

        // Show recommendation
        try {
          const bestOption =
            await AIProviderFactory.getBestAvailableModel(allConfigs);
          if (bestOption) {
            console.log(chalk.green('💡 Recommended:'));
            console.log(
              `   ${bestOption.model.name} from ${bestOption.providerInfo.displayName}`
            );
            console.log(
              chalk.dim(`   Reason: ${bestOption.model.description}`)
            );
          }
        } catch (error) {
          console.log(chalk.yellow('⚠️  No providers configured'));
        }
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Format command
program
  .command('format')
  .alias('fmt')
  .description('Format code with multi-language support')
  .option('--setup', 'Setup formatter configuration files')
  .option('--check', 'Check available formatters')
  .action(async function (options) {
    try {
      const CodeFormatter = require('../src/core/code-formatter');
      const formatter = new CodeFormatter();

      if (options.setup) {
        console.log(chalk.cyan('🔧 Setting up formatter configurations...'));
        const configs = await formatter.setupFormatterConfigs();
        console.log(chalk.green('✅ Formatter configurations created:'));
        for (const tool in configs) {
          console.log(chalk.dim('   ' + tool + ': ' + configs[tool]));
        }
        return;
      }

      if (options.check) {
        console.log(chalk.cyan('🔍 Checking available formatters...'));
        const available = await formatter.checkAvailableFormatters();
        console.log(chalk.cyan('\n📋 Available Formatters:'));
        for (const tool in available) {
          const isAvailable = available[tool];
          const status = isAvailable ? chalk.green('✅') : chalk.red('❌');
          console.log('   ' + status + ' ' + tool);
        }
        return;
      }

      // Format files if provided
      const files = this.args;
      if (files && files.length > 0) {
        console.log(chalk.cyan(`🔧 Formatting ${files.length} files...`));
        const results = await formatter.formatFiles(files);
        const summary = formatter.generateSummary(results);

        console.log(chalk.cyan('\n📊 Formatting Summary:'));
        console.log(
          `   Total: ${summary.total} | Formatted: ${summary.formatted} | Failed: ${summary.failed}`
        );

        if (summary.failed > 0) {
          console.log(
            chalk.yellow('\n⚠️  Some files failed to format. Check logs above.')
          );
        }
        return;
      }

      console.log(
        chalk.yellow(
          'Please specify --setup, --check, or provide files to format'
        )
      );
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Lint command
program
  .command('lint')
  .description('Run syntax linting on staged files')
  .option(
    '--no-fix',
    'Disable auto-fixing of linting errors (default: enabled)'
  )
  .option('--files <files...>', 'Lint specific files instead of staged files')
  .option(
    '--type <type>',
    'Specify project type (wordpress, nodejs, frontend, jquery, python, java, go, rust, css, etc.)'
  )
  .action(async (options) => {
    try {
      const autoGit = new AutoGit();

      let files;
      if (options.files && options.files.length > 0) {
        files = options.files;
      } else {
        // Get staged files
        const status = await autoGit.git.status();
        files = [
          ...status.created,
          ...status.modified,
          ...status.renamed.map((f) => f.to),
        ];
      }

      if (files.length === 0) {
        console.log(chalk.yellow('No files to lint'));
        return;
      }

      console.log(chalk.cyan(`🔍 Linting ${files.length} file(s)...`));

      const results = await autoGit.lintManager.lintFiles(files, {
        autoFix: options.fix !== false,
        projectType: options.type,
      });

      autoGit.lintManager.printResults(results);

      if (!results.success) {
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Quick commands
program
  .command('quick')
  .alias('q')
  .description('Quick commit with default message')
  .argument('[type]', 'Commit type (feat, fix, docs, etc.)')
  .action(async (type) => {
    try {
      const autoGit = new AutoGit();
      const defaultMessage = type
        ? `${type}: quick update`
        : 'chore: quick update';

      await autoGit.run({
        manualMessage: defaultMessage,
        skipAI: true,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Help examples
program.on('--help', () => {
  console.log('');
  console.log(chalk.cyan('Examples:'));
  console.log(
    '  aic                    # Auto commit, pull, push with AI message'
  );
  console.log('  aic "fix: bug fix"     # Commit with specific message');
  console.log('  aic --dry-run          # See what would be done');
  console.log("  aic --no-push          # Commit and pull but don't push");
  console.log(
    '  aic --test-validate    # Run tests and auto-fix before committing'
  );
  console.log(
    '  aic --format-code      # Run advanced multi-language formatting'
  );
  console.log(
    '  aic --lint             # Run syntax linting before committing (default)'
  );
  console.log('  aic --no-lint          # Disable syntax linting');
  console.log(
    '  aic --no-lint-fix      # Disable auto-fixing of linting errors'
  );
  console.log('  aic format --check     # Check available formatters');
  console.log('  aic format --setup     # Setup formatter configurations');
  console.log('  aic setup              # Configure AI provider');
  console.log('  aic status             # Show git and AI status');
  console.log('  aic models             # Show available AI models');
  console.log('  aic models --provider openai  # Show OpenAI models');
  console.log(
    '  aic quick feat         # Quick commit with "feat: quick update"'
  );
  console.log(
    '  aic lint               # Lint staged files (auto-fix enabled by default)'
  );
  console.log('  aic lint --no-fix      # Lint without auto-fixing');
  console.log('  aic lint --files *.js  # Lint specific files');
  console.log('  aic lint --type jquery # Lint as jQuery project');
  console.log('  aic lint --type css   # Lint as CSS project');
  console.log('');
  console.log(chalk.cyan('Standard Workflow:'));
  console.log('  1. 🔍 Check repository and changes');
  console.log('  2. 📦 Stage all changes');
  console.log('  3. 🔍 Run syntax linting (CSS, JS, jQuery, PHP, etc.)');
  console.log('  4. 🔧 Auto-fix linting errors');
  console.log('  5. 🤖 Generate AI commit message');
  console.log('  6. 💾 Commit changes');
  console.log('  7. ⬇️  Pull latest changes');
  console.log('  8. 🔧 Auto-resolve conflicts');
  console.log('  9. ⬆️  Push changes');
  console.log('');
  console.log(chalk.cyan('With --test-validate:'));
  console.log('  1. 🔍 Check repository and changes');
  console.log('  2. 📦 Stage all changes');
  console.log('  3. 🔍 Run syntax linting');
  console.log('  4. 🔧 Auto-fix linting errors');
  console.log('  5. 🧪 Run tests and validation');
  console.log('  6. 🔧 Auto-fix any issues found');
  console.log('  7. 🤖 Generate AI commit message');
  console.log('  8. 💾 Commit changes (original + fixed version)');
  console.log('  9. ⬇️  Pull latest changes');
  console.log('  10. 🔧 Auto-resolve conflicts');
  console.log('  11. ⬆️  Push changes');
  console.log('');
  console.log(chalk.cyan('With --no-lint-fix:'));
  console.log('  1. 🔍 Check repository and changes');
  console.log('  2. 📦 Stage all changes');
  console.log('  3. 🔍 Run syntax linting (no auto-fix)');
  console.log('  4. 🤖 Generate AI commit message');
  console.log('  5. 💾 Commit changes');
  console.log('  6. ⬇️  Pull latest changes');
  console.log('  7. 🔧 Auto-resolve conflicts');
  console.log('  8. ⬆️  Push changes');
  console.log('');
});

// Parse command line arguments
program.parse();
