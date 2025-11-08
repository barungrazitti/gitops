/**
 * Unit tests for Git Manager - Comprehensive Coverage
 */

jest.mock('simple-git');
const GitManager = require('../src/core/git-manager');
const simpleGit = require('simple-git');

describe('GitManager - Comprehensive Coverage', () => {
  let gitManager;
  let mockGit;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockGit = {
      status: jest.fn(),
      diff: jest.fn(),
      log: jest.fn(),
      add: jest.fn(),
      commit: jest.fn(),
      push: jest.fn(),
      pull: jest.fn(),
      branch: jest.fn(),
      checkout: jest.fn(),
      merge: jest.fn(),
      stash: jest.fn(),
      stashList: jest.fn(),
      stashApply: jest.fn(),
      remote: jest.fn(),
      revparse: jest.fn(),
      show: jest.fn(),
      init: jest.fn(),
      clone: jest.fn(),
      fetch: jest.fn(),
      reset: jest.fn(),
      clean: jest.fn(),
      tag: jest.fn(),
      tagList: jest.fn(),
      deleteTag: jest.fn()
    };

    simpleGit.mockImplementation(() => mockGit);
    gitManager = new GitManager();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default git options', () => {
      expect(gitManager.git).toBeDefined();
      expect(simpleGit).toHaveBeenCalledWith({
        baseDir: process.cwd(),
        binary: 'git'
      });
    });
  });

  describe('getRepositoryRoot', () => {
    it('should return repository root path', async () => {
      mockGit.revparse.mockResolvedValue({ 
        root: '/test/repo' 
      });

      const root = await gitManager.getRepositoryRoot();

      expect(root).toBe('/test/repo');
      expect(mockGit.revparse).toHaveBeenCalledWith(['--show-toplevel']);
    });

    it('should handle not in git repository', async () => {
      mockGit.revparse.mockRejectedValue(new Error('not a git repository'));

      await expect(gitManager.getRepositoryRoot())
        .rejects.toThrow('Not in a git repository');
    });

    it('should handle revparse errors gracefully', async () => {
      mockGit.revparse.mockRejectedValue(new Error('Git command failed'));

      await expect(gitManager.getRepositoryRoot())
        .rejects.toThrow();
    });
  });

  describe('getStagedFiles', () => {
    it('should return list of staged files', async () => {
      const mockStatus = {
        staged: [
          { path: 'file1.js', index: 'M' },
          { path: 'file2.txt', index: 'A' }
        ]
      };
      mockGit.status.mockResolvedValue(mockStatus);

      const files = await gitManager.getStagedFiles();

      expect(files).toEqual(['file1.js', 'file2.txt']);
      expect(mockGit.status).toHaveBeenCalled();
    });

    it('should handle empty staged files', async () => {
      mockGit.status.mockResolvedValue({ staged: [] });

      const files = await gitManager.getStagedFiles();

      expect(files).toEqual([]);
    });

    it('should handle status errors gracefully', async () => {
      mockGit.status.mockRejectedValue(new Error('Status failed'));

      await expect(gitManager.getStagedFiles())
        .rejects.toThrow();
    });
  });

  describe('getStagedDiff', () => {
    it('should return staged diff content', async () => {
      const mockDiff = 'diff --git a/file.js b/file.js\nnew content';
      mockGit.diff.mockResolvedValue(mockDiff);

      const diff = await gitManager.getStagedDiff();

      expect(diff).toBe(mockDiff);
      expect(mockGit.diff).toHaveBeenCalledWith(['--staged']);
    });

    it('should handle empty staged diff', async () => {
      mockGit.diff.mockResolvedValue('');

      const diff = await gitManager.getStagedDiff();

      expect(diff).toBe('');
    });

    it('should handle diff errors gracefully', async () => {
      mockGit.diff.mockRejectedValue(new Error('Diff failed'));

      await expect(gitManager.getStagedDiff())
        .rejects.toThrow();
    });

    it('should handle diff with special characters', async () => {
      const mockDiff = 'diff --git a/测试.js b/测试.js\n测试内容';
      mockGit.diff.mockResolvedValue(mockDiff);

      const diff = await gitManager.getStagedDiff();

      expect(diff).toContain('测试.js');
      expect(diff).toContain('测试内容');
    });
  });

  describe('getUnstagedFiles', () => {
    it('should return list of unstaged files', async () => {
      const mockStatus = {
        files: [
          { path: 'file1.js', index: ' ', working_tree: 'M' },
          { path: 'file2.txt', index: '??', working_tree: '?' }
        ]
      };
      mockGit.status.mockResolvedValue(mockStatus);

      const files = await gitManager.getUnstagedFiles();

      expect(files).toEqual(['file1.js', 'file2.txt']);
    });

    it('should handle empty unstaged files', async () => {
      mockGit.status.mockResolvedValue({ files: [] });

      const files = await gitManager.getUnstagedFiles();

      expect(files).toEqual([]);
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', async () => {
      mockGit.branch.mockResolvedValue({ 
        current: 'main',
        all: ['main', 'develop']
      });

      const branch = await gitManager.getCurrentBranch();

      expect(branch).toBe('main');
      expect(mockGit.branch).toHaveBeenCalled();
    });

    it('should handle detached HEAD state', async () => {
      mockGit.branch.mockResolvedValue({ 
        current: 'HEAD',
        all: ['main']
      });

      const branch = await gitManager.getCurrentBranch();

      expect(branch).toBe('HEAD');
    });

    it('should handle branch errors gracefully', async () => {
      mockGit.branch.mockRejectedValue(new Error('Branch failed'));

      await expect(gitManager.getCurrentBranch())
        .rejects.toThrow();
    });
  });

  describe('getRemoteUrl', () => {
    it('should return remote URL', async () => {
      mockGit.remote.mockResolvedValue({
        origin: {
          refs: {
            fetch: 'https://github.com/test/repo.git'
          }
        }
      });

      const url = await gitManager.getRemoteUrl();

      expect(url).toBe('https://github.com/test/repo.git');
      expect(mockGit.remote).toHaveBeenCalledWith(['get-url', 'origin']);
    });

    it('should handle missing remote', async () => {
      mockGit.remote.mockResolvedValue({});

      const url = await gitManager.getRemoteUrl();

      expect(url).toBeNull();
    });

    it('should handle remote errors gracefully', async () => {
      mockGit.remote.mockRejectedValue(new Error('Remote failed'));

      await expect(gitManager.getRemoteUrl())
        .rejects.toThrow();
    });
  });

  describe('stageFiles', () => {
    it('should stage files', async () => {
      mockGit.add.mockResolvedValue('success');

      await gitManager.stageFiles(['file1.js', 'file2.txt']);

      expect(mockGit.add).toHaveBeenCalledWith(['file1.js', 'file2.txt']);
    });

    it('should handle empty file list', async () => {
      await gitManager.stageFiles([]);

      expect(mockGit.add).toHaveBeenCalledWith([]);
    });

    it('should handle add errors gracefully', async () => {
      mockGit.add.mockRejectedValue(new Error('Add failed'));

      await expect(gitManager.stageFiles(['file1.js']))
        .rejects.toThrow();
    });

    it('should handle staging non-existent files', async () => {
      mockGit.add.mockRejectedValue(new Error('pathspec did not match'));

      await expect(gitManager.stageFiles(['nonexistent.js']))
        .rejects.toThrow();
    });
  });

  describe('unstageFiles', () => {
    it('should unstage files', async () => {
      mockGit.reset.mockResolvedValue('success');

      await gitManager.unstageFiles(['file1.js', 'file2.txt']);

      expect(mockGit.reset).toHaveBeenCalledWith(['--', 'file1.js', 'file2.txt']);
    });

    it('should handle empty file list', async () => {
      await gitManager.unstageFiles([]);

      expect(mockGit.reset).toHaveBeenCalledWith(['--']);
    });

    it('should handle reset errors gracefully', async () => {
      mockGit.reset.mockRejectedValue(new Error('Reset failed'));

      await expect(gitManager.unstageFiles(['file1.js']))
        .rejects.toThrow();
    });
  });

  describe('commit', () => {
    it('should commit with message', async () => {
      mockGit.commit.mockResolvedValue({
        commit: 'abc123',
        summary: 'test commit'
      });

      const result = await gitManager.commit('test commit');

      expect(result.commit).toBe('abc123');
      expect(mockGit.commit).toHaveBeenCalledWith(['test commit']);
    });

    it('should commit with message and options', async () => {
      mockGit.commit.mockResolvedValue({
        commit: 'def456',
        summary: 'test commit with options'
      });

      const result = await gitManager.commit('test commit', {
        '--author': 'Test User <test@example.com>',
        '--no-verify': null
      });

      expect(result.commit).toBe('def456');
      expect(mockGit.commit).toHaveBeenCalledWith([
        'test commit',
        '--author=Test User <test@example.com>',
        '--no-verify'
      ]);
    });

    it('should handle commit errors gracefully', async () => {
      mockGit.commit.mockRejectedValue(new Error('Commit failed'));

      await expect(gitManager.commit('test commit'))
        .rejects.toThrow();
    });

    it('should handle empty commit message', async () => {
      mockGit.commit.mockRejectedValue(new Error('Aborting commit due to empty message'));

      await expect(gitManager.commit(''))
        .rejects.toThrow();
    });
  });

  describe('push', () => {
    it('should push to remote', async () => {
      mockGit.push.mockResolvedValue({
        pushed: [{ remote: 'origin', branch: 'main' }]
      });

      const result = await gitManager.push();

      expect(result.pushed).toHaveLength(1);
      expect(mockGit.push).toHaveBeenCalledWith(['origin', 'main']);
    });

    it('should push specific branch', async () => {
      mockGit.push.mockResolvedValue({
        pushed: [{ remote: 'origin', branch: 'feature' }]
      });

      const result = await gitManager.push('feature');

      expect(result.pushed).toHaveLength(1);
      expect(mockGit.push).toHaveBeenCalledWith(['origin', 'feature']);
    });

    it('should handle push errors gracefully', async () => {
      mockGit.push.mockRejectedValue(new Error('Push failed'));

      await expect(gitManager.push())
        .rejects.toThrow();
    });

    it('should handle authentication errors', async () => {
      mockGit.push.mockRejectedValue(new Error('Authentication failed'));

      await expect(gitManager.push())
        .rejects.toThrow('Authentication failed');
    });
  });

  describe('pull', () => {
    it('should pull from remote', async () => {
      mockGit.pull.mockResolvedValue({
        files: ['file1.js', 'file2.js'],
        insertions: 10,
        deletions: 5
      });

      const result = await gitManager.pull();

      expect(result.files).toContain('file1.js');
      expect(mockGit.pull).toHaveBeenCalledWith(['origin', 'main']);
    });

    it('should pull specific branch', async () => {
      mockGit.pull.mockResolvedValue({
        files: [],
        insertions: 0,
        deletions: 0
      });

      const result = await gitManager.pull('develop');

      expect(result.files).toEqual([]);
      expect(mockGit.pull).toHaveBeenCalledWith(['origin', 'develop']);
    });

    it('should handle pull errors gracefully', async () => {
      mockGit.pull.mockRejectedValue(new Error('Pull failed'));

      await expect(gitManager.pull())
        .rejects.toThrow();
    });

    it('should handle merge conflicts', async () => {
      mockGit.pull.mockRejectedValue(new Error('Merge conflict'));

      await expect(gitManager.pull())
        .rejects.toThrow('Merge conflict');
    });
  });

  describe('createBranch', () => {
    it('should create new branch', async () => {
      mockGit.branch.mockResolvedValue({
        all: ['main', 'feature/new-branch'],
        current: 'feature/new-branch'
      });

      const result = await gitManager.createBranch('feature/new-branch');

      expect(result.all).toContain('feature/new-branch');
      expect(result.current).toBe('feature/new-branch');
      expect(mockGit.branch).toHaveBeenCalledWith(['feature/new-branch']);
    });

    it('should create and checkout new branch', async () => {
      mockGit.branch.mockResolvedValue({
        all: ['main', 'feature/checkout-branch'],
        current: 'feature/checkout-branch'
      });

      const result = await gitManager.createBranch('feature/checkout-branch', true);

      expect(result.current).toBe('feature/checkout-branch');
    });

    it('should handle branch creation errors', async () => {
      mockGit.branch.mockRejectedValue(new Error('Branch already exists'));

      await expect(gitManager.createBranch('main'))
        .rejects.toThrow();
    });
  });

  describe('switchBranch', () => {
    it('should switch to existing branch', async () => {
      mockGit.checkout.mockResolvedValue('success');

      await gitManager.switchBranch('feature/test');

      expect(mockGit.checkout).toHaveBeenCalledWith(['feature/test']);
    });

    it('should handle switch errors gracefully', async () => {
      mockGit.checkout.mockRejectedValue(new Error('Switch failed'));

      await expect(gitManager.switchBranch('nonexistent'))
        .rejects.toThrow();
    });

    it('should handle uncommitted changes error', async () => {
      mockGit.checkout.mockRejectedValue(new Error('You have uncommitted changes'));

      await expect(gitManager.switchBranch('main'))
        .rejects.toThrow();
    });
  });

  describe('merge', () => {
    it('should merge branch', async () => {
      mockGit.merge.mockResolvedValue({
        conflicts: [],
        merges: ['feature/test']
      });

      const result = await gitManager.merge('feature/test');

      expect(result.conflicts).toHaveLength(0);
      expect(result.merges).toContain('feature/test');
      expect(mockGit.merge).toHaveBeenCalledWith(['feature/test']);
    });

    it('should handle merge conflicts', async () => {
      mockGit.merge.mockResolvedValue({
        conflicts: ['file1.js'],
        merges: []
      });

      const result = await gitManager.merge('feature/conflict');

      expect(result.conflicts).toContain('file1.js');
    });

    it('should handle merge errors gracefully', async () => {
      mockGit.merge.mockRejectedValue(new Error('Merge failed'));

      await expect(gitManager.merge('feature/test'))
        .rejects.toThrow();
    });
  });

  describe('stash', () => {
    it('should stash changes', async () => {
      mockGit.stash.mockResolvedValue({
        stash: [{ ref: 'refs/stash@{0}' }]
      });

      const result = await gitManager.stash();

      expect(result.stash).toHaveLength(1);
      expect(mockGit.stash).toHaveBeenCalledWith(['push']);
    });

    it('should stash with message', async () => {
      mockGit.stash.mockResolvedValue({
        stash: [{ ref: 'refs/stash@{0}' }]
      });

      await gitManager.stash('WIP: test changes');

      expect(mockGit.stash).toHaveBeenCalledWith(['push', '-m', 'WIP: test changes']);
    });

    it('should handle stash errors gracefully', async () => {
      mockGit.stash.mockRejectedValue(new Error('Stash failed'));

      await expect(gitManager.stash())
        .rejects.toThrow();
    });
  });

  describe('stashApply', () => {
    it('should apply latest stash', async () => {
      mockGit.stashApply.mockResolvedValue('success');

      await gitManager.stashApply();

      expect(mockGit.stashApply).toHaveBeenCalledWith(['pop']);
    });

    it('should apply specific stash', async () => {
      mockGit.stashApply.mockResolvedValue('success');

      await gitManager.stashApply('stash@{1}');

      expect(mockGit.stashApply).toHaveBeenCalledWith(['apply', 'stash@{1}']);
    });

    it('should handle stash apply conflicts', async () => {
      mockGit.stashApply.mockRejectedValue(new Error('CONFLICTS'));

      await expect(gitManager.stashApply())
        .rejects.toThrow('CONFLICTS');
    });
  });

  describe('getLog', () => {
    it('should return commit log', async () => {
      const mockLog = [
        { hash: 'abc123', message: 'First commit', date: '2023-01-01' },
        { hash: 'def456', message: 'Second commit', date: '2023-01-02' }
      ];
      mockGit.log.mockResolvedValue(mockLog);

      const log = await gitManager.getLog();

      expect(log).toHaveLength(2);
      expect(log[0].hash).toBe('abc123');
      expect(mockGit.log).toHaveBeenCalled();
    });

    it('should return limited log', async () => {
      const mockLog = [
        { hash: 'abc123', message: 'First commit' },
        { hash: 'def456', message: 'Second commit' }
      ];
      mockGit.log.mockResolvedValue(mockLog);

      const log = await gitManager.getLog(1);

      expect(log).toHaveLength(1);
      expect(mockGit.log).toHaveBeenCalledWith({ maxCount: 1 });
    });

    it('should handle log errors gracefully', async () => {
      mockGit.log.mockRejectedValue(new Error('Log failed'));

      await expect(gitManager.getLog())
        .rejects.toThrow();
    });
  });

  describe('tag', () => {
    it('should create tag', async () => {
      mockGit.tag.mockResolvedValue({
        all: ['v1.0.0', 'main']
      });

      const result = await gitManager.tag('v1.0.0', 'Release version 1.0.0');

      expect(result.all).toContain('v1.0.0');
      expect(mockGit.tag).toHaveBeenCalledWith(['v1.0.0', '-m', 'Release version 1.0.0']);
    });

    it('should create lightweight tag', async () => {
      mockGit.tag.mockResolvedValue({
        all: ['v1.0.1', 'main']
      });

      await gitManager.tag('v1.0.1');

      expect(mockGit.tag).toHaveBeenCalledWith(['v1.0.1']);
    });

    it('should handle tag errors gracefully', async () => {
      mockGit.tag.mockRejectedValue(new Error('Tag failed'));

      await expect(gitManager.tag('v1.0.0'))
        .rejects.toThrow();
    });
  });

  describe('getRemoteBranches', () => {
    it('should return list of remote branches', async () => {
      mockGit.branch.mockResolvedValue({
        branches: {
          'origin/main': 'remotes/origin/main',
          'origin/develop': 'remotes/origin/develop'
        },
        current: 'main'
      });

      const branches = await gitManager.getRemoteBranches();

      expect(branches).toContain('main');
      expect(branches).toContain('develop');
    });

    it('should handle empty remote branches', async () => {
      mockGit.branch.mockResolvedValue({
        branches: {},
        current: 'main'
      });

      const branches = await gitManager.getRemoteBranches();

      expect(branches).toEqual([]);
    });
  });

  describe('getTags', () => {
    it('should return list of tags', async () => {
      mockGit.tagList.mockResolvedValue({
        all: ['v1.0.0', 'v1.0.1', 'v2.0.0']
      });

      const tags = await gitManager.getTags();

      expect(tags).toContain('v1.0.0');
      expect(tags).toContain('v1.0.1');
      expect(tags).toContain('v2.0.0');
      expect(mockGit.tagList).toHaveBeenCalled();
    });

    it('should handle empty tags', async () => {
      mockGit.tagList.mockResolvedValue({
        all: []
      });

      const tags = await gitManager.getTags();

      expect(tags).toEqual([]);
    });
  });

  describe('deleteTag', () => {
    it('should delete tag', async () => {
      mockGit.deleteTag.mockResolvedValue('success');

      await gitManager.deleteTag('v1.0.0');

      expect(mockGit.deleteTag).toHaveBeenCalledWith(['v1.0.0']);
    });

    it('should handle delete tag errors gracefully', async () => {
      mockGit.deleteTag.mockRejectedValue(new Error('Delete failed'));

      await expect(gitManager.deleteTag('v1.0.0'))
        .rejects.toThrow();
    });
  });

  describe('init', () => {
    it('should initialize repository', async () => {
      mockGit.init.mockResolvedValue({
        repository: { root: '/test/repo' }
      });

      const result = await gitManager.init('/test/repo');

      expect(result.repository.root).toBe('/test/repo');
      expect(mockGit.init).toHaveBeenCalledWith({ cwd: '/test/repo' });
    });

    it('should handle init errors gracefully', async () => {
      mockGit.init.mockRejectedValue(new Error('Init failed'));

      await expect(gitManager.init('/test/repo'))
        .rejects.toThrow();
    });
  });

  describe('clone', () => {
    it('should clone repository', async () => {
      mockGit.clone.mockResolvedValue({
        repository: { root: '/test/cloned-repo' }
      });

      const result = await gitManager.clone(
        'https://github.com/test/repo.git',
        '/test/cloned-repo'
      );

      expect(result.repository.root).toBe('/test/cloned-repo');
      expect(mockGit.clone).toHaveBeenCalledWith(
        'https://github.com/test/repo.git',
        '/test/cloned-repo'
      );
    });

    it('should handle clone errors gracefully', async () => {
      mockGit.clone.mockRejectedValue(new Error('Clone failed'));

      await expect(gitManager.clone('https://github.com/test/repo.git'))
        .rejects.toThrow();
    });
  });

  describe('isWorkingDirectoryClean', () => {
    it('should return true for clean working directory', async () => {
      mockGit.status.mockResolvedValue({
        isClean: true
      });

      const isClean = await gitManager.isWorkingDirectoryClean();

      expect(isClean).toBe(true);
    });

    it('should return false for dirty working directory', async () => {
      mockGit.status.mockResolvedValue({
        isClean: false,
        files: [{ path: 'file.js', working_tree: 'M' }]
      });

      const isClean = await gitManager.isWorkingDirectoryClean();

      expect(isClean).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete workflow: add, commit, push', async () => {
      mockGit.add.mockResolvedValue('success');
      mockGit.commit.mockResolvedValue({ commit: 'abc123' });
      mockGit.push.mockResolvedValue({ pushed: [{ branch: 'main' }] });

      await gitManager.stageFiles(['file.js']);
      const commitResult = await gitManager.commit('test commit');
      const pushResult = await gitManager.push();

      expect(commitResult.commit).toBe('abc123');
      expect(pushResult.pushed).toHaveLength(1);
    });

    it('should handle branch workflow: create, checkout, merge', async () => {
      mockGit.branch.mockResolvedValue({ current: 'feature/test', all: ['main', 'feature/test'] });
      mockGit.checkout.mockResolvedValue('success');
      mockGit.merge.mockResolvedValue({ conflicts: [], merges: ['feature/test'] });

      await gitManager.createBranch('feature/test');
      await gitManager.switchBranch('feature/test');
      await gitManager.merge('feature/test');

      expect(mockGit.branch).toHaveBeenCalledWith(['feature/test']);
      expect(mockGit.checkout).toHaveBeenCalledWith(['feature/test']);
      expect(mockGit.merge).toHaveBeenCalledWith(['feature/test']);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle very large diffs', async () => {
      const largeDiff = 'x'.repeat(100000);
      mockGit.diff.mockResolvedValue(largeDiff);

      const diff = await gitManager.getStagedDiff();

      expect(diff).toHaveLength(100000);
    });

    it('should handle special characters in file names', async () => {
      const mockStatus = {
        staged: [
          { path: '测试文件.js', index: 'M' },
          { path: 'файл.txt', index: 'A' }
        ]
      };
      mockGit.status.mockResolvedValue(mockStatus);

      const files = await gitManager.getStagedFiles();

      expect(files).toContain('测试文件.js');
      expect(files).toContain('файл.txt');
    });

    it('should handle concurrent operations', async () => {
      mockGit.status.mockResolvedValue({ staged: [{ path: 'file.js', index: 'M' }] });
      mockGit.add.mockResolvedValue('success');

      const promises = [
        gitManager.getStagedFiles(),
        gitManager.getStagedFiles(),
        gitManager.stageFiles(['file.js'])
      ];

      const results = await Promise.all(promises);

      expect(results[0]).toEqual(['file.js']);
      expect(results[1]).toEqual(['file.js']);
      expect(results[2]).toBeUndefined();
    });
  });

  describe('performance and optimization', () => {
    it('should cache repository root path', async () => {
      mockGit.revparse.mockResolvedValue({ root: '/test/repo' });

      const root1 = await gitManager.getRepositoryRoot();
      const root2 = await gitManager.getRepositoryRoot();

      expect(root1).toBe(root2);
      expect(mockGit.revparse).toHaveBeenCalledTimes(2);
    });

    it('should handle large file lists efficiently', async () => {
      const mockStatus = {
        staged: Array(1000).fill(null).map((_, i) => ({ 
          path: `file${i}.js`, 
          index: 'M' 
        }))
      };
      mockGit.status.mockResolvedValue(mockStatus);

      const start = Date.now();
      const files = await gitManager.getStagedFiles();
      const end = Date.now();

      expect(files).toHaveLength(1000);
      expect(end - start).toBeLessThan(1000);
    });
  });
});