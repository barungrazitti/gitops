/**
 * Auto Git - Simplified git workflow automation
 * Usage: aic (AI Commit) - does everything automatically
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const simpleGit = require('simple-git');
const ora = require('ora');
const AICommitGenerator = require('./index');

class AutoGit {
  constructor() {
    this.git = simpleGit();
    this.aiCommit = new AICommitGenerator();
    this.activityLogger = this.aiCommit.activityLogger;
    this.spinner = ora();
    // Configure git to prefer merge over rebase for safety
    this.git.raw(['config', 'pull.rebase', 'false']);
  }

  /**
   * Main auto git workflow
   */
  async run(options = {}) {
    const startTime = Date.now();

    // Handle dry run mode
    if (options.dryRun) {
      await this.activityLogger.info('auto_git_started', { options });
      await this.activityLogger.info('auto_git_completed', {
        reason: 'dry_run',
        duration: Date.now() - startTime,
      });
      return;
    }

    try {
      await this.activityLogger.info('auto_git_started', { options });

      // Step 1: Validate git repository
      await this.validateRepository();

      // Step 2: Check for changes
      const hasChanges = await this.checkForChanges();
      if (!hasChanges && !options.force) {
        await this.activityLogger.info('auto_git_completed', {
          reason: 'no_changes',
          duration: Date.now() - startTime,
        });
        return;
      }

      // Step 3: Stage all changes (if not already staged)
      await this.stageChanges();

      // Step 4: Generate or use provided commit message
      let commitMessage;
      if (options.manualMessage) {
        commitMessage = options.manualMessage;
      } else {
        commitMessage = await this.generateCommitMessage(options);
        if (!commitMessage) {
          await this.activityLogger.info('auto_git_cancelled', { reason: 'user_cancelled' });
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
          const { skipPull } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'skipPull',
              message: 'Skip pull and continue with push?',
              default: false,
            },
          ]);

          if (skipPull) {
            await this.activityLogger.warn('pull_skipped', { reason: pullError.message });
          } else {
            await this.activityLogger.info('auto_git_cancelled', {
              reason: 'pull_failed_cancelled',
            });
            return;
          }
        }
      }

      // Step 7: Push changes (unless skipped)
      if (options.push !== false) {
        await this.pushChanges();
      }

      await this.activityLogger.info('auto_git_completed', {
        success: true,
        duration: Date.now() - startTime,
        commitMessage,
      });
    } catch (error) {
      await this.activityLogger.error('auto_git_failed', {
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Validate that we're in a git repository
   */
  async validateRepository() {
    this.spinner.start('Validating git repository...');
    try {
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        this.spinner.fail('Repository validation failed');
        throw new Error('Not a git repository');
      }
      this.spinner.succeed('Git repository validated');
    } catch (error) {
      this.spinner.fail('Repository validation failed');
      throw error;
    }
  }

  /**
   * Check if there are any changes (staged or unstaged)
   */
  async checkForChanges() {
    this.spinner.start('Checking for changes...');
    try {
      const status = await this.git.status();
      const hasChanges =
        status.files.length > 0 ||
        status.not_added.length > 0 ||
        status.created.length > 0 ||
        status.deleted.length > 0 ||
        status.modified.length > 0 ||
        status.renamed.length > 0;

      if (!hasChanges) {
        this.spinner.succeed('No changes detected');
      } else {
        this.spinner.succeed('Changes detected');
      }

      return hasChanges;
    } catch (error) {
      this.spinner.fail('Failed to check for changes');
      throw error;
    }
  }

  /**
   * Stage all changes
   */
  async stageChanges() {
    this.spinner.start('Staging changes...');
    try {
      // Stage all changes including new files
      await this.git.add('.');
      this.spinner.succeed('Changes staged');
    } catch (error) {
      this.spinner.fail('Failed to stage changes');
      throw error;
    }
  }

  /**
   * Generate AI commit message
   */
  async generateCommitMessage(_options) {
    this.spinner.start('Generating AI commit message...');
    try {
      // Get repository context for better AI generation
      const context = await this.aiCommit.analysisEngine.analyzeRepository();

      // Get the staged diff
      const diff = await this.git.diff(['--staged']);

      if (!diff || diff.trim().length === 0) {
        this.spinner.fail('No staged changes available');
        throw new Error('No staged changes available');
      }

      // Check for and clean up conflict markers before generating commit
      if (/<<<<<<<|=======|>>>>>>>/.test(diff)) {
        this.spinner.text = chalk.yellow('Conflict markers detected, cleaning up...');
        const cleanupResult = await this.aiCommit.detectAndCleanupConflictMarkers();

        if (cleanupResult.cleaned) {
          // Re-stage the cleaned files
          await this.git.add(['.']);

          // Get fresh diff after cleanup
          const newDiff = await this.git.diff(['--staged']);

          if (newDiff && newDiff.trim().length > 0) {
            // Generate commit message from cleaned diff
            const config = await this.aiCommit.configManager.getAll();
            const messages = await this.aiCommit.generateWithSequentialFallback(newDiff, {
              context,
              count: 1,
              conventional: true,
              preferredProvider: config.defaultProvider || 'groq',
            });
            this.spinner.succeed('AI commit message generated from cleaned diff');
            return messages[0];
          }
        }
      }

      // Use the main AI commit generator with sequential fallback
      const config = await this.aiCommit.configManager.getAll();
      const messages = await this.aiCommit.generateWithSequentialFallback(diff, {
        context,
        count: 1, // Only need one message for auto-commit
        conventional: true,
        preferredProvider: config.defaultProvider || 'groq',
      });

      this.spinner.succeed('AI commit message generated');
      return messages[0]; // Return the best message
    } catch (error) {
      this.spinner.fail('Failed to generate commit message');
      console.log(chalk.red('✗ Failed to generate commit message'));
      throw error;
    }
  }

  /**
   * Commit changes
   */
  async commitChanges(message, _options) {
    this.spinner.start('Committing changes...');
    try {
      await this.git.commit(message);
      this.spinner.succeed(`Committed: ${message}`);
    } catch (error) {
      this.spinner.fail('Failed to commit changes');
      console.log(chalk.red('✗ Failed to commit changes'));
      throw error;
    }
  }

  /**
   * Pull latest changes and handle any conflicts
   */
  async pullAndHandleConflicts() {
    try {
      this.spinner.start('Pulling latest changes...');
      const pullResult = await this.git.pull();

      if (!pullResult || !pullResult.files || pullResult.files.length === 0) {
        this.spinner.succeed('Already up to date');
        return;
      }

      // Check for conflicts using git status (more reliable)
      const status = await this.git.status();
      const hasConflicts = status.conflicted.length > 0;

      if (hasConflicts) {
        console.log(chalk.yellow(`⚠ Merge conflicts in ${status.conflicted.length} file(s)`));
        status.conflicted.forEach(file => {
          console.log(chalk.gray(`  • ${file}`));
        });

        const { resolutionStrategy } = await inquirer.prompt([
          {
            type: 'list',
            name: 'resolutionStrategy',
            message: 'Choose conflict resolution strategy:',
            choices: [
              {
                name: '🤖 AI-powered resolution (intelligent merge)',
                value: 'ai',
              },
              {
                name: '💾 Keep current changes (theirs)',
                value: 'ours',
              },
              {
                name: '📥 Use incoming changes (mine)',
                value: 'theirs',
              },
              {
                name: '🔧 Manual resolution',
                value: 'manual',
              },
              {
                name: '❌ Cancel operation',
                value: 'cancel',
              },
            ],
            default: 'ai',
          },
        ]);

        if (resolutionStrategy === 'cancel') {
          throw new Error('Pull cancelled due to conflicts');
        }

        if (resolutionStrategy === 'manual') {
          console.log(chalk.yellow('\n📝 Manual conflict resolution required:'));
          console.log(chalk.dim('   1. Resolve conflicts in your editor'));
          console.log(chalk.dim('   2. Stage resolved files with: git add <files>'));
          console.log(chalk.dim('   3. Continue with: git commit'));
          throw new Error(
            'Manual conflict resolution required. Please resolve conflicts and run again.'
          );
        }

        try {
          if (resolutionStrategy === 'ai') {
            await this.resolveConflictsWithAI(status.conflicted);
          } else {
            // Traditional resolution
            const checkoutFlag = resolutionStrategy === 'ours' ? '--ours' : '--theirs';

            for (const file of status.conflicted) {
              await this.git.raw(['checkout', checkoutFlag, '--', file]);
            }

            await this.git.add('.');
            await this.git.commit(
              `Auto-resolved merge conflicts (kept ${resolutionStrategy} changes)`
            );

            console.log(chalk.green(`✓ Resolved ${status.conflicted.length} conflict(s)`));
            this.spinner.succeed('Pull and conflict resolution complete');
            return;
          }
        } catch (resolveError) {
          console.log(chalk.red('✗ Failed to resolve conflicts'));
          throw new Error(`Resolution failed: ${resolveError.message}`);
        }
      }
      this.spinner.succeed('Pull successful with no conflicts');
    } catch (error) {
      if (error.message.includes('Not possible to fast-forward')) {
        try {
          await this.git.pull(['--rebase']);
          console.log(chalk.green('✓ Rebased and pulled changes'));
        } catch (rebaseError) {
          console.log(chalk.red('✗ Rebase failed'));
          const status = await this.git.status();
          if (status.conflicted.length > 0) {
            throw new Error(`Rebase resulted in conflicts that need to be resolved manually.`);
          }
          throw new Error(`Failed to rebase: ${rebaseError.message}`);
        }
        return;
      }

      console.log(chalk.red(`✗ Pull failed: ${error.message}`));

      if (!error.message.includes('conflict') && !error.message.includes('Manual conflict')) {
        const { skipPull } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'skipPull',
            message: 'Skip pull and continue with push?',
            default: false,
          },
        ]);

        if (skipPull) {
          console.log(chalk.yellow('✓ Skipping pull'));
          return;
        }
      }

      throw error;
    }
  }

  /**
   * Resolve conflicts using AI with intelligent merging
   */
  async resolveConflictsWithAI(conflictedFiles) {
    const resolutionStartTime = Date.now();

    for (const file of conflictedFiles) {
      try {
        await this.resolveFileConflictsWithAI(file);
      } catch (error) {
        const { fallback } = await inquirer.prompt([
          {
            type: 'list',
            name: 'fallback',
            message: `Fallback strategy for ${file}:`,
            choices: [
              { name: 'Keep current changes (theirs)', value: 'ours' },
              { name: 'Use incoming changes (mine)', value: 'theirs' },
              { name: 'Cancel entire operation', value: 'cancel' },
            ],
          },
        ]);

        if (fallback === 'cancel') {
          await this.activityLogger.logConflictResolution(conflictedFiles, 'ai', false, {
            error: error.message,
            file,
            fallbackUsed: fallback,
            resolutionTime: Date.now() - resolutionStartTime,
          });
          throw new Error('Operation cancelled due to resolution failure');
        }

        await this.git.raw(['checkout', `--${fallback}`, '--', file]);
      }
    }

    // Stage all resolved files
    await this.git.add('.');
    await this.git.commit('AI-resolved merge conflicts with intelligent merging');

    await this.activityLogger.logConflictResolution(conflictedFiles, 'ai', true, {
      resolutionTime: Date.now() - resolutionStartTime,
      fallbackUsed: false,
      chunkingUsed: false,
    });
  }

  /**
   * Resolve conflicts in a single file using AI
   */
  async resolveFileConflictsWithAI(filePath) {
    try {
      // Get the conflicted file content
      const fileContent = await this.git.show([`HEAD:${filePath}`]);
      const currentContent = await this.git.show([`--theirs`, `:${filePath}`]);
      const incomingContent = await this.git.show([`--ours`, `:${filePath}`]);

      // Get the current conflicted file to see conflict markers
      const repoRoot = await this.git.revparse(['--show-toplevel']);
      const fullPath = require('path').join(repoRoot, filePath);
      const fs = require('fs-extra');
      const conflictedContent = await fs.readFile(fullPath, 'utf8');

      // Create conflict context for AI
      const conflictContext = {
        filePath,
        originalContent: fileContent,
        currentChanges: currentContent,
        incomingChanges: incomingContent,
        conflictedContent,
        timestamp: Date.now(),
      };

      // Use AI to resolve conflicts
      const resolvedContent = await this.aiCommit.resolveConflictWithAI(conflictContext);

      // Write the resolved content back to the file
      await fs.writeFile(fullPath, resolvedContent, 'utf8');
    } catch (error) {
      throw new Error(`Failed to resolve conflicts in ${filePath}: ${error.message}`);
    }
  }

  /**
   * Push changes to remote
   */
  async pushChanges() {
    this.spinner.start('Pushing changes to remote...');
    try {
      await this.git.push();
      this.spinner.succeed('Pushed to remote');
    } catch (error) {
      this.spinner.fail('Failed to push changes');
      console.log(chalk.red('✗ Failed to push changes'));
      throw error;
    }
  }
}

module.exports = AutoGit;
