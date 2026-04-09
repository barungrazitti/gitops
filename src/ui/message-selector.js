/**
 * Interactive message selection UI
 */

const chalk = require('chalk');

class MessageSelector {
  constructor() {}

  /**
   * Interactive message selection
   */
  async select(messages) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => new Promise(resolve => {
      rl.question(prompt, resolve);
    });

    try {
      console.log(chalk.cyan('\n📝 Generated commit messages:'));
      messages.forEach((msg, index) => {
        console.log(chalk.green(`${index + 1}. ${msg}`));
      });
      
       console.log(`${messages.length + 1}. 🔄 Regenerate messages`);
       console.log(`${messages.length + 2}. ✏️  Write custom message`);
       console.log(`${messages.length + 3}. ❌ Cancel`);

      const choice = await question(`\nSelect option (1-${messages.length + 3}, default: 1): `);
      const choiceNum = parseInt(choice) || 1;

      if (choiceNum === messages.length + 3) {
        console.log(chalk.yellow('Commit cancelled.'));
        return null;
      }

      if (choiceNum === messages.length + 1) {
        console.log(chalk.yellow('Regenerating commit messages...'));
        rl.close();
        // Return special value to trigger regeneration
        return 'regenerate';
      }

      if (choiceNum === messages.length + 2) {
        const customMessage = await question('Enter your custom commit message: ');
        if (!customMessage.trim()) {
          console.log(chalk.red('Message cannot be empty'));
          return null;
        }
        rl.close();
        return customMessage.trim();
      }

      if (choiceNum >= 1 && choiceNum <= messages.length) {
        rl.close();
        return messages[choiceNum - 1];
      }

      console.log(chalk.red('Invalid choice'));
      rl.close();
      return null;
    } catch (error) {
      rl.close();
      throw error;
    }
  }
}

module.exports = MessageSelector;