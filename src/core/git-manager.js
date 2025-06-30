/**
 * Git Manager - Handles all git operations
 */

const simpleGit = require('simple-git');
const fs = require('fs-extra');
const path = require('path');

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
        throw new Error('Not a git repository. Please run this command from within a git repository.');
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
        files: commit.refs || []
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
      const result = await this.git.commit(message);
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
        changed: diff.changed
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
          url: remote.refs.fetch
        }))
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
        formats: new Map()
      };

      commits.forEach(commit => {
        const message = commit.message;
        patterns.lengths.push(message.length);

        // Check for conventional commit format
        const conventionalMatch = message.match(/^(\w+)(\(.+\))?: (.+)/);
        if (conventionalMatch) {
          const [, type, scope, description] = conventionalMatch;
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
        preferredFormat: Array.from(patterns.formats.entries())
          .sort((a, b) => b[1] - a[1])[0]?.[0] || 'freeform'
      };
    } catch (error) {
      throw new Error(`Failed to analyze commit patterns: ${error.message}`);
    }
  }
}

module.exports = GitManager;