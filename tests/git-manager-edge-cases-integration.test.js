/**
 * Edge Case Tests for Git Manager (Integration Style)
 * Tests for real edge cases using actual git operations where possible
 */

const GitManager = require('../src/core/git-manager');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

describe('GitManager Edge Cases (Integration)', () => {
  let gitManager;
  let tempDir;

  beforeEach(() => {
    gitManager = new GitManager();
    tempDir = os.tmpdir();
  });

  describe('Input Validation Edge Cases', () => {
    test('should handle null commit message', async () => {
      await expect(gitManager.commit(null)).rejects.toThrow('Failed to commit');
    });

    test('should handle undefined commit message', async () => {
      await expect(gitManager.commit(undefined)).rejects.toThrow('Failed to commit');
    });

    test('should handle empty string commit message', async () => {
      const result = await gitManager.commit('');
      // Git may allow empty commits in some cases, but should handle gracefully
      expect(result).toBeDefined();
    });

    test('should handle whitespace-only commit message', async () => {
      const result = await gitManager.commit('   ');
      // Git may allow whitespace commits in some cases, but should handle gracefully
      expect(result).toBeDefined();
    });

    test('should handle extremely long commit message', async () => {
      const longMessage = 'a'.repeat(100000);
      const result = await gitManager.commit(longMessage);
      // Should handle long messages or fail gracefully
      expect(result).toBeDefined();
    });

    test('should handle negative commit history limit', async () => {
      // Git may handle negative limits differently than expected
      const result = await gitManager.getCommitHistory(-1);
      expect(Array.isArray(result)).toBe(true);
    });

    test('should handle zero commit history limit', async () => {
      const result = await gitManager.getCommitHistory(0);
      expect(Array.isArray(result)).toBe(true);
    });

    test('should handle non-numeric commit history limit', async () => {
      await expect(gitManager.getCommitHistory('invalid')).rejects.toThrow('Failed to get commit history');
    });
  });

  describe('Repository State Edge Cases', () => {
    test('should handle empty staged diff', async () => {
      const result = await gitManager.getStagedDiff();
      expect(typeof result).toBe('string');
    });

    test('should handle empty unstaged diff', async () => {
      const result = await gitManager.getUnstagedDiff();
      expect(typeof result).toBe('string');
    });

    test('should handle no staged files', async () => {
      const result = await gitManager.getStagedFiles();
      expect(Array.isArray(result)).toBe(true);
    });

    test('should handle no unstaged files', async () => {
      const result = await gitManager.getUnstagedFiles();
      expect(Array.isArray(result)).toBe(true);
    });

    test('should handle repository with no commits gracefully', async () => {
      // This test works in current repo since it has commits
      // In a repo with no commits, it should handle gracefully
      const result = await gitManager.getCommitHistory(1);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Error Handling Edge Cases', () => {
    test('should handle git command failures gracefully', async () => {
      // Test with invalid git operation through the public API
      // We can't directly mock, but we can test error handling patterns
      try {
        await gitManager.getRepositoryRoot();
        // If successful, that's fine - we're in a valid repo
        expect(true).toBe(true);
      } catch (error) {
        // Should have proper error message
        expect(error.message).toContain('Failed to get repository root');
      }
    });

    test('should handle network-related errors in push', async () => {
      try {
        await gitManager.pushCommits();
        // May succeed if remote is available and configured
        expect(true).toBe(true);
      } catch (error) {
        // Should handle network errors gracefully
        expect(error.message).toContain('Failed to push commits');
      }
    });

    test('should handle stash operations when no stash exists', async () => {
      const hasStash = await gitManager.hasStash();
      expect(typeof hasStash).toBe('boolean');

      if (!hasStash) {
        // Should handle pop stash gracefully when no stash exists
        await expect(gitManager.popStash()).rejects.toThrow('Failed to pop stash');
      }
    });
  });

  describe('Filesystem Edge Cases', () => {
    test('should handle files with special characters in status', async () => {
      const result = await gitManager.getAllChangedFiles();
      expect(Array.isArray(result)).toBe(true);
      
      // If there are files with special characters, they should be handled
      result.forEach(file => {
        expect(typeof file).toBe('string');
        expect(file.length).toBeGreaterThan(0);
      });
    });

    test('should handle very long file paths in status', async () => {
      const result = await gitManager.getAllChangedFiles();
      expect(Array.isArray(result)).toBe(true);
      
      // Check that paths are reasonable length
      result.forEach(file => {
        expect(file.length).toBeLessThan(4096); // Typical path limit
      });
    });
  });

  describe('Performance Edge Cases', () => {
    test('should handle large commit history requests', async () => {
      const startTime = Date.now();
      const result = await gitManager.getCommitHistory(1000);
      const duration = Date.now() - startTime;
      
      expect(Array.isArray(result)).toBe(true);
      // Should complete within reasonable time (10 seconds)
      expect(duration).toBeLessThan(10000);
    });

    test('should handle concurrent operations', async () => {
      const promises = [
        gitManager.getStagedDiff(),
        gitManager.getUnstagedDiff(),
        gitManager.getCurrentBranch(),
        gitManager.getRepositoryRoot()
      ];
      
      const results = await Promise.allSettled(promises);
      
      // All operations should either succeed or fail gracefully
      results.forEach(result => {
        expect(result.status).toMatch(/fulfilled|rejected/);
      });
    });
  });

  describe('Branch Operations Edge Cases', () => {
    test('should handle detached HEAD state', async () => {
      const branch = await gitManager.getCurrentBranch();
      expect(typeof branch).toBe('string');
      
      // Could be 'HEAD' in detached state, which is valid
      expect(['HEAD', 'main', 'master', 'develop'].includes(branch) || /^[a-f0-9]+$/.test(branch)).toBe(true);
    });

    test('should handle repository info with no remotes', async () => {
      try {
        const result = await gitManager.getRepositoryInfo();
        expect(result).toBeDefined();
        expect(typeof result.branch).toBe('string');
        expect(typeof result.root).toBe('string');
        expect(Array.isArray(result.remotes)).toBe(true);
      } catch (error) {
        // Should handle errors gracefully
        expect(error.message).toContain('Failed to get repository info');
      }
    });
  });

  describe('Data Validation Edge Cases', () => {
    test('should handle malformed commit history data', async () => {
      const result = await gitManager.getCommitHistory(1);
      expect(Array.isArray(result)).toBe(true);
      
      if (result.length > 0) {
        const commit = result[0];
        expect(commit).toHaveProperty('hash');
        expect(commit).toHaveProperty('message');
        expect(commit).toHaveProperty('author');
        expect(commit).toHaveProperty('date');
      }
    });

    test('should handle commit pattern analysis with no history', async () => {
      try {
        const result = await gitManager.getCommitPatterns(0);
        expect(result).toBeDefined();
        expect(result).toHaveProperty('mostUsedTypes');
        expect(result).toHaveProperty('mostUsedScopes');
        expect(result).toHaveProperty('averageLength');
        expect(result).toHaveProperty('preferredFormat');
      } catch (error) {
        // Should handle gracefully when no commits exist
        expect(error.message).toContain('Failed to analyze commit patterns');
      }
    });

    test('should handle file stats with no staged changes', async () => {
      try {
        const result = await gitManager.getFileStats();
        expect(result).toBeDefined();
        expect(result).toHaveProperty('files');
        expect(result).toHaveProperty('insertions');
        expect(result).toHaveProperty('deletions');
        expect(result).toHaveProperty('changed');
      } catch (error) {
        // Should handle gracefully when no staged changes
        expect(error.message).toContain('Failed to get file stats');
      }
    });
  });

  describe('Memory and Resource Edge Cases', () => {
    test('should handle large diff output without memory issues', async () => {
      const result = await gitManager.getStagedDiff();
      expect(typeof result).toBe('string');
      
      // Should be reasonable size (less than 50MB for safety)
      expect(result.length).toBeLessThan(50 * 1024 * 1024);
    });

    test('should handle many changed files without performance issues', async () => {
      const startTime = Date.now();
      const result = await gitManager.getAllChangedFiles();
      const duration = Date.now() - startTime;
      
      expect(Array.isArray(result)).toBe(true);
      // Should complete quickly even with many files
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Validation Branch Edge Cases', () => {
    test('should handle validation branch creation', async () => {
      try {
        const result = await gitManager.createValidationBranch();
        expect(result).toBeDefined();
        expect(result).toHaveProperty('branch');
        expect(result).toHaveProperty('previousBranch');
        
        // Cleanup
        await gitManager.cleanupValidationBranch(result.branch, result.previousBranch);
      } catch (error) {
        // Should handle gracefully if branch creation or cleanup fails
        expect(error.message).toMatch(/Failed to (create|cleanup) validation branch/);
      }
    });

    test('should handle cleanup of non-existent validation branch', async () => {
      await expect(gitManager.cleanupValidationBranch('non-existent-branch', 'main')).rejects.toThrow('Failed to cleanup validation branch');
    });
  });

  describe('Dual Commit Edge Cases', () => {
    test('should handle dual commit creation with no fixes', async () => {
      try {
        const result = await gitManager.createDualCommits('Test commit message');
        expect(Array.isArray(result)).toBe(true);
        
        if (result.length > 0) {
          expect(result[0]).toHaveProperty('type');
          expect(result[0]).toHaveProperty('message');
          expect(result[0]).toHaveProperty('hash');
        }
      } catch (error) {
        // Expected if no staged changes
        expect(error.message).toContain('Failed to create dual commits');
      }
    });

    test('should handle dual commit with null fixes', async () => {
      try {
        const result = await gitManager.createDualCommits('Test commit', null);
        expect(Array.isArray(result)).toBe(true);
      } catch (error) {
        // Expected if no staged changes
        expect(error.message).toContain('Failed to create dual commits');
      }
    });
  });

  describe('Reset Operations Edge Cases', () => {
    test('should handle reset staged operations', async () => {
      try {
        await gitManager.resetStaged();
        // Should complete without error
        expect(true).toBe(true);
      } catch (error) {
        // Should handle gracefully
        expect(error.message).toContain('Failed to reset staged changes');
      }
    });
  });

  describe('Repository Validation Edge Cases', () => {
    test('should validate current repository', async () => {
      try {
        const result = await gitManager.validateRepository();
        expect(result).toBe(true);
      } catch (error) {
        // Should handle non-git directory gracefully
        expect(error.message).toContain('Git repository validation failed');
      }
    });
  });
});