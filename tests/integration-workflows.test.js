/**
 * Integration Tests for Main AI Commit Workflow
 */

const AICommitGenerator = require('../src/index.js');
const simpleGit = require('simple-git');
const fs = require('fs-extra');
const path = require('path');

jest.mock('simple-git');
jest.mock('fs-extra');
jest.mock('../src/providers/ai-provider-factory');

describe('AI Commit Generator - Integration Tests', () => {
  let generator;
  let mockGit;
  let mockProvider;
  const testRepoPath = '/test/repo';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock git
    mockGit = {
      checkIsRepo: jest.fn().mockResolvedValue(true),
      status: jest.fn(),
      diff: jest.fn(),
      add: jest.fn(),
      commit: jest.fn(),
      log: jest.fn(),
      revparse: jest.fn(),
      branch: jest.fn(),
      raw: jest.fn()
    };
    simpleGit.mockReturnValue(mockGit);

    // Setup mock provider
    mockProvider = {
      generateCommitMessages: jest.fn(),
      buildPrompt: jest.fn(),
      testConnection: jest.fn().mockResolvedValue(true)
    };
    const { AIProviderFactory } = require('../src/providers/ai-provider-factory');
    AIProviderFactory.create = jest.fn().mockReturnValue(mockProvider);

    // Setup mock filesystem
    fs.pathExists.mockResolvedValue(true);
    fs.readJson.mockResolvedValue({
      defaultProvider: 'ollama',
      conventionalCommits: true,
      language: 'en'
    });
    fs.ensureDir.mockResolvedValue();
    fs.writeJson.mockResolvedValue();

    generator = new AICommitGenerator();
  });

  describe('Complete Workflow - Happy Path', () => {
    test('should complete full commit generation workflow', async () => {
      // Setup test data
      const stagedDiff = `diff --git a/src/app.js b/src/app.js
index 1234567..abcdefg 100644
--- a/src/app.js
+++ b/src/app.js
@@ -1,3 +1,5 @@
 function hello() {
-  console.log('Hello');
+  console.log('Hello, World!');
+  return 'Hello, World!';
 }`;

      const generatedMessages = [
        'feat: enhance hello function to return greeting',
        'fix: improve hello function output',
        'refactor: update hello function implementation'
      ];

      const selectedMessage = 'feat: enhance hello function to return greeting';

      // Mock git operations
      mockGit.diff.mockResolvedValue(stagedDiff);
      mockGit.commit.mockResolvedValue({ commit: 'abc123' });

      // Mock AI provider
      mockProvider.generateCommitMessages.mockResolvedValue(generatedMessages);
      mockProvider.buildPrompt.mockReturnValue('mock prompt');

      // Mock inquirer for message selection
      jest.doMock('inquirer', () => ({
        prompt: jest.fn().mockResolvedValue({ selectedMessage })
      }));

      const { prompt } = require('inquirer');

      // Execute workflow
      await generator.generate();

      // Verify git operations
      expect(mockGit.checkIsRepo).toHaveBeenCalled();
      expect(mockGit.diff).toHaveBeenCalledWith(['--cached']);
      expect(mockGit.commit).toHaveBeenCalledWith(selectedMessage);

      // Verify AI provider usage
      expect(mockProvider.generateCommitMessages).toHaveBeenCalledWith(
        stagedDiff,
        expect.objectContaining({
          count: 3,
          conventional: true,
          language: 'en'
        })
      );

      // Verify user interaction
      expect(prompt).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'list',
          name: 'selectedMessage',
          message: 'Select a commit message:'
        })
      );
    });
  });

  describe('Workflow with Cache Hit', () => {
    test('should use cached messages when available', async () => {
      const stagedDiff = 'diff --git a/file.js b/file.js\n+ new content';
      const cachedMessages = ['feat: add new feature', 'fix: resolve bug'];

      // Mock cache hit
      generator.cacheManager.getValidated = jest.fn().mockResolvedValue(cachedMessages);

      // Mock git operations
      mockGit.diff.mockResolvedValue(stagedDiff);
      mockGit.commit.mockResolvedValue({ commit: 'abc123' });

      // Mock inquirer
      jest.doMock('inquirer', () => ({
        prompt: jest.fn().mockResolvedValue({ selectedMessage: cachedMessages[0] })
      }));

      const { prompt } = require('inquirer');

      // Execute workflow
      await generator.generate();

      // Verify cache was checked
      expect(generator.cacheManager.getValidated).toHaveBeenCalledWith(stagedDiff);

      // Verify AI provider was NOT called (cache hit)
      expect(mockProvider.generateCommitMessages).not.toHaveBeenCalled();

      // Verify commit was made with cached message
      expect(mockGit.commit).toHaveBeenCalledWith(cachedMessages[0]);
    });
  });

  describe('Workflow with No Staged Changes', () => {
    test('should handle no staged changes gracefully', async () => {
      // Mock empty diff
      mockGit.diff.mockResolvedValue('');

      // Execute workflow
      await generator.generate();

      // Verify early exit
      expect(mockProvider.generateCommitMessages).not.toHaveBeenCalled();
      expect(mockGit.commit).not.toHaveBeenCalled();
    });
  });

  describe('Workflow with Dry Run', () => {
    test('should show messages without committing in dry run mode', async () => {
      const stagedDiff = 'diff --git a/file.js b/file.js\n+ new content';
      const generatedMessages = ['feat: add new feature'];

      // Mock git and AI
      mockGit.diff.mockResolvedValue(stagedDiff);
      mockProvider.generateCommitMessages.mockResolvedValue(generatedMessages);
      mockProvider.buildPrompt.mockReturnValue('mock prompt');

      // Execute dry run
      await generator.generate({ dryRun: true });

      // Verify AI was called
      expect(mockProvider.generateCommitMessages).toHaveBeenCalled();

      // Verify no commit was made
      expect(mockGit.commit).not.toHaveBeenCalled();
    });
  });

  describe('Workflow with Custom Options', () => {
    test('should use custom options in workflow', async () => {
      const stagedDiff = 'diff --git a/file.js b/file.js\n+ new content';
      const generatedMessages = ['característica: añadir nueva función'];

      const customOptions = {
        provider: 'groq',
        count: 5,
        language: 'es',
        conventional: false,
        cache: false
      };

      // Mock git and AI
      mockGit.diff.mockResolvedValue(stagedDiff);
      mockProvider.generateCommitMessages.mockResolvedValue(generatedMessages);
      mockProvider.buildPrompt.mockReturnValue('mock prompt');

      // Mock inquirer
      jest.doMock('inquirer', () => ({
        prompt: jest.fn().mockResolvedValue({ selectedMessage: generatedMessages[0] })
      }));

      // Execute with custom options
      await generator.generate(customOptions);

      // Verify custom options were passed to AI
      expect(mockProvider.generateCommitMessages).toHaveBeenCalledWith(
        stagedDiff,
        expect.objectContaining({
          count: 5,
          language: 'es',
          conventional: false
        })
      );

      // Verify cache was disabled
      expect(generator.cacheManager.getValidated).not.toHaveBeenCalled();
    });
  });

  describe('Workflow with AI Provider Failure', () => {
    test('should handle AI provider failure gracefully', async () => {
      const stagedDiff = 'diff --git a/file.js b/file.js\n+ new content';

      // Mock git
      mockGit.diff.mockResolvedValue(stagedDiff);

      // Mock AI provider failure
      mockProvider.generateCommitMessages.mockRejectedValue(new Error('AI service unavailable'));

      // Execute workflow
      await expect(generator.generate()).rejects.toThrow('All AI providers failed to generate commit messages');

      // Verify no commit was made
      expect(mockGit.commit).not.toHaveBeenCalled();
    });
  });

  describe('Workflow with Large Diff Chunking', () => {
    test('should handle large diff with chunking', async () => {
      // Create a large diff (> 15K chars)
      const largeDiff = 'diff --git a/large.js b/large.js\n' + '+ content\n'.repeat(1000);
      const generatedMessages = ['feat: implement large feature'];

      // Mock git
      mockGit.diff.mockResolvedValue(largeDiff);
      mockGit.commit.mockResolvedValue({ commit: 'abc123' });

      // Mock AI provider
      mockProvider.generateCommitMessages.mockResolvedValue(generatedMessages);
      mockProvider.buildPrompt.mockReturnValue('mock prompt');

      // Mock inquirer
      jest.doMock('inquirer', () => ({
        prompt: jest.fn().mockResolvedValue({ selectedMessage: generatedMessages[0] })
      }));

      // Execute workflow
      await generator.generate();

      // Verify AI was called with chunked data
      expect(mockProvider.generateCommitMessages).toHaveBeenCalled();

      // Verify commit was made
      expect(mockGit.commit).toHaveBeenCalledWith(generatedMessages[0]);
    });
  });

  describe('Configuration Management Workflow', () => {
    test('should complete configuration setup workflow', async () => {
      const setupAnswers = {
        provider: 'groq',
        apiKey: 'sk-test-key-123456',
        conventionalCommits: true,
        language: 'es'
      };

      // Mock inquirer for setup
      jest.doMock('inquirer', () => ({
        prompt: jest.fn().mockResolvedValue(setupAnswers)
      }));

      const { prompt } = require('inquirer');

      // Execute setup
      await generator.setup();

      // Verify setup questions were asked
      expect(prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'provider',
            type: 'list',
            message: 'Select your preferred AI provider:'
          }),
          expect.objectContaining({
            name: 'apiKey',
            type: 'password',
            message: 'Enter your API key:'
          }),
          expect.objectContaining({
            name: 'conventionalCommits',
            type: 'confirm',
            message: 'Use conventional commit format?'
          }),
          expect.objectContaining({
            name: 'language',
            type: 'list',
            message: 'Select commit message language:'
          })
        ])
      );

      // Verify configuration was saved
      expect(generator.configManager.setMultiple).toHaveBeenCalledWith({
        defaultProvider: setupAnswers.provider,
        apiKey: setupAnswers.apiKey,
        conventionalCommits: setupAnswers.conventionalCommits,
        language: setupAnswers.language
      });
    });
  });

  describe('Statistics Workflow', () => {
    test('should display usage statistics', async () => {
      const mockStats = {
        totalCommits: 150,
        mostUsedProvider: 'ollama',
        averageResponseTime: 1200,
        cacheHitRate: 75
      };

      // Mock stats manager
      generator.statsManager.getStats = jest.fn().mockResolvedValue(mockStats);

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Execute stats command
      await generator.stats({});

      // Verify stats were retrieved
      expect(generator.statsManager.getStats).toHaveBeenCalled();

      // Verify output was displayed
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Usage Statistics')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total commits: 150')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling Workflow', () => {
    test('should handle repository validation error', async () => {
      // Mock repository validation failure
      mockGit.checkIsRepo.mockRejectedValue(new Error('Not a git repository'));

      // Execute workflow
      await expect(generator.generate()).rejects.toThrow('Not a git repository');

      // Verify no further operations were attempted
      expect(mockGit.diff).not.toHaveBeenCalled();
      expect(mockProvider.generateCommitMessages).not.toHaveBeenCalled();
    });

    test('should handle git operation errors', async () => {
      const stagedDiff = 'diff --git a/file.js b/file.js\n+ new content';

      // Mock git diff success but commit failure
      mockGit.diff.mockResolvedValue(stagedDiff);
      mockGit.commit.mockRejectedValue(new Error('Git commit failed'));

      // Mock AI and inquirer
      mockProvider.generateCommitMessages.mockResolvedValue(['feat: add feature']);
      mockProvider.buildPrompt.mockReturnValue('mock prompt');

      jest.doMock('inquirer', () => ({
        prompt: jest.fn().mockResolvedValue({ selectedMessage: 'feat: add feature' })
      }));

      // Execute workflow
      await expect(generator.generate()).rejects.toThrow('Git commit failed');
    });
  });

  describe('Plugin Update Detection Workflow', () => {
    test('should handle plugin update without chunking', async () => {
      const pluginDiff = `diff --git a/package.json b/package.json
index 1234567..abcdefg 100644
--- a/package.json
+++ b/package.json
@@ -1,6 +1,6 @@
 {
   "name": "test-app",
-  "version": "1.0.0",
+  "version": "2.0.0",
   "dependencies": {
     "express": "^4.18.0"
   }
 }`;

      const generatedMessages = ['chore: update dependencies'];

      // Mock git
      mockGit.diff.mockResolvedValue(pluginDiff);
      mockGit.commit.mockResolvedValue({ commit: 'abc123' });

      // Mock AI
      mockProvider.generateCommitMessages.mockResolvedValue(generatedMessages);
      mockProvider.buildPrompt.mockReturnValue('mock prompt');

      // Mock inquirer
      jest.doMock('inquirer', () => ({
        prompt: jest.fn().mockResolvedValue({ selectedMessage: generatedMessages[0] })
      }));

      // Execute workflow
      await generator.generate();

      // Verify plugin update was detected (no chunking)
      expect(mockProvider.generateCommitMessages).toHaveBeenCalledWith(
        pluginDiff, // Full diff, not chunked
        expect.any(Object)
      );

      // Verify commit was made
      expect(mockGit.commit).toHaveBeenCalledWith(generatedMessages[0]);
    });
  });
});