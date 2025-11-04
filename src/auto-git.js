/**
 * Auto Git - Simplified git workflow automation
 * Usage: aic (AI Commit) - does everything automatically
 */

const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const simpleGit = require('simple-git');
const AICommitGenerator = require('./index.js');
const LintManager = require('./core/lint-manager');

class AutoGit {
  constructor() {
    this.git = simpleGit();
    this.aiCommit = new AICommitGenerator();
    this.lintManager = new LintManager();
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

      // Step 4: Run linting if enabled (default: enabled with auto-fix and AI fallback)
      if (options.lint !== false) {
        // Default to auto-fix and AI fallback unless explicitly disabled
        const autoFix = options.lintFix !== false;
        const useAI = options.aiLint !== false;
        const lintResults = await this.runLinting({
          ...options,
          autoFix,
          useAI,
          aiFallback: useAI,
        });

        if (!lintResults.success) {
          console.log(
            chalk.yellow(
              'Linting failed with unfixable errors. Use --no-lint to skip or --ai-lint to enable AI fixes.'
            )
          );

          const { continueAnyway } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'continueAnyway',
              message: 'Continue with commit despite linting failures?',
              default: false,
            },
          ]);

          if (!continueAnyway) {
            return;
          }
        }
      }

      // Step 5: Run test validation if requested
      if (options.testValidate) {
        const fixes = await this.runTestValidation(options);
        if (fixes === false && options.autoFix !== false) {
          console.log(
            chalk.yellow(
              'Validation failed and auto-fix is disabled. Aborting.'
            )
          );
          return;
        }
      }

      // Step 6: Generate or use provided commit message
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

      // Step 7: Commit changes
      await this.commitChanges(commitMessage, options);

      // Step 7: Pull latest changes and handle conflicts (unless skipped)
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
            throw new Error('Workflow aborted due to pull failure');
          }
        }
      }

      // Step 8: Push changes (unless disabled)
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
        console.log(
          chalk.yellow('No remote found. Only local commit will be performed.')
        );
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
  async generateCommitMessage(options = {}) {
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
            default: true,
          },
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
  async generateAIMessages(diff, options = {}) {
    const config = await this.aiCommit.configManager.load();
    const AIProviderFactory = require('./providers/ai-provider-factory');

    // Use auto-configuration to get the best available provider
    const autoConfig = await AIProviderFactory.autoConfigureProvider(config);
    const provider = AIProviderFactory.create(autoConfig.provider);

    // Analyze repository context
    const context = await this.aiCommit.analysisEngine.analyzeRepository();

    const messages = await provider.generateCommitMessages(diff, {
      ...options,
      model: autoConfig.model,
      context,
      count: 3,
      language: config.language || 'en',
      conventional: config.conventionalCommits,
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
        short: `Message ${index + 1}`,
      })),
      {
        name: chalk.dim('Write custom message'),
        value: 'custom',
      },
      {
        name: chalk.dim('Cancel'),
        value: 'cancel',
      },
    ];

    const { selectedMessage } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedMessage',
        message: 'Select commit message:',
        choices,
        pageSize: 10,
      },
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
        validate: (input) =>
          input.trim().length > 0 || 'Message cannot be empty',
      },
    ]);

    return message.trim();
  }

  /**
   * Commit changes
   */
  async commitChanges(message, options = {}) {
    this.spinner = ora('Committing changes...').start();

    try {
      // If test validation was requested, use dual commit functionality
      if (options.testValidate) {
        const commits =
          await this.aiCommit.gitManager.createDualCommits(message);

        this.spinner.succeed(`Created ${commits.length} commit(s):`);
        commits.forEach((commit, index) => {
          const type =
            commit.type === 'original' ? '📝 Original' : '🔧 Corrected';
          console.log(
            chalk.cyan(
              `  ${index + 1}. ${type}: ${commit.hash.substring(0, 8)}`
            )
          );
        });
      } else {
        // Standard single commit
        await this.git.commit(message);
        this.spinner.succeed(`Committed: ${message}`);
      }
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
        // Use explicit pull strategy to avoid rebase conflicts
        await this.git.pull('origin', currentBranch, { '--no-rebase': null });
        this.spinner.succeed('Successfully pulled latest changes');
      } catch (pullError) {
        this.spinner.warn('Pull resulted in conflicts');

        // Check for specific rebase error
        if (
          pullError.message.includes('Cannot rebase onto multiple branches')
        ) {
          console.log(
            chalk.yellow(
              '\nDetected rebase conflict. Falling back to merge strategy...'
            )
          );

          // Retry with merge strategy
          try {
            await this.git.pull('origin', currentBranch, {
              '--no-rebase': null,
              '--no-ff': null,
            });
            this.spinner.succeed('Successfully pulled with merge strategy');
            return;
          } catch (mergeError) {
            console.log(
              chalk.yellow(
                'Merge strategy also failed. Checking for conflicts...'
              )
            );
          }
        }

        // Check if there are merge conflicts
        const status = await this.git.status();
        const conflicts = status.conflicted;

        if (conflicts.length > 0) {
          console.log(
            chalk.yellow(`\nFound ${conflicts.length} conflicted files:`)
          );
          conflicts.forEach((file) => console.log(chalk.red(`   - ${file}`)));

          // Attempt standard auto-resolution first
          const standardResolved = await this.autoResolveConflicts(conflicts);

          if (!standardResolved && conflicts.length > 0) {
            // Try AI-assisted resolution for remaining conflicts
            console.log(
              chalk.blue(
                '\nStandard resolution failed. Trying AI-assisted resolution...'
              )
            );
            const aiResolved =
              await this.aiAssistedConflictResolution(conflicts);

            if (aiResolved) {
              // Check if all conflicts are resolved
              const remainingStatus = await this.git.status();
              if (remainingStatus.conflicted.length === 0) {
                this.spinner = ora('Finalizing merge...').start();
                await this.git.add('.');
                await this.git.commit(
                  'Merge conflicts resolved with AI assistance'
                );
                this.spinner.succeed('Conflicts resolved with AI assistance');
                return;
              }
            }
          }

          if (standardResolved) {
            this.spinner = ora('Finalizing merge...').start();
            await this.git.add('.');
            await this.git.commit('Merge conflicts resolved automatically');
            this.spinner.succeed('Conflicts resolved automatically');
          } else {
            // Manual resolution required
            await this.handleManualConflictResolution(conflicts);
          }
        } else {
          // Some other pull error - provide more specific guidance
          if (
            pullError.message.includes('Cannot rebase onto multiple branches')
          ) {
            throw new Error(
              'Git rebase conflict. This can happen with complex branch setups. Try: git pull --no-rebase'
            );
          } else if (pullError.message.includes('fatal:')) {
            throw new Error(
              `Git fatal error: ${pullError.message.replace('fatal: ', '').trim()}`
            );
          } else {
            throw pullError;
          }
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
        this.spinner.warn(
          `Auto-resolved ${resolvedCount}/${conflicts.length} conflicts`
        );
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
      if (
        filePath.includes('package-lock.json') ||
        filePath.includes('yarn.lock') ||
        filePath.includes('.lock')
      ) {
        resolved = this.resolveConflictTakeOurs(content);
      }
      // Strategy 2: Take "theirs" for documentation files
      else if (
        filePath.includes('README') ||
        filePath.includes('.md') ||
        filePath.includes('CHANGELOG')
      ) {
        resolved = this.resolveConflictTakeTheirs(content);
      }
      // Strategy 3: Enhanced JSON conflict resolution
      else if (
        filePath.includes('.json') ||
        filePath.includes('.yml') ||
        filePath.includes('.yaml')
      ) {
        resolved = this.resolveEnhancedConfigConflict(content, filePath);
      }
      // Strategy 4: TypeScript/JavaScript conflict resolution
      else if (filePath.includes('.ts') || filePath.includes('.js')) {
        resolved = this.resolveJavaScriptConflict(content, filePath);
      }
      // Strategy 5: CSS/SCSS conflict resolution
      else if (
        filePath.includes('.css') ||
        filePath.includes('.scss') ||
        filePath.includes('.sass')
      ) {
        resolved = this.resolveStyleConflict(content, filePath);
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
   * Enhanced configuration file conflict resolution
   */
  resolveEnhancedConfigConflict(content, filePath) {
    const lines = content.split('\n');
    const resolvedLines = [];
    let inConflict = false;
    let ourLines = [];
    let theirLines = [];
    let currentSection = 'none';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('<<<<<<<')) {
        inConflict = true;
        currentSection = 'ours';
        continue;
      } else if (line.startsWith('=======')) {
        currentSection = 'theirs';
        continue;
      } else if (line.startsWith('>>>>>>>')) {
        inConflict = false;

        // Resolve the conflict based on file type and content
        const resolution = this.resolveConfigConflict(
          ourLines,
          theirLines,
          filePath
        );
        resolvedLines.push(...resolution);

        ourLines = [];
        theirLines = [];
        currentSection = 'none';
        continue;
      }

      if (inConflict) {
        if (currentSection === 'ours') {
          ourLines.push(line);
        } else {
          theirLines.push(line);
        }
      } else {
        resolvedLines.push(line);
      }
    }

    return resolvedLines.join('\n');
  }

  /**
   * Resolve configuration conflicts intelligently
   */
  resolveConfigConflict(ourLines, theirLines, filePath) {
    // For package.json, try to merge dependencies
    if (filePath.includes('package.json')) {
      return this.mergePackageJsonConflict(ourLines, theirLines);
    }

    // For environment files, prioritize ours (local changes)
    if (filePath.includes('.env')) {
      return ourLines;
    }

    // For other config files, try simple merging
    try {
      const ourObj = this.parseConfigLines(ourLines);
      const theirObj = this.parseConfigLines(theirLines);

      // Merge objects: their values take precedence except for local config
      const merged = { ...theirObj, ...ourObj };

      // Convert back to lines
      return Object.entries(merged).map(([key, value]) => {
        if (typeof value === 'string' && value.includes(' ')) {
          return `${key}: "${value}"`;
        }
        return `${key}: ${value}`;
      });
    } catch (error) {
      // Fallback to our lines if parsing fails
      return ourLines;
    }
  }

  /**
   * Merge package.json conflicts
   */
  mergePackageJsonConflict(ourLines, theirLines) {
    try {
      const ourSection = this.parseJsonSection(ourLines);
      const theirSection = this.parseJsonSection(theirLines);

      if (
        ourSection.type === 'dependencies' ||
        theirSection.type === 'dependencies'
      ) {
        // Merge dependencies
        const merged = { ...theirSection.content, ...ourSection.content };
        const keys = Object.keys(merged).sort();
        return keys.map((key) => `    "${key}": "${merged[key]}"`);
      }

      // For other sections, prefer theirs (upstream)
      return theirLines;
    } catch (error) {
      return ourLines;
    }
  }

  /**
   * Parse JSON section from conflict lines
   */
  parseJsonSection(lines) {
    const content = {};
    let type = 'unknown';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('"')) {
        const match = trimmed.match(/"([^"]+)"\s*:\s*"([^"]+)"/);
        if (match) {
          content[match[1]] = match[2];
          if (
            ['dependencies', 'devDependencies', 'peerDependencies'].includes(
              match[1]
            )
          ) {
            type = 'dependencies';
          }
        }
      }
    }

    return { type, content };
  }

  /**
   * Parse configuration lines into key-value pairs
   */
  parseConfigLines(lines) {
    const config = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([^=:]+)[:=]\s*(.+)$/);
        if (match) {
          config[match[1].trim()] = match[2].trim().replace(/['"]/g, '');
        }
      }
    }

    return config;
  }

  /**
   * Resolve JavaScript/TypeScript conflicts
   */
  resolveJavaScriptConflict(content, _filePath) {
    // For JavaScript files, try to preserve function signatures and imports
    const lines = content.split('\n');
    const resolvedLines = [];
    let inConflict = false;
    let ourLines = [];
    let theirLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('<<<<<<<')) {
        inConflict = true;
        continue;
      } else if (line.startsWith('=======')) {
        continue;
      } else if (line.startsWith('>>>>>>>')) {
        inConflict = false;

        // Prefer lines with function definitions or imports
        const resolution = this.resolveJavaScriptConflictHelper(
          ourLines,
          theirLines
        );
        resolvedLines.push(...resolution);

        ourLines = [];
        theirLines = [];
        continue;
      }

      if (inConflict) {
        if (line.startsWith('+') || line.startsWith('-')) {
          // This is from the diff marker, determine which side
          if (ourLines.length === 0) {
            theirLines.push(line);
          } else {
            ourLines.push(line);
          }
        } else {
          // Regular content in conflict
          if (ourLines.length <= theirLines.length) {
            ourLines.push(line);
          } else {
            theirLines.push(line);
          }
        }
      } else {
        resolvedLines.push(line);
      }
    }

    return resolvedLines.join('\n');
  }

  /**
   * Helper for JavaScript conflict resolution
   */
  resolveJavaScriptConflictHelper(ourLines, theirLines) {
    // Prioritize lines with function definitions, imports, exports
    const hasImportantContent = (lines) => {
      return lines.some(
        (line) =>
          line.includes('function') ||
          line.includes('import') ||
          line.includes('export') ||
          line.includes('class') ||
          line.includes('const')
      );
    };

    if (hasImportantContent(ourLines) && !hasImportantContent(theirLines)) {
      return ourLines;
    } else if (
      !hasImportantContent(ourLines) &&
      hasImportantContent(theirLines)
    ) {
      return theirLines;
    }

    // Default to our changes
    return ourLines;
  }

  /**
   * Resolve CSS/SCSS conflicts
   */
  resolveStyleConflict(content, _filePath) {
    // For CSS, merge by combining rules
    const lines = content.split('\n');
    const resolvedLines = [];
    let inConflict = false;
    let ourRules = new Set();
    let theirRules = new Set();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('<<<<<<<')) {
        inConflict = true;
        continue;
      } else if (line.startsWith('=======')) {
        continue;
      } else if (line.startsWith('>>>>>>>')) {
        inConflict = false;

        // Merge CSS rules
        const merged = [...theirRules, ...ourRules].filter(
          (rule, index, arr) => arr.indexOf(rule) === index
        );
        resolvedLines.push(...merged);

        ourRules.clear();
        theirRules.clear();
        continue;
      }

      if (inConflict) {
        if (line.trim().includes('{') || line.trim().includes('}')) {
          // CSS selector or closing brace
          if (ourRules.size <= theirRules.size) {
            ourRules.add(line);
          } else {
            theirRules.add(line);
          }
        } else {
          // CSS property
          if (ourRules.size <= theirRules.size) {
            ourRules.add(line);
          } else {
            theirRules.add(line);
          }
        }
      } else {
        resolvedLines.push(line);
      }
    }

    return resolvedLines.join('\n');
  }

  /**
   * Resolve conflict by taking "ours" (current branch)
   */
  resolveConflictTakeOurs(content) {
    return content.replace(
      /<<<<<<< HEAD\n([\s\S]*?)\n=======\n[\s\S]*?\n>>>>>>> .*/g,
      '$1'
    );
  }

  /**
   * Resolve conflict by taking "theirs" (incoming branch)
   */
  resolveConflictTakeTheirs(content) {
    return content.replace(
      /<<<<<<< HEAD\n[\s\S]*?\n=======\n([\s\S]*?)\n>>>>>>> .*/g,
      '$1'
    );
  }

  /**
   * AI-assisted conflict resolution for complex cases
   */
  async aiAssistedConflictResolution(conflicts) {
    if (conflicts.length === 0) return false;

    this.spinner = ora('Attempting AI-assisted conflict resolution...').start();

    try {
      const resolvedCount = await this.aiResolveConflicts(conflicts);

      if (resolvedCount > 0) {
        this.spinner.succeed(`AI resolved ${resolvedCount} conflicts`);
        return true;
      } else {
        this.spinner.warn('AI could not resolve conflicts automatically');
        return false;
      }
    } catch (error) {
      this.spinner.fail('AI conflict resolution failed');
      console.log(chalk.yellow('AI resolution error:', error.message));
      return false;
    }
  }

  /**
   * Use AI to resolve conflicts
   */
  async aiResolveConflicts(conflicts) {
    let resolvedCount = 0;

    for (const file of conflicts) {
      try {
        const resolved = await this.aiResolveFileConflict(file);
        if (resolved) {
          resolvedCount++;
        }
      } catch (error) {
        console.log(
          chalk.yellow(`Failed to AI-resolve ${file}: ${error.message}`)
        );
      }
    }

    return resolvedCount;
  }

  /**
   * AI resolve individual file conflict
   */
  async aiResolveFileConflict(filePath) {
    const fs = require('fs-extra');

    try {
      const content = await fs.readFile(filePath, 'utf8');

      // Skip if no conflict markers
      if (!content.includes('<<<<<<<')) {
        return false;
      }

      // Extract conflict sections
      const conflictSections = this.extractConflictSections(content);
      if (!conflictSections.length) {
        return false;
      }

      // Use AI to suggest resolution for complex conflicts
      const aiSuggestion = await this.getAIConflictResolution(
        filePath,
        conflictSections
      );

      if (aiSuggestion && aiSuggestion.resolved) {
        await fs.writeFile(filePath, aiSuggestion.resolution);
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract conflict sections for AI analysis
   */
  extractConflictSections(content) {
    const lines = content.split('\n');
    const sections = [];
    let currentSection = null;
    let startLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('<<<<<<<')) {
        currentSection = {
          type: 'conflict',
          start: i,
          ours: [],
          theirs: [],
        };
        startLine = i;
      } else if (line.startsWith('=======')) {
        if (currentSection) {
          currentSection.separator = i;
        }
      } else if (line.startsWith('>>>>>>>')) {
        if (currentSection) {
          currentSection.end = i;
          sections.push({
            ...currentSection,
            context: this.getConflictContext(lines, startLine, i),
          });
          currentSection = null;
        }
      } else if (currentSection) {
        if (currentSection.separator === undefined) {
          currentSection.ours.push(line);
        } else {
          currentSection.theirs.push(line);
        }
      }
    }

    return sections;
  }

  /**
   * Get context around conflict for AI understanding
   */
  getConflictContext(lines, start, end) {
    const contextLines = 3;
    const before = Math.max(0, start - contextLines);
    const after = Math.min(lines.length, end + contextLines + 1);

    return {
      before: lines.slice(before, start).join('\n'),
      after: lines.slice(after, end + contextLines + 1).join('\n'),
      fileTypes: this.inferFileType(lines.slice(start, end + 1)),
    };
  }

  /**
   * Infer file type from conflict content
   */
  inferFileType(lines) {
    const content = lines.join('\n');

    if (
      content.includes('import') ||
      content.includes('export') ||
      content.includes('function')
    ) {
      return 'javascript';
    } else if (content.includes('class ') || content.includes('def ')) {
      return content.includes('def ') ? 'python' : 'typescript';
    } else if (content.includes('{') && content.includes('"')) {
      return 'json';
    } else if (content.includes('#') && content.includes(':')) {
      return 'yaml';
    } else if (content.includes('html') || content.includes('<')) {
      return 'html';
    }

    return 'text';
  }

  /**
   * Get AI conflict resolution suggestion
   */
  async getAIConflictResolution(filePath, conflictSections) {
    try {
      // Use the existing AI provider system
      const AIProviderFactory = require('./providers/ai-provider-factory');
      const config = await this.aiCommit.configManager.load();

      if (!config.apiKey && config.defaultProvider !== 'ollama') {
        return null; // No AI available
      }

      const provider = AIProviderFactory.create(config.defaultProvider);

      // Build a prompt for conflict resolution
      const prompt = this.buildConflictResolutionPrompt(
        filePath,
        conflictSections
      );

      // Get AI suggestion
      const response = await provider.generateCommitMessages(prompt, {
        count: 1,
        context: { type: 'conflict-resolution' },
      });

      if (response && response.length > 0) {
        // Parse the AI response for resolution
        return this.parseAIConflictResponse(response[0], conflictSections);
      }

      return null;
    } catch (error) {
      console.warn('AI conflict resolution failed:', error.message);
      return null;
    }
  }

  /**
   * Build prompt for AI conflict resolution
   */
  buildConflictResolutionPrompt(filePath, conflictSections) {
    return `You are helping resolve a merge conflict in the file: ${filePath}

Below are the conflict sections that need to be resolved:

${conflictSections
    .map(
      (section, index) => `
Conflict ${index + 1}:
<<<<<<< HEAD (our changes)
${section.ours.join('\n')}
=======
${section.theirs.join('\n')}
>>>>>>> their changes

Context around this conflict:
Before: ${section.context.before}
After: ${section.context.after}
`
    )
    .join('\n')}

Please provide a resolution that:
1. Preserves important functionality from both sides
2. Maintains syntactic correctness
3. Follows best practices for the file type
4. Removes all conflict markers (<<<<<<<, =======, >>>>>>>)

Respond with only the resolved conflict content, no explanation:`;
  }

  /**
   * Parse AI conflict response
   */
  parseAIConflictResponse(response, _conflictSections) {
    if (!response || response.trim().length === 0) {
      return null;
    }

    // Simple validation - check if conflict markers are removed
    if (
      response.includes('<<<<<<<') ||
      response.includes('=======') ||
      response.includes('>>>>>>>')
    ) {
      return null; // AI didn't properly resolve
    }

    return {
      resolved: true,
      resolution: response.trim(),
    };
  }

  /**
   * Handle manual conflict resolution
   */
  async handleManualConflictResolution(conflicts) {
    console.log(chalk.yellow('\nManual conflict resolution required'));
    console.log(
      chalk.dim('Please resolve the conflicts manually and then continue.')
    );

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'How would you like to proceed?',
        choices: [
          {
            name: 'Open files for manual editing',
            value: 'edit',
          },
          {
            name: 'Skip and continue (conflicts resolved externally)',
            value: 'skip',
          },
          {
            name: 'Abort workflow',
            value: 'abort',
          },
        ],
      },
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
            detached: true,
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

    let ready = true;
    while (ready) {
      const result = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'ready',
          message: 'Have you resolved all conflicts?',
          default: false,
        },
      ]);

      if (result.ready) {
        // Verify conflicts are resolved
        const status = await this.git.status();
        if (status.conflicted.length === 0) {
          console.log(chalk.green('All conflicts resolved!'));

          // Stage resolved files and commit
          await this.git.add('.');
          await this.git.commit('Resolve merge conflicts');
          break;
        } else {
          console.log(
            chalk.red(`${status.conflicted.length} conflicts still remain`)
          );
          status.conflicted.forEach((file) =>
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
   * Run linting workflow
   */
  async runLinting(options = {}) {
    try {
      const {
        autoFix = true,
        projectType = null,
        useAI = true,
        aiFallback = true,
      } = options;

      // Get staged files
      const status = await this.git.status();
      const stagedFiles = [
        ...status.created,
        ...status.modified,
        ...status.renamed.map((f) => f.to),
      ];

      if (stagedFiles.length === 0) {
        console.log(chalk.yellow('⚠️  No staged files to lint'));
        return {
          success: true,
          results: [],
          summary: { total: 0, passed: 0, failed: 0, fixed: 0 },
        };
      }

      // Get repository root for project detection
      const repoRoot = await this.git.revparse(['--show-toplevel']);

      // First try standard linting with auto-fix
      const standardResults = await this.lintManager.lintFiles(stagedFiles, {
        autoFix,
        projectType,
        repoRoot: repoRoot.trim(),
      });

      // If standard linting succeeded or AI fallback is disabled, return results
      if (standardResults.success || !aiFallback) {
        this.lintManager.printResults(standardResults);
        return standardResults;
      }

      // Try AI fallback for unfixable errors
      if (useAI) {
        // Initialize AI provider if not already done
        if (!this.lintManager.aiProvider) {
          try {
            const AIProviderFactory = require('./providers/ai-provider-factory');
            const config = await this.aiCommit.configManager.load();
            const providerName = config.defaultProvider || 'groq';
            this.lintManager.aiProvider =
              AIProviderFactory.create(providerName);
          } catch (error) {
            console.log(
              chalk.yellow(
                '   ⚠️  Could not initialize AI provider for linting fixes'
              )
            );
            this.lintManager.printResults(standardResults);
            return standardResults;
          }
        }
        console.log(
          chalk.blue('\n🤖 Standard linting failed, attempting AI fixes...')
        );

        const aiResults = await this.lintManager.lintFilesWithAI(stagedFiles, {
          autoFix: false, // Don't double-fix
          useAI: true,
          projectType,
          repoRoot: repoRoot.trim(),
        });

        // Print enhanced results
        this.lintManager.printResults(aiResults);
        return aiResults;
      }

      // Print standard results if AI is not available
      this.lintManager.printResults(standardResults);
      return standardResults;
    } catch (error) {
      console.error(chalk.red(`❌ Linting failed: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  /**
   * Run test validation workflow
   */
  async runTestValidation(options) {
    try {
      console.log(chalk.blue('🧪 Running test validation...'));

      // Use the AI commit generator's test validation
      const fixes = await this.aiCommit.runTestValidation(options);

      if (fixes && fixes.summary.totalFixes > 0) {
        console.log(
          chalk.green(`✅ Applied ${fixes.summary.totalFixes} fixes`)
        );
      } else if (fixes === null) {
        console.log(chalk.green('✅ All validations passed!'));
      }

      return fixes;
    } catch (error) {
      console.error(chalk.red(`❌ Test validation failed: ${error.message}`));

      if (options.autoFix !== false) {
        const { continueAnyway } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'continueAnyway',
            message: 'Continue with commit despite validation failures?',
            default: false,
          },
        ]);

        if (!continueAnyway) {
          return false;
        }
      }

      return null;
    }
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
      console.log(
        chalk.dim('   • Run: git add . && git commit after resolving')
      );
    } else if (error.message.includes('Cannot rebase onto multiple branches')) {
      console.log(chalk.dim('   • Try: git pull --no-rebase'));
      console.log(chalk.dim('   • Or: git config pull.rebase false'));
      console.log(chalk.dim('   • Then run: aic again'));
    } else {
      console.log(chalk.dim('   • Check git status: git status'));
      console.log(chalk.dim('   • Check git log: git log --oneline -5'));
      console.log(chalk.dim('   • Try again: aic'));
    }
  }
}

module.exports = AutoGit;
