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
      await this.commitChanges(commitMessage);

      // Step 6: Pull latest changes and handle conflicts (unless skipped)
      if (!options.skipPull) {
        await this.pullAndHandleConflicts();
      }

      // Step 7: Push changes (unless disabled)
      if (options.push !== false) {
        await this.pushChanges();
      }

      console.log(chalk.green('\nAuto Git workflow completed successfully!'));
      
    } catch (error) {
      if (this.spinner) this.spinner.fail();
      console.error(chalk.red('\nAuto Git workflow failed:'), error.message);
      
      // Provide helpful recovery suggestions
      await this.suggestRecovery(error);
      process.exit(1);
    }
  }

  /**
   * Validate git repository
   */
  async validateRepository() {
    this.spinner = ora('Checking git repository...').start();
    
    try {
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        throw new Error('Not a git repository. Run "git init" first.');
      }

      // Check if we have a remote
      const remotes = await this.git.getRemotes();
      if (remotes.length === 0) {
        this.spinner.warn('No remote repository configured');
        console.log(chalk.yellow('No remote found. Only local commit will be performed.'));
      }

      this.spinner.succeed('Git repository validated');
    } catch (error) {
      this.spinner.fail();
      throw error;
    }
  }

  /**
   * Check for changes in the repository
   */
  async checkForChanges() {
    this.spinner = ora('Checking for changes...').start();
    
    try {
      const status = await this.git.status();
      const hasChanges = status.files.length > 0;
      
      if (hasChanges) {
        this.spinner.succeed(`Found ${status.files.length} changed files`);
        
        // Show summary of changes
        const summary = this.summarizeChanges(status);
        console.log(chalk.dim(summary));
      } else {
        this.spinner.succeed('No changes detected');
      }
      
      return hasChanges;
    } catch (error) {
      this.spinner.fail();
      throw error;
    }
  }

  /**
   * Stage all changes
   */
  async stageChanges() {
    this.spinner = ora('Staging changes...').start();
    
    try {
      await this.git.add('.');
      this.spinner.succeed('All changes staged');
    } catch (error) {
      this.spinner.fail();
      throw new Error(`Failed to stage changes: ${error.message}`);
    }
  }

  /**
   * Generate AI commit message
   */
  async generateCommitMessage(options) {
    this.spinner = ora('Generating AI commit message...').start();
    
    try {
      // Check if AI is configured
      const config = await this.aiCommit.configManager.load();
      if (!config.apiKey && config.defaultProvider !== 'ollama') {
        this.spinner.fail();
        console.log(chalk.yellow('\nAI provider not configured.'));
        
        const { setupNow } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'setupNow',
            message: 'Would you like to set up AI provider now?',
            default: true
          }
        ]);

        if (setupNow) {
          await this.aiCommit.setup();
          this.spinner = ora('Generating AI commit message...').start();
        } else {
          return await this.manualCommitMessage();
        }
      }

      // Generate AI commit messages
      const diff = await this.git.diff(['--staged']);
      if (!diff) {
        throw new Error('No staged changes found');
      }

      // Use the AI generator but get messages only
      const messages = await this.generateAIMessages(diff, options);

      this.spinner.succeed('AI commit messages generated');

      // Let user select message
      return await this.selectCommitMessage(messages);

    } catch (error) {
      this.spinner.fail();
      console.log(chalk.yellow(`\nAI generation failed: ${error.message}`));
      console.log(chalk.dim('Falling back to manual commit message...'));
      
      return await this.manualCommitMessage();
    }
  }

  /**
   * Generate AI messages using the AI provider
   */
  async generateAIMessages(diff, options) {
    const config = await this.aiCommit.configManager.load();
    const AIProviderFactory = require('./providers/ai-provider-factory');
    
    const provider = AIProviderFactory.create(options.provider || config.defaultProvider);
    
    // Analyze repository context
    const context = await this.aiCommit.analysisEngine.analyzeRepository();
    
    const messages = await provider.generateCommitMessages(diff, {
      context,
      count: 3,
      language: config.language || 'en',
      conventional: config.conventionalCommits
    });

    return messages;
  }

  /**
   * Select commit message from AI suggestions
   */
  async selectCommitMessage(messages) {
    if (!messages || messages.length === 0) {
      return await this.manualCommitMessage();
    }

    const choices = [
      ...messages.map((msg, index) => ({
        name: `${index + 1}. ${msg}`,
        value: msg,
        short: `Message ${index + 1}`
      })),
      {
        name: chalk.dim('Write custom message'),
        value: 'custom'
      },
      {
        name: chalk.dim('Cancel'),
        value: 'cancel'
      }
    ];

    const { selectedMessage } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedMessage',
        message: 'Select commit message:',
        choices,
        pageSize: 10
      }
    ]);

    if (selectedMessage === 'cancel') {
      return null;
    }

    if (selectedMessage === 'custom') {
      return await this.manualCommitMessage();
    }

    return selectedMessage;
  }

  /**
   * Manual commit message input
   */
  async manualCommitMessage() {
    const { message } = await inquirer.prompt([
      {
        type: 'input',
        name: 'message',
        message: 'Enter commit message:',
        validate: (input) => input.trim().length > 0 || 'Message cannot be empty'
      }
    ]);

    return message.trim();
  }

  /**
   * Commit changes
   */
  async commitChanges(message) {
    this.spinner = ora('Committing changes...').start();
    
    try {
      await this.git.commit(message);
      this.spinner.succeed(`Committed: ${message}`);
    } catch (error) {
      this.spinner.fail();
      throw new Error(`Failed to commit: ${error.message}`);
    }
  }

  /**
   * Pull latest changes and handle conflicts
   */
  async pullAndHandleConflicts() {
    this.spinner = ora('Pulling latest changes...').start();
    
    try {
      const remotes = await this.git.getRemotes();
      if (remotes.length === 0) {
        this.spinner.warn('No remote configured, skipping pull');
        return;
      }

      // Get current branch
      const branch = await this.git.branch();
      const currentBranch = branch.current;

      try {
        await this.git.pull('origin', currentBranch);
        this.spinner.succeed('Successfully pulled latest changes');
      } catch (pullError) {
        this.spinner.warn('Pull resulted in conflicts');
        
        // Check if there are merge conflicts
        const status = await this.git.status();
        const conflicts = status.conflicted;

        if (conflicts.length > 0) {
          console.log(chalk.yellow(`\nFound ${conflicts.length} conflicted files:`));
          conflicts.forEach(file => console.log(chalk.red(`   - ${file}`)));

          // Attempt auto-resolution
          const resolved = await this.autoResolveConflicts(conflicts);
          
          if (resolved) {
            this.spinner = ora('Finalizing merge...').start();
            await this.git.add('.');
            await this.git.commit('Merge conflicts resolved automatically');
            this.spinner.succeed('Conflicts resolved automatically');
          } else {
            // Manual resolution required
            await this.handleManualConflictResolution(conflicts);
          }
        } else {
          // Some other pull error
          throw pullError;
        }
      }
    } catch (error) {
      this.spinner.fail();
      throw new Error(`Pull failed: ${error.message}`);
    }
  }

  /**
   * Attempt to auto-resolve simple conflicts
   */
  async autoResolveConflicts(conflicts) {
    this.spinner = ora('Attempting auto-resolution...').start();
    
    try {
      let resolvedCount = 0;
      
      for (const file of conflicts) {
        const resolved = await this.autoResolveFile(file);
        if (resolved) {
          resolvedCount++;
        }
      }

      if (resolvedCount === conflicts.length) {
        this.spinner.succeed(`Auto-resolved ${resolvedCount} conflicts`);
        return true;
      } else {
        this.spinner.warn(`Auto-resolved ${resolvedCount}/${conflicts.length} conflicts`);
        return false;
      }
    } catch (error) {
      this.spinner.fail();
      return false;
    }
  }

  /**
   * Auto-resolve simple conflicts in a file
   */
  async autoResolveFile(filePath) {
    try {
      const fs = require('fs-extra');
      const content = await fs.readFile(filePath, 'utf8');
      
      // Simple auto-resolution strategies
      let resolved = content;
      
      // Strategy 1: Take "ours" for package-lock.json and similar files
      if (filePath.includes('package-lock.json') || 
          filePath.includes('yarn.lock') ||
          filePath.includes('.lock')) {
        resolved = this.resolveConflictTakeOurs(content);
      }
      // Strategy 2: Take "theirs" for documentation files
      else if (filePath.includes('README') || 
               filePath.includes('.md') ||
               filePath.includes('CHANGELOG')) {
        resolved = this.resolveConflictTakeTheirs(content);
      }
      // Strategy 3: Simple merge for configuration files
      else if (filePath.includes('.json') || 
               filePath.includes('.yml') ||
               filePath.includes('.yaml')) {
        resolved = this.resolveSimpleJsonConflict(content);
      }
      
      // Check if we actually resolved anything
      if (resolved !== content && !resolved.includes('<<<<<<<')) {
        await fs.writeFile(filePath, resolved);
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Resolve conflict by taking "ours" (current branch)
   */
  resolveConflictTakeOurs(content) {
    return content.replace(/<<<<<<< HEAD\n([\s\S]*?)\n=======\n[\s\S]*?\n>>>>>>> .*/g, '$1');
  }

  /**
   * Resolve conflict by taking "theirs" (incoming branch)
   */
  resolveConflictTakeTheirs(content) {
    return content.replace(/<<<<<<< HEAD\n[\s\S]*?\n=======\n([\s\S]*?)\n>>>>>>> .*/g, '$1');
  }

  /**
   * Simple JSON conflict resolution
   */
  resolveSimpleJsonConflict(content) {
    // For now, just take ours for JSON files
    // In the future, this could be more sophisticated
    return this.resolveConflictTakeOurs(content);
  }

  /**
   * Handle manual conflict resolution
   */
  async handleManualConflictResolution(conflicts) {
    console.log(chalk.yellow('\nManual conflict resolution required'));
    console.log(chalk.dim('Please resolve the conflicts manually and then continue.'));
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'How would you like to proceed?',
        choices: [
          {
            name: 'Open files for manual editing',
            value: 'edit'
          },
          {
            name: 'Skip and continue (conflicts resolved externally)',
            value: 'skip'
          },
          {
            name: 'Abort workflow',
            value: 'abort'
          }
        ]
      }
    ]);

    switch (action) {
      case 'edit':
        await this.openConflictedFiles(conflicts);
        await this.waitForConflictResolution();
        break;
      case 'skip':
        console.log(chalk.yellow('Assuming conflicts are resolved...'));
        break;
      case 'abort':
        throw new Error('Workflow aborted by user');
    }
  }

  /**
   * Open conflicted files in default editor
   */
  async openConflictedFiles(conflicts) {
    const { spawn } = require('child_process');
    
    console.log(chalk.cyan('\nOpening conflicted files...'));
    
    for (const file of conflicts) {
      console.log(chalk.dim(`Opening: ${file}`));
      
      // Try different editors
      const editors = ['code', 'vim', 'nano', 'notepad'];
      
      for (const editor of editors) {
        try {
          spawn(editor, [file], { 
            stdio: 'inherit',
            detached: true 
          });
          break;
        } catch (error) {
          // Try next editor
          continue;
        }
      }
    }
  }

  /**
   * Wait for user to resolve conflicts
   */
  async waitForConflictResolution() {
    console.log(chalk.yellow('\nWaiting for conflict resolution...'));
    
    while (true) {
      const { ready } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'ready',
          message: 'Have you resolved all conflicts?',
          default: false
        }
      ]);

      if (ready) {
        // Verify conflicts are resolved
        const status = await this.git.status();
        if (status.conflicted.length === 0) {
          console.log(chalk.green('All conflicts resolved!'));
          
          // Stage resolved files and commit
          await this.git.add('.');
          await this.git.commit('Resolve merge conflicts');
          break;
        } else {
          console.log(chalk.red(`${status.conflicted.length} conflicts still remain`));
          status.conflicted.forEach(file => 
            console.log(chalk.red(`   - ${file}`))
          );
        }
      }
    }
  }

  /**
   * Push changes to remote
   */
  async pushChanges() {
    this.spinner = ora('Pushing changes...').start();
    
    try {
      const remotes = await this.git.getRemotes();
      if (remotes.length === 0) {
        this.spinner.warn('No remote configured, skipping push');
        return;
      }

      const branch = await this.git.branch();
      const currentBranch = branch.current;

      await this.git.push('origin', currentBranch);
      this.spinner.succeed('Successfully pushed changes');
    } catch (error) {
      this.spinner.fail();
      throw new Error(`Push failed: ${error.message}`);
    }
  }

  /**
   * Summarize changes for display
   */
  summarizeChanges(status) {
    const summary = [];
    
    if (status.created.length > 0) {
      summary.push(`${status.created.length} new files`);
    }
    if (status.modified.length > 0) {
      summary.push(`${status.modified.length} modified`);
    }
    if (status.deleted.length > 0) {
      summary.push(`${status.deleted.length} deleted`);
    }
    if (status.renamed.length > 0) {
      summary.push(`${status.renamed.length} renamed`);
    }

    return `   ${summary.join(', ')}`;
  }

  /**
   * Suggest recovery actions on failure
   */
  async suggestRecovery(error) {
    console.log(chalk.yellow('\nSuggested recovery actions:'));
    
    if (error.message.includes('not a git repository')) {
      console.log(chalk.dim('   • Run: git init'));
      console.log(chalk.dim('   • Add remote: git remote add origin <url>'));
    } else if (error.message.includes('no changes')) {
      console.log(chalk.dim('   • Make some changes to your files'));
      console.log(chalk.dim('   • Use --force to run anyway'));
    } else if (error.message.includes('API key')) {
      console.log(chalk.dim('   • Run: aic setup'));
      console.log(chalk.dim('   • Configure your AI provider'));
    } else if (error.message.includes('conflict')) {
      console.log(chalk.dim('   • Resolve conflicts manually'));
      console.log(chalk.dim('   • Run: git status to see conflicted files'));
      console.log(chalk.dim('   • Run: git add . && git commit after resolving'));
    } else {
      console.log(chalk.dim('   • Check git status: git status'));
      console.log(chalk.dim('   • Check git log: git log --oneline -5'));
      console.log(chalk.dim('   • Try again: aic'));
    }
  }
}

module.exports = AutoGit;