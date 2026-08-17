/**
 * Git Manager - Handles all git operations
 */

const simpleGit = require('simple-git');
const InputSanitizer = require('../utils/input-sanitizer');

class GitManager {
  constructor() {
    this.git = simpleGit();
  }

  /**
   * Validate that we're in a git repository
   */
  async validateRepository() {
    try {
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        throw new Error(
          'Not a git repository. Please run this command from within a git repository.'
        );
      }
      return true;
    } catch (error) {
      throw new Error(`Git repository validation failed: ${error.message}`);
    }
  }

  /**
   * Get staged changes diff
   */
  async getStagedDiff() {
    try {
      const diff = await this.git.diff(['--staged']);
      return diff;
    } catch (error) {
      throw new Error(`Failed to get staged diff: ${error.message}`);
    }
  }

  /**
   * Get unstaged changes diff
   */
  async getUnstagedDiff() {
    try {
      const diff = await this.git.diff();
      return diff;
    } catch (error) {
      throw new Error(`Failed to get unstaged diff: ${error.message}`);
    }
  }

  /**
   * Get commit history for analysis
   */
  async getCommitHistory(limit = 50) {
    try {
      const log = await this.git.log({ maxCount: limit });
      return log.all.map(commit => ({
        hash: commit.hash,
        message: commit.message,
        author: commit.author_name,
        date: commit.date,
        files: commit.refs || [],
      }));
    } catch (error) {
      throw new Error(`Failed to get commit history: ${error.message}`);
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch() {
    try {
      const branch = await this.git.branch();
      return branch.current;
    } catch (error) {
      throw new Error(`Failed to get current branch: ${error.message}`);
    }
  }

  /**
   * Get repository root path
   */
  async getRepositoryRoot() {
    try {
      const root = await this.git.revparse(['--show-toplevel']);
      return root.trim();
    } catch (error) {
      throw new Error(`Failed to get repository root: ${error.message}`);
    }
  }

  /**
   * Get staged files
   */
  async getStagedFiles() {
    try {
      const status = await this.git.status();
      return status.staged;
    } catch (error) {
      throw new Error(`Failed to get staged files: ${error.message}`);
    }
  }

  /**
   * Get full git status result (files, conflicted, not_added, etc.)
   */
  async getStatus() {
    try {
      const status = await this.git.status();
      return status;
    } catch (error) {
      throw new Error(`Failed to get git status: ${error.message}`);
    }
  }

  /**
   * Stage all changes including new files
   */
  async stageAll() {
    try {
      await this.git.add('.');
    } catch (error) {
      throw new Error(`Failed to stage changes: ${error.message}`);
    }
  }

  /**
   * Pull latest changes from the default remote
   */
  async pull(options = {}) {
    try {
      if (options.rebase) {
        return await this.git.pull(['--rebase']);
      }
      return await this.git.pull();
    } catch (error) {
      throw new Error(`Failed to pull changes: ${error.message}`);
    }
  }

  /**
   * Push commits to the default remote
   */
  async push() {
    try {
      return await this.git.push();
    } catch (error) {
      throw new Error(`Failed to push changes: ${error.message}`);
    }
  }

  /**
   * Checkout one side of a conflicted file (ours/theirs)
   */
  async checkoutSide(file, side) {
    const VALID_SIDES = ['ours', 'theirs'];
    if (!VALID_SIDES.includes(side)) {
      throw new Error(`Invalid checkout side: ${side} (expected ours or theirs)`);
    }
    if (typeof file !== 'string' || file.length === 0) {
      throw new Error('Checkout requires a file path');
    }
    try {
      return await this.git.raw(['checkout', `--${side}`, '--', file]);
    } catch (error) {
      throw new Error(`Failed to checkout ${side} version of ${file}: ${error.message}`);
    }
  }

  /**
   * Show the index version on one side of a conflicted file (ours/theirs)
   */
  async showIndexSide(filePath, side) {
    const VALID_SIDES = ['ours', 'theirs'];
    if (!VALID_SIDES.includes(side)) {
      throw new Error(`Invalid show side: ${side} (expected ours or theirs)`);
    }
    if (typeof filePath !== 'string' || filePath.length === 0) {
      throw new Error('Show requires a file path');
    }
    try {
      return await this.git.show([`--${side}`, `:${filePath}`]);
    } catch (error) {
      throw new Error(`Failed to show ${side} version of ${filePath}: ${error.message}`);
    }
  }

  /**
   * Configure git to prefer merge over rebase for safety
   */
  async configurePullStrategy() {
    try {
      await this.git.raw(['config', 'pull.rebase', 'false']);
    } catch (error) {
      throw new Error(`Failed to configure pull strategy: ${error.message}`);
    }
  }

  /**
   * Check if there are staged changes
   */
  async hasStagedChanges() {
    try {
      const status = await this.git.status();
      return status.staged.length > 0;
    } catch (error) {
      throw new Error(`Failed to check staged changes: ${error.message}`);
    }
  }

  /**
   * Commit with message
   */
  async commit(message) {
    try {
      const sanitizedMessage = InputSanitizer.sanitizeCommitMessage(message);
      const result = await this.git.commit(sanitizedMessage);
      return result;
    } catch (error) {
      throw new Error(`Failed to commit: ${error.message}`);
    }
  }

  /**
   * Get file changes statistics
   */
  async getFileStats() {
    try {
      const diff = await this.git.diffSummary(['--staged']);
      return {
        files: diff.files,
        insertions: diff.insertions,
        deletions: diff.deletions,
        changed: diff.changed,
      };
    } catch (error) {
      throw new Error(`Failed to get file stats: ${error.message}`);
    }
  }

  /**
   * Get repository information
   */
  async getRepositoryInfo() {
    try {
      const remotes = await this.git.getRemotes(true);
      const branch = await this.getCurrentBranch();
      const root = await this.getRepositoryRoot();

      return {
        branch,
        root,
        remotes: remotes.map(remote => ({
          name: remote.name,
          url: remote.refs.fetch,
        })),
      };
    } catch (error) {
      throw new Error(`Failed to get repository info: ${error.message}`);
    }
  }

  /**
   * Get recent commit patterns for learning
   */
  async getCommitPatterns(limit = 100) {
    try {
      const commits = await this.getCommitHistory(limit);

      // Analyze commit message patterns
      const patterns = {
        types: new Map(),
        scopes: new Map(),
        lengths: [],
        formats: new Map(),
      };

      commits.forEach(commit => {
        const { message } = commit;
        patterns.lengths.push(message.length);

        // Check for conventional commit format
        const conventionalMatch = message.match(/^(\w+)(\(.+\))?: (.+)/);
        if (conventionalMatch) {
          const [, type, scope] = conventionalMatch;
          patterns.types.set(type, (patterns.types.get(type) || 0) + 1);
          if (scope) {
            const cleanScope = scope.slice(1, -1); // Remove parentheses
            patterns.scopes.set(cleanScope, (patterns.scopes.get(cleanScope) || 0) + 1);
          }
          patterns.formats.set('conventional', (patterns.formats.get('conventional') || 0) + 1);
        } else {
          patterns.formats.set('freeform', (patterns.formats.get('freeform') || 0) + 1);
        }
      });

      return {
        mostUsedTypes: Array.from(patterns.types.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5),
        mostUsedScopes: Array.from(patterns.scopes.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5),
        averageLength: patterns.lengths.reduce((a, b) => a + b, 0) / patterns.lengths.length,
        preferredFormat:
          Array.from(patterns.formats.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'freeform',
      };
    } catch (error) {
      throw new Error(`Failed to analyze commit patterns: ${error.message}`);
    }
  }

  /**
   * Create a temporary branch for validation workflow
   */
  async pushCommits(branch = null, force = false) {
    try {
      const targetBranch = branch || (await this.getCurrentBranch());

      // Validate branch name to prevent injection
      if (targetBranch && !InputSanitizer.validateGitReference(targetBranch)) {
        throw new Error(`Invalid branch name: ${targetBranch}`);
      }

      const forceFlag = force ? '--force' : '';

      const result = await this.git.push('origin', targetBranch, forceFlag);
      return result;
    } catch (error) {
      throw new Error(`Failed to push commits: ${error.message}`);
    }
  }

  /**
   * Stash current changes
   */
  async stashChanges(message = 'Auto-stash before validation') {
    try {
      const sanitizedMessage = InputSanitizer.sanitizeString(message);
      const result = await this.git.stash(
        InputSanitizer.sanitizeGitArgs(['push', '-m', sanitizedMessage])
      );
      return result;
    } catch (error) {
      throw new Error(`Failed to stash changes: ${error.message}`);
    }
  }

  /**
   * Pop stashed changes
   */
  async popStash() {
    try {
      const result = await this.git.stash(['pop']);
      return result;
    } catch (error) {
      throw new Error(`Failed to pop stash: ${error.message}`);
    }
  }

  /**
   * Check if there are any stashed changes
   */
  async hasStash() {
    try {
      const stashList = await this.git.stashList();
      return stashList.all.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get unstaged files list
   */
  async getUnstagedFiles() {
    try {
      const status = await this.git.status();
      return status.modified.concat(status.not_added, status.deleted, status.created);
    } catch (error) {
      throw new Error(`Failed to get unstaged files: ${error.message}`);
    }
  }

  /**
   * Reset staged changes
   */
  async resetStaged() {
    try {
      await this.git.reset(['--mixed']);
    } catch (error) {
      throw new Error(`Failed to reset staged changes: ${error.message}`);
    }
  }

  /**
   * Get list of all changed files (staged and unstaged)
   */
  async getAllChangedFiles() {
    try {
      const status = await this.git.status();
      const allChanged = [
        ...status.staged,
        ...status.modified,
        ...status.not_added,
        ...status.deleted,
        ...status.created,
      ];
      return [...new Set(allChanged)]; // Remove duplicates
    } catch (error) {
      throw new Error(`Failed to get all changed files: ${error.message}`);
    }
  }
}

module.exports = GitManager;
