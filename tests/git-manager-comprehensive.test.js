/**
 * Comprehensive Tests for Git Manager
 */

const GitManager = require('../src/core/git-manager');
const simpleGit = require('simple-git');

jest.mock('simple-git');

describe('GitManager', () => {
  let gitManager;
  let mockGit;

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
    };
    simpleGit.mockReturnValue(mockGit);
    gitManager = new GitManager();
  });

  describe('validateRepository', () => {
    test('should validate repository successfully', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);

      await expect(gitManager.validateRepository()).resolves.toBeUndefined();
      expect(mockGit.checkIsRepo).toHaveBeenCalled();
    });

    test('should throw error for non-git repository', async () => {
      mockGit.checkIsRepo.mockResolvedValue(false);

      await expect(gitManager.validateRepository()).rejects.toThrow('Not a git repository');
    });

    test('should handle git check errors', async () => {
      mockGit.checkIsRepo.mockRejectedValue(new Error('Git error'));

      await expect(gitManager.validateRepository()).rejects.toThrow('Failed to validate git repository');
    });
  });

  describe('getStagedDiff', () => {
    test('should get staged diff successfully', async () => {
      const expectedDiff = 'diff --git a/file.js b/file.js\n+ new content';
      mockGit.diff.mockResolvedValue(expectedDiff);

      const result = await gitManager.getStagedDiff();

      expect(result).toBe(expectedDiff);
      expect(mockGit.diff).toHaveBeenCalledWith(['--cached']);
    });

    test('should handle empty staged diff', async () => {
      mockGit.diff.mockResolvedValue('');

      const result = await gitManager.getStagedDiff();

      expect(result).toBe('');
    });

    test('should handle diff errors', async () => {
      mockGit.diff.mockRejectedValue(new Error('Diff error'));

      await expect(gitManager.getStagedDiff()).rejects.toThrow('Failed to get staged diff');
    });
  });

  describe('commit', () => {
    test('should commit with message successfully', async () => {
      const message = 'feat: add new feature';
      mockGit.commit.mockResolvedValue({ commit: 'abc123' });

      await gitManager.commit(message);

      expect(mockGit.commit).toHaveBeenCalledWith(message);
    });

    test('should handle commit errors', async () => {
      const message = 'feat: add new feature';
      mockGit.commit.mockRejectedValue(new Error('Commit error'));

      await expect(gitManager.commit(message)).rejects.toThrow('Failed to create commit');
    });

    test('should handle empty commit message', async () => {
      await expect(gitManager.commit('')).rejects.toThrow('Commit message cannot be empty');
    });
  });

  describe('getStatus', () => {
    test('should get repository status', async () => {
      const mockStatus = {
        files: [
          { path: 'file.js', index: 'M', working_tree: ' ' }
        ],
        staged: ['file.js'],
        modified: [],
        created: [],
        deleted: []
      };
      mockGit.status.mockResolvedValue(mockStatus);

      const result = await gitManager.getStatus();

      expect(result).toEqual(mockStatus);
      expect(mockGit.status).toHaveBeenCalled();
    });

    test('should handle status errors', async () => {
      mockGit.status.mockRejectedValue(new Error('Status error'));

      await expect(gitManager.getStatus()).rejects.toThrow('Failed to get repository status');
    });
  });

  describe('addFiles', () => {
    test('should add files successfully', async () => {
      const files = ['file1.js', 'file2.js'];
      mockGit.add.mockResolvedValue({});

      await gitManager.addFiles(files);

      expect(mockGit.add).toHaveBeenCalledWith(files);
    });

    test('should handle add errors', async () => {
      const files = ['file1.js'];
      mockGit.add.mockRejectedValue(new Error('Add error'));

      await expect(gitManager.addFiles(files)).rejects.toThrow('Failed to add files');
    });
  });

  describe('getCommitHistory', () => {
    test('should get commit history', async () => {
      const mockLog = {
        all: [
          { hash: 'abc123', message: 'feat: add feature', date: '2023-01-01' },
          { hash: 'def456', message: 'fix: bug', date: '2023-01-02' }
        ]
      };
      mockGit.log.mockResolvedValue(mockLog);

      const result = await gitManager.getCommitHistory(10);

      expect(result).toEqual(mockLog.all);
      expect(mockGit.log).toHaveBeenCalledWith({ maxCount: 10 });
    });

    test('should handle log errors', async () => {
      mockGit.log.mockRejectedValue(new Error('Log error'));

      await expect(gitManager.getCommitHistory()).rejects.toThrow('Failed to get commit history');
    });
  });

  describe('getCurrentBranch', () => {
    test('should get current branch', async () => {
      mockGit.branch.mockResolvedValue({ current: 'main' });

      const result = await gitManager.getCurrentBranch();

      expect(result).toBe('main');
      expect(mockGit.branch).toHaveBeenCalled();
    });

    test('should handle branch errors', async () => {
      mockGit.branch.mockRejectedValue(new Error('Branch error'));

      await expect(gitManager.getCurrentBranch()).rejects.toThrow('Failed to get current branch');
    });
  });

  describe('hasStagedChanges', () => {
    test('should detect staged changes', async () => {
      const mockStatus = {
        staged: ['file.js'],
        files: [{ path: 'file.js', index: 'A', working_tree: ' ' }]
      };
      mockGit.status.mockResolvedValue(mockStatus);

      const result = await gitManager.hasStagedChanges();

      expect(result).toBe(true);
    });

    test('should return false for no staged changes', async () => {
      const mockStatus = {
        staged: [],
        files: []
      };
      mockGit.status.mockResolvedValue(mockStatus);

      const result = await gitManager.hasStagedChanges();

      expect(result).toBe(false);
    });
  });

  describe('getChangedFiles', () => {
    test('should get changed files', async () => {
      const mockStatus = {
        files: [
          { path: 'file1.js', index: 'M', working_tree: ' ' },
          { path: 'file2.js', index: 'A', working_tree: ' ' }
        ]
      };
      mockGit.status.mockResolvedValue(mockStatus);

      const result = await gitManager.getChangedFiles();

      expect(result).toEqual(['file1.js', 'file2.js']);
    });

    test('should handle empty changed files', async () => {
      const mockStatus = { files: [] };
      mockGit.status.mockResolvedValue(mockStatus);

      const result = await gitManager.getChangedFiles();

      expect(result).toEqual([]);
    });
  });
});