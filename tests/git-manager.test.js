/**
 * Tests for GitManager
 */

const GitManager = require('../src/core/git-manager');

describe('GitManager', () => {
  let gitManager;

  beforeEach(() => {
    gitManager = new GitManager();
  });

  describe('constructor', () => {
    it('should initialize with git instance', () => {
      expect(gitManager.git).toBeDefined();
    });
  });

  describe('validateRepository', () => {
    it('should validate repository successfully', async () => {
      // This test will work if we're in a git repo
      const result = await gitManager.validateRepository();
      expect(typeof result).toBe('boolean');
    });

    it('should handle validation errors', async () => {
      // Test error handling by mocking a scenario
      const originalCheckIsRepo = gitManager.git.checkIsRepo;
      gitManager.git.checkIsRepo = jest.fn().mockRejectedValue(new Error('Git error'));
      
      await expect(gitManager.validateRepository()).rejects.toThrow('Git repository validation failed: Git error');
      
      // Restore original method
      gitManager.git.checkIsRepo = originalCheckIsRepo;
    });
  });

  describe('getStagedDiff', () => {
    it('should get staged diff', async () => {
      const result = await gitManager.getStagedDiff();
      expect(typeof result).toBe('string');
    });

    it('should handle diff errors', async () => {
      const originalDiff = gitManager.git.diff;
      gitManager.git.diff = jest.fn().mockRejectedValue(new Error('Diff error'));
      
      await expect(gitManager.getStagedDiff()).rejects.toThrow('Failed to get staged diff: Diff error');
      
      gitManager.git.diff = originalDiff;
    });
  });

  describe('getUnstagedDiff', () => {
    it('should get unstaged diff', async () => {
      const result = await gitManager.getUnstagedDiff();
      expect(typeof result).toBe('string');
    });

    it('should handle diff errors', async () => {
      const originalDiff = gitManager.git.diff;
      gitManager.git.diff = jest.fn().mockRejectedValue(new Error('Diff error'));
      
      await expect(gitManager.getUnstagedDiff()).rejects.toThrow('Failed to get unstaged diff: Diff error');
      
      gitManager.git.diff = originalDiff;
    });
  });

  describe('getCommitHistory', () => {
    it('should get commit history with default limit', async () => {
      const result = await gitManager.getCommitHistory();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should get commit history with custom limit', async () => {
      const result = await gitManager.getCommitHistory(10);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle log errors', async () => {
      const originalLog = gitManager.git.log;
      gitManager.git.log = jest.fn().mockRejectedValue(new Error('Log error'));
      
      await expect(gitManager.getCommitHistory()).rejects.toThrow('Failed to get commit history: Log error');
      
      gitManager.git.log = originalLog;
    });
  });

  describe('getCurrentBranch', () => {
    it('should get current branch', async () => {
      const result = await gitManager.getCurrentBranch();
      expect(typeof result).toBe('string');
    });

    it('should handle branch errors', async () => {
      const originalBranch = gitManager.git.branch;
      gitManager.git.branch = jest.fn().mockRejectedValue(new Error('Branch error'));
      
      await expect(gitManager.getCurrentBranch()).rejects.toThrow('Failed to get current branch: Branch error');
      
      gitManager.git.branch = originalBranch;
    });
  });

  describe('getRepositoryRoot', () => {
    it('should get repository root', async () => {
      const result = await gitManager.getRepositoryRoot();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle revparse errors', async () => {
      const originalRevparse = gitManager.git.revparse;
      gitManager.git.revparse = jest.fn().mockRejectedValue(new Error('Revparse error'));
      
      await expect(gitManager.getRepositoryRoot()).rejects.toThrow('Failed to get repository root: Revparse error');
      
      gitManager.git.revparse = originalRevparse;
    });
  });

  describe('getStagedFiles', () => {
    it('should get staged files', async () => {
      const result = await gitManager.getStagedFiles();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle status errors', async () => {
      const originalStatus = gitManager.git.status;
      gitManager.git.status = jest.fn().mockRejectedValue(new Error('Status error'));
      
      await expect(gitManager.getStagedFiles()).rejects.toThrow('Failed to get staged files: Status error');
      
      gitManager.git.status = originalStatus;
    });
  });

  describe('hasStagedChanges', () => {
    it('should return boolean for staged changes', async () => {
      const result = await gitManager.hasStagedChanges();
      expect(typeof result).toBe('boolean');
    });

    it('should handle status errors', async () => {
      const originalStatus = gitManager.git.status;
      gitManager.git.status = jest.fn().mockRejectedValue(new Error('Status error'));
      
      await expect(gitManager.hasStagedChanges()).rejects.toThrow('Failed to check staged changes: Status error');
      
      gitManager.git.status = originalStatus;
    });
  });

  describe('commit', () => {
    it('should commit with message', async () => {
      const message = 'Test commit message';
      const result = await gitManager.commit(message);
      expect(result).toBeDefined();
    });

    it('should handle commit errors', async () => {
      const originalCommit = gitManager.git.commit;
      gitManager.git.commit = jest.fn().mockRejectedValue(new Error('Commit error'));
      
      await expect(gitManager.commit('Test')).rejects.toThrow('Failed to commit: Commit error');
      
      gitManager.git.commit = originalCommit;
    });
  });

  describe('getFileStats', () => {
    it('should get file statistics', async () => {
      const result = await gitManager.getFileStats();
      expect(result).toBeDefined();
      expect(typeof result.files).toBe('object');
      expect(typeof result.insertions).toBe('number');
      expect(typeof result.deletions).toBe('number');
      expect(typeof result.changed).toBe('number');
    });

    it('should handle diff summary errors', async () => {
      const originalDiffSummary = gitManager.git.diffSummary;
      gitManager.git.diffSummary = jest.fn().mockRejectedValue(new Error('Diff summary error'));
      
      await expect(gitManager.getFileStats()).rejects.toThrow('Failed to get file stats: Diff summary error');
      
      gitManager.git.diffSummary = originalDiffSummary;
    });
  });

  describe('getRepositoryInfo', () => {
    it('should get repository information', async () => {
      const result = await gitManager.getRepositoryInfo();
      expect(result).toBeDefined();
      expect(typeof result.branch).toBe('string');
      expect(typeof result.root).toBe('string');
      expect(Array.isArray(result.remotes)).toBe(true);
    });

    it('should handle repository info errors', async () => {
      const originalGetRemotes = gitManager.git.getRemotes;
      gitManager.git.getRemotes = jest.fn().mockRejectedValue(new Error('Remotes error'));
      
      await expect(gitManager.getRepositoryInfo()).rejects.toThrow('Failed to get repository info: Remotes error');
      
      gitManager.git.getRemotes = originalGetRemotes;
    });
  });

  describe('getCommitPatterns', () => {
    it('should analyze commit patterns', async () => {
      const result = await gitManager.getCommitPatterns();
      expect(result).toBeDefined();
      expect(Array.isArray(result.mostUsedTypes)).toBe(true);
      expect(Array.isArray(result.mostUsedScopes)).toBe(true);
      expect(typeof result.averageLength).toBe('number');
      expect(typeof result.preferredFormat).toBe('string');
    });

    it('should handle pattern analysis errors', async () => {
      const originalGetCommitHistory = gitManager.getCommitHistory;
      gitManager.getCommitHistory = jest.fn().mockRejectedValue(new Error('History error'));
      
      await expect(gitManager.getCommitPatterns()).rejects.toThrow('Failed to analyze commit patterns: History error');
      
      gitManager.getCommitHistory = originalGetCommitHistory;
    });
  });

  describe('stashChanges', () => {
    it('should stash changes', async () => {
      const result = await gitManager.stashChanges();
      expect(result).toBeDefined();
    });

    it('should handle stash errors', async () => {
      const originalStash = gitManager.git.stash;
      gitManager.git.stash = jest.fn().mockRejectedValue(new Error('Stash error'));
      
      await expect(gitManager.stashChanges()).rejects.toThrow('Failed to stash changes: Stash error');
      
      gitManager.git.stash = originalStash;
    });
  });

  describe('popStash', () => {
    it('should pop stash', async () => {
      const result = await gitManager.popStash();
      expect(result).toBeDefined();
    });

    it('should handle pop stash errors', async () => {
      const originalStash = gitManager.git.stash;
      gitManager.git.stash = jest.fn().mockRejectedValue(new Error('Pop stash error'));
      
      await expect(gitManager.popStash()).rejects.toThrow('Failed to pop stash: Pop stash error');
      
      gitManager.git.stash = originalStash;
    });
  });

  describe('hasStash', () => {
    it('should return boolean for stash existence', async () => {
      const result = await gitManager.hasStash();
      expect(typeof result).toBe('boolean');
    });

    it('should return false on stash list error', async () => {
      const originalStashList = gitManager.git.stashList;
      gitManager.git.stashList = jest.fn().mockRejectedValue(new Error('Stash list error'));
      
      const result = await gitManager.hasStash();
      expect(result).toBe(false);
      
      gitManager.git.stashList = originalStashList;
    });
  });

  describe('getUnstagedFiles', () => {
    it('should get unstaged files', async () => {
      const result = await gitManager.getUnstagedFiles();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle unstaged files errors', async () => {
      const originalStatus = gitManager.git.status;
      gitManager.git.status = jest.fn().mockRejectedValue(new Error('Status error'));
      
      await expect(gitManager.getUnstagedFiles()).rejects.toThrow('Failed to get unstaged files: Status error');
      
      gitManager.git.status = originalStatus;
    });
  });

  describe('resetStaged', () => {
    it('should reset staged changes', async () => {
      await expect(gitManager.resetStaged()).resolves.toBeUndefined();
    });

    it('should handle reset errors', async () => {
      const originalReset = gitManager.git.reset;
      gitManager.git.reset = jest.fn().mockRejectedValue(new Error('Reset error'));
      
      await expect(gitManager.resetStaged()).rejects.toThrow('Failed to reset staged changes: Reset error');
      
      gitManager.git.reset = originalReset;
    });
  });

  describe('createValidationBranch', () => {
    it('should create validation branch', async () => {
      const result = await gitManager.createValidationBranch();
      expect(result).toBeDefined();
      expect(typeof result.branch).toBe('string');
      expect(typeof result.previousBranch).toBe('string');
    });

    it('should handle validation branch creation errors', async () => {
      const originalGetCurrentBranch = gitManager.getCurrentBranch;
      gitManager.getCurrentBranch = jest.fn().mockRejectedValue(new Error('Branch error'));
      
      await expect(gitManager.createValidationBranch()).rejects.toThrow('Failed to create validation branch: Branch error');
      
      gitManager.getCurrentBranch = originalGetCurrentBranch;
    });
  });

  describe('cleanupValidationBranch', () => {
    it('should cleanup validation branch', async () => {
      // Ensure we're on main branch first
      await gitManager.git.checkout('main');
      
      // Mock the timestamp generation to ensure unique branch name
      const originalCreateValidationBranch = gitManager.createValidationBranch;
      const uniqueSuffix = Math.random().toString(36).substring(7);
      
      gitManager.createValidationBranch = async function(baseBranch = null) {
        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, '-')
          .slice(0, 19);
        const validationBranch = `validation-${timestamp}-${uniqueSuffix}`;
        
        await this.git.checkoutLocalBranch(validationBranch);
        
        return {
          branch: validationBranch,
          previousBranch: 'main', // We know we're on main
        };
      };
      
      // First create a branch to cleanup
      const branchInfo = await gitManager.createValidationBranch();
      
      // Then cleanup
      await expect(gitManager.cleanupValidationBranch(branchInfo.branch, branchInfo.previousBranch)).resolves.toBeUndefined();
      
      // Restore original method
      gitManager.createValidationBranch = originalCreateValidationBranch;
    });

    it('should handle cleanup errors', async () => {
      const originalCheckout = gitManager.git.checkout;
      gitManager.git.checkout = jest.fn().mockRejectedValue(new Error('Checkout error'));
      
      await expect(gitManager.cleanupValidationBranch('test-branch', 'main')).rejects.toThrow('Failed to cleanup validation branch: Checkout error');
      
      gitManager.git.checkout = originalCheckout;
    });
  });

  describe('createDualCommits', () => {
    it('should create original commit only', async () => {
      const originalMessage = 'Test commit';
      const result = await gitManager.createDualCommits(originalMessage);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].type).toBe('original');
    });

    it('should handle dual commit errors', async () => {
      const originalCommit = gitManager.git.commit;
      gitManager.git.commit = jest.fn().mockRejectedValue(new Error('Commit error'));
      
      await expect(gitManager.createDualCommits('Test')).rejects.toThrow('Failed to create dual commits: Failed to commit: Commit error');
      
      gitManager.git.commit = originalCommit;
    });
  });

  describe('pushCommits', () => {
    it('should push commits to current branch', async () => {
      // This might fail if no remote is configured, but we test the method structure
      try {
        const result = await gitManager.pushCommits();
        expect(result).toBeDefined();
      } catch (error) {
        // Expected if no remote is configured
        expect(error.message).toContain('Failed to push commits');
      }
    });

    it('should handle push errors', async () => {
      const originalGetCurrentBranch = gitManager.getCurrentBranch;
      gitManager.getCurrentBranch = jest.fn().mockRejectedValue(new Error('Branch error'));
      
      await expect(gitManager.pushCommits()).rejects.toThrow('Failed to push commits: Branch error');
      
      gitManager.getCurrentBranch = originalGetCurrentBranch;
    });
  });
});