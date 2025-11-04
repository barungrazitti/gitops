/**
 * Auto Git - Simplified git workflow automation
 * Usage: aic (AI Commit) - does everything automatically
 */

const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const simpleGit = require('simple-git');
const AICommitGenerator = require('./index.js');

class AutoGit {
  constructor() {
    this.git = simpleGit();
    this.aiCommit = new AICommitGenerator();
    this.spinner = null;
    // Configure git to prefer merge over rebase for safety
    this.git.raw(['config', 'pull.rebase', 'false']);
  }

  /**
   * Main auto git workflow
   */
  async run(options = {}) {
    console.log(chalk.cyan('Auto Git Workflow Starting...\n'));

    try {
      // Step 1: Validate git repository
      await this.validateRepository();

      // Step 2: Check for changes
      const hasChanges = await this.checkForChanges();
      if (!hasChanges && !options.force) {
        console.log(chalk.yellow('No changes detected. Repository is clean!'));
        return;
      }

      // Step 3: Stage all changes (if not already staged)
      await this.stageChanges();

      // Step 4: Generate or use provided commit message
      let commitMessage;
      if (options.manualMessage) {
        commitMessage = options.manualMessage;
        console.log(chalk.green(`Using provided message: ${commitMessage}`));
      } else {
        commitMessage = await this.generateCommitMessage(options);
        if (!commitMessage) {
          console.log(chalk.yellow('Commit cancelled by user'));
          return;
        }
      }

      // Step 5: Commit changes
      await this.commitChanges(commitMessage, options);

      // Step 6: Pull latest changes and handle conflicts (unless skipped)
      if (!options.skipPull) {
        try {
          await this.pullAndHandleConflicts();
        } catch (pullError) {
          // Offer to skip pull if it fails
          console.log(chalk.yellow(`\nPull failed: ${pullError.message}`));

          const { skipPull } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'skipPull',
              message: 'Skip pull and continue with push?',
              default: false,
            },
          ]);

          if (!skipPull) {
            return;
          }
        }
      }

      // Step 7: Push changes (unless skipped)
      if (options.push !== false) {
        await this.pushChanges();
      }

      console.log(chalk.green('\n✅ Auto Git workflow completed successfully!'));
    } catch (error) {
      console.error(chalk.red('\n❌ Auto Git workflow failed:'), error.message);
      throw error;
    }
  }

  /**
   * Validate that we're in a git repository
   */
  async validateRepository() {
    this.spinner = ora('Validating git repository...').start();

    try {
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        throw new Error('Not a git repository');
      }

      this.spinner.succeed('Git repository validated');
    } catch (error) {
      this.spinner.fail('Repository validation failed');
      throw error;
    } finally {
      this.spinner = null;
    }
  }

  /**
   * Check if there are any changes (staged or unstaged)
   */
  async checkForChanges() {
    this.spinner = ora('Checking for changes...').start();

    try {
      const status = await this.git.status();
      const hasChanges =
        status.files.length > 0 ||
        status.not_added.length > 0 ||
        status.created.length > 0 ||
        status.deleted.length > 0 ||
        status.modified.length > 0 ||
        status.renamed.length > 0;

      this.spinner.succeed(hasChanges ? 'Changes detected' : 'No changes detected');
      return hasChanges;
    } catch (error) {
      this.spinner.fail('Failed to check for changes');
      throw error;
    } finally {
      this.spinner = null;
    }
  }

  /**
   * Stage all changes
   */
  async stageChanges() {
    this.spinner = ora('Staging changes...').start();

    try {
      // Stage all changes including new files
      await this.git.add('.');
      this.spinner.succeed('Changes staged');
    } catch (error) {
      this.spinner.fail('Failed to stage changes');
      throw error;
    } finally {
      this.spinner = null;
    }
  }

  /**
   * Generate AI commit message
   */
  async generateCommitMessage(options) {
    this.spinner = ora('Generating AI commit message...').start();

    try {
      // Get repository context for better AI generation
      const context = await this.aiCommit.analysisEngine.analyzeRepository();

      // Use the AI commit generator with intelligent merging
      const messages = await this.aiCommit.generateWithIntelligentMerging(
        await this.git.diff(['--staged']),
        {
          count: 1, // Only need one message for auto-commit
          conventional: true,
          provider: options.provider,
          context: context, // Add proper context
        }
      );

      this.spinner.succeed('AI commit message generated');
      return messages[0]; // Return the best message
    } catch (error) {
      this.spinner.fail('Failed to generate AI commit message');
      throw error;
    } finally {
      this.spinner = null;
    }
  }

  /**
   * Commit changes
   */
  async commitChanges(message, options) {
    this.spinner = ora('Committing changes...').start();

    try {
      await this.git.commit(message);
      this.spinner.succeed(`Committed: ${message}`);
    } catch (error) {
      this.spinner.fail('Failed to commit changes');
      throw error;
    } finally {
      this.spinner = null;
    }
  }

  /**
   * Pull latest changes and auto-resolve conflicts
   */
  async pullAndHandleConflicts() {
    this.spinner = ora('Pulling latest changes...').start();

    try {
      const pullResult = await this.git.pull();

      if (pullResult.files && pullResult.files.length > 0) {
        this.spinner.text = 'Handling conflicts...';

        // Check for conflicts
        const hasConflicts = pullResult.files.some(
          (file) => file.changes && file.changes.some((change) => change.conflict)
        );

        if (hasConflicts) {
          console.log(chalk.yellow('\n⚠️  Merge conflicts detected'));

          const { autoResolve } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'autoResolve',
              message: 'Attempt to auto-resolve conflicts?',
              default: true,
            },
          ]);

          if (autoResolve) {
            try {
              // Simple auto-resolve: prefer current changes
              await this.git.raw(['checkout', '--ours', '.']);
              await this.git.add('.');
              await this.git.commit('Auto-resolved merge conflicts');

              this.spinner.succeed('Conflicts auto-resolved');
            } catch (resolveError) {
              this.spinner.warn(
                'Could not auto-resolve conflicts. Manual resolution required.'
              );
              throw resolveError;
            }
          } else {
            throw new Error(
              'Manual conflict resolution required. Please resolve conflicts and run again.'
            );
          }
        } else {
          this.spinner.succeed('Pulled latest changes');
        }
      } else {
        this.spinner.succeed('Already up to date');
      }
    } catch (error) {
      this.spinner.fail('Failed to pull changes');
      throw error;
    } finally {
      this.spinner = null;
    }
  }

  /**
   * Push changes to remote
   */
  async pushChanges() {
    this.spinner = ora('Pushing changes...').start();

    try {
      await this.git.push();
      this.spinner.succeed('Changes pushed to remote');
    } catch (error) {
      this.spinner.fail('Failed to push changes');
      throw error;
    } finally {
      this.spinner = null;
    }
  }
}

module.exports = AutoGit;