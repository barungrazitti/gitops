/**
 * Unit tests for AutoGit class
 */

// Mock all dependencies before requiring
jest.mock('../src/index');
jest.mock('ora');
jest.mock('inquirer');
jest.mock('fs-extra');
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => args.join('/')),
  isAbsolute: jest.fn(p => String(p).startsWith('/')),
}));

const ora = require('ora');
const inquirer = require('inquirer');
const AICommitGenerator = require('../src/index');
const AutoGit = require('../src/auto-git');

describe('AutoGit', () => {
  let autoGit;
  let mockGitManager;
  let mockAiCommit;
  let mockSpinner;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock git manager (the git facade)
    mockGitManager = {
      validateRepository: jest.fn(),
      getStatus: jest.fn(),
      getStatusCached: jest.fn().mockImplementation(() => mockGitManager.getStatus()),
      invalidateStatusCache: jest.fn(),
      stageAll: jest.fn(),
      getStagedDiff: jest.fn(),
      getWorkingDiff: jest.fn().mockResolvedValue(''),
      commit: jest.fn(),
      pull: jest.fn(),
      push: jest.fn(),
      checkoutSide: jest.fn(),
      showIndexSide: jest.fn(),
      rebaseContinue: jest.fn().mockResolvedValue(),
      rebaseAbort: jest.fn().mockResolvedValue(),
      mergeAbort: jest.fn().mockResolvedValue(),
      getRepositoryRoot: jest.fn(),
      getCurrentBranch: jest.fn().mockResolvedValue('main'),
    };

    // Setup mock AI commit generator and collaborators
    mockAiCommit = {
      activityLogger: {
        info: jest.fn().mockResolvedValue(),
        warn: jest.fn().mockResolvedValue(),
        error: jest.fn().mockResolvedValue(),
        logConflictResolution: jest.fn().mockResolvedValue(),
      },
      analysisEngine: {
        analyzeRepository: jest.fn().mockResolvedValue({}),
      },
      configManager: {
        getAll: jest.fn().mockResolvedValue({}),
      },
      generateMessages: jest.fn(),
      conflictResolver: {
        detectAndCleanupConflictMarkers: jest.fn().mockResolvedValue({ cleaned: false }),
        resolveConflictWithAI: jest.fn(),
      },
    };
    AICommitGenerator.mockImplementation(() => mockAiCommit);

    // Setup mock spinner
    mockSpinner = {
      start: jest.fn().mockReturnThis(),
      text: '',
      succeed: jest.fn(),
      fail: jest.fn(),
    };
    ora.mockReturnValue(mockSpinner);

    autoGit = new AutoGit({
      gitManager: mockGitManager,
      analysisEngine: mockAiCommit.analysisEngine,
      configManager: mockAiCommit.configManager,
      generateMessages: mockAiCommit.generateMessages,
      conflictResolver: mockAiCommit.conflictResolver,
      activityLogger: mockAiCommit.activityLogger,
    });
  });

  describe('constructor', () => {
    it('should initialize with injected git facade and collaborators', () => {
      expect(autoGit.gitManager).toBe(mockGitManager);
      expect(autoGit.activityLogger).toBe(mockAiCommit.activityLogger);
      expect(autoGit.analysisEngine).toBe(mockAiCommit.analysisEngine);
      expect(autoGit.conflictResolver).toBe(mockAiCommit.conflictResolver);
    });

  });

  describe('run', () => {
    beforeEach(() => {
      autoGit.validateRepository = jest.fn().mockResolvedValue();
      autoGit.checkForChanges = jest.fn().mockResolvedValue(true);
      autoGit.stageChanges = jest.fn().mockResolvedValue();
      autoGit.generateCommitMessage = jest.fn().mockResolvedValue('test commit');
      autoGit.commitChanges = jest.fn().mockResolvedValue();
      autoGit.pullAndHandleConflicts = jest.fn().mockResolvedValue();
      autoGit.pushChanges = jest.fn().mockResolvedValue();
    });

    it('should handle dry run mode', async () => {
      const stdoutSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await autoGit.run({ dryRun: true });

      expect(autoGit.validateRepository).not.toHaveBeenCalled();
      expect(autoGit.stageChanges).not.toHaveBeenCalled();
      expect(autoGit.pushChanges).not.toHaveBeenCalled();
      expect(autoGit.generateCommitMessage).toHaveBeenCalled();
      expect(stdoutSpy).toHaveBeenCalledWith('test commit');
      stdoutSpy.mockRestore();
    });

    it('should stay silent on dry run when no message can be generated', async () => {
      autoGit.generateCommitMessage = jest.fn().mockRejectedValue(new Error('no staged changes'));
      const stdoutSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await autoGit.run({ dryRun: true });

      expect(stdoutSpy).not.toHaveBeenCalled();
      stdoutSpy.mockRestore();
    });

    it('should prefer the manual message over AI on dry run', async () => {
      const stdoutSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await autoGit.run({ dryRun: true, manualMessage: 'custom message' });

      expect(autoGit.generateCommitMessage).not.toHaveBeenCalled();
      expect(stdoutSpy).toHaveBeenCalledWith('custom message');
      stdoutSpy.mockRestore();
    });

    it('scrubs control characters from the dry-run stdout seam', async () => {
      autoGit.generateCommitMessage = jest
        .fn()
        .mockResolvedValue('feat: add \x1b[31mred\x1b[0m thing\n\nRefs: #1');
      const stdoutSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await autoGit.run({ dryRun: true });

      const printed = stdoutSpy.mock.calls.flat().map(String).join('\n');
      expect(printed).toContain('feat: add ');
      expect(printed).toContain('Refs: #1');
      expect(printed).not.toContain('\x1b');
      stdoutSpy.mockRestore();
    });

    it('should complete full workflow successfully', async () => {
      await autoGit.run();

      expect(autoGit.validateRepository).toHaveBeenCalled();
      expect(autoGit.checkForChanges).toHaveBeenCalled();
      expect(autoGit.stageChanges).toHaveBeenCalled();
      expect(autoGit.generateCommitMessage).toHaveBeenCalled();
      expect(autoGit.commitChanges).toHaveBeenCalledWith('test commit', {});
      expect(autoGit.pullAndHandleConflicts).toHaveBeenCalled();
      expect(autoGit.pushChanges).toHaveBeenCalled();
    });

    it('should exit when no changes and not forced', async () => {
      autoGit.checkForChanges.mockResolvedValue(false);

      await autoGit.run();

      expect(autoGit.stageChanges).not.toHaveBeenCalled();
      expect(autoGit.commitChanges).not.toHaveBeenCalled();
    });

    it('should continue when no changes but forced', async () => {
      autoGit.checkForChanges.mockResolvedValue(false);

      await autoGit.run({ force: true });

      expect(autoGit.stageChanges).toHaveBeenCalled();
      expect(autoGit.commitChanges).toHaveBeenCalled();
    });

    it('should use manual message when provided', async () => {
      await autoGit.run({ manualMessage: 'custom message' });

      expect(autoGit.generateCommitMessage).not.toHaveBeenCalled();
      expect(autoGit.commitChanges).toHaveBeenCalledWith('custom message', {
        manualMessage: 'custom message',
      });
    });

    it('should cancel when user cancels commit generation', async () => {
      autoGit.generateCommitMessage.mockResolvedValue(null);

      await autoGit.run();

      expect(autoGit.commitChanges).not.toHaveBeenCalled();
      expect(autoGit.pushChanges).not.toHaveBeenCalled();
    });

    it('should skip push when specified', async () => {
      await autoGit.run({ push: false });

      expect(autoGit.pushChanges).not.toHaveBeenCalled();
    });

    it('should skip pull when specified', async () => {
      await autoGit.run({ skipPull: true });

      expect(autoGit.pullAndHandleConflicts).not.toHaveBeenCalled();
    });

    it('should handle pull failure and offer to skip', async () => {
      const pullError = new Error('Pull failed');
      autoGit.pullAndHandleConflicts.mockRejectedValue(pullError);

      inquirer.prompt.mockResolvedValue({ skipPull: true });

      await autoGit.run();

      expect(inquirer.prompt).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'skipPull',
          message: 'Skip pull and continue with push?',
          default: false,
        },
      ]);
    });

    it('should cancel when pull fails and user declines to skip', async () => {
      const pullError = new Error('Pull failed');
      autoGit.pullAndHandleConflicts.mockRejectedValue(pullError);

      inquirer.prompt.mockResolvedValue({ skipPull: false });

      await autoGit.run();

      expect(autoGit.pushChanges).not.toHaveBeenCalled();
    });

    it('should log workflow completion', async () => {
      await autoGit.run();

      expect(mockAiCommit.activityLogger.info).toHaveBeenCalledWith('auto_git_started', {
        options: {},
      });
      expect(mockAiCommit.activityLogger.info).toHaveBeenCalledWith('auto_git_completed', {
        success: true,
        duration: expect.any(Number),
        commitMessage: 'test commit',
      });
    });

    it('should handle workflow errors', async () => {
      const error = new Error('Test error');
      autoGit.validateRepository.mockRejectedValue(error);

      await expect(autoGit.run()).rejects.toThrow('Test error');
      expect(mockAiCommit.activityLogger.error).toHaveBeenCalledWith('auto_git_failed', {
        error: 'Test error',
        stack: expect.any(String),
        duration: expect.any(Number),
      });
    });
  });

  describe('validateRepository', () => {
    it('should validate successfully', async () => {
      mockGitManager.validateRepository.mockResolvedValue(true);

      await autoGit.validateRepository();

      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Git repository validated');
      // Spinner should remain as an ora instance, not be null
      expect(autoGit.spinner).toBeDefined();
    });

    it('should throw error for non-git repository', async () => {
      mockGitManager.validateRepository.mockResolvedValue(false);

      await expect(autoGit.validateRepository()).rejects.toThrow('Not a git repository');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Repository validation failed');
    });

    it('should handle git errors', async () => {
      const error = new Error('Git error');
      mockGitManager.validateRepository.mockRejectedValue(error);

      await expect(autoGit.validateRepository()).rejects.toThrow('Git error');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Repository validation failed');
    });
  });

  describe('checkForChanges', () => {
    it('should detect changes', async () => {
      mockGitManager.getStatus.mockResolvedValue({
        files: ['test.js'],
        not_added: [],
        created: [],
        deleted: [],
        modified: [],
        renamed: [],
      });

      const hasChanges = await autoGit.checkForChanges();

      expect(hasChanges).toBe(true);
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Changes detected');
    });

    it('should detect no changes', async () => {
      mockGitManager.getStatus.mockResolvedValue({
        files: [],
        not_added: [],
        created: [],
        deleted: [],
        modified: [],
        renamed: [],
      });

      const hasChanges = await autoGit.checkForChanges();

      expect(hasChanges).toBe(false);
      expect(mockSpinner.succeed).toHaveBeenCalledWith('No changes detected');
    });

    it('should detect unstaged changes', async () => {
      mockGitManager.getStatus.mockResolvedValue({
        files: [],
        not_added: ['new.js'],
        created: [],
        deleted: [],
        modified: [],
        renamed: [],
      });

      const hasChanges = await autoGit.checkForChanges();

      expect(hasChanges).toBe(true);
    });

    it('should handle status errors', async () => {
      const error = new Error('Status error');
      mockGitManager.getStatus.mockRejectedValue(error);

      await expect(autoGit.checkForChanges()).rejects.toThrow('Status error');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to check for changes');
    });
  });

  describe('stageChanges', () => {
    it('should stage all changes', async () => {
      mockGitManager.stageAll.mockResolvedValue();

      await autoGit.stageChanges();

      expect(mockGitManager.stageAll).toHaveBeenCalledWith();
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Changes staged');
    });

    it('should handle staging errors', async () => {
      const error = new Error('Stage error');
      mockGitManager.stageAll.mockRejectedValue(error);

      await expect(autoGit.stageChanges()).rejects.toThrow('Stage error');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to stage changes');
    });
  });

  describe('generateCommitMessage', () => {
    beforeEach(() => {
      mockGitManager.getStagedDiff.mockResolvedValue('test diff');
    });

    it('should generate commit message successfully', async () => {
      mockAiCommit.generateMessages.mockResolvedValue(['feat: add test']);

      const message = await autoGit.generateCommitMessage({});

      expect(message).toBe('feat: add test');
      expect(mockSpinner.succeed).toHaveBeenCalledWith('AI commit message generated');
    });

    it('should handle no staged diff', async () => {
      mockGitManager.getStagedDiff.mockResolvedValue('');

      await expect(autoGit.generateCommitMessage()).rejects.toThrow('No staged changes available');
      expect(mockSpinner.fail).toHaveBeenCalledWith('No staged changes available');
    });

    it('should handle generation errors', async () => {
      const error = new Error('Generation error');
      mockAiCommit.generateMessages.mockRejectedValue(error);

      await expect(autoGit.generateCommitMessage()).rejects.toThrow('Generation error');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to generate commit message');
    });

    it('should refuse marker-laden diffs when cleanup fails (no fall-through)', async () => {
      mockGitManager.getStagedDiff.mockResolvedValue(
        '+<<<<<<< HEAD\n+ours line\n+=======\n+theirs line\n+>>>>>>> side\n'
      );
      mockAiCommit.conflictResolver.detectAndCleanupConflictMarkers.mockResolvedValue({
        cleaned: false,
      });

      await expect(autoGit.generateCommitMessage()).rejects.toThrow(/merge-conflict markers/);

      expect(mockAiCommit.generateMessages).not.toHaveBeenCalled();
    });

    it('should pass options to AI generator', async () => {
      const options = { provider: 'ollama' };
      mockAiCommit.generateMessages.mockResolvedValue(['test message']);

      await autoGit.generateCommitMessage(options);

      expect(mockAiCommit.generateMessages).toHaveBeenCalledWith('test diff', {
        context: {},
        count: 1,
        conventional: true,
        language: 'en',
        preferredProvider: 'groq',
        enterpriseMode: false,
      });
    });
  });

  describe('commitChanges', () => {
    it('should commit successfully', async () => {
      mockGitManager.commit.mockResolvedValue();

      await autoGit.commitChanges('test message');

      expect(mockGitManager.commit).toHaveBeenCalledWith('test message');
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Committed: test message');
    });

    it('should handle commit errors', async () => {
      const error = new Error('Commit error');
      mockGitManager.commit.mockRejectedValue(error);

      await expect(autoGit.commitChanges('test message')).rejects.toThrow('Commit error');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to commit changes');
    });
  });

  describe('pullAndHandleConflicts (rebase-first)', () => {
    beforeEach(() => {
      mockGitManager.pull.mockResolvedValue({ files: [] });
      mockGitManager.getStatus.mockResolvedValue({ conflicted: [] });
    });

    it('should pull with rebase by default', async () => {
      await autoGit.pullAndHandleConflicts();

      expect(mockGitManager.pull).toHaveBeenCalledWith({ rebase: true });
    });

    it('should pull successfully with no conflicts', async () => {
      mockGitManager.pull.mockResolvedValue({ files: [] });

      await autoGit.pullAndHandleConflicts();

      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        'Synced with upstream via rebase, no conflicts'
      );
    });

    it('should handle already up to date', async () => {
      mockGitManager.pull.mockResolvedValue(null);

      await autoGit.pullAndHandleConflicts();

      expect(mockSpinner.succeed).toHaveBeenCalledWith('Already up to date');
    });

    it('should succeed cleanly when rebase applies upstream commits', async () => {
      mockGitManager.pull.mockResolvedValue({ files: ['a.js'] });

      await autoGit.pullAndHandleConflicts();

      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        'Synced with upstream via rebase, no conflicts'
      );
    });

    it('should handle rebase conflicts with AI resolution + continue (no commit)', async () => {
      mockGitManager.pull.mockRejectedValue(new Error('could not apply'));
      mockGitManager.getStatus.mockResolvedValue({ conflicted: ['test.js'] });

      autoGit.resolveConflictsWithAI = jest.fn().mockResolvedValue();
      inquirer.prompt.mockResolvedValueOnce({ resolutionStrategy: 'ai' });

      await autoGit.pullAndHandleConflicts();

      expect(autoGit.syncOperation).toBe('rebase');
      expect(autoGit.resolveConflictsWithAI).toHaveBeenCalledWith(['test.js']);
      expect(mockGitManager.stageAll).toHaveBeenCalled();
      expect(mockGitManager.rebaseContinue).toHaveBeenCalled();
      expect(mockGitManager.commit).not.toHaveBeenCalled();
    });

    it('should map keep-mine to theirs under rebase (sides swap)', async () => {
      mockGitManager.pull.mockRejectedValue(new Error('could not apply'));
      mockGitManager.getStatus.mockResolvedValue({ conflicted: ['test.js'] });

      inquirer.prompt.mockResolvedValueOnce({ resolutionStrategy: 'keep-mine' });

      await autoGit.pullAndHandleConflicts();

      // Rebase: local work is "theirs", so keeping mine checks out theirs.
      expect(mockGitManager.checkoutSide).toHaveBeenCalledWith('test.js', 'theirs');
      expect(mockGitManager.rebaseContinue).toHaveBeenCalled();
    });

    it('should map keep-incoming to ours under rebase', async () => {
      mockGitManager.pull.mockRejectedValue(new Error('could not apply'));
      mockGitManager.getStatus.mockResolvedValue({ conflicted: ['test.js'] });

      inquirer.prompt.mockResolvedValueOnce({ resolutionStrategy: 'keep-incoming' });

      await autoGit.pullAndHandleConflicts();

      expect(mockGitManager.checkoutSide).toHaveBeenCalledWith('test.js', 'ours');
    });

    it('should fall back to merge when requested', async () => {
      mockGitManager.pull.mockRejectedValueOnce(new Error('could not apply'));
      mockGitManager.pull.mockResolvedValueOnce({ files: [] });
      mockGitManager.getStatus
        .mockResolvedValueOnce({ conflicted: ['test.js'] })
        .mockResolvedValue({ conflicted: [] });

      inquirer.prompt.mockResolvedValueOnce({ resolutionStrategy: 'merge-fallback' });

      await autoGit.pullAndHandleConflicts();

      expect(mockGitManager.rebaseAbort).toHaveBeenCalled();
      expect(mockGitManager.pull).toHaveBeenLastCalledWith();
      expect(autoGit.syncOperation).toBe('merge');
    });

    it('should abort the rebase on abort without touching the branch', async () => {
      mockGitManager.pull.mockRejectedValue(new Error('could not apply'));
      mockGitManager.getStatus.mockResolvedValue({ conflicted: ['test.js'] });

      inquirer.prompt.mockResolvedValueOnce({ resolutionStrategy: 'abort' });

      await expect(autoGit.pullAndHandleConflicts()).rejects.toThrow('Rebase aborted');

      expect(mockGitManager.rebaseAbort).toHaveBeenCalled();
      expect(mockGitManager.rebaseContinue).not.toHaveBeenCalled();
    });

    it('should handle conflicts with manual resolution', async () => {
      mockGitManager.pull.mockRejectedValue(new Error('could not apply'));
      mockGitManager.getStatus.mockResolvedValue({ conflicted: ['test.js'] });

      inquirer.prompt.mockResolvedValueOnce({ resolutionStrategy: 'manual' });

      await expect(autoGit.pullAndHandleConflicts()).rejects.toThrow(
        'Manual conflict resolution required'
      );
    });

    it('should handle non-conflict pull errors', async () => {
      const error = new Error('Network error');
      mockGitManager.pull.mockRejectedValue(error);
      mockGitManager.getStatus.mockResolvedValue({ conflicted: [] });

      inquirer.prompt.mockResolvedValue({ skipPull: true });

      await autoGit.pullAndHandleConflicts();

      expect(inquirer.prompt).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'skipPull',
          message: 'Skip pull and continue with push?',
          default: false,
        },
      ]);
    });
  });

  describe('pullAndMerge (explicit fallback)', () => {
    it('should merge-pull and commit side resolutions', async () => {
      mockGitManager.pull.mockResolvedValue({ files: ['test.js'] });
      mockGitManager.getStatus.mockResolvedValue({ conflicted: ['test.js'] });

      inquirer.prompt.mockResolvedValueOnce({ resolutionStrategy: 'keep-mine' });

      autoGit.syncOperation = null;
      await autoGit.pullAndMerge();

      // Merge: local work is "ours".
      expect(mockGitManager.pull).toHaveBeenCalledWith();
      expect(mockGitManager.checkoutSide).toHaveBeenCalledWith('test.js', 'ours');
      expect(mockGitManager.stageAll).toHaveBeenCalled();
      expect(mockGitManager.commit).toHaveBeenCalled();
    });

    it('should abort the merge on abort', async () => {
      mockGitManager.pull.mockResolvedValue({ files: ['test.js'] });
      mockGitManager.getStatus.mockResolvedValue({ conflicted: ['test.js'] });

      inquirer.prompt.mockResolvedValueOnce({ resolutionStrategy: 'abort' });

      autoGit.syncOperation = null;
      await expect(autoGit.pullAndMerge()).rejects.toThrow('Merge aborted');

      expect(mockGitManager.mergeAbort).toHaveBeenCalled();
    });

    it('should reach the strategy menu when the conflicting merge pull fails', async () => {
      mockGitManager.pull.mockRejectedValue(
        new Error('Automatic merge failed; fix conflicts and then commit the result.')
      );
      mockGitManager.getStatus.mockResolvedValue({ conflicted: ['b.js'] });
      mockGitManager.commit.mockResolvedValue();

      inquirer.prompt.mockResolvedValueOnce({ resolutionStrategy: 'keep-mine' });

      // Simulate the real call path: rebase flow opted out into merge fallback.
      autoGit.syncOperation = 'rebase';
      await autoGit.pullAndMerge();

      // Merge: keep-mine = ours. The failure must not strand the repo mid-merge.
      expect(mockGitManager.mergeAbort).not.toHaveBeenCalled();
      expect(mockGitManager.checkoutSide).toHaveBeenCalledWith('b.js', 'ours');
      expect(mockGitManager.commit).toHaveBeenCalledWith(
        'AI-resolved merge conflicts with intelligent merging'
      );
    });

    it('should rethrow the pull error when the failed merge has no conflicts', async () => {
      mockGitManager.pull.mockRejectedValue(new Error('Network error'));
      mockGitManager.getStatus.mockResolvedValue({ conflicted: [] });

      autoGit.syncOperation = null;
      await expect(autoGit.pullAndMerge()).rejects.toThrow('Network error');

      expect(inquirer.prompt).not.toHaveBeenCalled();
    });
  });

  describe('handleRebaseConflicts (multi-round loop)', () => {
    it('loops to the next round when rebaseContinue surfaces new conflicts', async () => {
      autoGit.syncOperation = 'rebase';
      mockGitManager.getStatus.mockResolvedValue({ conflicted: ['a.js'] });
      mockGitManager.rebaseContinue
        .mockRejectedValueOnce(
          new Error(
            'Failed to continue rebase: could not apply abc123... Resolve all conflicts manually, mark them as resolved (git add), and run git rebase --continue.'
          )
        )
        .mockResolvedValueOnce();
      autoGit.resolveConflictsWithAI = jest.fn().mockResolvedValue();

      inquirer.prompt
        .mockResolvedValueOnce({ resolutionStrategy: 'ai' })
        .mockResolvedValueOnce({ resolutionStrategy: 'keep-mine' });

      await autoGit.handleRebaseConflicts(['a.js']);

      // Round 1's failure quoted git's "resolve manually" hint — the loop
      // must not treat that as a user abort; it continues to round 2.
      expect(mockGitManager.rebaseContinue).toHaveBeenCalledTimes(2);
      // Rebase swaps keep-mine → theirs.
      expect(mockGitManager.checkoutSide).toHaveBeenCalledWith('a.js', 'theirs');
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Rebase completed with no conflicts');
    });

    it('rethrows immediately when the AI flow reports a user abort (no loop)', async () => {
      autoGit.syncOperation = 'rebase';
      mockGitManager.getStatus.mockResolvedValue({ conflicted: ['a.js'] });

      const abortError = AutoGit.userAbort(
        'AI resolution discarded. Your branch is unchanged.'
      );
      autoGit.resolveConflictsWithAI = jest.fn().mockRejectedValue(abortError);

      inquirer.prompt.mockResolvedValueOnce({ resolutionStrategy: 'ai' });

      await expect(autoGit.handleRebaseConflicts(['a.js'])).rejects.toBe(abortError);

      expect(mockGitManager.rebaseContinue).not.toHaveBeenCalled();
    });
  });

  describe('sideForIntent', () => {
    it('should map intents to merge sides', () => {
      autoGit.syncOperation = 'merge';

      expect(autoGit.sideForIntent('keep-mine')).toBe('ours');
      expect(autoGit.sideForIntent('keep-incoming')).toBe('theirs');
    });

    it('should swap sides under rebase', () => {
      autoGit.syncOperation = 'rebase';

      expect(autoGit.sideForIntent('keep-mine')).toBe('theirs');
      expect(autoGit.sideForIntent('keep-incoming')).toBe('ours');
    });
  });

  describe('resolveConflictsWithAI (review-gated)', () => {
    beforeEach(() => {
      autoGit.resolveFileConflictsWithAI = jest.fn().mockResolvedValue();
      autoGit.syncOperation = 'merge';
      mockGitManager.stageAll.mockResolvedValue();
      mockGitManager.commit.mockResolvedValue();
      mockGitManager.getWorkingDiff.mockResolvedValue('+resolved line');
      // Ensure spinner is available for this method
      autoGit.spinner = mockSpinner;
      inquirer.prompt.mockResolvedValue({ decision: 'accept' });
    });

    it('should resolve all conflicts and stop at the review gate (no commit here)', async () => {
      const conflictedFiles = ['file1.js', 'file2.js'];

      await autoGit.resolveConflictsWithAI(conflictedFiles);

      expect(autoGit.resolveFileConflictsWithAI).toHaveBeenCalledTimes(2);
      expect(autoGit.resolveFileConflictsWithAI).toHaveBeenCalledWith('file1.js');
      expect(autoGit.resolveFileConflictsWithAI).toHaveBeenCalledWith('file2.js');
      // Review gate asked, staging done, commit left to the caller.
      expect(inquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'decision' }),
        ])
      );
      expect(mockGitManager.stageAll).toHaveBeenCalled();
      expect(mockGitManager.commit).not.toHaveBeenCalled();
      expect(mockAiCommit.activityLogger.logConflictResolution).toHaveBeenCalledWith(
        conflictedFiles,
        'ai',
        true,
        expect.any(Object)
      );
    });

    it('should abort the sync when the review is rejected with abort', async () => {
      inquirer.prompt.mockResolvedValue({ decision: 'abort' });

      await expect(autoGit.resolveConflictsWithAI(['file1.js'])).rejects.toThrow(
        'AI resolution discarded'
      );

      expect(mockGitManager.mergeAbort).toHaveBeenCalled();
      expect(mockGitManager.stageAll).not.toHaveBeenCalled();
    });

    it('should handle AI resolution failures with intent-based fallback', async () => {
      const conflictedFiles = ['file1.js'];
      const error = new Error('AI resolution failed');
      autoGit.resolveFileConflictsWithAI.mockRejectedValue(error);

      inquirer.prompt.mockResolvedValueOnce({ fallback: 'keep-mine' });
      inquirer.prompt.mockResolvedValueOnce({ decision: 'accept' });
      mockGitManager.checkoutSide.mockResolvedValue();

      autoGit.syncOperation = 'merge';
      await autoGit.resolveConflictsWithAI(conflictedFiles);

      expect(mockGitManager.checkoutSide).toHaveBeenCalledWith('file1.js', 'ours');
    });

    it('should cancel when fallback is cancelled', async () => {
      const conflictedFiles = ['file1.js'];
      const error = new Error('AI resolution failed');
      autoGit.resolveFileConflictsWithAI.mockRejectedValue(error);

      inquirer.prompt.mockResolvedValue({ fallback: 'cancel' });

      await expect(autoGit.resolveConflictsWithAI(conflictedFiles)).rejects.toThrow(
        'Operation cancelled due to resolution failure'
      );
    });
  });

  describe('resolveFileConflictsWithAI (operation-aware sides)', () => {
    const fs = require('fs-extra');

    beforeEach(() => {
      mockGitManager.getRepositoryRoot.mockResolvedValue('/repo/root');
      mockGitManager.showIndexSide.mockImplementation((filePath, side) => {
        if (side === 'ours') return Promise.resolve('stage2-content');
        if (side === 'theirs') return Promise.resolve('stage3-content');
      });
      fs.readFile.mockResolvedValue('conflicted content');
      fs.writeFile.mockResolvedValue();
      mockAiCommit.conflictResolver.resolveConflictWithAI.mockResolvedValue('resolved content');
    });

    it('should pass local=:2, incoming=:3 for merges', async () => {
      autoGit.syncOperation = 'merge';

      await autoGit.resolveFileConflictsWithAI('test.js');

      expect(mockGitManager.showIndexSide).toHaveBeenCalledWith('test.js', 'ours');
      expect(mockGitManager.showIndexSide).toHaveBeenCalledWith('test.js', 'theirs');
      expect(mockAiCommit.conflictResolver.resolveConflictWithAI).toHaveBeenCalledWith({
        filePath: 'test.js',
        currentVersion: 'stage2-content',
        incomingVersion: 'stage3-content',
        language: 'javascript',
      });
      expect(fs.writeFile).toHaveBeenCalledWith('/repo/root/test.js', 'resolved content', 'utf8');
    });

    it('should swap inputs under rebase so current is still local', async () => {
      autoGit.syncOperation = 'rebase';

      await autoGit.resolveFileConflictsWithAI('test.js');

      expect(mockAiCommit.conflictResolver.resolveConflictWithAI).toHaveBeenCalledWith(
        expect.objectContaining({
          currentVersion: 'stage3-content',
          incomingVersion: 'stage2-content',
        })
      );
    });
    it('should pass php language hint for php files', async () => {
      await autoGit.resolveFileConflictsWithAI('theme/functions.php');

      expect(mockAiCommit.conflictResolver.resolveConflictWithAI).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'php' })
      );
    });

    it('should handle resolution errors', async () => {
      const error = new Error('Resolution failed');
      mockAiCommit.conflictResolver.resolveConflictWithAI.mockRejectedValue(error);

      await expect(autoGit.resolveFileConflictsWithAI('test.js')).rejects.toThrow(
        'Failed to resolve conflicts in test.js: Resolution failed'
      );
    });
  });

  describe('pushChanges', () => {
    it('should push successfully', async () => {
      mockGitManager.push.mockResolvedValue();

      await autoGit.pushChanges();

      expect(mockGitManager.push).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Pushed to origin/main');
    });

    it('should handle push errors', async () => {
      const error = new Error('Push error');
      mockGitManager.push.mockRejectedValue(error);

      await expect(autoGit.pushChanges()).rejects.toThrow('Push error');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to push changes');
    });
  });
});
