/**
 * CLI Presenter - owns all console interaction for aic: prompts, menus,
 * readline, chalk/styling, setup wizard, config and stats display.
 * Dependencies are injected explicitly - it never reaches through to
 * other modules' internals.
 */

const chalk = require('chalk');
const readline = require('readline');

class CLIPresenter {
  /**
   * @param {Object} deps
   * @param {Object} deps.configManager - Config store (apiKey masked in output).
   * @param {Object} deps.statsManager - Usage statistics.
   * @param {Object} deps.activityLogger - Activity log analysis/export.
   * @param {Object} deps.hookManager - Git hook install/uninstall.
   * @param {Object} deps.metricsScorer - Message quality scoring for display.
   */
  constructor({ configManager, statsManager, activityLogger, hookManager, metricsScorer }) {
    this.configManager = configManager;
    this.statsManager = statsManager;
    this.activityLogger = activityLogger;
    this.hookManager = hookManager;
    this.metricsScorer = metricsScorer;
  }

  /**
   * Create a readline interface for interactive prompts
   */
  createReadline() {
    return readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Interactive message selection.
   * Returns a discriminated result: { action: 'commit', message } |
   * { action: 'regenerate' } | { action: 'cancel' }.
   */
  async selectMessage(messages, options = {}) {
    const rl = this.createReadline();

    const question = prompt =>
      new Promise(resolve => {
        rl.question(prompt, resolve);
      });

    try {
      console.log(chalk.cyan('\n📝 Generated commit messages:'));

      const showScores = options.quiet !== true;
      const diff = options.diff || '';

      messages.forEach((msg, index) => {
        console.log(chalk.green(`${index + 1}. ${msg}`));
        if (showScores && this.metricsScorer) {
          const score = this.metricsScorer.calculateOverallScore(msg, diff);
          const { category, color } = this.metricsScorer.categorizeScore(score);
          console.log(chalk[color](`   └─ Score: ${score}/100 (${category})`));
        }
      });

      console.log(chalk.gray(`${messages.length + 1}. 🔄 Regenerate messages`));
      console.log(chalk.gray(`${messages.length + 2}. ✏️  Write custom message`));
      console.log(chalk.gray(`${messages.length + 3}. ❌ Cancel`));

      const choice = await question(`\nSelect option (1-${messages.length + 3}, default: 1): `);
      const choiceNum = parseInt(choice) || 1;

      if (choiceNum === messages.length + 3) {
        console.log(chalk.yellow('Commit cancelled.'));
        return { action: 'cancel' };
      }

      if (choiceNum === messages.length + 1) {
        console.log(chalk.yellow('Regenerating commit messages...'));
        rl.close();
        return { action: 'regenerate' };
      }

      if (choiceNum === messages.length + 2) {
        const customMessage = await question('Enter your custom commit message: ');
        if (!customMessage.trim()) {
          console.log(chalk.red('Message cannot be empty'));
          return { action: 'cancel' };
        }
        rl.close();
        return { action: 'commit', message: customMessage.trim() };
      }

      if (choiceNum >= 1 && choiceNum <= messages.length) {
        rl.close();
        return { action: 'commit', message: messages[choiceNum - 1] };
      }

      console.log(chalk.red('Invalid choice'));
      rl.close();
      return { action: 'cancel' };
    } catch (error) {
      rl.close();
      throw error;
    }
  }

  /**
   * Configuration management UI
   */
  async config(options = {}) {
    if (options.set) {
      const [key, value] = options.set.split('=');
      await this.configManager.set(key, value);
      console.log(chalk.green(`✅ Configuration updated: ${key} = ${value}`));
    } else if (options.get) {
      const value = await this.configManager.get(options.get);
      console.log(`${options.get}: ${value || 'not set'}`);
    } else if (options.list || (!options.set && !options.get && !options.reset)) {
      const config = await this.configManager.load();
      console.log(chalk.cyan('Current configuration:'));
      Object.entries(config).forEach(([key, value]) => {
        // Never print secrets in plaintext
        const display = key === 'apiKey' && value ? '***configured***' : value;
        console.log(`  ${key}: ${display}`);
      });
    } else if (options.reset) {
      await this.configManager.reset();
      console.log(chalk.green('✅ Configuration reset to defaults'));
    }
  }

  /**
   * Interactive setup wizard
   */
  async setup() {
    console.log(chalk.cyan('🚀 AI Commit Generator Setup Wizard\n'));

    const rl = this.createReadline();

    const question = prompt =>
      new Promise(resolve => {
        rl.question(prompt, resolve);
      });

    try {
      console.log('Select your preferred AI provider:');
      console.log('1. Groq (Fast Cloud)');
      console.log('2. Ollama (Local)');

      const providerChoice = await question('Enter choice (1-2, default: 1): ');
      const provider = providerChoice === '2' ? 'ollama' : 'groq';

      let apiKey = '';
      if (provider !== 'ollama') {
        apiKey = await question('Enter your Groq API key: ');
        if (!apiKey.trim()) {
          console.log(chalk.red('❌ API key is required for Groq'));
          rl.close();
          return;
        }
      }

      const conventionalChoice = await question(
        'Use conventional commit format? (Y/n, default: Y): '
      );
      const conventionalCommits = conventionalChoice.toLowerCase() !== 'n';

      console.log('Select commit message language:');
      console.log('1. English');
      console.log('2. Spanish');
      console.log('3. French');
      console.log('4. German');
      console.log('5. Chinese');
      console.log('6. Japanese');

      const langChoice = await question('Enter choice (1-6, default: 1): ');
      const languages = {
        1: 'en',
        2: 'es',
        3: 'fr',
        4: 'de',
        5: 'zh',
        6: 'ja',
      };
      const language = languages[langChoice] || 'en';

      // Save configuration
      await this.configManager.setMultiple({
        defaultProvider: provider,
        apiKey,
        conventionalCommits,
        language,
      });

      console.log(chalk.green('\n✅ Setup completed successfully!'));
      console.log(chalk.cyan('You can now use "aic" to generate commit messages.'));
    } catch (error) {
      console.error(chalk.red('Setup failed:'), error.message);
    } finally {
      rl.close();
    }
  }

  /**
   * Git hook management UI
   */
  async hook(options = {}) {
    if (options.install) {
      await this.hookManager.install();
      console.log(chalk.green('✅ Git hook installed successfully!'));
    } else if (options.uninstall) {
      await this.hookManager.uninstall();
      console.log(chalk.green('✅ Git hook uninstalled successfully!'));
    } else {
      console.log(chalk.yellow('Please specify --install or --uninstall'));
    }
  }

  /**
   * Show usage statistics UI
   */
  async stats(options) {
    if (options.reset) {
      await this.statsManager.reset();
      console.log(chalk.green('✅ Statistics reset successfully!'));
      return;
    }

    if (options.analyze) {
      const analysis = await this.activityLogger.analyzeLogs(options.days || 30);
      this.displayLogAnalysis(analysis);
      return;
    }

    if (options.export) {
      const format = options.format || 'json';
      const exportData = await this.activityLogger.exportLogs(options.days || 30, format);

      if (format === 'json') {
        console.log(JSON.stringify(JSON.parse(exportData), null, 2));
      } else {
        console.log(exportData);
      }
      return;
    }

    const stats = await this.statsManager.getStats();
    console.log(chalk.cyan('\n📊 Usage Statistics:'));
    console.log(`Total commits: ${stats.totalCommits}`);
    console.log(`Most used provider: ${stats.mostUsedProvider}`);
    console.log(`Average response time: ${stats.averageResponseTime}ms`);
    console.log(`Cache hit rate: ${stats.cacheHitRate}%`);
  }

  /**
   * Display log analysis results
   */
  displayLogAnalysis(analysis) {
    console.log(chalk.cyan('\n📈 Activity Analysis (Last 30 days):'));

    console.log(chalk.yellow('\n🔥 Usage Metrics:'));
    console.log(`  Total Sessions: ${analysis.totalSessions}`);
    console.log(`  AI Interactions: ${analysis.aiInteractions}`);
    console.log(`  Successful Commits: ${analysis.successfulCommits}`);
    console.log(`  Conflict Resolutions: ${analysis.conflictResolutions}`);

    console.log(chalk.yellow('\n🤖 Provider Usage:'));
    Object.entries(analysis.providerUsage).forEach(([provider, count]) => {
      console.log(
        `  ${provider}: ${count} (${Math.round((count / analysis.aiInteractions) * 100)}%)`
      );
    });

    if (analysis.averageResponseTime > 0) {
      console.log(chalk.yellow('\n⚡ Performance:'));
      console.log(`  Average Response Time: ${analysis.averageResponseTime}ms`);
    }

    if (Object.keys(analysis.messagePatterns).length > 0) {
      console.log(chalk.yellow('\n📝 Commit Patterns:'));
      Object.entries(analysis.messagePatterns)
        .sort(([, a], [, b]) => b - a)
        .forEach(([type, count]) => {
          const percentage = Math.round((count / analysis.successfulCommits) * 100);
          console.log(`  ${type}: ${count} (${percentage}%)`);
        });
    }

    if (Object.keys(analysis.commonErrors).length > 0) {
      console.log(chalk.yellow('\n❌ Common Errors:'));
      Object.entries(analysis.commonErrors)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .forEach(([error, count]) => {
          console.log(`  ${error}: ${count}`);
        });
    }

    if (Object.keys(analysis.peakUsageHours).length > 0) {
      console.log(chalk.yellow('\n🕐 Peak Usage Hours:'));
      Object.entries(analysis.peakUsageHours)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .forEach(([hour, count]) => {
          console.log(`  ${hour.toString().padStart(2, '0')}:00 - ${count} interactions`);
        });
    }

    console.log(chalk.dim('\n💡 Tip: Use --export to get detailed data for further analysis'));
  }
}

module.exports = CLIPresenter;
