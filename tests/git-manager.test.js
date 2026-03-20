/**
 * Tests for GitManager
 */

jest.mock('simple-git');

const GitManager = require('../src/core/git-manager');

describe('GitManager', () => {
  let gitManager;
  let mockGit;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGit = {
      checkIsRepo: jest.fn().mockResolvedValue(true),
      diff: jest.fn().mockResolvedValue('diff --git a/test.js b/test.js\n+ const x = 1;'),
      log: jest.fn().mockResolvedValue({ all: [] }),
      branch: jest.fn().mockResolvedValue({ current: 'main' }),
      revparse: jest.fn().mockResolvedValue('/test/repo'),
      status: jest.fn().mockResolvedValue({
        staged: ['file1.js'],
        modified: [],
        not_added: [],
        deleted: [],
        created: [],
      }),
      commit: jest.fn().mockResolvedValue({ commit: 'abc123' }),
      diffSummary: jest.fn().mockResolvedValue({
        files: [{ file: 'test.js', changes: 1 }],
        insertions: 1,
        deletions: 0,
        changed: 1,
      }),
      getRemotes: jest.fn().mockResolvedValue([]),
      add: jest.fn().mockResolvedValue(),
      pull: jest.fn().mockResolvedValue({ files: [] }),
      push: jest.fn().mockResolvedValue(),
      reset: jest.fn().mockResolvedValue(),
      stash: jest.fn().mockResolvedValue(),
      stashList: jest.fn().mockResolvedValue({ all: [] }),
      checkout: jest.fn().mockResolvedValue(),
      checkoutLocalBranch: jest.fn().mockResolvedValue(),
      deleteLocalBranch: jest.fn().mockResolvedValue(),
    };

    const simpleGit = require('simple-git');
    simpleGit.mockReturnValue(mockGit);
    gitManager = new GitManager();
  });

  describe('constructor', () => {
    it('should initialize with git instance', () => {
      expect(gitManager.git).toBeDefined();
    });
  });

  describe('validateRepository', () => {
    it('should validate repository successfully', async () => {
      const result = await gitManager.validateRepository();
      expect(result).toBe(true);
      expect(mockGit.checkIsRepo).toHaveBeenCalled();
    });

    it('should throw error when not in git repo', async () => {
      mockGit.checkIsRepo.mockResolvedValue(false);

      await expect(gitManager.validateRepository()).rejects.toThrow('Not a git repository');
    });

    it('should handle validation errors', async () => {
      mockGit.checkIsRepo.mockRejectedValue(new Error('Git error'));

      await expect(gitManager.validateRepository()).rejects.toThrow('Git repository validation failed');
    });
  });

  describe('getStagedDiff', () => {
    it('should get staged diff', async () => {
      const result = await gitManager.getStagedDiff();
      expect(typeof result).toBe('string');
      expect(mockGit.diff).toHaveBeenCalledWith(['--staged']);
    });

    it('should handle diff errors', async () => {
      mockGit.diff.mockRejectedValue(new Error('Diff error'));

      await expect(gitManager.getStagedDiff()).rejects.toThrow('Failed to get staged diff');
    });
  });

  describe('getUnstagedDiff', () => {
    it('should get unstaged diff', async () => {
      const result = await gitManager.getUnstagedDiff();
      expect(typeof result).toBe('string');
      expect(mockGit.diff).toHaveBeenCalledWith();
    });
  });

  describe('getCommitHistory', () => {
    it('should get commit history with default limit', async () => {
      mockGit.log.mockResolvedValue({
        all: [
          { hash: 'abc', message: 'test commit', author_name: 'test', date: '2024-01-01', refs: 'HEAD -> main' },
        ],
      });

      const result = await gitManager.getCommitHistory();

      expect(Array.isArray(result)).toBe(true);
      expect(mockGit.log).toHaveBeenCalledWith({ maxCount: 50 });
    });

    it('should get commit history with custom limit', async () => {
      await gitManager.getCommitHistory(10);

      expect(mockGit.log).toHaveBeenCalledWith({ maxCount: 10 });
    });
  });

  describe('getCurrentBranch', () => {
    it('should get current branch', async () => {
      const result = await gitManager.getCurrentBranch();
      expect(typeof result).toBe('string');
      expect(mockGit.branch).toHaveBeenCalled();
    });
  });

  describe('getRepositoryRoot', () => {
    it('should get repository root', async () => {
      const result = await gitManager.getRepositoryRoot();
      expect(typeof result).toBe('string');
      expect(mockGit.revparse).toHaveBeenCalledWith(['--show-toplevel']);
    });
  });

  describe('getStagedFiles', () => {
    it('should get staged files', async () => {
      const result = await gitManager.getStagedFiles();
      expect(Array.isArray(result)).toBe(true);
      expect(mockGit.status).toHaveBeenCalled();
    });
  });

  describe('hasStagedChanges', () => {
    it('should return true when staged changes exist', async () => {
      mockGit.status.mockResolvedValue({
        staged: ['file1.js'],
        modified: [],
        not_added: [],
        deleted: [],
        created: [],
      });

      const result = await gitManager.hasStagedChanges();
      expect(result).toBe(true);
    });

    it('should return false when no staged changes', async () => {
      mockGit.status.mockResolvedValue({
        staged: [],
        modified: [],
        not_added: [],
        deleted: [],
        created: [],
      });

      const result = await gitManager.hasStagedChanges();
      expect(result).toBe(false);
    });
  });

  describe('commit', () => {
    it('should commit with message', async () => {
      const message = 'Test commit message';
      const result = await gitManager.commit(message);

      expect(result).toBeDefined();
      expect(mockGit.commit).toHaveBeenCalledWith(message);
    });

    it('should handle commit errors', async () => {
      mockGit.commit.mockRejectedValue(new Error('Commit error'));

      await expect(gitManager.commit('Test')).rejects.toThrow('Failed to commit');
    });
  });

  describe('getFileStats', () => {
    it('should get file statistics', async () => {
      const result = await gitManager.getFileStats();

      expect(result).toBeDefined();
      expect(typeof result.insertions).toBe('number');
      expect(typeof result.deletions).toBe('number');
    });
  });

  describe('getRepositoryInfo', () => {
    it('should get repository information', async () => {
      mockGit.getRemotes.mockResolvedValue([{ name: 'origin', refs: { fetch: 'https://github.com/test/repo.git' } }]);

      const result = await gitManager.getRepositoryInfo();

      expect(result).toBeDefined();
      expect(typeof result.branch).toBe('string');
      expect(typeof result.root).toBe('string');
      expect(Array.isArray(result.remotes)).toBe(true);
    });
  });

  describe('getCommitPatterns', () => {
    it('should analyze commit patterns', async () => {
      mockGit.log.mockResolvedValue({
        all: [
          { hash: 'abc', message: 'feat: add feature', author_name: 'test', date: '2024-01-01', refs: '' },
          { hash: 'def', message: 'fix: bug fix', author_name: 'test', date: '2024-01-02', refs: '' },
        ],
      });

      const result = await gitManager.getCommitPatterns();

      expect(result).toBeDefined();
      expect(Array.isArray(result.mostUsedTypes)).toBe(true);
      expect(typeof result.averageLength).toBe('number');
    });
  });

  describe('stashChanges', () => {
    it('should stash changes', async () => {
      mockGit.stash.mockResolvedValue({ saved: true });

      await gitManager.stashChanges();

      expect(mockGit.stash).toHaveBeenCalled();
    });
  });

  describe('popStash', () => {
    it('should pop stash', async () => {
      mockGit.stash.mockResolvedValue({ applied: true });

      await gitManager.popStash();

      expect(mockGit.stash).toHaveBeenCalledWith(['pop']);
    });
  });

  describe('hasStash', () => {
    it('should return true when stash exists', async () => {
      mockGit.stashList.mockResolvedValue({ all: [{ hash: 'abc' }] });

      const result = await gitManager.hasStash();
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockGit.stashList.mockRejectedValue(new Error('Stash error'));

      const result = await gitManager.hasStash();
      expect(result).toBe(false);
    });
  });

  describe('getUnstagedFiles', () => {
    it('should get unstaged files', async () => {
      mockGit.status.mockResolvedValue({
        staged: [],
        modified: ['file1.js'],
        not_added: [],
        deleted: [],
        created: [],
      });

      const result = await gitManager.getUnstagedFiles();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toContain('file1.js');
    });
  });

  describe('resetStaged', () => {
    it('should reset staged changes', async () => {
      await expect(gitManager.resetStaged()).resolves.toBeUndefined();
      expect(mockGit.reset).toHaveBeenCalledWith(['--mixed']);
    });
  });

  describe('getAllChangedFiles', () => {
    it('should get all changed files', async () => {
      mockGit.status.mockResolvedValue({
        staged: ['file1.js'],
        modified: ['file2.js'],
        not_added: ['file3.js'],
        deleted: ['file4.js'],
        created: ['file5.js'],
      });

      const result = await gitManager.getAllChangedFiles();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(5);
    });
  });

  describe('pushCommits', () => {
    it('should push commits to current branch', async () => {
      mockGit.branch.mockResolvedValue({ current: 'main' });
      mockGit.push.mockResolvedValue({ pushed: true });

      await gitManager.pushCommits();

      expect(mockGit.push).toHaveBeenCalledWith('origin', 'main', '');
    });

    it('should push to specified branch', async () => {
      await gitManager.pushCommits('develop');

      expect(mockGit.push).toHaveBeenCalledWith('origin', 'develop', '');
    });

    it('should handle push errors', async () => {
      mockGit.push.mockRejectedValue(new Error('Push error'));

      await expect(gitManager.pushCommits()).rejects.toThrow('Failed to push commits');
    });
  });
});
