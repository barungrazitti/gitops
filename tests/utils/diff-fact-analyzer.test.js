const DiffFactAnalyzer = require('../../src/utils/diff-fact-analyzer');

describe('DiffFactAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new DiffFactAnalyzer();
  });

  describe('analyze()', () => {
    it('should return empty result for null/undefined input', () => {
      const result = analyzer.analyze(null);
      expect(result.stats.totalAdditions).toBe(0);
      expect(result.stats.totalDeletions).toBe(0);
      expect(result.fileChanges).toEqual([]);
    });

    it('should return empty result for empty string', () => {
      const result = analyzer.analyze('');
      expect(result.stats.totalAdditions).toBe(0);
      expect(result.stats.filesChanged).toBe(0);
    });

    it('should parse file additions and deletions correctly', () => {
      const diff = `diff --git a/src/index.js b/src/index.js
index abc1234..def5678 100644
--- a/src/index.js
+++ b/src/index.js
@@ -10,6 +10,8 @@ function oldFunc() {
+const newVar = 'hello';
+function newFunc() {
+  return newVar;
+}
-const oldVar = 'world';
-function removedFunc() {
-  return oldVar;
-}`;

      const result = analyzer.analyze(diff);
      expect(result.stats.totalAdditions).toBe(4);
      expect(result.stats.totalDeletions).toBe(4);
      expect(result.stats.filesChanged).toBe(1);
      expect(result.stats.filesModified).toBe(1);
      expect(result.stats.netChange).toBe(0);
    });

    it('should detect deletion-only changes', () => {
      const diff = `diff --git a/src/app.js b/src/app.js
--- a/src/app.js
+++ b/src/app.js
@@ -5,8 +5,3 @@ function run() {
-  console.log('debug here');
-  console.log('another debug');
-  console.log('yet another');
-  console.warn('warning');
-  console.error('error msg');`;

      const result = analyzer.analyze(diff);
      expect(result.patterns.isDeletionOnly).toBe(true);
      expect(result.patterns.isAdditionOnly).toBe(false);
      expect(result.stats.totalDeletions).toBe(5);
      expect(result.stats.totalAdditions).toBe(0);
    });

    it('should detect console.log removal operation', () => {
      const diff = `diff --git a/src/app.js b/src/app.js
--- a/src/app.js
+++ b/src/app.js
@@ -5,8 +5,3 @@ function run() {
-  console.log('debug');
-  console.warn('warning');
+  const x = 1;`;

      const result = analyzer.analyze(diff);
      const consoleOp = result.patterns.detectedOperations.find(op => op.type === 'remove-console-logs');
      expect(consoleOp).toBeDefined();
      expect(consoleOp.description).toContain('removed console');
    });

    it('should detect new file additions', () => {
      const diff = `diff --git a/src/new-module.js b/src/new-module.js
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/new-module.js
@@ -0,0 +1,10 @@
+class NewModule {
+  constructor() {}
+  run() {}
+}`;

      const result = analyzer.analyze(diff);
      expect(result.stats.filesAdded).toBe(1);
      expect(result.stats.totalAdditions).toBe(4);
      expect(result.patterns.isNewFile).toBe(true);
    });

    it('should detect file deletion', () => {
      const diff = `diff --git a/src/old.js b/src/old.js
deleted file mode 100644
index abc1234..0000000
--- a/src/old.js
+++ /dev/null
@@ -1,5 +0,0 @@
-class Old {
-  method() {}
-}`;

      const result = analyzer.analyze(diff);
      expect(result.stats.filesDeleted).toBe(1);
      expect(result.patterns.isFileDeletion).toBe(true);
    });

    it('should detect docs-only changes', () => {
      const diff = `diff --git a/README.md b/README.md
--- a/README.md
+++ b/README.md
@@ -1,3 +1,5 @@
+# Updated title
+
 This is a project.
+More docs here.`;

      const result = analyzer.analyze(diff);
      expect(result.patterns.isDocsOnly).toBe(true);
    });

    it('should detect config-only changes', () => {
      const diff = `diff --git a/.gitignore b/.gitignore
--- a/.gitignore
+++ b/.gitignore
@@ -1,2 +1,3 @@
 node_modules/
+.aic-logs/
+dist/`;

      const result = analyzer.analyze(diff);
      expect(result.patterns.isConfigOnly).toBe(true);
    });

    it('should detect test-only changes', () => {
      const diff = `diff --git a/tests/app.test.js b/tests/app.test.js
--- a/tests/app.test.js
+++ b/tests/app.test.js
@@ -1,3 +1,5 @@
 describe('App', () => {
+  it('should work', () => {
+    expect(true).toBe(true);
+  });
 });`;

      const result = analyzer.analyze(diff);
      expect(result.patterns.isTestOnly).toBe(true);
    });

    it('should detect mostly-removals pattern', () => {
      const diff = `diff --git a/src/big.js b/src/big.js
--- a/src/big.js
+++ b/src/big.js
@@ -1,20 +1,3 @@
-  console.log('line 1');
-  console.log('line 2');
-  console.log('line 3');
-  console.log('line 4');
-  console.log('line 5');
-  console.log('line 6');
-  console.log('line 7');
-  console.log('line 8');
-  console.log('line 9');
-  console.log('line 10');
+const x = 1;`;

      const result = analyzer.analyze(diff);
      expect(result.patterns.isMostlyRemovals).toBe(true);
    });

    it('should handle multiple files', () => {
      const diff = `diff --git a/src/a.js b/src/a.js
--- a/src/a.js
+++ b/src/a.js
@@ -1,2 +1,3 @@
-const old = 1;
+const new = 2;
+const another = 3;
diff --git a/src/b.js b/src/b.js
--- a/src/b.js
+++ b/src/b.js
@@ -1,2 +1,2 @@
-const x = 1;
+const y = 2;`;

      const result = analyzer.analyze(diff);
      expect(result.stats.filesChanged).toBe(2);
      expect(result.stats.totalAdditions).toBe(3);
      expect(result.stats.totalDeletions).toBe(2);
    });

    it('should detect new function/class additions', () => {
      const diff = `diff --git a/src/module.js b/src/module.js
--- a/src/module.js
+++ b/src/module.js
@@ -1,1 +1,4 @@
+class NewClass {
+  method() {}
+}
 module.exports = {};`;

      const result = analyzer.analyze(diff);
      const fnOp = result.patterns.detectedOperations.find(op => op.type === 'add-functions');
      expect(fnOp).toBeDefined();
    });
  });

  describe('recommendType()', () => {
    it('should recommend refactor for console.log-only removals', () => {
      const diff = `diff --git a/src/app.js b/src/app.js
--- a/src/app.js
+++ b/src/app.js
@@ -5,10 +5,3 @@ function run() {
-  console.log('debug');
-  console.warn('warning');
-  console.error('error');`;

      const result = analyzer.analyze(diff);
      expect(result.recommendation.type).toBe('refactor');
      expect(result.recommendation.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should recommend docs for documentation-only changes', () => {
      const diff = `diff --git a/README.md b/README.md
--- a/README.md
+++ b/README.md
@@ -1,1 +1,3 @@
+# Title
+Content here.`;

      const result = analyzer.analyze(diff);
      expect(result.recommendation.type).toBe('docs');
    });

    it('should recommend chore for config-only changes', () => {
      const diff = `diff --git a/.gitignore b/.gitignore
--- a/.gitignore
+++ b/.gitignore
@@ -1,1 +1,2 @@
 node_modules/
+.aic-logs/`;

      const result = analyzer.analyze(diff);
      expect(result.recommendation.type).toBe('chore');
    });

    it('should recommend test for test-only changes', () => {
      const diff = `diff --git a/tests/app.test.js b/tests/app.test.js
--- a/tests/app.test.js
+++ b/tests/app.test.js
@@ -1,1 +1,3 @@
+describe('test', () => {
+  it('works', () => expect(true).toBe(true));
+});`;

      const result = analyzer.analyze(diff);
      expect(result.recommendation.type).toBe('test');
    });

    it('should recommend chore for file deletion', () => {
      const diff = `diff --git a/old.js b/old.js
deleted file mode 100644
--- a/old.js
+++ /dev/null
@@ -1,3 +0,0 @@
-const x = 1;
-const y = 2;`;

      const result = analyzer.analyze(diff);
      expect(result.recommendation.type).toBe('chore');
    });

    it('should recommend feat for new code with functions', () => {
      const diff = `diff --git a/src/new.js b/src/new.js
new file mode 100644
--- /dev/null
+++ b/src/new.js
@@ -0,0 +1,5 @@
+class NewFeature {
+  constructor() {}
+  run() { return true; }
+}`;

      const result = analyzer.analyze(diff);
      expect(result.recommendation.type).toBe('feat');
    });
  });

  describe('buildPromptConstraints()', () => {
    it('should return empty string for null input', () => {
      expect(analyzer.buildPromptConstraints(null)).toBe('');
    });

    it('should include diff stats in constraints', () => {
      const diff = `diff --git a/src/app.js b/src/app.js
--- a/src/app.js
+++ b/src/app.js
@@ -1,3 +1,5 @@
-const old = 1;
+const new = 2;
+const another = 3;
+const more = 4;`;

      const facts = analyzer.analyze(diff);
      const constraints = analyzer.buildPromptConstraints(facts);
      expect(constraints).toContain('DIFF FACTS');
      expect(constraints).toContain('Files changed: 1');
      expect(constraints).toContain('+3 additions');
      expect(constraints).toContain('-1 deletions');
    });

    it('should include CRITICAL constraint for deletion-only diffs', () => {
      const diff = `diff --git a/src/app.js b/src/app.js
--- a/src/app.js
+++ b/src/app.js
@@ -1,5 +1,0 @@
-const x = 1;
-const y = 2;`;

      const facts = analyzer.analyze(diff);
      const constraints = analyzer.buildPromptConstraints(facts);
      expect(constraints).toContain('CRITICAL');
      expect(constraints).toContain('ONLY deletions');
      expect(constraints).toContain('NOT "feat"');
    });

    it('should include config-only constraint', () => {
      const diff = `diff --git a/.gitignore b/.gitignore
--- a/.gitignore
+++ b/.gitignore
@@ -1,1 +1,2 @@
 node_modules/
+.aic-logs/`;

      const facts = analyzer.analyze(diff);
      const constraints = analyzer.buildPromptConstraints(facts);
      expect(constraints).toContain('configuration files');
      expect(constraints).toContain('"chore"');
    });

    it('should include docs-only constraint', () => {
      const diff = `diff --git a/README.md b/README.md
--- a/README.md
+++ b/README.md
@@ -1,1 +1,3 @@
+# Title`;

      const facts = analyzer.analyze(diff);
      const constraints = analyzer.buildPromptConstraints(facts);
      expect(constraints).toContain('documentation');
      expect(constraints).toContain('"docs"');
    });

    it('should include recommended type when confidence is high', () => {
      const diff = `diff --git a/src/app.js b/src/app.js
--- a/src/app.js
+++ b/src/app.js
@@ -1,3 +1,0 @@
-console.log('debug');
-console.warn('warn');`;

      const facts = analyzer.analyze(diff);
      const constraints = analyzer.buildPromptConstraints(facts);
      expect(constraints).toContain('RECOMMENDED type');
    });
  });
});
