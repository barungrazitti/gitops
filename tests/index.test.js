/**
 * Unit tests for AICommitGenerator main class
 */

const path = require('path');
const fs = require('fs-extra');

// Mock dependencies before requiring the module
jest.mock('simple-git');
jest.mock('fs-extra');
jest.mock('inquirer');
jest.mock('ora');
jest.mock('chalk', () => ({
  blue: jest.fn((text) => text),
  green: jest.fn((text) => text),
  red: jest.fn((text) => text),
  yellow: jest.fn((text) => text),
  cyan: jest.fn((text) => text),
  dim: jest.fn((text) => text),
}));

const simpleGit = require('simple-git');
const inquirer = require('inquirer');
const ora = require('ora');
const AICommitGenerator = require('../src/index');

describe('AICommitGenerator', () => {
  let generator;
  let mockSpinner;
  let mockGit;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock spinner
    mockSpinner = {
      start: jest.fn().mockReturnThis(),
      text: '',
      succeed: jest.fn(),
      fail: jest.fn(),
    };
    ora.mockReturnValue(mockSpinner);

    // Setup mock git
    mockGit = {
      diff: jest.fn(),
      commit: jest.fn(),
      checkIsRepo: jest.fn().mockResolvedValue(true),
      status: jest.fn().mockResolvedValue({
        staged: [],
        modified: [],
        not_added: [],
        deleted: [],
        created: [],
      }),
      add: jest.fn().mockResolvedValue(),
      pull: jest.fn().mockResolvedValue({ files: [] }),
      push: jest.fn().mockResolvedValue(),
    };
    simpleGit.mockReturnValue(mockGit);

    // Setup mock config
    fs.pathExists = jest.fn().mockResolvedValue(true);
    fs.readFile = jest.fn().mockResolvedValue('');

    generator = new AICommitGenerator();
  });

  describe('constructor', () => {
    it('should initialize all managers', () => {
      expect(generator.gitManager).toBeDefined();
      expect(generator.configManager).toBeDefined();
      expect(generator.cacheManager).toBeDefined();
      expect(generator.analysisEngine).toBeDefined();
      expect(generator.messageFormatter).toBeDefined();
      expect(generator.statsManager).toBeDefined();
      expect(generator.hookManager).toBeDefined();
      expect(generator.activityLogger).toBeDefined();
    });
  });

  describe('generate', () => {
    const mockDiff = 'diff --git a/test.js b/test.js\n+ const x = 1;';
    const mockMessages = ['feat: add new feature', 'fix: resolve issue'];

    beforeEach(() => {
      generator.gitManager.validateRepository = jest.fn().mockResolvedValue(true);
      generator.gitManager.getStagedDiff = jest.fn().mockResolvedValue(mockDiff);
      generator.cacheManager.getValidated = jest.fn().mockResolvedValue(null);
      generator.cacheManager.setValidated = jest.fn().mockResolvedValue();
      generator.analysisEngine.analyzeRepository = jest.fn().mockResolvedValue({ files: {} });
      generator.messageFormatter.format = jest.fn((msg) => msg);
      generator.configManager.load = jest.fn().mockResolvedValue({
        defaultProvider: 'groq',
        conventionalCommits: true,
      });
      generator.selectMessage = jest.fn().mockResolvedValue(mockMessages[0]);
      generator.gitManager.commit = jest.fn().mockResolvedValue({});
    });

    it('should handle no staged changes', async () => {
      generator.gitManager.getStagedDiff.mockResolvedValue('');

      await generator.generate();

      expect(mockSpinner.fail).toHaveBeenCalledWith(expect.stringContaining('No staged changes'));
    });

    it('should use cached messages when available', async () => {
      generator.cacheManager.getValidated = jest.fn().mockResolvedValue(mockMessages);

      await generator.generate();

      expect(generator.cacheManager.getValidated).toHaveBeenCalledWith(mockDiff);
      expect(generator.gitManager.commit).toHaveBeenCalledWith(mockMessages[0]);
    });

    it('should handle errors during generation', async () => {
      const testError = new Error('Test generation error');
      generator.gitManager.getStagedDiff.mockRejectedValue(testError);
      generator.activityLogger.logDetailedError = jest.fn().mockResolvedValue();
      generator.provideErrorSuggestions = jest.fn();

      await expect(generator.generate()).rejects.toThrow('Test generation error');
      expect(mockSpinner.fail).toHaveBeenCalled();
    });
  });

  describe('config', () => {
    beforeEach(() => {
      generator.configManager.load = jest.fn().mockResolvedValue({
        defaultProvider: 'groq',
        conventionalCommits: true,
      });
    });

    it('should set configuration value', async () => {
      generator.configManager.set = jest.fn().mockResolvedValue();

      await generator.config({ set: 'key=value' });

      expect(generator.configManager.set).toHaveBeenCalledWith('key', 'value');
    });

    it('should get configuration value', async () => {
      generator.configManager.get = jest.fn().mockResolvedValue('test-value');

      await generator.config({ get: 'key' });

      expect(generator.configManager.get).toHaveBeenCalledWith('key');
    });

    it('should list configuration', async () => {
      await generator.config({ list: true });

      expect(generator.configManager.load).toHaveBeenCalled();
    });

    it('should reset configuration', async () => {
      generator.configManager.reset = jest.fn().mockResolvedValue();

      await generator.config({ reset: true });

      expect(generator.configManager.reset).toHaveBeenCalled();
    });
  });

  describe('hook', () => {
    it('should install git hook', async () => {
      generator.hookManager.install = jest.fn().mockResolvedValue();

      await generator.hook({ install: true });

      expect(generator.hookManager.install).toHaveBeenCalled();
    });

    it('should uninstall git hook', async () => {
      generator.hookManager.uninstall = jest.fn().mockResolvedValue();

      await generator.hook({ uninstall: true });

      expect(generator.hookManager.uninstall).toHaveBeenCalled();
    });
  });

  describe('chunkDiff', () => {
    it('should handle small diffs without chunking', () => {
      const smallDiff = 'diff --git a/test.js b/test.js\n+ small change';
      const result = generator.chunkDiff(smallDiff, 10000);

      expect(result).toEqual([smallDiff]);
    });

    it('should handle very large diffs', () => {
      const largeDiff = 'diff --git a/file1.js b/file1.js\n' + 'line 1\n'.repeat(2000);
      const result = generator.chunkDiff(largeDiff, 6000);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle single very large lines', () => {
      const largeLine = 'a'.repeat(10000);
      const diff = `diff --git a/test.js b/test.js\n+${largeLine}`;
      const result = generator.chunkDiff(diff, 2000);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('selectBestMessages', () => {
    it('should select best messages from array', () => {
      const messages = [
        'feat: add new feature',
        'fix: resolve bug',
        'chore: update dependencies',
        'update functionality', // generic - should be ranked lower
      ];

      const result = generator.selectBestMessages(messages, 3);

      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should handle empty input', () => {
      const result = generator.selectBestMessages([]);
      expect(result).toEqual([]);
    });

    it('should handle null input', () => {
      const result = generator.selectBestMessages(null);
      expect(result).toEqual([]);
    });
  });

  describe('scoreCommitMessage', () => {
    it('should score conventional commit format higher', () => {
      const conventional = 'feat: add new feature';
      const nonConventional = 'add new feature';

      const conventionalScore = generator.scoreCommitMessage(conventional);
      const nonConventionalScore = generator.scoreCommitMessage(nonConventional);

      expect(conventionalScore).toBeGreaterThan(nonConventionalScore);
    });

    it('should penalize generic messages', () => {
      const generic = 'update functionality';
      const specific = 'feat: add UserAuthentication class';

      const genericScore = generator.scoreCommitMessage(generic);
      const specificScore = generator.scoreCommitMessage(specific);

      expect(specificScore).toBeGreaterThan(genericScore);
    });

    it('should return low score for very short messages', () => {
      const short = 'ab';

      const score = generator.scoreCommitMessage(short);

      expect(score).toBeLessThan(0);
    });
  });

  describe('manageDiffForAI', () => {
    it('should use full strategy for small diffs', () => {
      const smallDiff = 'diff --git a/test.js b/test.js\n+ small change';
      const result = generator.manageDiffForAI(smallDiff);

      expect(result.strategy).toBe('full');
    });

    it('should truncate very large diffs', () => {
      const largeDiff = 'diff --git a/test.js b/test.js\n' + 'a'.repeat(500000);
      const result = generator.manageDiffForAI(largeDiff);

      expect(result.strategy).toBe('smart-truncated');
      expect(result.data.length).toBeLessThan(largeDiff.length);
      expect(result.info.truncated).toBe(true);
      expect(result.info.preservedFiles).toBeDefined();
      expect(result.info.reasoning).toBeDefined();
    });

    it('should preserve new files with higher priority', () => {
      const newFileDiff = `diff --git a/new-feature/new-file.js b/new-feature/new-file.js
new file mode 100644
--- /dev/null
+++ b/new-feature/new-file.js
@@ -0,0 +1,500 @@
+console.log('new file');
+${Array(500).fill(0).map((_, i) => `+const x${i} = ${i};`).join('\n')}
diff --git a/old-file.js b/old-file.js
--- a/old-file.js
+++ b/old-file.js
@@ -1,3 +1,503 @@
 const x = 1;
+const added = 'change';
+${Array(500).fill(0).map((_, i) => `+const y${i} = ${i};`).join('\n')}
 const y = 2;`;
      const result = generator.manageDiffForAI(newFileDiff);
      expect(result.info.strategy).toBe('smart-truncated');
      expect(result.info.preservedFiles).toContain('new-feature/new-file.js');
    });

    it('should filter out node_modules files', () => {
      const diffWithNodeModules = `diff --git a/src/main.js b/src/main.js
--- a/src/main.js
+++ b/src/main.js
@@ -1,2 +1,1000 @@
 console.log('hello');
+${Array(1000).fill(0).map((_, i) => `+const x${i} = ${i};`).join('\n')}
diff --git a/node_modules/some-lib/index.js b/node_modules/some-lib/index.js
--- a/node_modules/some-lib/index.js
+++ b/node_modules/some-lib/index.js
@@ -1,2 +1,3 @@
 module.exports = {};
+const x = 1;`;
      const result = generator.manageDiffForAI(diffWithNodeModules);
      expect(result.info.strategy).toBe('smart-truncated');
      expect(result.info.preservedFiles).toContain('src/main.js');
      expect(result.info.preservedFiles).not.toContain('node_modules/some-lib/index.js');
      expect(result.data).not.toContain('node_modules');
    });

    it('should use semantic context for prioritization', () => {
      const multiFileDiff = `diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -1 +1 @@
-{"version": "1.0.0"}
+{"version": "1.1.0"}
diff --git a/src/main.js b/src/main.js
--- a/src/main.js
+++ b/src/main.js
@@ -1,3 +1,4 @@
+import newFeature from './new-feature';
 function main() {
   console.log('hello');
 }
diff --git a/src/utils.js b/src/utils.js
--- a/src/utils.js
+++ b/src/utils.js
@@ -1,2 +1,3 @@
 export const util1 = () => {};
+export const util2 = () => {};`;
      const semanticContext = {
        files: {
          semantic: {
            'src/main.js': { significance: 'high', functions: ['main'] },
            'src/utils.js': { significance: 'low', functions: [] }
          }
        }
      };
      const result = generator.manageDiffForAI(multiFileDiff, { context: semanticContext });
      expect(result.data).toContain('src/main.js');
    });

    it('should filter out node_modules files', () => {
      const diffWithNodeModules = `diff --git a/src/main.js b/src/main.js
--- a/src/main.js
+++ b/src/main.js
@@ -1,2 +1,1000 @@
 console.log('hello');
+${Array(1000).fill(0).map((_, i) => `+const x${i} = ${i};`).join('\n')}
diff --git a/node_modules/some-lib/index.js b/node_modules/some-lib/index.js
--- a/node_modules/some-lib/index.js
+++ b/node_modules/some-lib/index.js
@@ -1,2 +1,3 @@
 module.exports = {};
+const x = 1;`;
      const result = generator.manageDiffForAI(diffWithNodeModules);
      expect(result.info.strategy).toBe('smart-truncated');
      expect(result.info.preservedFiles).toContain('src/main.js');
      expect(result.info.preservedFiles).not.toContain('node_modules/some-lib/index.js');
      expect(result.data).not.toContain('node_modules');
    });
  });

  describe('cleanConflictMarkers', () => {
    it('should clean conflict markers keeping current version', () => {
      const content = `<<<<<<<
old line
=======
new line
>>>>>>> branch`;

      const result = generator.cleanConflictMarkers(content);

      expect(result).not.toContain('<<<<<<< ');
      expect(result).not.toContain('=======');
      expect(result).not.toContain('>>>>>>> ');
    });

    it('should handle content without conflicts', () => {
      const content = 'normal content\nline 2\nline 3';
      const result = generator.cleanConflictMarkers(content);

      expect(result).toBe('normal content\nline 2\nline 3');
    });
  });

  describe('parseConflictBlocks', () => {
    it('should parse conflict blocks from content', () => {
      const content = `<<<<<<<
const a = 1;
=======
const a = 2;
>>>>>>> branch`;

      const result = generator.parseConflictBlocks(content);

      expect(result.length).toBe(1);
      expect(result[0].currentVersion).toBe('const a = 1;');
      expect(result[0].incomingVersion).toBe('const a = 2;');
    });

    it('should handle multiple conflicts', () => {
      const content = `<<<<<<<
first conflict
=======
first incoming
>>>>>>> branch

some content

<<<<<<<
second conflict
=======
second incoming
>>>>>>> branch`;

      const result = generator.parseConflictBlocks(content);

      expect(result.length).toBe(2);
    });
  });
});
