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
      raw: jest.fn().mockResolvedValue(),
      show: jest.fn().mockResolvedValue('file content'),
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

      await expect(gitManager.validateRepository()).rejects.toThrow(
        'Git repository validation failed'
      );
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

  describe('getCommitHistory', () => {
    it('should get commit history with default limit', async () => {
      mockGit.log.mockResolvedValue({
        all: [
          {
            hash: 'abc',
            message: 'test commit',
            author_name: 'test',
            date: '2024-01-01',
            refs: 'HEAD -> main',
          },
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
      mockGit.getRemotes.mockResolvedValue([
        { name: 'origin', refs: { fetch: 'https://github.com/test/repo.git' } },
      ]);

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
          {
            hash: 'abc',
            message: 'feat: add feature',
            author_name: 'test',
            date: '2024-01-01',
            refs: '',
          },
          {
            hash: 'def',
            message: 'fix: bug fix',
            author_name: 'test',
            date: '2024-01-02',
            refs: '',
          },
        ],
      });

      const result = await gitManager.getCommitPatterns();

      expect(result).toBeDefined();
      expect(Array.isArray(result.mostUsedTypes)).toBe(true);
      expect(typeof result.averageLength).toBe('number');
    });
  });

  describe('getStatus', () => {
    it('should return the raw status result', async () => {
      mockGit.status.mockResolvedValue({ conflicted: [], staged: ['a.js'], not_added: ['b.js'] });

      const result = await gitManager.getStatus();

      expect(result.conflicted).toEqual([]);
      expect(result.staged).toEqual(['a.js']);
    });

    it('should handle status errors', async () => {
      mockGit.status.mockRejectedValue(new Error('Status error'));

      await expect(gitManager.getStatus()).rejects.toThrow('Failed to get git status');
    });
  });

  describe('stageAll', () => {
    it('should stage all changes', async () => {
      await gitManager.stageAll();

      expect(mockGit.add).toHaveBeenCalledWith('.');
    });

    it('should handle stage errors', async () => {
      mockGit.add.mockRejectedValue(new Error('Add error'));

      await expect(gitManager.stageAll()).rejects.toThrow('Failed to stage changes');
    });
  });

  describe('pull', () => {
    it('should pull without rebase by default', async () => {
      mockGit.pull.mockResolvedValue({ files: ['a.js'] });

      const result = await gitManager.pull();

      expect(mockGit.pull).toHaveBeenCalledWith();
      expect(result.files).toEqual(['a.js']);
    });

    it('should pull with rebase when requested', async () => {
      await gitManager.pull({ rebase: true });

      expect(mockGit.pull).toHaveBeenCalledWith(['--rebase']);
    });

    it('should handle pull errors', async () => {
      mockGit.pull.mockRejectedValue(new Error('Pull error'));

      await expect(gitManager.pull()).rejects.toThrow('Failed to pull changes');
    });
  });

  describe('push', () => {
    it('should push to the default remote', async () => {
      mockGit.push.mockResolvedValue({ pushed: true });

      const result = await gitManager.push();

      expect(mockGit.push).toHaveBeenCalledWith();
      expect(result.pushed).toBe(true);
    });

    it('should handle push errors', async () => {
      mockGit.push.mockRejectedValue(new Error('Push error'));

      await expect(gitManager.push()).rejects.toThrow('Failed to push changes');
    });
  });

  describe('checkoutSide', () => {
    it('should checkout the ours side of a conflicted file', async () => {
      await gitManager.checkoutSide('test.js', 'ours');

      expect(mockGit.raw).toHaveBeenCalledWith(['checkout', '--ours', '--', 'test.js']);
    });

    it('should checkout the theirs side of a conflicted file', async () => {
      await gitManager.checkoutSide('test.js', 'theirs');

      expect(mockGit.raw).toHaveBeenCalledWith(['checkout', '--theirs', '--', 'test.js']);
    });

    it('should reject invalid sides', async () => {
      await expect(gitManager.checkoutSide('test.js', 'mine')).rejects.toThrow(
        'Invalid checkout side'
      );
    });

    it('should reject empty file paths', async () => {
      await expect(gitManager.checkoutSide('', 'ours')).rejects.toThrow(
        'Checkout requires a file path'
      );
    });

    it('should handle checkout errors', async () => {
      mockGit.raw.mockRejectedValue(new Error('Checkout error'));

      await expect(gitManager.checkoutSide('test.js', 'ours')).rejects.toThrow(
        'Failed to checkout ours version of test.js'
      );
    });
  });

  describe('showIndexSide', () => {
    it('should show the ours side of a conflicted file', async () => {
      mockGit.show.mockResolvedValue('incoming content');

      const result = await gitManager.showIndexSide('test.js', 'ours');

      expect(mockGit.show).toHaveBeenCalledWith([':2:test.js']);
      expect(result).toBe('incoming content');
    });

    it('should show the theirs side of a conflicted file', async () => {
      await gitManager.showIndexSide('test.js', 'theirs');

      expect(mockGit.show).toHaveBeenCalledWith([':3:test.js']);
    });

    it('should reject invalid sides', async () => {
      await expect(gitManager.showIndexSide('test.js', 'mine')).rejects.toThrow(
        'Invalid show side'
      );
    });

    it('should handle show errors', async () => {
      mockGit.show.mockRejectedValue(new Error('Show error'));

      await expect(gitManager.showIndexSide('test.js', 'ours')).rejects.toThrow(
        'Failed to show ours version of test.js'
      );
    });
  });

  describe('rebaseContinue', () => {
    it('should continue the rebase', async () => {
      await gitManager.rebaseContinue();

      expect(mockGit.raw).toHaveBeenCalledWith(['rebase', '--continue']);
    });

    it('should handle continue errors', async () => {
      mockGit.raw.mockRejectedValue(new Error('Continue error'));

      await expect(gitManager.rebaseContinue()).rejects.toThrow('Failed to continue rebase');
    });
  });

  describe('rebaseAbort', () => {
    it('should abort the rebase', async () => {
      await gitManager.rebaseAbort();

      expect(mockGit.raw).toHaveBeenCalledWith(['rebase', '--abort']);
    });

    it('should handle abort errors', async () => {
      mockGit.raw.mockRejectedValue(new Error('Abort error'));

      await expect(gitManager.rebaseAbort()).rejects.toThrow('Failed to abort rebase');
    });
  });

  describe('mergeAbort', () => {
    it('should abort the merge', async () => {
      await gitManager.mergeAbort();

      expect(mockGit.raw).toHaveBeenCalledWith(['merge', '--abort']);
    });

    it('should handle abort errors', async () => {
      mockGit.raw.mockRejectedValue(new Error('Abort error'));

      await expect(gitManager.mergeAbort()).rejects.toThrow('Failed to abort merge');
    });
  });

  describe('getWorkingDiff', () => {
    it('should return the unstaged diff', async () => {
      mockGit.diff.mockResolvedValue('diff content');

      const result = await gitManager.getWorkingDiff();

      expect(mockGit.diff).toHaveBeenCalledWith();
      expect(result).toBe('diff content');
    });

    it('should handle diff errors', async () => {
      mockGit.diff.mockRejectedValue(new Error('Diff error'));

      await expect(gitManager.getWorkingDiff()).rejects.toThrow('Failed to get working diff');
    });
  });
});
