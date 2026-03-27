/**
 * CommitGenerator tests
 */

// Mock MessageValidator BEFORE any imports (jest hoists this)
jest.mock('../../src/core/message-validator', () => {
  return jest.fn().mockImplementation(() => ({
    validate: jest.fn(() => ({ valid: true, score: 80, issues: [], suggestions: [] })),
    validateBatch: jest.fn((messages) => ({
      validMessages: messages.map(m => ({ message: m, score: 80, issues: [] })),
      invalidMessages: [],
      stats: {
        total: messages.length || 0,
        validCount: messages.length || 0,
        genericCount: 0,
        withReasoning: messages.length || 0,
        qualityRate: 1
      }
    })),
    checkQualityThresholds: jest.fn(() => ({
      qual01Pass: true,
      qual02Pass: true,
      failures: []
    })),
    generateSuggestions: jest.fn(() => [])
  }));
});

const CommitGenerator = require('../../src/core/commit-generator');

describe('CommitGenerator', () => {
  let generator;
  let mocks;

  beforeEach(() => {
    mocks = {
      gitManager: {
        getStagedDiff: jest.fn(),
        commit: jest.fn()
      },
      configManager: {
        load: jest.fn().mockResolvedValue({ defaultProvider: 'groq' }),
        get: jest.fn()
      },
      analysisEngine: {
        analyzeRepository: jest.fn()
      },
      messageFormatter: {
        formatWithContext: jest.fn((msg) => msg)
      },
      providerOrchestrator: {
        generateWithSequentialFallback: jest.fn()
      },
      activityLogger: {
        info: jest.fn(),
        logGitOperation: jest.fn(),
        logDetailedError: jest.fn()
      },
      statsManager: {
        recordCommit: jest.fn()
      },
      ComponentDetector: jest.fn().mockImplementation(() => ({
        detect: jest.fn().mockResolvedValue([])
      })),
      FileTypeDetector: jest.fn().mockImplementation(() => ({
        detectBatch: jest.fn().mockResolvedValue({ files: [], summary: {} })
      })),
      DependencyMapper: jest.fn().mockImplementation(() => ({
        mapDependencies: jest.fn().mockReturnValue({ imports: [], exports: [], affected: [] })
      }))
    };

    generator = new CommitGenerator(mocks);
  });

  describe('extractFilePathsFromDiff', () => {
    it('should extract single file path from diff', () => {
      const diff = `diff --git a/src/utils/helper.js b/src/utils/helper.js
index 1234567..abcdefg 100644
--- a/src/utils/helper.js
+++ b/src/utils/helper.js
@@ -1,3 +1,5 @@
+new line
`;

      const paths = generator.extractFilePathsFromDiff(diff);
      expect(paths).toEqual(['src/utils/helper.js']);
    });

    it('should extract multiple file paths from diff', () => {
      const diff = `diff --git a/src/file1.js b/src/file1.js
diff --git a/test/file2.test.js b/test/file2.test.js
diff --git a/package.json b/package.json`;

      const paths = generator.extractFilePathsFromDiff(diff);
      expect(paths).toEqual(['src/file1.js', 'test/file2.test.js', 'package.json']);
    });

    it('should return empty array for empty diff', () => {
      const paths = generator.extractFilePathsFromDiff('');
      expect(paths).toEqual([]);
    });

    it('should return empty array for diff without file headers', () => {
      const diff = 'some random text without diff headers';
      const paths = generator.extractFilePathsFromDiff(diff);
      expect(paths).toEqual([]);
    });
  });

  describe('buildEnrichedContext', () => {
    it('should build context from detector results', () => {
      const detectorResults = {
        components: [
          { component: 'auth', scope: 'src/auth', boundary: 'directory' },
          { component: 'api', scope: 'src/api', boundary: 'directory' }
        ],
        fileTypes: {
          summary: {
            countByType: { source: 3, test: 1 },
            countByLanguage: { javascript: 3, typescript: 1 }
          },
          files: [{ path: 'src/auth/login.js', type: 'source', language: 'javascript' }]
        },
        dependencies: {
          imports: [{ file: 'src/auth/login.js', module: './utils', type: 'commonjs' }],
          exports: [{ file: 'src/auth/login.js', name: 'login', type: 'named' }],
          affected: ['src/app.js', 'src/routes.js']
        }
      };

      const context = generator.buildEnrichedContext(detectorResults, 'diff');

      expect(context.components.list).toEqual(['auth', 'api']);
      expect(context.components.count).toBe(2);
      expect(context.fileTypes.countByType).toEqual({ source: 3, test: 1 });
      expect(context.fileTypes.countByLanguage).toEqual({ javascript: 3, typescript: 1 });
      expect(context.dependencies.affected).toEqual(['src/app.js', 'src/routes.js']);
      expect(context.hasSemanticContext).toBe(true);
    });

    it('should handle empty detector results', () => {
      const detectorResults = {
        components: [],
        fileTypes: { summary: {} },
        dependencies: { imports: [], exports: [], affected: [] }
      };

      const context = generator.buildEnrichedContext(detectorResults, 'diff');

      expect(context.components.list).toEqual([]);
      expect(context.components.count).toBe(0);
      expect(context.hasSemanticContext).toBe(false);
    });

    it('should handle null detector results gracefully', () => {
      const detectorResults = {
        components: null,
        fileTypes: { summary: null },
        dependencies: null
      };

      const context = generator.buildEnrichedContext(detectorResults, 'diff');

      expect(context.components).toBeDefined();
      expect(context.fileTypes).toBeDefined();
      expect(context.dependencies).toBeDefined();
    });
  });

  describe('buildEnrichedPrompt', () => {
    it('should include diff in prompt', () => {
      const detectorResults = {
        components: [],
        fileTypes: { summary: {} },
        dependencies: { affected: [] }
      };

      const diff = 'diff --git a/src/auth/login.js';
      const prompt = generator.buildEnrichedPrompt(diff, detectorResults);

      expect(prompt).toContain('diff --git a/src/auth/login.js');
    });

    it('should include component context when components detected', () => {
      const detectorResults = {
        components: [
          { component: 'auth', scope: 'src/auth', boundary: 'directory' },
          { component: 'auth', scope: 'src/auth', boundary: 'directory' }
        ],
        fileTypes: { summary: {} },
        dependencies: { affected: [] }
      };

      const diff = 'diff content';
      const prompt = generator.buildEnrichedPrompt(diff, detectorResults);

      expect(prompt).toContain('Changed components: auth');
    });

    it('should include file type context when available', () => {
      const detectorResults = {
        components: [],
        fileTypes: {
          summary: {
            countByType: { source: 3, test: 1 },
            countByLanguage: { javascript: 4 }
          }
        },
        dependencies: { affected: [] }
      };

      const diff = 'diff content';
      const prompt = generator.buildEnrichedPrompt(diff, detectorResults);

      expect(prompt).toContain('File types: 3 source, 1 test');
      expect(prompt).toContain('Languages: 4 javascript');
    });

    it('should include dependency context when files affected', () => {
      const detectorResults = {
        components: [],
        fileTypes: { summary: {} },
        dependencies: {
          affected: ['src/app.js', 'src/routes.js', 'src/index.js']
        }
      };

      const diff = 'diff content';
      const prompt = generator.buildEnrichedPrompt(diff, detectorResults);

      expect(prompt).toContain('Dependencies: 3 files affected by these changes');
    });
  });

  describe('generate()', () => {
    it('should throw error when no staged changes', async () => {
      mocks.gitManager.getStagedDiff.mockResolvedValue('');

      await expect(generator.generate()).rejects.toThrow(
        'No staged changes found'
      );
    });

    it('should throw error when AI provider returns empty messages', async () => {
      mocks.gitManager.getStagedDiff.mockResolvedValue('diff content');
      mocks.providerOrchestrator.generateWithSequentialFallback.mockResolvedValue([]);

      await expect(generator.generate()).rejects.toThrow(
        'AI provider failed to generate commit messages'
      );
    });

    it('should throw error when AI provider returns null messages', async () => {
      mocks.gitManager.getStagedDiff.mockResolvedValue('diff content');
      mocks.providerOrchestrator.generateWithSequentialFallback.mockResolvedValue(null);

      await expect(generator.generate()).rejects.toThrow(
        'AI provider failed to generate commit messages'
      );
    });

    it('should generate and commit messages successfully', async () => {
      const diff = 'diff --git a/src/utils/helper.js';
      const messages = ['feat(utils): add helper function'];
      const formattedMessages = ['feat(utils): add helper function to improve code reuse'];

      mocks.gitManager.getStagedDiff.mockResolvedValue(diff);
      mocks.providerOrchestrator.generateWithSequentialFallback.mockResolvedValue(messages);
      mocks.messageFormatter.formatWithContext.mockReturnValue(formattedMessages[0]);

      const result = await generator.generate();

      expect(result).toEqual(formattedMessages);
      expect(mocks.gitManager.commit).toHaveBeenCalledWith(formattedMessages[0]);
      expect(mocks.statsManager.recordCommit).toHaveBeenCalledWith('groq');
      expect(mocks.activityLogger.info).toHaveBeenCalledWith(
        'commit_completed',
        expect.objectContaining({ selectedMessage: formattedMessages[0] })
      );
    });

    it('should handle dry run mode without committing', async () => {
      const diff = 'diff --git a/src/utils/helper.js';
      const messages = ['feat(utils): add helper function'];
      const formattedMessages = ['feat(utils): add helper function'];

      mocks.gitManager.getStagedDiff.mockResolvedValue(diff);
      mocks.providerOrchestrator.generateWithSequentialFallback.mockResolvedValue(messages);
      mocks.messageFormatter.formatWithContext.mockReturnValue(formattedMessages[0]);

      const result = await generator.generate({ dryRun: true });

      expect(result).toEqual(formattedMessages);
      expect(mocks.gitManager.commit).not.toHaveBeenCalled();
    });

    it('should use custom provider from options', async () => {
      const diff = 'diff content';
      const messages = ['feat: add feature'];

      mocks.gitManager.getStagedDiff.mockResolvedValue(diff);
      mocks.providerOrchestrator.generateWithSequentialFallback.mockResolvedValue(messages);
      mocks.messageFormatter.formatWithContext.mockReturnValue(messages[0]);

      await generator.generate({ provider: 'ollama' });

      expect(mocks.providerOrchestrator.generateWithSequentialFallback).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ preferredProvider: 'ollama' }),
        expect.anything(),
        expect.anything()
      );
    });

    it('should log errors on failure', async () => {
      mocks.gitManager.getStagedDiff.mockRejectedValue(new Error('Git error'));

      try {
        await generator.generate();
      } catch (error) {
        // Expected
      }

      expect(mocks.activityLogger.logDetailedError).toHaveBeenCalled();
    });

    it('should pass context to AI provider', async () => {
      const diff = 'diff content';
      const messages = ['feat: add feature'];

      mocks.gitManager.getStagedDiff.mockResolvedValue(diff);
      mocks.providerOrchestrator.generateWithSequentialFallback.mockResolvedValue(messages);
      mocks.messageFormatter.formatWithContext.mockReturnValue(messages[0]);

      await generator.generate();

      const callArgs = mocks.providerOrchestrator.generateWithSequentialFallback.mock.calls[0];
      expect(callArgs[1]).toHaveProperty('context');
      expect(callArgs[1].context).toHaveProperty('components');
      expect(callArgs[1].context).toHaveProperty('fileTypes');
      expect(callArgs[1].context).toHaveProperty('dependencies');
    });
  });
});
