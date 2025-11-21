/**
 * Edge Case Tests for Git Manager
 * Tests for empty repositories, invalid repos, large files, permissions, network issues, etc.
 */

const GitManager = require('../src/core/git-manager');
const simpleGit = require('simple-git');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

jest.mock('simple-git');
jest.mock('fs-extra');

describe('GitManager Edge Cases', () => {
  let gitManager;
  let mockGit;
  let tempDir;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGit = {
      checkIsRepo: jest.fn(),
      status: jest.fn(),
      diff: jest.fn(),
      diffSummary: jest.fn(),
      add: jest.fn(),
      commit: jest.fn(),
      log: jest.fn(),
      revparse: jest.fn(),
      branch: jest.fn(),
      raw: jest.fn(),
      getRemotes: jest.fn(),
      stash: jest.fn(),
      stashList: jest.fn(),
      reset: jest.fn(),
      checkout: jest.fn(),
      checkoutLocalBranch: jest.fn(),
      deleteLocalBranch: jest.fn(),
      push: jest.fn(),
      show: jest.fn(),
    };
    simpleGit.mockReturnValue(mockGit);
    gitManager = new GitManager();
    tempDir = os.tmpdir();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Empty Repository Scenarios', () => {
    test('should handle repository with no commits', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.log.mockRejectedValue(new Error('fatal: your current branch \'main\' does not have any commits yet'));
      
      await expect(gitManager.getCommitHistory()).rejects.toThrow('Failed to get commit history');
    });

    test('should handle empty staged diff', async () => {
      mockGit.diff.mockResolvedValue('');
      
      const result = await gitManager.getStagedDiff();
      expect(result).toBe('');
    });

    test('should handle no staged files', async () => {
      mockGit.status.mockResolvedValue({ staged: [] });
      
      const result = await gitManager.getStagedFiles();
      expect(result).toEqual([]);
    });

    test('should handle empty repository status', async () => {
      mockGit.status.mockResolvedValue({
        staged: [],
        modified: [],
        not_added: [],
        deleted: [],
        created: [],
        conflicted: [],
        files: []
      });
      
      const hasStaged = await gitManager.hasStagedChanges();
      expect(hasStaged).toBe(false);
      
      const unstagedFiles = await gitManager.getUnstagedFiles();
      expect(unstagedFiles).toEqual([]);
    });

    test('should handle repository with no remote configured', async () => {
      mockGit.getRemotes.mockResolvedValue([]);
      mockGit.branch.mockResolvedValue({ current: 'main' });
      mockGit.revparse.mockResolvedValue('/path/to/repo');
      
      const result = await gitManager.getRepositoryInfo();
      expect(result.remotes).toEqual([]);
    });
  });

  describe('Invalid Git Repository Scenarios', () => {
    test('should handle non-git directory', async () => {
      mockGit.checkIsRepo.mockResolvedValue(false);
      
      await expect(gitManager.validateRepository()).rejects.toThrow('Not a git repository');
    });

    test('should handle corrupted git repository', async () => {
      mockGit.checkIsRepo.mockRejectedValue(new Error('fatal: not a git repository (or any of the parent directories): .git'));
      
      await expect(gitManager.validateRepository()).rejects.toThrow('Git repository validation failed');
    });

    test('should handle missing .git directory', async () => {
      mockGit.checkIsRepo.mockRejectedValue(new Error('fatal: not a git repository'));
      
      await expect(gitManager.validateRepository()).rejects.toThrow('Git repository validation failed');
    });

    test('should handle git command not found', async () => {
      mockGit.checkIsRepo.mockRejectedValue(new Error('Command failed: git'));
      
      await expect(gitManager.validateRepository()).rejects.toThrow('Git repository validation failed');
    });
  });

  describe('Large File Handling', () => {
    test('should handle very large diff output', async () => {
      const largeDiff = 'diff --git a/large-file.js b/large-file.js\n' + 
        'new content'.repeat(100000) + // Simulate large diff
        '\n+ more content';
      
      mockGit.diff.mockResolvedValue(largeDiff);
      
      const result = await gitManager.getStagedDiff();
      expect(result).toBe(largeDiff);
      expect(result.length).toBeGreaterThan(1000000);
    });

    test('should handle large commit history', async () => {
      const largeHistory = Array.from({ length: 10000 }, (_, i) => ({
        hash: `commit${i}`,
        message: `Commit message ${i}`,
        author_name: `Author ${i}`,
        date: new Date().toISOString(),
        refs: []
      }));
      
      mockGit.log.mockResolvedValue({ all: largeHistory });
      
      const result = await gitManager.getCommitHistory(10000);
      expect(result).toHaveLength(10000);
    });

    test('should handle large number of changed files', async () => {
      const manyFiles = Array.from({ length: 10000 }, (_, i) => `file${i}.js`);
      
      mockGit.status.mockResolvedValue({
        staged: manyFiles.slice(0, 5000),
        modified: manyFiles.slice(5000, 7500),
        not_added: manyFiles.slice(7500, 9000),
        deleted: manyFiles.slice(9000, 10000),
        created: [],
        conflicted: []
      });
      
      const result = await gitManager.getAllChangedFiles();
      expect(result).toHaveLength(10000);
    });
  });

  describe('Permission Issues', () => {
    test('should handle permission denied on git operations', async () => {
      mockGit.status.mockRejectedValue(new Error('Permission denied'));
      
      await expect(gitManager.getStagedFiles()).rejects.toThrow('Failed to get staged files: Permission denied');
    });

    test('should handle read-only repository', async () => {
      mockGit.commit.mockRejectedValue(new Error('fatal: cannot create .git/index.lock: Permission denied'));
      
      await expect(gitManager.commit('test message')).rejects.toThrow('Failed to commit');
    });

    test('should handle filesystem permission errors', async () => {
      mockGit.revparse.mockRejectedValue(new Error('EACCES: permission denied, access \'.git\''));
      
      await expect(gitManager.getRepositoryRoot()).rejects.toThrow('Failed to get repository root');
    });
  });

  describe('Network Connectivity Issues', () => {
    test('should handle network timeout during push', async () => {
      mockGit.push.mockRejectedValue(new Error('unable to access \'https://github.com/user/repo.git\': The requested URL returned error: Connection timed out'));
      
      await expect(gitManager.pushCommits()).rejects.toThrow('Failed to push commits');
    });

    test('should handle DNS resolution failure', async () => {
      mockGit.push.mockRejectedValue(new Error('unable to access \'https://github.com/user/repo.git\': Could not resolve host: github.com'));
      
      await expect(gitManager.pushCommits()).rejects.toThrow('Failed to push commits');
    });

    test('should handle SSL certificate errors', async () => {
      mockGit.push.mockRejectedValue(new Error('SSL certificate problem: self-signed certificate'));
      
      await expect(gitManager.pushCommits()).rejects.toThrow('Failed to push commits');
    });

    test('should handle authentication failures', async () => {
      mockGit.push.mockRejectedValue(new Error('fatal: Authentication failed for \'https://github.com/user/repo.git\''));
      
      await expect(gitManager.pushCommits()).rejects.toThrow('Failed to push commits');
    });
  });

  describe('Merge Conflict Scenarios', () => {
    test('should handle merge conflict in status', async () => {
      mockGit.status.mockResolvedValue({
        conflicted: ['file1.js', 'file2.txt'],
        staged: [],
        modified: [],
        not_added: [],
        deleted: [],
        created: []
      });
      
      const result = await gitManager.getAllChangedFiles();
      expect(result).toContain('file1.js');
      expect(result).toContain('file2.txt');
    });

    test('should handle conflict during rebase', async () => {
      mockGit.reset.mockRejectedValue(new Error('fatal: Cannot rebase: You have unstaged changes'));
      
      await expect(gitManager.resetStaged()).rejects.toThrow('Failed to reset staged changes');
    });
  });

  describe('Branch Switching Edge Cases', () => {
    test('should handle detached HEAD state', async () => {
      mockGit.branch.mockResolvedValue({ current: 'HEAD' });
      
      const result = await gitManager.getCurrentBranch();
      expect(result).toBe('HEAD');
    });

    test('should handle branch checkout failure', async () => {
      mockGit.checkout.mockRejectedValue(new Error('error: pathspec \'feature-branch\' did not match any file(s) known to git'));
      
      await expect(gitManager.cleanupValidationBranch('validation-branch', 'feature-branch')).rejects.toThrow('Failed to cleanup validation branch');
    });

    test('should handle branch deletion failure', async () => {
      mockGit.checkout.mockResolvedValue();
      mockGit.deleteLocalBranch.mockRejectedValue(new Error('error: branch \'validation-branch\' not found'));
      
      await expect(gitManager.cleanupValidationBranch('validation-branch', 'main')).rejects.toThrow('Failed to cleanup validation branch');
    });

    test('should handle creating branch with invalid name', async () => {
      mockGit.checkoutLocalBranch.mockRejectedValue(new Error('fatal: invalid branch name'));
      
      await expect(gitManager.createValidationBranch()).rejects.toThrow('Failed to create validation branch');
    });
  });

  describe('Corrupted Git Repository Scenarios', () => {
    test('should handle corrupted index file', async () => {
      mockGit.status.mockRejectedValue(new Error('fatal: bad index file sha1 signature'));
      
      await expect(gitManager.getStagedFiles()).rejects.toThrow('Failed to get staged files');
    });

    test('should handle corrupted objects', async () => {
      mockGit.log.mockRejectedValue(new Error('fatal: loose object 123456... (stored in .git/objects/12/3456...) is corrupt'));
      
      await expect(gitManager.getCommitHistory()).rejects.toThrow('Failed to get commit history');
    });

    test('should handle corrupted refs', async () => {
      mockGit.revparse.mockRejectedValue(new Error('fatal: invalid reference: HEAD'));
      
      await expect(gitManager.getRepositoryRoot()).rejects.toThrow('Failed to get repository root');
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    test('should handle out of memory errors', async () => {
      mockGit.log.mockRejectedValue(new Error('JavaScript heap out of memory'));
      
      await expect(gitManager.getCommitHistory()).rejects.toThrow('Failed to get commit history');
    });

    test('should handle file descriptor exhaustion', async () => {
      mockGit.diff.mockRejectedValue(new Error('EMFILE: too many open files'));
      
      await expect(gitManager.getStagedDiff()).rejects.toThrow('Failed to get staged diff');
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent git operations', async () => {
      mockGit.status.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ staged: ['file.js'] }), 100);
        });
      });
      
      const promises = [
        gitManager.getStagedFiles(),
        gitManager.hasStagedChanges(),
        gitManager.getUnstagedFiles()
      ];
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
    });

    test('should handle git lock file conflicts', async () => {
      mockGit.commit.mockRejectedValue(new Error('fatal: Unable to create \'.git/index.lock\': File exists'));
      
      await expect(gitManager.commit('test')).rejects.toThrow('Failed to commit');
    });
  });

  describe('Invalid Input Handling', () => {
    test('should handle null commit message', async () => {
      mockGit.commit.mockRejectedValue(new Error('fatal: empty commit message'));
      
      await expect(gitManager.commit(null)).rejects.toThrow('Failed to commit');
    });

    test('should handle extremely long commit message', async () => {
      const longMessage = 'a'.repeat(100000);
      mockGit.commit.mockRejectedValue(new Error('fatal: commit message too long'));
      
      await expect(gitManager.commit(longMessage)).rejects.toThrow('Failed to commit');
    });

    test('should handle negative commit history limit', async () => {
      mockGit.log.mockRejectedValue(new Error('fatal: negative max count not allowed'));
      
      await expect(gitManager.getCommitHistory(-1)).rejects.toThrow('Failed to get commit history');
    });
  });

  describe('Filesystem Edge Cases', () => {
    test('should handle files with special characters', async () => {
      mockGit.status.mockResolvedValue({
        staged: ['file with spaces.js', 'file-with-dashes.js', 'file_with_underscores.js', 'file(with)parentheses.js'],
        modified: [],
        not_added: [],
        deleted: [],
        created: []
      });
      
      const result = await gitManager.getStagedFiles();
      expect(result).toContain('file with spaces.js');
      expect(result).toContain('file-with-dashes.js');
      expect(result).toContain('file_with_underscores.js');
      expect(result).toContain('file(with)parentheses.js');
    });

    test('should handle Unicode filenames', async () => {
      mockGit.status.mockResolvedValue({
        staged: ['файл.js', 'ファイル.js', 'ملف.js'],
        modified: [],
        not_added: [],
        deleted: [],
        created: []
      });
      
      const result = await gitManager.getStagedFiles();
      expect(result).toContain('файл.js');
      expect(result).toContain('ファイル.js');
      expect(result).toContain('ملف.js');
    });

    test('should handle very long file paths', async () => {
      const longPath = 'a'.repeat(255) + '.js';
      mockGit.status.mockResolvedValue({
        staged: [longPath],
        modified: [],
        not_added: [],
        deleted: [],
        created: []
      });
      
      const result = await gitManager.getStagedFiles();
      expect(result).toContain(longPath);
    });
  });

  describe('Stash Edge Cases', () => {
    test('should handle empty stash list', async () => {
      mockGit.stashList.mockResolvedValue({ all: [] });
      
      const result = await gitManager.hasStash();
      expect(result).toBe(false);
    });

    test('should handle corrupted stash', async () => {
      mockGit.stashList.mockRejectedValue(new Error('fatal: bad revision \'stash@{0}\''));
      
      const result = await gitManager.hasStash();
      expect(result).toBe(false);
    });

    test('should handle stash pop conflicts', async () => {
      mockGit.stash.mockRejectedValue(new Error('CONFLICTS: Merge conflict in file.js'));
      
      await expect(gitManager.popStash()).rejects.toThrow('Failed to pop stash');
    });
  });

  describe('Performance Edge Cases', () => {
    test('should handle very slow git operations', async () => {
      mockGit.status.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ staged: ['file.js'] }), 10000);
        });
      });
      
      const startTime = Date.now();
      await gitManager.getStagedFiles();
      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThan(9000);
    });

    test('should handle git command timeouts', async () => {
      mockGit.log.mockRejectedValue(new Error('fatal: git command timed out'));
      
      await expect(gitManager.getCommitHistory()).rejects.toThrow('Failed to get commit history');
    });
  });
});