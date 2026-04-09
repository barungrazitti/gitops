/**
 * Configuration management command
 */

const chalk = require('chalk');

class ConfigCommand {
  constructor(configManager) {
    this.configManager = configManager;
  }

  /**
   * Handle configuration operations
   */
  async execute(options) {
    if (options.set) {
      const [key, value] = options.set.split('=');
      await this.configManager.set(key, value);
      console.log(chalk.green(`✅ Configuration updated: ${key} = ${value}`));
    } else if (options.get) {
      const value = await this.configManager.get(options.get);
      console.log(`${options.get}: ${value || 'not set'}`);
    } else if (options.list || !options.set && !options.get && !options.reset) {
      const config = await this.configManager.load();
      console.log(chalk.cyan('Current configuration:'));
      Object.entries(config).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    } else if (options.reset) {
      await this.configManager.reset();
      console.log(chalk.green('✅ Configuration reset to defaults'));
    }
  }
}

module.exports = ConfigCommand;