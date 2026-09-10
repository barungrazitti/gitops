/**
 * Auto Git - Simplified git workflow automation
 * Usage: aic (AI Commit) - does everything automatically
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const { DIFF_MARKER_REGEX } = require('./core/conflict-resolver');

class AutoGit {
  // Cap on rebase --continue rounds: each round replays remaining commits and
  // can surface new conflicts. Past this, the branch needs human attention.
  static MAX_SYNC_ROUNDS = 3;

  // Preview length for the AI-resolution review gate.
  static REVIEW_PREVIEW_LINES = 100;

  constructor({ gitManager, analysisEngine, configManager, generateMessages, conflictResolver, activityLogger } = {}) {
    this.gitManager = gitManager;
    this.analysisEngine = analysisEngine;
    this.configManager = configManager;
    this.generateMessages = generateMessages;
    this.conflictResolver = conflictResolver;
    this.activityLogger = activityLogger;
    this.spinner = ora();
    // 'rebase' | 'merge' | null — which sync operation produced the current
    // conflicts. ours/theirs MEANING depends on it (git swaps the sides
    // under rebase), so every side choice goes through sideForIntent().
    this.syncOperation = null;
  }

  /**
   * Main auto git workflow
   */
  async run(options = {}) {
    const startTime = Date.now();

    // Handle dry run mode
    if (options.dryRun) {
      await this.activityLogger.info('auto_git_started', { options });

      // Emit the message that WOULD be committed (stdout seam for hooks:
      // `aic --dry-run | head -1` must receive a real candidate message).
      // A manual message wins over AI generation, mirroring the commit path.
      let dryRunMessage = options.manualMessage || null;
      if (!dryRunMessage) {
        try {
          dryRunMessage = await this.generateCommitMessage(options);
        } catch (e) {
          dryRunMessage = null;
        }
      }
      if (dryRunMessage) {
        console.log(dryRunMessage);
      }

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
        console.log(chalk.yellow('Nothing to commit — no changes detected. Use "aic -f" to force.'));
        await this.activityLogger.info('auto_git_completed', {
          reason: 'no_changes',
          duration: Date.now() - startTime,
        });
        return;
      }

      // Step 3: Stage all changes (if not already staged)
      await this.stageChanges();

      // Step 3.5: Syntax check staged .js files
      if (!options.skipSyntaxCheck) {
        const syntaxOk = await this.syntaxCheck();
        if (!syntaxOk) return;
      }

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
      const isRepo = await this.gitManager.validateRepository();
      if (!isRepo) {
        this.spinner.fail('Repository validation failed');
        throw new Error('Not a git repository. Run "git init" to create one, or cd into an existing repo.');
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
      const status = await this.gitManager.getStatusCached();
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
      await this.gitManager.stageAll();
      this.gitManager.invalidateStatusCache();
      this.spinner.succeed('Changes staged');
    } catch (error) {
      this.spinner.fail('Failed to stage changes');
      throw error;
    }
  }

  /**
   * Check syntax of staged .js files
   */
  async syntaxCheck() {
    this.spinner.start('Checking syntax of staged .js files...');
    try {
      const { valid, errors } = await this.gitManager.syntaxCheck();
      if (!valid) {
        this.spinner.fail(`${errors.length} file(s) have syntax errors`);
        console.log(chalk.red('\n❌ Syntax errors found in staged files:\n'));
        for (const { file, error } of errors) {
          console.log(chalk.yellow(`  ${file}:`));
          console.log(`    ${error}\n`);
        }
        const { continueAnyway } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'continueAnyway',
            message: 'Continue with commit despite syntax errors?',
            default: false,
          },
        ]);
        if (!continueAnyway) {
          await this.activityLogger.info('auto_git_cancelled', { reason: 'syntax_errors' });
          return false;
        }
        await this.activityLogger.warn('syntax_check_continued', { errors });
      } else {
        this.spinner.succeed('Syntax check passed');
      }
      return true;
    } catch (error) {
      console.log(chalk.gray('ℹ Syntax check skipped (node not available)'));
      return true;
    }
  }

  /**
   * Generate AI commit message
   */
  async generateCommitMessage(_options) {
    this.spinner.start('Generating AI commit message...');
    try {
      // Get repository context for better AI generation
      const context = await this.analysisEngine.analyzeRepository();

      // Get the staged diff
      const diff = await this.gitManager.getStagedDiff();

      if (!diff || diff.trim().length === 0) {
        this.spinner.fail('No staged changes available');
        throw new Error(
          'No staged changes available. Stage files first with "git add ." or use "aic" (auto mode stages everything).'
        );
      }

      // Check for and clean up conflict markers before generating commit
      if (DIFF_MARKER_REGEX.test(diff)) {
        this.spinner.text = chalk.yellow('Conflict markers detected, cleaning up...');
        const cleanupResult = await this.conflictResolver.detectAndCleanupConflictMarkers();

        if (cleanupResult.cleaned) {
          // Re-stage the cleaned files
          await this.gitManager.stageAll();

          // Get fresh diff after cleanup
          const newDiff = await this.gitManager.getStagedDiff();

          if (newDiff && newDiff.trim().length > 0) {
            // Generate commit message from cleaned diff
            const config = await this.configManager.getAll();
            const messages = await this.generateMessages(newDiff, {
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
      const config = await this.configManager.getAll();
      const messages = await this.generateMessages(diff, {
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
      console.log(chalk.dim('  Check your API key with "aic config --list" or run "aic setup"'));
      throw error;
    }
  }

  /**
   * Commit changes
   */
  async commitChanges(message, _options) {
    this.spinner.start('Committing changes...');
    try {
      await this.gitManager.commit(message);
      this.spinner.succeed(`Committed: ${message}`);
    } catch (error) {
      this.spinner.fail('Failed to commit changes');
      console.log(chalk.red('✗ Failed to commit changes'));
      if (error.message.includes('hook')) {
        console.log(chalk.dim('  A git hook rejected the commit. Check your .git/hooks/'));
      }
      throw error;
    }
  }

  /**
   * Sync with the remote, rebase-first.
   *
   * Team-scale rationale: plain `git pull` mints a merge commit on every
   * divergent sync. On a busy repo that buries real work under "Merge
   * branch ..." noise and breaks `git bisect`. Rebasing replays the (few,
   * just-committed) local commits onto the updated upstream instead, keeping
   * history linear and reviewable. Merge stays available as an explicit
   * fallback — never the default. We pass --rebase per command rather than
   * setting pull.rebase in the user's config, so the tool never mutates
   * their global git setup.
   */
  async pullAndHandleConflicts() {
    this.spinner.start('Pulling latest changes (rebase)...');
    let pullResult;
    try {
      pullResult = await this.gitManager.pull({ rebase: true });
    } catch (error) {
      // Rebase conflicts surface as pull failures — confirm via status rather
      // than parsing error text, which varies across git versions.
      const conflicted = await this.conflictedFiles();
      if (conflicted.length > 0) {
        this.syncOperation = 'rebase';
        await this.handleRebaseConflicts(conflicted);
        return;
      }
      console.log(chalk.red(`✗ Pull failed: ${error.message}`));
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

      throw error;
    }

    if (!pullResult) {
      this.spinner.succeed('Already up to date');
      return;
    }

    // Rebase applied cleanly but moved the branch — double-check for leftovers.
    const leftover = await this.conflictedFiles();
    if (leftover.length > 0) {
      this.syncOperation = 'rebase';
      await this.handleRebaseConflicts(leftover);
      return;
    }
    // Note: a rebase that only replays local commits reports no changed
    // files, so "synced" (not "already up to date") is the honest label.
    this.spinner.succeed('Synced with upstream via rebase, no conflicts');
  }

  /**
   * List currently conflicted files, tolerating status failures.
   */
  async conflictedFiles() {
    try {
      const status = await this.gitManager.getStatus();
      return status?.conflicted || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Map a user intent to the git side for the CURRENT sync operation.
   *
   * Merge: ours = local HEAD, theirs = incoming remote (intuitive).
   * Rebase: git replays local work ONTO the upstream, so the sides swap —
   * ours = upstream, theirs = the local commits being replayed (per
   * git-checkout docs: "during rebase, ours and theirs may appear swapped").
   * Callers use intents ('keep-mine'/'keep-incoming') and never raw sides,
   * so the UI stays correct under both operations.
   */
  sideForIntent(intent) {
    if (this.syncOperation === 'rebase') {
      return intent === 'keep-mine' ? 'theirs' : 'ours';
    }
    return intent === 'keep-mine' ? 'ours' : 'theirs';
  }

  /**
   * Abort whichever sync operation is in progress, restoring the branch.
   */
  async abortSync() {
    if (this.syncOperation === 'rebase') {
      await this.gitManager.rebaseAbort();
    } else {
      await this.gitManager.mergeAbort();
    }
  }

  /**
   * Shared strategy menu. No ours/theirs jargon: users pick an intent and
   * sideForIntent() translates it for the active operation.
   */
  async promptSyncStrategy(conflictedFiles, { allowMergeFallback }) {
    const op = this.syncOperation;
    console.log(chalk.yellow(`⚠ Sync conflicts in ${conflictedFiles.length} file(s) (${op})`));
    conflictedFiles.forEach(file => {
      console.log(chalk.gray(`  • ${file}`));
    });

    const choices = [
      {
        name: '🤖 AI-powered resolution (you review before anything is committed)',
        value: 'ai',
      },
      { name: '💾 Keep my changes (local)', value: 'keep-mine' },
      { name: '📥 Use incoming changes (remote)', value: 'keep-incoming' },
    ];
    if (allowMergeFallback) {
      choices.push({ name: '🔀 Fall back to merge instead of rebase', value: 'merge-fallback' });
    }
    choices.push(
      { name: '🔧 Manual resolution', value: 'manual' },
      {
        name:
          op === 'rebase'
            ? '❌ Abort rebase (branch stays exactly as it was)'
            : '❌ Abort merge (branch stays exactly as it was)',
        value: 'abort',
      }
    );

    const { resolutionStrategy } = await inquirer.prompt([
      {
        type: 'list',
        name: 'resolutionStrategy',
        message: 'Choose conflict resolution strategy:',
        choices,
        default: 'ai',
      },
    ]);
    return resolutionStrategy;
  }

  manualInstructions() {
    if (this.syncOperation === 'rebase') {
      console.log(chalk.yellow('\n📝 Manual conflict resolution required:'));
      console.log(chalk.dim('   1. Resolve conflicts in your editor'));
      console.log(chalk.dim('   2. Stage resolved files with: git add <files>'));
      console.log(chalk.dim('   3. Continue with: git rebase --continue (or abort with: git rebase --abort)'));
    } else {
      console.log(chalk.yellow('\n📝 Manual conflict resolution required:'));
      console.log(chalk.dim('   1. Resolve conflicts in your editor'));
      console.log(chalk.dim('   2. Stage resolved files with: git add <files>'));
      console.log(chalk.dim('   3. Continue with: git commit'));
    }
  }

  /**
   * Handle rebase conflicts. Resolving does NOT commit: fixed files are
   * staged and the rebase is continued, preserving linear history.
   */
  async handleRebaseConflicts(conflictedFiles, round = 1) {
    const strategy = await this.promptSyncStrategy(conflictedFiles, {
      allowMergeFallback: true,
    });

    if (strategy === 'abort') {
      await this.abortSync();
      throw new Error('Rebase aborted. Your branch is unchanged — resolve and run again.');
    }

    if (strategy === 'manual') {
      this.manualInstructions();
      throw new Error(
        'Manual conflict resolution required. Please resolve conflicts and run again.'
      );
    }

    if (strategy === 'merge-fallback') {
      await this.gitManager.rebaseAbort();
      await this.pullAndMerge();
      return;
    }

    try {
      if (strategy === 'ai') {
        await this.resolveConflictsWithAI(conflictedFiles);
      } else {
        await this.resolveWithSide(conflictedFiles, strategy);
      }
      await this.gitManager.stageAll();
      await this.gitManager.rebaseContinue();
    } catch (error) {
      if (/cancelled|Manual|discarded/i.test(error.message)) {
        throw error;
      }
      // --continue can surface the NEXT commit's conflicts; loop with a cap.
      const remaining = await this.conflictedFiles();
      if (remaining.length > 0 && round < AutoGit.MAX_SYNC_ROUNDS) {
        console.log(
          chalk.yellow(`↻ More conflicts after continuing (round ${round + 1}/${AutoGit.MAX_SYNC_ROUNDS})`)
        );
        await this.handleRebaseConflicts(remaining, round + 1);
        return;
      }
      throw new Error(
        `Rebase could not continue: ${error.message}. Resolve manually (git status, git add, git rebase --continue) or abort (git rebase --abort).`
      );
    }

    this.spinner.succeed('Rebase completed with no conflicts');
  }

  /**
   * Explicit merge fallback (and only path that creates a merge commit).
   * Used solely when the user opts out of rebase mid-conflict.
   */
  async pullAndMerge() {
    this.syncOperation = 'merge';
    this.spinner.start('Pulling latest changes (merge)...');
    await this.gitManager.pull();
    const conflicted = await this.conflictedFiles();
    if (conflicted.length === 0) {
      this.spinner.succeed('Pulled with merge, no conflicts');
      return;
    }

    const strategy = await this.promptSyncStrategy(conflicted, {
      allowMergeFallback: false,
    });

    if (strategy === 'abort') {
      await this.abortSync();
      throw new Error('Merge aborted. Your branch is unchanged — resolve and run again.');
    }

    if (strategy === 'manual') {
      this.manualInstructions();
      throw new Error(
        'Manual conflict resolution required. Please resolve conflicts and run again.'
      );
    }

    if (strategy === 'ai') {
      await this.resolveConflictsWithAI(conflicted);
    } else {
      await this.resolveWithSide(conflicted, strategy);
    }

    await this.gitManager.stageAll();
    await this.gitManager.commit('AI-resolved merge conflicts with intelligent merging');
    console.log(chalk.green(`✓ Resolved ${conflicted.length} conflict(s)`));
    this.spinner.succeed('Pull and conflict resolution complete');
  }

  /**
   * Resolve every conflicted file to one side by user intent.
   */
  async resolveWithSide(conflictedFiles, intent) {
    const side = this.sideForIntent(intent);
    for (const file of conflictedFiles) {
      await this.gitManager.checkoutSide(file, side);
    }
  }

  /**
   * Resolve conflicts using AI with intelligent merging.
   *
   * Writes resolved content to the working tree, then STOPS at a human
   * review gate — nothing is committed or continued until the user accepts
   * the diff. On a multi-person repo, machine-merged code that nobody read
   * is how subtle breakage ships: the resolver has no access to CI, intent,
   * or tribal knowledge, so a person signs off. Staging is left to the
   * caller (merge path commits, rebase path continues).
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
              { name: 'Keep my changes (local)', value: 'keep-mine' },
              { name: 'Use incoming changes (remote)', value: 'keep-incoming' },
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

        await this.gitManager.checkoutSide(file, this.sideForIntent(fallback));
      }
    }

    await this.reviewAiResolution(conflictedFiles);

    await this.gitManager.stageAll();

    await this.activityLogger.logConflictResolution(conflictedFiles, 'ai', true, {
      resolutionTime: Date.now() - resolutionStartTime,
      fallbackUsed: false,
      chunkingUsed: false,
    });
  }

  /**
   * Human review gate: show what the AI wrote, proceed only on accept.
   */
  async reviewAiResolution(conflictedFiles) {
    let preview = '';
    try {
      const workingDiff = await this.gitManager.getWorkingDiff();
      preview = (workingDiff || '').split('\n').slice(0, AutoGit.REVIEW_PREVIEW_LINES).join('\n');
    } catch (error) {
      preview = '';
    }

    console.log(chalk.cyan('\n🔍 AI-resolved changes (review before anything is committed):'));
    if (preview.trim()) {
      console.log(preview);
    } else {
      console.log(chalk.dim('   (no visible working-tree diff — resolutions may match one side exactly)'));
    }

    const { decision } = await inquirer.prompt([
      {
        type: 'list',
        name: 'decision',
        message: `Accept this AI resolution for ${conflictedFiles.length} file(s)?`,
        choices: [
          { name: '✅ Accept — proceed', value: 'accept' },
          { name: '🔧 Reject — I will resolve manually', value: 'manual' },
          { name: '❌ Discard — abort the sync, keep my branch as-is', value: 'abort' },
        ],
        default: 'accept',
      },
    ]);

    if (decision === 'abort') {
      await this.abortSync();
      throw new Error('AI resolution discarded. Your branch is unchanged.');
    }

    if (decision === 'manual') {
      this.manualInstructions();
      throw new Error(
        'AI resolution set aside. Resolve manually and run again.'
      );
    }
  }

  /**
   * Resolve conflicts in a single file using AI.
   *
   * Side inputs are operation-aware: git stage #2 is always "ours" and #3
   * always "theirs", but what those MEAN flips under rebase (ours=upstream,
   * theirs=local work being replayed). currentVersion is therefore always
   * the LOCAL content and incomingVersion always the UPSTREAM content,
   * regardless of operation — the resolver prompt stays truthful.
   */
  async resolveFileConflictsWithAI(filePath) {
    try {
      const stage2 = await this.gitManager.showIndexSide(filePath, 'ours');
      const stage3 = await this.gitManager.showIndexSide(filePath, 'theirs');
      const isRebase = this.syncOperation === 'rebase';

      const resolvedContent = await this.conflictResolver.resolveConflictWithAI({
        filePath,
        currentVersion: isRebase ? stage3 : stage2,
        incomingVersion: isRebase ? stage2 : stage3,
        language: filePath.split('.').pop() === 'php' ? 'php' : 'javascript',
      });

      const repoRoot = await this.gitManager.getRepositoryRoot();
      const fullPath = require('path').join(repoRoot, filePath);
      const fs = require('fs-extra');
      await fs.writeFile(fullPath, resolvedContent, 'utf8');
    } catch (error) {
      throw new Error(`Failed to resolve conflicts in ${filePath}: ${error.message}`);
    }
  }

  /**
   * Push changes to remote
   */
  async pushChanges() {
    let branch = '';
    try {
      branch = await this.gitManager.getCurrentBranch();
    } catch (_) {}
    this.spinner.start(`Pushing to origin/${branch || '<branch>'}...`);
    try {
      await this.gitManager.push();
      this.spinner.succeed(`Pushed to origin/${branch || 'remote'}`);
    } catch (error) {
      this.spinner.fail('Failed to push changes');
      if (
        error.message.includes('no tracking information') ||
        error.message.includes('set-upstream') ||
        error.message.includes('has no upstream')
      ) {
        console.log(
          chalk.yellow(`\n💡 Tip: git push --set-upstream origin ${branch || '<branch>'}`)
        );
      } else if (error.message.includes('authentication') || error.message.includes('403')) {
        console.log(chalk.yellow('\n💡 Tip: Check your git credentials or SSH key'));
      } else {
        console.log(chalk.red('✗ Failed to push changes'));
        console.log(chalk.dim('  Try "git push" manually to see the full error'));
      }
      throw error;
    }
  }
}

module.exports = AutoGit;
