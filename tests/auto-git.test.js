/**
 * Unit tests for AutoGit class
 */

// Mock all dependencies before requiring
jest.mock('simple-git');
jest.mock('../src/index');
jest.mock('ora');
jest.mock('inquirer');
jest.mock('fs-extra');
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
}));

const AutoGit = require('../src/auto-git');
const AICommitGenerator = require('../src/index');
const simpleGit = require('simple-git');
const ora = require('ora');
const inquirer = require('inquirer');
const path = require('path');
const chalk = require('chalk');

describe('AutoGit', () => {
  let autoGit;
  let mockGit;
  let mockAiCommit;
  let mockSpinner;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock git
    mockGit = {
      raw: jest.fn(),
      checkIsRepo: jest.fn(),
      status: jest.fn(),
      add: jest.fn(),
      diff: jest.fn(),
      pull: jest.fn(),
      commit: jest.fn(),
      push: jest.fn(),
      revparse: jest.fn(),
      show: jest.fn(),
    };
    simpleGit.mockReturnValue(mockGit);

    // Setup mock AI commit generator
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
      generateWithSequentialFallback: jest.fn(),
      resolveConflictWithAI: jest.fn(),
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

    autoGit = new AutoGit();
  });

  describe('constructor', () => {
    it('should initialize with git and AI commit instances', () => {
      expect(simpleGit).toHaveBeenCalled();
      expect(AICommitGenerator).toHaveBeenCalled();
      expect(autoGit.git).toBe(mockGit);
      expect(autoGit.aiCommit).toBe(mockAiCommit);
      expect(autoGit.activityLogger).toBe(mockAiCommit.activityLogger);
    });

    it('should configure git to prefer merge over rebase', () => {
      expect(mockGit.raw).toHaveBeenCalledWith(['config', 'pull.rebase', 'false']);
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
      await autoGit.run({ dryRun: true });

      expect(autoGit.validateRepository).not.toHaveBeenCalled();
      expect(autoGit.stageChanges).not.toHaveBeenCalled();
      expect(autoGit.pushChanges).not.toHaveBeenCalled();
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
      expect(autoGit.commitChanges).toHaveBeenCalledWith('custom message', { manualMessage: 'custom message' });
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

      expect(mockAiCommit.activityLogger.info).toHaveBeenCalledWith('auto_git_started', { options: {} });
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
      mockGit.checkIsRepo.mockResolvedValue(true);

      await autoGit.validateRepository();

      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Git repository validated');
      expect(autoGit.spinner).toBe(null);
    });

    it('should throw error for non-git repository', async () => {
      mockGit.checkIsRepo.mockResolvedValue(false);

      await expect(autoGit.validateRepository()).rejects.toThrow('Not a git repository');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Repository validation failed');
    });

    it('should handle git errors', async () => {
      const error = new Error('Git error');
      mockGit.checkIsRepo.mockRejectedValue(error);

      await expect(autoGit.validateRepository()).rejects.toThrow('Git error');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Repository validation failed');
    });
  });

  describe('checkForChanges', () => {
    it('should detect changes', async () => {
      mockGit.status.mockResolvedValue({
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
      mockGit.status.mockResolvedValue({
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
      mockGit.status.mockResolvedValue({
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
      mockGit.status.mockRejectedValue(error);

      await expect(autoGit.checkForChanges()).rejects.toThrow('Status error');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to check for changes');
    });
  });

  describe('stageChanges', () => {
    it('should stage all changes', async () => {
      mockGit.add.mockResolvedValue();

      await autoGit.stageChanges();

      expect(mockGit.add).toHaveBeenCalledWith('.');
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Changes staged');
    });

    it('should handle staging errors', async () => {
      const error = new Error('Stage error');
      mockGit.add.mockRejectedValue(error);

      await expect(autoGit.stageChanges()).rejects.toThrow('Stage error');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to stage changes');
    });
  });

  describe('generateCommitMessage', () => {
    beforeEach(() => {
      mockGit.diff.mockResolvedValue('test diff');
    });

    it('should generate commit message successfully', async () => {
      mockAiCommit.generateWithSequentialFallback.mockResolvedValue(['feat: add test']);

      const message = await autoGit.generateCommitMessage({});

      expect(message).toBe('feat: add test');
      expect(mockSpinner.succeed).toHaveBeenCalledWith('AI commit message generated');
    });

    it('should handle no staged diff', async () => {
      mockGit.diff.mockResolvedValue('');

      await expect(autoGit.generateCommitMessage()).rejects.toThrow('No staged changes available');
      expect(mockSpinner.fail).toHaveBeenCalledWith('No staged changes found for commit message generation');
    });

    it('should handle generation errors', async () => {
      const error = new Error('Generation error');
      mockAiCommit.generateWithSequentialFallback.mockRejectedValue(error);

      await expect(autoGit.generateCommitMessage()).rejects.toThrow('Generation error');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to generate AI commit message');
    });

    it('should pass options to AI generator', async () => {
      const options = { provider: 'ollama' };
      mockAiCommit.generateWithSequentialFallback.mockResolvedValue(['test message']);

      await autoGit.generateCommitMessage(options);

      expect(mockAiCommit.generateWithSequentialFallback).toHaveBeenCalledWith('test diff', {
        context: {},
        count: 1,
        conventional: true,
        provider: 'ollama',
      });
    });
  });

  describe('commitChanges', () => {
    it('should commit successfully', async () => {
      mockGit.commit.mockResolvedValue();

      await autoGit.commitChanges('test message');

      expect(mockGit.commit).toHaveBeenCalledWith('test message');
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Committed: test message');
    });

    it('should handle commit errors', async () => {
      const error = new Error('Commit error');
      mockGit.commit.mockRejectedValue(error);

      await expect(autoGit.commitChanges('test message')).rejects.toThrow('Commit error');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to commit changes');
    });
  });

  describe('pullAndHandleConflicts', () => {
    beforeEach(() => {
      mockGit.pull.mockResolvedValue({ files: [] });
    });

    it('should pull successfully with no conflicts', async () => {
      mockGit.pull.mockResolvedValue({ files: [] });

      await autoGit.pullAndHandleConflicts();

      expect(mockSpinner.succeed).toHaveBeenCalledWith('Already up to date');
    });

    it('should handle already up to date', async () => {
      mockGit.pull.mockResolvedValue(null);

      await autoGit.pullAndHandleConflicts();

      expect(mockSpinner.succeed).toHaveBeenCalledWith('Already up to date');
    });

    it('should handle conflicts with AI resolution', async () => {
      mockGit.pull.mockResolvedValue({ files: ['test.js'] });
      mockGit.status.mockResolvedValue({
        conflicted: ['test.js'],
      });
      
      autoGit.resolveConflictsWithAI = jest.fn().mockResolvedValue();
      inquirer.prompt.mockResolvedValue({ resolutionStrategy: 'ai' });

      await autoGit.pullAndHandleConflicts();

      expect(autoGit.resolveConflictsWithAI).toHaveBeenCalledWith(['test.js']);
    });

    it('should handle conflicts with manual resolution', async () => {
      mockGit.pull.mockResolvedValue({ files: ['test.js'] });
      mockGit.status.mockResolvedValue({
        conflicted: ['test.js'],
      });
      
      inquirer.prompt.mockResolvedValue({ resolutionStrategy: 'manual' });

      await expect(autoGit.pullAndHandleConflicts()).rejects.toThrow('Manual conflict resolution required');
    });

    it('should handle conflicts by keeping current changes', async () => {
      mockGit.pull.mockResolvedValue({ files: ['test.js'] });
      mockGit.status.mockResolvedValue({
        conflicted: ['test.js'],
      });
      
      inquirer.prompt.mockResolvedValue({ resolutionStrategy: 'ours' });
      mockGit.add.mockResolvedValue();
      mockGit.commit.mockResolvedValue();

      await autoGit.pullAndHandleConflicts();

      expect(mockGit.raw).toHaveBeenCalledWith(['checkout', '--ours', '--', 'test.js']);
      expect(mockGit.add).toHaveBeenCalledWith('.');
      expect(mockGit.commit).toHaveBeenCalled();
    });

    it('should handle conflicts by using incoming changes', async () => {
      mockGit.pull.mockResolvedValue({ files: ['test.js'] });
      mockGit.status.mockResolvedValue({
        conflicted: ['test.js'],
      });
      
      inquirer.prompt.mockResolvedValue({ resolutionStrategy: 'theirs' });
      mockGit.add.mockResolvedValue();
      mockGit.commit.mockResolvedValue();

      await autoGit.pullAndHandleConflicts();

      expect(mockGit.raw).toHaveBeenCalledWith(['checkout', '--theirs', '--', 'test.js']);
      expect(mockGit.add).toHaveBeenCalledWith('.');
      expect(mockGit.commit).toHaveBeenCalled();
    });

    it('should cancel operation when user chooses', async () => {
      mockGit.pull.mockResolvedValue({ files: ['test.js'] });
      mockGit.status.mockResolvedValue({
        conflicted: ['test.js'],
      });
      
      inquirer.prompt.mockResolvedValue({ resolutionStrategy: 'cancel' });

      await expect(autoGit.pullAndHandleConflicts()).rejects.toThrow('Pull cancelled due to conflicts');
    });

    it('should handle non-conflict pull errors', async () => {
      const error = new Error('Network error');
      mockGit.pull.mockRejectedValue(error);
      
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

  describe('resolveConflictsWithAI', () => {
    beforeEach(() => {
      autoGit.resolveFileConflictsWithAI = jest.fn().mockResolvedValue();
      mockGit.add.mockResolvedValue();
      mockGit.commit.mockResolvedValue();
      // Ensure spinner is available for this method
      autoGit.spinner = mockSpinner;
    });

    it('should resolve all conflicts successfully', async () => {
      const conflictedFiles = ['file1.js', 'file2.js'];

      await autoGit.resolveConflictsWithAI(conflictedFiles);

      expect(autoGit.resolveFileConflictsWithAI).toHaveBeenCalledTimes(2);
      expect(autoGit.resolveFileConflictsWithAI).toHaveBeenCalledWith('file1.js');
      expect(autoGit.resolveFileConflictsWithAI).toHaveBeenCalledWith('file2.js');
      expect(mockGit.commit).toHaveBeenCalledWith('AI-resolved merge conflicts with intelligent merging');
      expect(mockAiCommit.activityLogger.logConflictResolution).toHaveBeenCalledWith(
        conflictedFiles,
        'ai',
        true,
        expect.any(Object)
      );
    });

    it('should handle AI resolution failures with fallback', async () => {
      const conflictedFiles = ['file1.js'];
      const error = new Error('AI resolution failed');
      autoGit.resolveFileConflictsWithAI.mockRejectedValue(error);
      
      inquirer.prompt.mockResolvedValue({ fallback: 'ours' });
      mockGit.raw.mockResolvedValue();

      await autoGit.resolveConflictsWithAI(conflictedFiles);

      expect(mockGit.raw).toHaveBeenCalledWith(['checkout', '--ours', '--', 'file1.js']);
    });

    it('should cancel when fallback is cancelled', async () => {
      const conflictedFiles = ['file1.js'];
      const error = new Error('AI resolution failed');
      autoGit.resolveFileConflictsWithAI.mockRejectedValue(error);
      
      inquirer.prompt.mockResolvedValue({ fallback: 'cancel' });

      await expect(autoGit.resolveConflictsWithAI(conflictedFiles)).rejects.toThrow('Operation cancelled due to resolution failure');
    });
  });

  describe('resolveFileConflictsWithAI', () => {
    const fs = require('fs-extra');
    const path = require('path');

    beforeEach(() => {
      mockGit.revparse.mockResolvedValue('/repo/root');
      mockGit.show.mockImplementation(args => {
        if (args[0] === 'HEAD:test.js') return Promise.resolve('original');
        if (args[0] === '--theirs') return Promise.resolve('current');
        if (args[0] === '--ours') return Promise.resolve('incoming');
      });
      fs.readFile.mockResolvedValue('conflicted content');
      fs.writeFile.mockResolvedValue();
      mockAiCommit.resolveConflictWithAI.mockResolvedValue('resolved content');
    });

    it('should resolve conflicts successfully', async () => {
      await autoGit.resolveFileConflictsWithAI('test.js');

      expect(mockGit.show).toHaveBeenCalledWith(['HEAD:test.js']);
      expect(mockGit.show).toHaveBeenCalledWith(['--theirs', ':test.js']);
      expect(mockGit.show).toHaveBeenCalledWith(['--ours', ':test.js']);
      expect(fs.readFile).toHaveBeenCalledWith('/repo/root/test.js', 'utf8');
      expect(mockAiCommit.resolveConflictWithAI).toHaveBeenCalledWith({
        filePath: 'test.js',
        originalContent: 'original',
        currentChanges: 'current',
        incomingChanges: 'incoming',
        conflictedContent: 'conflicted content',
        timestamp: expect.any(Number),
      });
      expect(fs.writeFile).toHaveBeenCalledWith('/repo/root/test.js', 'resolved content', 'utf8');
    });

    it('should handle resolution errors', async () => {
      const error = new Error('Resolution failed');
      mockAiCommit.resolveConflictWithAI.mockRejectedValue(error);

      await expect(autoGit.resolveFileConflictsWithAI('test.js')).rejects.toThrow('Failed to resolve conflicts in test.js: Resolution failed');
    });
  });

  describe('pushChanges', () => {
    it('should push successfully', async () => {
      mockGit.push.mockResolvedValue();

      await autoGit.pushChanges();

      expect(mockGit.push).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Changes pushed to remote');
    });

    it('should handle push errors', async () => {
      const error = new Error('Push error');
      mockGit.push.mockRejectedValue(error);

      await expect(autoGit.pushChanges()).rejects.toThrow('Push error');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to push changes');
    });
  });
});