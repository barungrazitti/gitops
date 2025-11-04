/**
 * Auto Git - Simplified git workflow automation
 * Usage: aic (AI Commit) - does everything automatically
 */

const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const simpleGit = require('simple-git');
const fs = require('fs-extra');
const path = require('path');
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

      // Use the AI commit generator with Ollama-first fallback
      const messages = await this.aiCommit.generateWithFallback(
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
   * Pull latest changes and handle conflicts with AI-powered resolution
   */
  async pullAndHandleConflicts() {
    this.spinner = ora('Pulling latest changes...').start();

    try {
      const pullResult = await this.git.pull();

      if (pullResult.files && pullResult.files.length > 0) {
        // Check for conflicts using git status (more reliable)
        const status = await this.git.status();
        const hasConflicts = status.conflicted.length > 0;

        if (hasConflicts) {
          this.spinner.text = 'Analyzing merge conflicts...';
          console.log(chalk.yellow(`\n⚠️  Merge conflicts detected in ${status.conflicted.length} file(s):`));
          status.conflicted.forEach(file => {
            console.log(chalk.dim(`   • ${file}`));
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
            throw new Error('Manual conflict resolution required. Please resolve conflicts and run again.');
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
              await this.git.commit(`Auto-resolved merge conflicts (kept ${resolutionStrategy} changes)`);
              
              this.spinner.succeed(`Conflicts resolved using ${resolutionStrategy} strategy`);
              console.log(chalk.green(`✅ Resolved conflicts in ${status.conflicted.length} file(s)`));
            }
          } catch (resolveError) {
            this.spinner.fail('Failed to resolve conflicts');
            console.log(chalk.red('Error details:', resolveError.message));
            throw new Error(`Resolution failed: ${resolveError.message}`);
          }
        } else {
          this.spinner.succeed('Pulled latest changes');
        }
      } else {
        this.spinner.succeed('Already up to date');
      }
    } catch (error) {
      this.spinner.fail('Failed to pull changes');
      
      // If it's not a conflict error we handled, offer to skip
      if (!error.message.includes('conflict') && !error.message.includes('Manual conflict')) {
        console.log(chalk.yellow(`\nPull failed: ${error.message}`));

        const { skipPull } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'skipPull',
            message: 'Skip pull and continue with push?',
            default: false,
          },
        ]);

        if (skipPull) {
          console.log(chalk.yellow('⚠️  Skipping pull, pushing local changes only'));
          return; // Continue without pulling
        }
      }
      
      throw error;
    } finally {
      this.spinner = null;
    }
  }

  /**
   * Resolve conflicts using AI with intelligent merging
   */
  async resolveConflictsWithAI(conflictedFiles) {
    console.log(chalk.blue('\n🤖 Using AI to intelligently resolve conflicts...'));
    
    for (const file of conflictedFiles) {
      console.log(chalk.cyan(`\n📄 Processing ${file}...`));
      
      try {
        await this.resolveFileConflictsWithAI(file);
        console.log(chalk.green(`✅ Resolved conflicts in ${file}`));
      } catch (error) {
        console.log(chalk.red(`❌ Failed to resolve ${file}: ${error.message}`));
        
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
          throw new Error('Operation cancelled due to resolution failure');
        }
        
        await this.git.raw(['checkout', `--${fallback}`, '--', file]);
        console.log(chalk.yellow(`⚠️  Used fallback strategy for ${file}`));
      }
    }
    
    // Stage all resolved files
    await this.git.add('.');
    await this.git.commit('AI-resolved merge conflicts with intelligent merging');
    
    this.spinner.succeed(`AI resolved conflicts in ${conflictedFiles.length} file(s)`);
    console.log(chalk.green('✨ AI-powered conflict resolution completed!'));
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