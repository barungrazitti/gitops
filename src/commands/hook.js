/**
 * Git hook management command
 */

const chalk = require('chalk');

class HookCommand {
  constructor(hookManager) {
    this.hookManager = hookManager;
  }

  /**
   * Git hook management
   */
  async execute(options) {
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
}

module.exports = HookCommand;