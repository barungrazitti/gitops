/**
 * Setup wizard command
 */

const chalk = require('chalk');

class SetupCommand {
  constructor(configManager) {
    this.configManager = configManager;
  }

  /**
   * Interactive setup wizard
   */
  async execute(options) {
    console.log(chalk.cyan('🚀 AI Commit Generator Setup Wizard\n'));

    // Simple command-line setup (compatible with Node.js v25)
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => new Promise(resolve => {
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

      const conventionalChoice = await question('Use conventional commit format? (Y/n, default: Y): ');
      const conventionalCommits = conventionalChoice.toLowerCase() !== 'n';

      console.log('Select commit message language:');
      console.log('1. English');
      console.log('2. Spanish');
      console.log('3. French');
      console.log('4. German');
      console.log('5. Chinese');
      console.log('6. Japanese');
      
      const langChoice = await question('Enter choice (1-6, default: 1): ');
      const languages = { '1': 'en', '2': 'es', '3': 'fr', '4': 'de', '5': 'zh', '6': 'ja' };
      const language = languages[langChoice] || 'en';

      // Save configuration
      await this.configManager.setMultiple({
        defaultProvider: provider,
        apiKey: apiKey,
        conventionalCommits: conventionalCommits,
        language: language,
      });

      console.log(chalk.green('\n✅ Setup completed successfully!'));
      console.log(chalk.cyan('You can now use "aic" to generate commit messages.'));
    } catch (error) {
      console.error(chalk.red('Setup failed:'), error.message);
    } finally {
      rl.close();
    }
  }
}

module.exports = SetupCommand;