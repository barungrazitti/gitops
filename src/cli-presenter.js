/**
 * CLI Presenter - Handles all console interaction for aic
 */

const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');

class CLIPresenter {
  constructor(aiCommitGenerator) {
    this.generator = aiCommitGenerator;
    this.spinner = ora();
  }

  /**
   * Identify the type of error to provide better suggestions
   */
  identifyErrorType(error) {
    const message = error.message.toLowerCase();
    if (message.includes('no staged changes')) return 'git_no_changes';
    if (message.includes('not a git repository')) return 'git_not_repo';
    if (message.includes('401') || message.includes('unauthorized') || message.includes('api key')) return 'ai_auth_error';
    if (message.includes('429') || message.includes('too many requests') || message.includes('rate limit')) return 'ai_rate_limit';
    if (message.includes('econnrefused') || message.includes('enotfound')) return 'ai_connection_error';
    if (message.includes('context length exceeded') || message.includes('too large')) return 'ai_context_limit';
    return 'unknown';
  }

  /**
   * Get a local fallback suggestion for an error type
   */
  getLocalSuggestion(type) {
    const suggestions = {
      git_no_changes: 'No changes are staged. Use "git add <file>" to stage changes.',
      git_not_repo: 'This directory is not a git repository. Run "git init".',
      ai_auth_error: 'AI provider authentication failed. Run "aic setup".',
      ai_rate_limit: 'AI provider rate limit reached. Please wait or switch providers.',
      ai_connection_error: 'Could not connect to AI provider. Check internet/Ollama.',
      ai_context_limit: 'Diff is too large. Stage fewer files.',
    };
    return suggestions[type] || 'An unknown error occurred.';
  }

  /**
   * Provide error suggestions with interactive options
   */
  async provideErrorSuggestions(error, options = {}) {
    const errorType = this.identifyErrorType(error);
    const suggestion = this.getLocalSuggestion(errorType);
    console.log(chalk.yellow('\n⚠️  Error:') + chalk.red(` ${error.message}`));
    console.log(chalk.dim(`\nSuggestion: ${suggestion}`));

    const { runSetup = false } = await inquirer.prompt([{
      type: 'confirm', name: 'runSetup', message: 'Run setup to fix configuration?', default: false,
    }]);

    if (runSetup) await this.setup();
  }

  /**
   * Interactive message selection
   */
  async selectMessage(messages, options = {}) {
    if (!messages || messages.length === 0) return null;
    if (messages.length === 1) return messages[0];

    const { useAISelection } = await inquirer.prompt([{
      type: 'confirm', name: 'useAISelection', message: 'Use AI to select the best commit message?', default: true,
    }]);

    if (useAISelection) {
      this.spinner.start('Analyzing messages...');
      try {
        const diff = await this.generator.gitManager.getStagedDiff();
        const ranked = await this.generator.messageRanker.selectBestMessages(messages, options.count || 3, diff);
        this.spinner.stop();
        const { selected } = await inquirer.prompt([{
          type: 'list', name: 'selected', message: 'Select message:', choices: ranked,
        }]);
        return selected;
      } catch (e) {
        this.spinner.stop();
        console.warn(chalk.yellow('AI selection failed, showing manual selector'));
      }
    }
    const { selected } = await inquirer.prompt([{
      type: 'list', name: 'selected', message: 'Select message:', choices: messages,
    }]);
    return selected;
  }

  /**
   * Configuration management
   */
  async config(options = {}) {
    const configManager = this.generator.configManager;
    if (options.list || (!options.set && !options.reset && !Object.keys(options).length)) {
      const config = await configManager.getAll();
      console.log(chalk.cyan('\n📋 Current Configuration:\n'));
      Object.entries(config).forEach(([k, v]) => {
        const display = k === 'apiKey' && v ? '***configured***' : v;
        console.log(`${k}: ${display}`);
      });
      return;
    }
    if (options.set) { await configManager.set(options.set); console.log(chalk.green('✅ Updated')); }
    if (options.reset) { await configManager.reset(); console.log(chalk.green('✅ Reset')); }
  }

  /**
   * Interactive setup wizard
   */
  async setup() {
    console.log(chalk.cyan('\n🚀 AI Commit Setup\n'));
    const provider = await inquirer.prompt([{
      type: 'list', name: 'provider', message: 'Select AI provider:', choices: ['groq', 'ollama'],
    }]);
    let apiKey = '';
    if (provider.provider === 'groq') {
      apiKey = (await inquirer.prompt([{ type: 'input', name: 'apiKey', message: 'Groq API Key:' }])).apiKey;
    }
    const model = await inquirer.prompt([{
      type: 'list', name: 'model', message: 'Select model:', choices: ['openai/gpt-oss-20b', 'llama-3.1-8b-instant'],
    }]);
    await this.generator.configManager.set({ provider: provider.provider, apiKey, model: model.model });
    console.log(chalk.green('\n✅ Setup complete!'));
  }

  /**
   * Git hook management
   */
  async hook(options = {}) {
    if (options.install) { await this.generator.hookManager.install(); console.log('✅ Installed'); }
    if (options.uninstall) { await this.generator.hookManager.uninstall(); console.log('✅ Uninstalled'); }
  }

  /**
   * Show usage statistics
   */
  async stats(options = {}) {
    if (options.reset) { await this.generator.statsManager.reset(); console.log('✅ Reset'); return; }
    const stats = await this.generator.statsManager.getStats();
    if (options.analyze) { await this.displayLogAnalysis(stats); return; }
    console.log(chalk.cyan('\n📊 Usage Statistics\n'));
    this._displayStatsTable(stats);
  }

  /**
   * Display log analysis
   */
  async displayLogAnalysis(stats) {
    const logs = await this.generator.activityLogger.getRecentLogs(100);
    console.log(chalk.cyan('\n📈 Recent Activity Analysis\n'));
    console.log(`Total events: ${logs.length}`);
  }

  _displayStatsTable(stats) {
    console.log(`Generations: ${stats.totalGenerations || 0}`);
  }
}

module.exports = CLIPresenter;
