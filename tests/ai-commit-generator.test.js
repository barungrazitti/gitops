/**
 * Simple Unit Test for AI Commit Generator Core Functionality
 */

const AICommitGenerator = require('../src/index.js');

describe('AICommitGenerator - Core Functionality', () => {
  let generator;

  beforeEach(() => {
    generator = new AICommitGenerator();
  });

  describe('Constructor', () => {
    test('should initialize without errors', () => {
      expect(generator).toBeInstanceOf(AICommitGenerator);
      expect(generator.gitManager).toBeDefined();
      expect(generator.configManager).toBeDefined();
      expect(generator.cacheManager).toBeDefined();
      expect(generator.analysisEngine).toBeDefined();
      expect(generator.messageFormatter).toBeDefined();
      expect(generator.statsManager).toBeDefined();
      expect(generator.activityLogger).toBeDefined();
    });
  });

  describe('Diff Management', () => {
    test('should use full diff for small changes', () => {
      const smallDiff = 'diff --git a/file.js b/file.js\n+ small change';
      const result = generator.manageDiffForAI(smallDiff);

      expect(result.strategy).toBe('full');
      expect(result.data).toBe(smallDiff);
      expect(result.chunks).toBeNull();
    });

    test('should detect plugin updates and avoid chunking', () => {
      const pluginDiff = 'diff --git a/package.json b/package.json\n+++ b/package.json\n+ "version": "2.0.0"';
      const result = generator.manageDiffForAI(pluginDiff);

      expect(result.strategy).toBe('full');
      expect(result.info.pluginUpdate).toBe(true);
    });

    test('should handle large diffs appropriately', () => {
      // Create a diff much larger than MAX_DIFF_SIZE (15000 chars)
      const largeContent = '+ ' + 'x'.repeat(1000) + '\n';
      const largeDiff = 'diff --git a/large.js b/large.js\n' + largeContent.repeat(30); // ~30K chars
      
      const result = generator.manageDiffForAI(largeDiff);

      // Should handle large diffs without errors
      expect(result).toBeDefined();
      expect(['full', 'chunked']).toContain(result.strategy);
      
      if (result.strategy === 'chunked') {
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.chunks).toBeGreaterThanOrEqual(1);
      } else {
        expect(result.data).toBe(largeDiff);
      }
    });

    test('should extract chunk context correctly', () => {
      const chunkContent = `diff --git a/test.js b/test.js
+++ b/test.js
+ function newFunction() {
+   return 'test';
+ }
+ class NewClass {
+   constructor() {}
+ }`;

      const context = generator.extractChunkContext(chunkContent);

      expect(context.files).toContain('test.js');
      expect(context.functions).toContain('newFunction');
      expect(context.classes).toContain('NewClass');
      expect(context.hasSignificantChanges).toBe(true);
    });
  });

  describe('Message Scoring', () => {
    test('should score conventional commits higher', () => {
      const conventionalMsg = 'feat: add new authentication system';
      const genericMsg = 'update some stuff';

      const conventionalScore = generator.scoreCommitMessage(conventionalMsg);
      const genericScore = generator.scoreCommitMessage(genericMsg);

      expect(conventionalScore).toBeGreaterThan(genericScore);
    });

    test('should penalize generic messages', () => {
      const genericMsg = 'update functionality';
      const specificMsg = 'add user authentication middleware';

      const genericScore = generator.scoreCommitMessage(genericMsg);
      const specificScore = generator.scoreCommitMessage(specificMsg);

      expect(specificScore).toBeGreaterThan(genericScore);
    });

    test('should prefer appropriate message length', () => {
      const goodMsg = 'feat: implement user authentication with JWT tokens';
      const tooShortMsg = 'fix bug';
      const tooLongMsg = 'feat: ' + 'a'.repeat(200);

      const goodScore = generator.scoreCommitMessage(goodMsg);
      const shortScore = generator.scoreCommitMessage(tooShortMsg);
      const longScore = generator.scoreCommitMessage(tooLongMsg);

      expect(goodScore).toBeGreaterThan(shortScore);
      expect(goodScore).toBeGreaterThan(longScore);
    });
  });

  describe('Plugin Update Detection', () => {
    test('should detect package.json updates', () => {
      const packageDiff = 'diff --git a/package.json b/package.json\n+++ b/package.json\n+ "version": "2.0.0"';
      
      expect(generator.detectPluginUpdate(packageDiff)).toBe(true);
    });

    test('should detect WordPress plugin updates', () => {
      const wpDiff = 'diff --git a/wp-content/plugins/my-plugin/plugin.php b/wp-content/plugins/my-plugin/plugin.php\n+++ b/wp-content/plugins/my-plugin/plugin.php\n+ Version: 2.0.0';
      
      expect(generator.detectPluginUpdate(wpDiff)).toBe(true);
    });

    test('should detect composer.json updates', () => {
      const composerDiff = 'diff --git a/composer.json b/composer.json\n+ "require": { "vendor/package": "^2.0" }';
      
      expect(generator.detectPluginUpdate(composerDiff)).toBe(true);
    });

    test('should not detect regular code changes as plugin updates', () => {
      const codeDiff = 'diff --git a/src/app.js b/src/app.js\n+ function newFeature() {}';
      
      expect(generator.detectPluginUpdate(codeDiff)).toBe(false);
    });
  });

  describe('Chunking Logic', () => {
    test('should handle empty diff', () => {
      const result = generator.manageDiffForAI('');
      
      expect(result.strategy).toBe('full');
      expect(result.data).toBe('');
    });

    test('should handle single line diff', () => {
      const singleLineDiff = '+ new line';
      const result = generator.manageDiffForAI(singleLineDiff);
      
      expect(result.strategy).toBe('full');
      expect(result.data).toBe(singleLineDiff);
    });

    test('should preserve context in chunks', () => {
      const diffWithContext = `diff --git a/file.js b/file.js
--- a/file.js
+++ b/file.js
@@ -1,5 +1,5 @@
 function oldFunction() {
-  return 'old';
+  return 'new';
 }
 
 function anotherFunction() {
   return 'stable';
}`;

      const result = generator.manageDiffForAI(diffWithContext);
      
      if (result.strategy === 'chunked') {
        result.data.forEach(chunk => {
          expect(chunk.content).toContain('function');
          expect(chunk.context).toBeDefined();
        });
      }
    });
  });

  describe('Message Selection', () => {
    test('should select best messages from array', () => {
      const messages = [
        'fix: resolve authentication bug',
        'update some stuff',
        'feat: add user login functionality',
        'docs: update readme',
        'refactor: improve code structure'
      ];

      const best = generator.selectBestMessages(messages, 3);
      
      expect(best).toHaveLength(3);
      expect(best[0]).toMatch(/^(feat|fix):/); // Should prefer conventional commits
    });

    test('should handle empty messages array', () => {
      const best = generator.selectBestMessages([], 3);
      
      expect(best).toHaveLength(0);
    });

    test('should remove duplicates', () => {
      const messages = [
        'feat: add feature',
        'feat: add feature',
        'fix: resolve bug',
        'feat: add feature'
      ];

      const best = generator.selectBestMessages(messages, 5);
      
      // Should only contain unique messages
      const uniqueBest = [...new Set(best)];
      expect(best).toEqual(uniqueBest);
      expect(best).toContain('fix: resolve bug');
      expect(best.filter(msg => msg === 'feat: add feature')).toHaveLength(1);
    });
  });
});