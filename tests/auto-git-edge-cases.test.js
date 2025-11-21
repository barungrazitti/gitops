/**
 * Edge Case Tests for Auto Git (Merge Conflicts and Workflow)
 * Tests for merge conflict resolution, network issues, and workflow edge cases
 */

const AutoGit = require('../src/auto-git');
const simpleGit = require('simple-git');
const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

jest.mock('simple-git');
jest.mock('inquirer');
jest.mock('fs-extra');

describe('AutoGit Edge Cases', () => {
  let autoGit;
  let mockGit;
  let mockAICommit;
  let tempDir;

  beforeEach(() => {
    mockGit = {
      checkIsRepo: jest.fn(),
      status: jest.fn(),
      diff: jest.fn(),
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
      pull: jest.fn(),
      show: jest.fn(),
    };

    mockAICommit = {
      analysisEngine: {
        analyzeRepository: jest.fn()
      },
      generateWithSequentialFallback: jest.fn(),
      resolveConflictWithAI: jest.fn(),
      activityLogger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        logConflictResolution: jest.fn()
      }
    };

    simpleGit.mockReturnValue(mockGit);
    
    // Mock constructor dependencies
    const mockModule = require('../src/auto-git');
    const MockAutoGit = jest.fn().mockImplementation(() => {
      const instance = Object.create(mockModule.prototype);
      instance.git = mockGit;
      instance.aiCommit = mockAICommit;
      instance.activityLogger = mockAICommit.activityLogger;
      instance.spinner = { start: jest.fn(), succeed: jest.fn(), fail: jest.fn(), text: '' };
      return instance;
    });
    
    autoGit = new MockAutoGit();
    tempDir = os.tmpdir();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Repository Validation Edge Cases', () => {
    test('should handle git not installed', async () => {
      mockGit.checkIsRepo.mockRejectedValue(new Error('Command failed: git'));
      
      await expect(autoGit.validateRepository()).rejects.toThrow('Not a git repository');
    });

    test('should handle bare repository', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.status.mockRejectedValue(new Error('fatal: This operation must be run in a work tree'));
      
      await expect(autoGit.checkForChanges()).rejects.toThrow();
    });

    test('should handle repository with detached HEAD', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.branch.mockResolvedValue({ current: 'HEAD' });
      
      // Should still work but might need special handling
      await expect(autoGit.validateRepository()).resolves.toBeUndefined();
    });
  });

  describe('Merge Conflict Resolution Edge Cases', () => {
    test('should handle binary file conflicts', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.status.mockResolvedValue({ files: [{ path: 'image.png', index: 'U', working_tree: 'U' }] });
      mockGit.diff.mockResolvedValue('Binary files a/image.png and b/image.png differ');
      mockGit.pull.mockResolvedValue({ files: ['image.png'] });
      
      // Simulate conflict detection
      mockGit.status.mockResolvedValueOnce({ 
        conflicted: ['image.png'],
        files: []
      });
      
      inquirer.prompt.mockResolvedValue({ resolutionStrategy: 'ours' });
      mockGit.raw.mockResolvedValue();
      mockGit.add.mockResolvedValue();
      mockGit.commit.mockResolvedValue();
      
      await expect(autoGit.pullAndHandleConflicts()).resolves.toBeUndefined();
    });

    test('should handle large file conflicts', async () => {
      const largeConflict = '<<<<<<< HEAD\n' + 'large content '.repeat(100000) + '\n=======\n' + 'different large content '.repeat(100000) + '\n>>>>>>> branch';
      
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.status.mockResolvedValue({ files: [] });
      mockGit.diff.mockResolvedValue('');
      mockGit.pull.mockResolvedValue({ files: ['large-file.js'] });
      
      mockGit.status.mockResolvedValueOnce({ 
        conflicted: ['large-file.js'],
        files: []
      });
      
      inquirer.prompt.mockResolvedValue({ resolutionStrategy: 'ai' });
      mockGit.show.mockResolvedValue('content');
      mockGit.revparse.mockResolvedValue('/tmp');
      fs.readFile.mockResolvedValue(largeConflict);
      mockAICommit.resolveConflictWithAI.mockResolvedValue('resolved content');
      fs.writeFile.mockResolvedValue();
      mockGit.add.mockResolvedValue();
      mockGit.commit.mockResolvedValue();
      
      await expect(autoGit.pullAndHandleConflicts()).resolves.toBeUndefined();
    });

    test('should handle conflicts in locked files', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.status.mockResolvedValue({ files: [] });
      mockGit.diff.mockResolvedValue('');
      mockGit.pull.mockResolvedValue({ files: ['locked-file.js'] });
      
      mockGit.status.mockResolvedValueOnce({ 
        conflicted: ['locked-file.js'],
        files: []
      });
      
      inquirer.prompt.mockResolvedValue({ resolutionStrategy: 'ai' });
      mockGit.show.mockRejectedValue(new Error('Permission denied: locked-file.js'));
      
      await expect(autoGit.pullAndHandleConflicts()).rejects.toThrow();
    });

    test('should handle nested conflict markers', async () => {
      const nestedConflict = `<<<<<<< HEAD
outer start
<<<<<<< HEAD
inner conflict
=======
inner resolution
>>>>>>> branch
outer end
>>>>>>> main`;
      
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.status.mockResolvedValue({ files: [] });
      mockGit.diff.mockResolvedValue('');
      mockGit.pull.mockResolvedValue({ files: ['nested.js'] });
      
      mockGit.status.mockResolvedValueOnce({ 
        conflicted: ['nested.js'],
        files: []
      });
      
      inquirer.prompt.mockResolvedValue({ resolutionStrategy: 'ai' });
      mockGit.show.mockResolvedValue('content');
      mockGit.revparse.mockResolvedValue('/tmp');
      fs.readFile.mockResolvedValue(nestedConflict);
      mockAICommit.resolveConflictWithAI.mockResolvedValue('resolved nested content');
      fs.writeFile.mockResolvedValue();
      mockGit.add.mockResolvedValue();
      mockGit.commit.mockResolvedValue();
      
      await expect(autoGit.pullAndHandleConflicts()).resolves.toBeUndefined();
    });

    test('should handle AI resolution failure with fallback', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.status.mockResolvedValue({ files: [] });
      mockGit.diff.mockResolvedValue('');
      mockGit.pull.mockResolvedValue({ files: ['problematic.js'] });
      
      mockGit.status.mockResolvedValueOnce({ 
        conflicted: ['problematic.js'],
        files: []
      });
      
      inquirer.prompt
        .mockResolvedValueOnce({ resolutionStrategy: 'ai' })
        .mockResolvedValueOnce({ fallback: 'ours' });
      
      mockGit.show.mockRejectedValue(new Error('AI resolution failed'));
      mockGit.raw.mockResolvedValue();
      mockGit.add.mockResolvedValue();
      mockGit.commit.mockResolvedValue();
      
      await expect(autoGit.pullAndHandleConflicts()).resolves.toBeUndefined();
    });

    test('should handle multiple simultaneous conflicts', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.status.mockResolvedValue({ files: [] });
      mockGit.diff.mockResolvedValue('');
      mockGit.pull.mockResolvedValue({ files: ['file1.js', 'file2.js', 'file3.js'] });
      
      mockGit.status.mockResolvedValueOnce({ 
        conflicted: ['file1.js', 'file2.js', 'file3.js'],
        files: []
      });
      
      inquirer.prompt.mockResolvedValue({ resolutionStrategy: 'theirs' });
      mockGit.raw.mockResolvedValue();
      mockGit.add.mockResolvedValue();
      mockGit.commit.mockResolvedValue();
      
      await expect(autoGit.pullAndHandleConflicts()).resolves.toBeUndefined();
      expect(mockGit.raw).toHaveBeenCalledTimes(3); // Called for each conflicted file
    });
  });

  describe('Network and Remote Operations Edge Cases', () => {
    test('should handle slow network during pull', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.status.mockResolvedValue({ files: [] });
      mockGit.diff.mockResolvedValue('');
      
      mockGit.pull.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ files: [] }), 30000); // 30 second delay
        });
      });
      
      const startTime = Date.now();
      await expect(autoGit.pullAndHandleConflicts()).resolves.toBeUndefined();
      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThan(25000);
    });

    test('should handle intermittent network failures', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.status.mockResolvedValue({ files: [] });
      mockGit.diff.mockResolvedValue('');
      
      mockGit.pull
        .mockRejectedValueOnce(new Error('Connection timed out'))
        .mockResolvedValueOnce({ files: [] });
      
      inquirer.prompt.mockResolvedValue({ skipPull: false });
      
      await expect(autoGit.pullAndHandleConflicts()).rejects.toThrow();
    });

    test('should handle remote repository unavailable', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.status.mockResolvedValue({ files: [] });
      mockGit.diff.mockResolvedValue('');
      
      mockGit.pull.mockRejectedValue(new Error('unable to access \'https://github.com/user/repo.git\': Could not resolve host'));
      
      inquirer.prompt.mockResolvedValue({ skipPull: true });
      
      await expect(autoGit.pullAndHandleConflicts()).resolves.toBeUndefined();
    });

    test('should handle push during network outage', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.status.mockResolvedValue({ files: [] });
      mockGit.diff.mockResolvedValue('');
      mockGit.add.mockResolvedValue();
      mockGit.commit.mockResolvedValue();
      mockGit.pull.mockResolvedValue({ files: [] });
      
      mockGit.push.mockRejectedValue(new Error('Network is unreachable'));
      
      await expect(autoGit.run()).rejects.toThrow();
    });
  });

  describe('Workflow Edge Cases', () => {
    test('should handle empty commit message generation', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.status.mockResolvedValue({ files: [] });
      mockGit.diff.mockResolvedValue('');
      
      mockAICommit.generateWithSequentialFallback.mockResolvedValue([]);
      
      await expect(autoGit.run()).rejects.toThrow();
    });

    test('should handle AI provider failure during commit generation', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.status.mockResolvedValue({ files: ['test.js'] });
      mockGit.diff.mockResolvedValue('diff content');
      mockGit.add.mockResolvedValue();
      
      mockAICommit.analysisEngine.analyzeRepository.mockResolvedValue({});
      mockAICommit.generateWithSequentialFallback.mockRejectedValue(new Error('All AI providers failed'));
      
      await expect(autoGit.run()).rejects.toThrow();
    });

    test('should handle concurrent workflow executions', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.status.mockResolvedValue({ files: ['test.js'] });
      mockGit.diff.mockResolvedValue('diff content');
      mockGit.add.mockResolvedValue();
      mockGit.commit.mockResolvedValue();
      mockGit.pull.mockResolvedValue({ files: [] });
      mockGit.push.mockResolvedValue();
      
      mockAICommit.analysisEngine.analyzeRepository.mockResolvedValue({});
      mockAICommit.generateWithSequentialFallback.mockResolvedValue(['feat: test commit']);
      
      const promises = [autoGit.run(), autoGit.run()];
      const results = await Promise.allSettled(promises);
      
      // At least one should succeed, but there might be race conditions
      expect(results.some(r => r.status === 'fulfilled')).toBe(true);
    });

    test('should handle repository state changes during workflow', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      
      // Status changes between calls
      mockGit.status
        .mockResolvedValueOnce({ files: ['test.js'] }) // Initial check
        .mockResolvedValueOnce({ files: [] }); // After staging
      
      mockGit.diff.mockResolvedValue('diff content');
      mockGit.add.mockResolvedValue();
      mockGit.commit.mockResolvedValue();
      mockGit.pull.mockResolvedValue({ files: [] });
      mockGit.push.mockResolvedValue();
      
      mockAICommit.analysisEngine.analyzeRepository.mockResolvedValue({});
      mockAICommit.generateWithSequentialFallback.mockResolvedValue(['feat: test commit']);
      
      await expect(autoGit.run()).resolves.toBeUndefined();
    });

    test('should handle dry run mode with various scenarios', async () => {
      const options = { dryRun: true };
      
      // Should not make any actual git calls
      await expect(autoGit.run(options)).resolves.toBeUndefined();
      expect(mockGit.checkIsRepo).not.toHaveBeenCalled();
      expect(mockGit.status).not.toHaveBeenCalled();
    });

    test('should handle force mode with no changes', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.status.mockResolvedValue({ files: [] });
      
      const options = { force: true };
      
      await expect(autoGit.run(options)).resolves.toBeUndefined();
    });
  });

  describe('File System Edge Cases', () => {
    test('should handle files with conflict markers in content', async () => {
      const contentWithMarkers = `<<<<<<< HEAD
some code
=======
other code
>>>>>>> branch`;
      
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.status.mockResolvedValue({ files: [] });
      mockGit.diff.mockResolvedValue('');
      mockGit.add.mockResolvedValue();
      mockGit.commit.mockResolvedValue();
      mockGit.pull.mockResolvedValue({ files: [] });
      
      mockAICommit.analysisEngine.analyzeRepository.mockResolvedValue({});
      mockAICommit.generateWithSequentialFallback.mockResolvedValue(['fix: resolve conflicts']);
      
      await expect(autoGit.run()).resolves.toBeUndefined();
    });

    test('should handle very large repository', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      
      // Simulate large repository status
      const manyFiles = Array.from({ length: 50000 }, (_, i) => ({ 
        path: `file${i}.js`, 
        index: 'M', 
        working_tree: ' ' 
      }));
      
      mockGit.status.mockResolvedValue({ files: manyFiles });
      mockGit.diff.mockResolvedValue('large diff');
      mockGit.add.mockResolvedValue();
      mockGit.commit.mockResolvedValue();
      mockGit.pull.mockResolvedValue({ files: [] });
      mockGit.push.mockResolvedValue();
      
      mockAICommit.analysisEngine.analyzeRepository.mockResolvedValue({});
      mockAICommit.generateWithSequentialFallback.mockResolvedValue(['feat: large update']);
      
      await expect(autoGit.run()).resolves.toBeUndefined();
    });

    test('should handle repository with submodules', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.status.mockResolvedValue({ 
        files: [
          { path: 'submodule', index: ' ', working_tree: 'M' },
          { path: 'file.js', index: 'M', working_tree: ' ' }
        ]
      });
      mockGit.diff.mockResolvedValue('diff content');
      mockGit.add.mockResolvedValue();
      mockGit.commit.mockResolvedValue();
      mockGit.pull.mockResolvedValue({ files: [] });
      mockGit.push.mockResolvedValue();
      
      mockAICommit.analysisEngine.analyzeRepository.mockResolvedValue({});
      mockAICommit.generateWithSequentialFallback.mockResolvedValue(['feat: update submodule and files']);
      
      await expect(autoGit.run()).resolves.toBeUndefined();
    });
  });

  describe('Error Recovery Edge Cases', () => {
    test('should handle partial workflow failure recovery', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.status.mockResolvedValue({ files: ['test.js'] });
      mockGit.diff.mockResolvedValue('diff content');
      mockGit.add.mockResolvedValue();
      mockGit.commit.mockResolvedValue();
      
      // Pull fails but push succeeds
      mockGit.pull.mockRejectedValue(new Error('Network error'));
      mockGit.push.mockResolvedValue();
      
      inquirer.prompt.mockResolvedValue({ skipPull: true });
      
      mockAICommit.analysisEngine.analyzeRepository.mockResolvedValue({});
      mockAICommit.generateWithSequentialFallback.mockResolvedValue(['feat: test commit']);
      
      await expect(autoGit.run()).resolves.toBeUndefined();
    });

    test('should handle git lock file cleanup', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.status.mockResolvedValue({ files: ['test.js'] });
      mockGit.diff.mockResolvedValue('diff content');
      
      // First call fails with lock, second succeeds
      mockGit.add
        .mockRejectedValueOnce(new Error('Unable to create \'.git/index.lock\': File exists'))
        .mockResolvedValueOnce();
      
      mockGit.commit.mockResolvedValue();
      mockGit.pull.mockResolvedValue({ files: [] });
      mockGit.push.mockResolvedValue();
      
      mockAICommit.analysisEngine.analyzeRepository.mockResolvedValue({});
      mockAICommit.generateWithSequentialFallback.mockResolvedValue(['feat: test commit']);
      
      // Should handle the lock error gracefully
      await expect(autoGit.run()).rejects.toThrow();
    });

    test('should handle corrupted git index recovery', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.status.mockRejectedValue(new Error('fatal: bad index file sha1 signature'));
      
      await expect(autoGit.checkForChanges()).rejects.toThrow();
    });
  });

  describe('Performance and Resource Edge Cases', () => {
    test('should handle memory pressure during large operations', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.status.mockResolvedValue({ files: ['large-file.js'] });
      
      // Simulate memory pressure
      mockGit.diff.mockImplementation(() => {
        const largeDiff = 'x'.repeat(100 * 1024 * 1024); // 100MB diff
        return Promise.resolve(largeDiff);
      });
      
      mockGit.add.mockResolvedValue();
      mockGit.commit.mockResolvedValue();
      mockGit.pull.mockResolvedValue({ files: [] });
      mockGit.push.mockResolvedValue();
      
      mockAICommit.analysisEngine.analyzeRepository.mockResolvedValue({});
      mockAICommit.generateWithSequentialFallback.mockResolvedValue(['feat: large file update']);
      
      await expect(autoGit.run()).resolves.toBeUndefined();
    });

    test('should handle file descriptor exhaustion', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.status.mockRejectedValue(new Error('EMFILE: too many open files'));
      
      await expect(autoGit.checkForChanges()).rejects.toThrow();
    });
  });
});