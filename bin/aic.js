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
  .option('-n, --no-push', 'Don\'t push after commit')
  .option('--dry-run', 'Show what would be done without executing')
  .action(async (message, options) => {
    try {
      const autoGit = new AutoGit();
      
      if (options.dryRun) {
        console.log(chalk.cyan('🔍 Dry run mode - showing what would be done:\n'));
        console.log('1. Check git repository');
        console.log('2. Stage all changes');
        console.log('3. Generate AI commit message (or use provided)');
        console.log('4. Commit changes');
        if (!options.skipPull) console.log('5. Pull latest changes');
        console.log('6. Auto-resolve conflicts if possible');
        if (options.push !== false) console.log('7. Push changes');
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
          console.log(`   Remote: ${remotes.length > 0 ? remotes[0].name : 'none'}`);
          console.log(`   Changes: ${status.files.length} files`);
          
          if (status.files.length > 0) {
            console.log(chalk.yellow('   Pending changes:'));
            status.files.slice(0, 5).forEach(file => {
              console.log(chalk.dim(`     ${file.working_dir}${file.index} ${file.path}`));
            });
            if (status.files.length > 5) {
              console.log(chalk.dim(`     ... and ${status.files.length - 5} more`));
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
        console.log(`   API Key: ${config.apiKey ? '***configured***' : 'not set'}`);
        console.log(`   Format: ${config.conventionalCommits ? 'conventional' : 'free-form'}`);
        console.log(`   Language: ${config.language}`);
        
        if (!config.apiKey && config.defaultProvider !== 'ollama') {
          console.log(chalk.yellow('\n⚠️  AI provider not configured. Run "aic setup" to configure.'));
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
          const models = await AIProviderFactory.getProviderModels(options.provider, providerConfig);
          
          if (models.length === 0) {
            console.log(chalk.yellow('   No models available or provider not configured'));
          } else {
            models.forEach(model => {
              const status = model.available ? chalk.green('✅') : chalk.red('❌');
              const recommended = model.recommended ? chalk.yellow('⭐') : '  ';
              console.log(`   ${status} ${recommended} ${model.name || model.id}`);
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
          ollama: {}
        };
        
        const allModels = await AIProviderFactory.getAllAvailableModels(allConfigs);
        
        for (const [providerName, providerData] of Object.entries(allModels)) {
          const status = providerData.available ? chalk.green('✅') : chalk.red('❌');
          console.log(`${status} ${chalk.blue(providerData.displayName)}`);
          
          if (providerData.models && providerData.models.length > 0) {
            providerData.models.slice(0, 3).forEach(model => {
              const recommended = model.recommended ? chalk.yellow('⭐') : '  ';
              const available = model.available !== false ? chalk.green('✓') : chalk.red('✗');
              console.log(`   ${available} ${recommended} ${model.name || model.id}`);
            });
            if (providerData.models.length > 3) {
              console.log(chalk.dim(`   ... and ${providerData.models.length - 3} more`));
            }
          } else {
            console.log(chalk.dim('   No models available'));
          }
          console.log();
        }
        
        // Show recommendation
        try {
          const bestOption = await AIProviderFactory.getBestAvailableModel(allConfigs);
          if (bestOption) {
            console.log(chalk.green('💡 Recommended:'));
            console.log(`   ${bestOption.model.name} from ${bestOption.providerInfo.displayName}`);
            console.log(chalk.dim(`   Reason: ${bestOption.model.description}`));
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

// Quick commands
program
  .command('quick')
  .alias('q')
  .description('Quick commit with default message')
  .argument('[type]', 'Commit type (feat, fix, docs, etc.)')
  .action(async (type) => {
    try {
      const autoGit = new AutoGit();
      const defaultMessage = type ? `${type}: quick update` : 'chore: quick update';
      
      await autoGit.run({ 
        manualMessage: defaultMessage,
        skipAI: true 
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
  console.log('  aic                    # Auto commit, pull, push with AI message');
  console.log('  aic "fix: bug fix"     # Commit with specific message');
  console.log('  aic --dry-run          # See what would be done');
  console.log('  aic --no-push          # Commit and pull but don\'t push');
  console.log('  aic setup              # Configure AI provider');
  console.log('  aic status             # Show git and AI status');
  console.log('  aic models             # Show available AI models');
  console.log('  aic models --provider openai  # Show OpenAI models');
  console.log('  aic quick feat         # Quick commit with "feat: quick update"');
  console.log('');
  console.log(chalk.cyan('Workflow:'));
  console.log('  1. 🔍 Check repository and changes');
  console.log('  2. 📦 Stage all changes');
  console.log('  3. 🤖 Generate AI commit message');
  console.log('  4. 💾 Commit changes');
  console.log('  5. ⬇️  Pull latest changes');
  console.log('  6. 🔧 Auto-resolve conflicts');
  console.log('  7. ⬆️  Push changes');
  console.log('');
});

// Parse command line arguments
program.parse();