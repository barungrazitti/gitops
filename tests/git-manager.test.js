/**
 * Tests for GitManager
 */

const GitManager = require('../src/core/git-manager');

// Mock simple-git
jest.mock('simple-git');

describe('GitManager', () => {
  let gitManager;
  let mockGit;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock simple-git instance
    mockGit = {
      checkIsRepo: jest.fn(),
      diff: jest.fn(),
      log: jest.fn(),
      branch: jest.fn(),
      revparse: jest.fn(),
      status: jest.fn(),
      commit: jest.fn(),
      diffSummary: jest.fn(),
      getRemotes: jest.fn(),
      checkoutLocalBranch: jest.fn(),
      checkout: jest.fn(),
      deleteLocalBranch: jest.fn(),
      add: jest.fn(),
      push: jest.fn(),
      stash: jest.fn(),
      stashList: jest.fn(),
      reset: jest.fn()
    };
    
    // Mock simple-git constructor
    const simpleGit = require('simple-git');
    simpleGit.mockReturnValue(mockGit);
    
    gitManager = new GitManager();
  });

  describe('constructor', () => {
    it('should initialize with simple-git instance', () => {
      expect(simpleGit).toHaveBeenCalled();
      expect(gitManager.git).toBeDefined();
    });
  });

  describe('validateRepository', () => {
    it('should validate repository successfully', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      
      const result = await gitManager.validateRepository();
      
      expect(mockGit.checkIsRepo).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should throw error if not a repository', async () => {
      mockGit.checkIsRepo.mockResolvedValue(false);
      
      await expect(gitManager.validateRepository()).rejects.toThrow('Not a git repository');
    });

    it('should handle git errors', async () => {
      mockGit.checkIsRepo.mockRejectedValue(new Error('Git error'));
      
      await expect(gitManager.validateRepository()).rejects.toThrow('Git repository validation failed: Git error');
    });
  });

  describe('getStagedDiff', () => {
    it('should get staged diff', async () => {
      const diff = 'sample staged diff';
      mockGit.diff.mockResolvedValue(diff);
      
      const result = await gitManager.getStagedDiff();
      
      expect(mockGit.diff).toHaveBeenCalledWith(['--staged']);
      expect(result).toBe(diff);
    });

    it('should handle errors', async () => {
      mockGit.diff.mockRejectedValue(new Error('Diff error'));
      
      await expect(gitManager.getStagedDiff()).rejects.toThrow('Failed to get staged diff: Diff error');
    });
  });

  describe('getUnstagedDiff', () => {
    it('should get unstaged diff', async () => {
      const diff = 'sample unstaged diff';
      mockGit.diff.mockResolvedValue(diff);
      
      const result = await gitManager.getUnstagedDiff();
      
      expect(mockGit.diff).toHaveBeenCalledWith();
      expect(result).toBe(diff);
    });

    it('should handle errors', async () => {
      mockGit.diff.mockRejectedValue(new Error('Diff error'));
      
      await expect(gitManager.getUnstagedDiff()).rejects.toThrow('Failed to get unstaged diff: Diff error');
    });
  });

  describe('getCommitHistory', () => {
    it('should get commit history with default limit', async () => {
      const mockLog = {
        all: [
          {
            hash: 'abc123',
            message: 'Test commit',
            author_name: 'Test Author',
            date: '2023-01-01',
            refs: ['file1.js', 'file2.js']
          }
        ]
      };
      mockGit.log.mockResolvedValue(mockLog);
      
      const result = await gitManager.getCommitHistory();
      
      expect(mockGit.log).toHaveBeenCalledWith({ maxCount: 50 });
      expect(result).toEqual([{
        hash: 'abc123',
        message: 'Test commit',
        author: 'Test Author',
        date: '2023-01-01',
        files: ['file1.js', 'file2.js']
      }]);
    });

    it('should get commit history with custom limit', async () => {
      mockGit.log.mockResolvedValue({ all: [] });
      
      await gitManager.getCommitHistory(25);
      
      expect(mockGit.log).toHaveBeenCalledWith({ maxCount: 25 });
    });

    it('should handle errors', async () => {
      mockGit.log.mockRejectedValue(new Error('Log error'));
      
      await expect(gitManager.getCommitHistory()).rejects.toThrow('Failed to get commit history: Log error');
    });
  });

  describe('getCurrentBranch', () => {
    it('should get current branch', async () => {
      const branchInfo = { current: 'main' };
      mockGit.branch.mockResolvedValue(branchInfo);
      
      const result = await gitManager.getCurrentBranch();
      
      expect(mockGit.branch).toHaveBeenCalled();
      expect(result).toBe('main');
    });

    it('should handle errors', async () => {
      mockGit.branch.mockRejectedValue(new Error('Branch error'));
      
      await expect(gitManager.getCurrentBranch()).rejects.toThrow('Failed to get current branch: Branch error');
    });
  });

  describe('getRepositoryRoot', () => {
    it('should get repository root', async () => {
      const root = '/path/to/repo';
      mockGit.revparse.mockResolvedValue(root);
      
      const result = await gitManager.getRepositoryRoot();
      
      expect(mockGit.revparse).toHaveBeenCalledWith(['--show-toplevel']);
      expect(result).toBe(root);
    });

    it('should trim whitespace from root path', async () => {
      const root = '/path/to/repo\n';
      mockGit.revparse.mockResolvedValue(root);
      
      const result = await gitManager.getRepositoryRoot();
      
      expect(result).toBe('/path/to/repo');
    });

    it('should handle errors', async () => {
      mockGit.revparse.mockRejectedValue(new Error('Revparse error'));
      
      await expect(gitManager.getRepositoryRoot()).rejects.toThrow('Failed to get repository root: Revparse error');
    });
  });

  describe('getStagedFiles', () => {
    it('should get staged files', async () => {
      const status = { staged: ['file1.js', 'file2.js'] };
      mockGit.status.mockResolvedValue(status);
      
      const result = await gitManager.getStagedFiles();
      
      expect(mockGit.status).toHaveBeenCalled();
      expect(result).toEqual(['file1.js', 'file2.js']);
    });

    it('should handle errors', async () => {
      mockGit.status.mockRejectedValue(new Error('Status error'));
      
      await expect(gitManager.getStagedFiles()).rejects.toThrow('Failed to get staged files: Status error');
    });
  });

  describe('hasStagedChanges', () => {
    it('should return true when there are staged changes', async () => {
      const status = { staged: ['file1.js'] };
      mockGit.status.mockResolvedValue(status);
      
      const result = await gitManager.hasStagedChanges();
      
      expect(result).toBe(true);
    });

    it('should return false when there are no staged changes', async () => {
      const status = { staged: [] };
      mockGit.status.mockResolvedValue(status);
      
      const result = await gitManager.hasStagedChanges();
      
      expect(result).toBe(false);
    });

    it('should handle errors', async () => {
      mockGit.status.mockRejectedValue(new Error('Status error'));
      
      await expect(gitManager.hasStagedChanges()).rejects.toThrow('Failed to check staged changes: Status error');
    });
  });

  describe('commit', () => {
    it('should commit with message', async () => {
      const message = 'Test commit';
      const result = { commit: 'abc123' };
      mockGit.commit.mockResolvedValue(result);
      
      const commitResult = await gitManager.commit(message);
      
      expect(mockGit.commit).toHaveBeenCalledWith(message);
      expect(commitResult).toEqual(result);
    });

    it('should handle errors', async () => {
      mockGit.commit.mockRejectedValue(new Error('Commit error'));
      
      await expect(gitManager.commit('Test')).rejects.toThrow('Failed to commit: Commit error');
    });
  });

  describe('getFileStats', () => {
    it('should get file statistics', async () => {
      const diffSummary = {
        files: [{ file: 'test.js', changes: 10 }],
        insertions: 15,
        deletions: 5,
        changed: 1
      };
      mockGit.diffSummary.mockResolvedValue(diffSummary);
      
      const result = await gitManager.getFileStats();
      
      expect(mockGit.diffSummary).toHaveBeenCalledWith(['--staged']);
      expect(result).toEqual({
        files: diffSummary.files,
        insertions: 15,
        deletions: 5,
        changed: 1
      });
    });

    it('should handle errors', async () => {
      mockGit.diffSummary.mockRejectedValue(new Error('Diff summary error'));
      
      await expect(gitManager.getFileStats()).rejects.toThrow('Failed to get file stats: Diff summary error');
    });
  });

  describe('getRepositoryInfo', () => {
    it('should get repository information', async () => {
      const remotes = [
        { name: 'origin', refs: { fetch: 'https://github.com/user/repo.git' } }
      ];
      mockGit.getRemotes.mockResolvedValue(remotes);
      mockGit.getCurrentBranch.mockResolvedValue('main');
      mockGit.getRepositoryRoot.mockResolvedValue('/path/to/repo');
      
      const result = await gitManager.getRepositoryInfo();
      
      expect(result).toEqual({
        branch: 'main',
        root: '/path/to/repo',
        remotes: [
          { name: 'origin', url: 'https://github.com/user/repo.git' }
        ]
      });
    });

    it('should handle errors', async () => {
      mockGit.getRemotes.mockRejectedValue(new Error('Remotes error'));
      
      await expect(gitManager.getRepositoryInfo()).rejects.toThrow('Failed to get repository info: Remotes error');
    });
  });

  describe('getCommitPatterns', () => {
    it('should analyze commit patterns', async () => {
      const commits = [
        { message: 'feat: add new feature' },
        { message: 'fix: resolve bug' },
        { message: 'docs: update documentation' },
        { message: 'feat(auth): add authentication' },
        { message: 'simple commit message' }
      ];
      mockGit.getCommitHistory.mockResolvedValue(commits);
      
      const result = await gitManager.getCommitPatterns();
      
      expect(result.mostUsedTypes).toContainEqual(['feat', 2]);
      expect(result.mostUsedScopes).toContainEqual(['auth', 1]);
      expect(result.preferredFormat).toBe('conventional');
      expect(result.averageLength).toBeGreaterThan(0);
    });

    it('should handle freeform commits', async () => {
      const commits = [
        { message: 'simple commit 1' },
        { message: 'simple commit 2' }
      ];
      mockGit.getCommitHistory.mockResolvedValue(commits);
      
      const result = await gitManager.getCommitPatterns();
      
      expect(result.preferredFormat).toBe('freeform');
    });

    it('should handle errors', async () => {
      mockGit.getCommitHistory.mockRejectedValue(new Error('History error'));
      
      await expect(gitManager.getCommitPatterns()).rejects.toThrow('Failed to analyze commit patterns: History error');
    });
  });

  describe('createValidationBranch', () => {
    it('should create validation branch', async () => {
      mockGit.getCurrentBranch.mockResolvedValue('main');
      mockGit.checkoutLocalBranch.mockResolvedValue();
      
      const result = await gitManager.createValidationBranch();
      
      expect(mockGit.checkoutLocalBranch).toHaveBeenCalled();
      expect(result.branch).toMatch(/^validation-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
      expect(result.previousBranch).toBe('main');
    });

    it('should handle errors', async () => {
      mockGit.getCurrentBranch.mockRejectedValue(new Error('Branch error'));
      
      await expect(gitManager.createValidationBranch()).rejects.toThrow('Failed to create validation branch: Branch error');
    });
  });

  describe('cleanupValidationBranch', () => {
    it('should cleanup validation branch', async () => {
      mockGit.checkout.mockResolvedValue();
      mockGit.deleteLocalBranch.mockResolvedValue();
      
      await gitManager.cleanupValidationBranch('validation-branch', 'main');
      
      expect(mockGit.checkout).toHaveBeenCalledWith('main');
      expect(mockGit.deleteLocalBranch).toHaveBeenCalledWith('validation-branch');
    });

    it('should handle errors', async () => {
      mockGit.checkout.mockRejectedValue(new Error('Checkout error'));
      
      await expect(gitManager.cleanupValidationBranch('val', 'main')).rejects.toThrow('Failed to cleanup validation branch: Checkout error');
    });
  });

  describe('createDualCommits', () => {
    it('should create original commit only', async () => {
      const originalMessage = 'Test commit';
      const commitResult = { commit: 'abc123' };
      mockGit.commit.mockResolvedValue(commitResult);
      
      const result = await gitManager.createDualCommits(originalMessage);
      
      expect(mockGit.commit).toHaveBeenCalledWith(originalMessage);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'original',
        message: originalMessage,
        hash: 'abc123'
      });
    });

    it('should create both original and corrected commits', async () => {
      const originalMessage = 'Test commit';
      const fixes = {
        applied: [{ type: 'lint', description: 'Fix linting' }],
        summary: { totalFixes: 1 }
      };
      const commitResult = { commit: 'abc123' };
      mockGit.commit.mockResolvedValue(commitResult);
      mockGit.add.mockResolvedValue();
      
      const result = await gitManager.createDualCommits(originalMessage, fixes);
      
      expect(mockGit.commit).toHaveBeenCalledTimes(2);
      expect(mockGit.add).toHaveBeenCalledWith('.');
      expect(result).toHaveLength(2);
      expect(result[1].type).toBe('corrected');
    });

    it('should handle errors', async () => {
      mockGit.commit.mockRejectedValue(new Error('Commit error'));
      
      await expect(gitManager.createDualCommits('Test')).rejects.toThrow('Failed to create dual commits: Commit error');
    });
  });

  describe('pushCommits', () => {
    it('should push commits to current branch', async () => {
      mockGit.getCurrentBranch.mockResolvedValue('main');
      mockGit.push.mockResolvedValue({ success: true });
      
      const result = await gitManager.pushCommits();
      
      expect(mockGit.push).toHaveBeenCalledWith('origin', 'main', '');
      expect(result).toEqual({ success: true });
    });

    it('should push commits to specific branch', async () => {
      mockGit.push.mockResolvedValue({ success: true });
      
      const result = await gitManager.pushCommits('feature-branch');
      
      expect(mockGit.push).toHaveBeenCalledWith('origin', 'feature-branch', '');
    });

    it('should force push when requested', async () => {
      mockGit.getCurrentBranch.mockResolvedValue('main');
      mockGit.push.mockResolvedValue({ success: true });
      
      const result = await gitManager.pushCommits(null, true);
      
      expect(mockGit.push).toHaveBeenCalledWith('origin', 'main', '--force');
    });

    it('should handle errors', async () => {
      mockGit.getCurrentBranch.mockRejectedValue(new Error('Branch error'));
      
      await expect(gitManager.pushCommits()).rejects.toThrow('Failed to push commits: Branch error');
    });
  });

  describe('stashChanges', () => {
    it('should stash changes with default message', async () => {
      mockGit.stash.mockResolvedValue({ success: true });
      
      const result = await gitManager.stashChanges();
      
      expect(mockGit.stash).toHaveBeenCalledWith(['push', '-m', 'Auto-stash before validation']);
      expect(result).toEqual({ success: true });
    });

    it('should stash changes with custom message', async () => {
      const message = 'Custom stash message';
      mockGit.stash.mockResolvedValue({ success: true });
      
      const result = await gitManager.stashChanges(message);
      
      expect(mockGit.stash).toHaveBeenCalledWith(['push', '-m', message]);
      expect(result).toEqual({ success: true });
    });

    it('should handle errors', async () => {
      mockGit.stash.mockRejectedValue(new Error('Stash error'));
      
      await expect(gitManager.stashChanges()).rejects.toThrow('Failed to stash changes: Stash error');
    });
  });

  describe('popStash', () => {
    it('should pop stash', async () => {
      mockGit.stash.mockResolvedValue({ success: true });
      
      const result = await gitManager.popStash();
      
      expect(mockGit.stash).toHaveBeenCalledWith(['pop']);
      expect(result).toEqual({ success: true });
    });

    it('should handle errors', async () => {
      mockGit.stash.mockRejectedValue(new Error('Pop stash error'));
      
      await expect(gitManager.popStash()).rejects.toThrow('Failed to pop stash: Pop stash error');
    });
  });

  describe('hasStash', () => {
    it('should return true when stash exists', async () => {
      mockGit.stashList.mockResolvedValue({ all: [{ stash: 'stash@{0}' }] });
      
      const result = await gitManager.hasStash();
      
      expect(result).toBe(true);
    });

    it('should return false when no stash exists', async () => {
      mockGit.stashList.mockResolvedValue({ all: [] });
      
      const result = await gitManager.hasStash();
      
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockGit.stashList.mockRejectedValue(new Error('Stash list error'));
      
      const result = await gitManager.hasStash();
      
      expect(result).toBe(false);
    });
  });

  describe('getUnstagedFiles', () => {
    it('should get unstaged files', async () => {
      const status = {
        modified: ['file1.js'],
        not_added: ['file2.js'],
        deleted: ['file3.js'],
        created: ['file4.js']
      };
      mockGit.status.mockResolvedValue(status);
      
      const result = await gitManager.getUnstagedFiles();
      
      expect(result).toEqual(['file1.js', 'file2.js', 'file3.js', 'file4.js']);
    });

    it('should handle errors', async () => {
      mockGit.status.mockRejectedValue(new Error('Status error'));
      
      await expect(gitManager.getUnstagedFiles()).rejects.toThrow('Failed to get unstaged files: Status error');
    });
  });

  describe('resetStaged', () => {
    it('should reset staged changes', async () => {
      mockGit.reset.mockResolvedValue();
      
      await gitManager.resetStaged();
      
      expect(mockGit.reset).toHaveBeenCalledWith(['--mixed']);
    });

    it('should handle errors', async () => {
      mockGit.reset.mockRejectedValue(new Error('Reset error'));
      
      await expect(gitManager.resetStaged()).rejects.toThrow('Failed to reset staged changes: Reset error');
    });
  });
});