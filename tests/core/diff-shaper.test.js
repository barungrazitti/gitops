const DiffShaper = require('../../src/core/diff-shaper');

describe('DiffShaper', () => {
  let shaper;

  beforeEach(() => {
    shaper = new DiffShaper();
  });

  describe('analyzeDiffType() — classification without prompt fixtures', () => {
    it('defaults to chore with low confidence for null/empty diffs', () => {
      expect(shaper.analyzeDiffType(null)).toMatchObject({ type: 'chore', confidence: 0.1 });
      expect(shaper.analyzeDiffType('')).toMatchObject({ type: 'chore', confidence: 0.1 });
    });

    it('classifies WordPress cache/transient changes as performance work', () => {
      const diff = `diff --git a/wp-content/themes/child/inc/rest.php b/wp-content/themes/child/inc/rest.php
--- a/wp-content/themes/child/inc/rest.php
+++ b/wp-content/themes/child/inc/rest.php
@@ -1,4 +1,10 @@
+    private function get_cached_ids(
+        string $cache_key
+    ): array {
+        $last_changed = function_exists("wp_cache_get_last_changed")
+            ? wp_cache_get_last_changed("posts")
+            : "";
+        $cached = get_transient($cache_key . "_" . md5($last_changed));
+        set_transient($cache_key, $cached, HOUR_IN_SECONDS);
+    }`;

      const analysis = shaper.analyzeDiffType(diff);

      expect(analysis.type).toBe('perf');
    });

    it('does not classify words like latest as test changes', () => {
      const diff = `diff --git a/src/posts.js b/src/posts.js
--- a/src/posts.js
+++ b/src/posts.js
@@ -1,2 +1,2 @@
-const route = "/posts";
+const route = "/latest-posts";`;

      const analysis = shaper.analyzeDiffType(diff);

      expect(analysis.type).not.toBe('test');
    });

    it.each([
      [
        'PHP feature',
        `diff --git a/src/Providers/UserProvider.php b/src/Providers/UserProvider.php
--- a/src/Providers/UserProvider.php
+++ b/src/Providers/UserProvider.php
@@ -1,3 +1,8 @@
+public function createUserProfile(array $payload): UserProfile
+{
+    return UserProfile::create($payload);
+}`,
        'feat',
      ],
      [
        'PHP security fix',
        `diff --git a/src/Auth/LoginController.php b/src/Auth/LoginController.php
--- a/src/Auth/LoginController.php
+++ b/src/Auth/LoginController.php
@@ -10,7 +10,8 @@
-if ($token === $sessionToken) {
+if (hash_equals($sessionToken, $token)) {
     return true;
 }`,
        'fix',
      ],
      [
        'HTML markup',
        `diff --git a/templates/pricing.html b/templates/pricing.html
--- a/templates/pricing.html
+++ b/templates/pricing.html
@@ -1,3 +1,6 @@
+<section class="pricing-card" aria-labelledby="pricing-title">
+  <h2 id="pricing-title">Plans for every team</h2>
+</section>`,
        'feat',
      ],
      [
        'CSS layout',
        `diff --git a/assets/styles/buttons.css b/assets/styles/buttons.css
--- a/assets/styles/buttons.css
+++ b/assets/styles/buttons.css
@@ -1,3 +1,6 @@
+.button {
+  padding: 0.75rem 1rem;
+  border-radius: 8px;
+}`,
        'style',
      ],
      [
        'documentation',
        `diff --git a/docs/setup.md b/docs/setup.md
--- a/docs/setup.md
+++ b/docs/setup.md
@@ -1,2 +1,5 @@
+## Enterprise mode
+Run 'aic --enterprise-mode' to block commits with sensitive data.`,
        'docs',
      ],
      [
        'test file',
        `diff --git a/tests/login.test.js b/tests/login.test.js
--- a/tests/login.test.js
+++ b/tests/login.test.js
@@ -1,3 +1,7 @@
+test('rejects invalid tokens', () => {
+  expect(validateToken('bad')).toBe(false);
+});`,
        'test',
      ],
      [
        'dependency update',
        `diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -4,7 +4,7 @@
-    "groq-sdk": "^0.7.0"
+    "groq-sdk": "^0.8.0"`,
        'build',
      ],
      [
        'configuration',
        `diff --git a/config/app.yaml b/config/app.yaml
--- a/config/app.yaml
+++ b/config/app.yaml
@@ -1,2 +1,3 @@
+enterpriseMode: true`,
        'chore',
      ],
    ])('classifies %s changes as %s', (_name, diff, expectedType) => {
      const analysis = shaper.analyzeDiffType(diff);

      expect(analysis.type).toBe(expectedType);
    });

    it('detects binary files (headers without +/- changes)', () => {
      const diff = `diff --git a/logo.png b/logo.png
new file mode 100644
index 0000000..1234567
Binary files /dev/null and b/logo.png differ`;

      const analysis = shaper.analyzeDiffType(diff);

      expect(analysis.type).toBe('binary');
      expect(analysis.confidence).toBe(0.9);
      expect(analysis.keywords).toContain('added');
    });

    it('flags binary deletions', () => {
      const diff = `diff --git a/logo.png b/logo.png
deleted file mode 100644
index 1234567..0000000
Binary files a/logo.png and /dev/null differ`;

      const analysis = shaper.analyzeDiffType(diff);

      expect(analysis.type).toBe('binary');
      expect(analysis.keywords).toContain('removed');
    });

    it('returns impact fields alongside the type', () => {
      const diff = `diff --git a/src/auth.js b/src/auth.js
--- a/src/auth.js
+++ b/src/auth.js
@@ -1,2 +1,2 @@
-old token validation
+new password hash check`;

      const analysis = shaper.analyzeDiffType(diff, { files: { fileTypes: { jsx: 0 } } });

      expect(analysis.security).toBe(true);
      expect(typeof analysis.breaking).toBe('boolean');
      expect(typeof analysis.scope).toBe('string');
    });
  });

  describe('limitContextLines()', () => {
    it('keeps headers and change lines, trims trailing context', () => {
      const diff = [
        'diff --git a/f.js b/f.js',
        'index 111..222 100644',
        '--- a/f.js',
        '+++ b/f.js',
        '@@ -1,8 +1,9 @@',
        ' context line 1',
        ' context line 2',
        ' context line 3',
        ' context line 4',
        '-removed line',
        '+added line',
        ' context after 1',
        ' context after 2',
        ' context after 3',
        ' context after 4',
      ].join('\n');

      const limited = shaper.limitContextLines(diff, 3);

      const lines = limited.split('\n');
      expect(lines).toContain('-removed line');
      expect(lines).toContain('+added line');
      expect(lines).toContain(' context after 3');
      expect(lines).not.toContain(' context after 4');
      // Context before the first change is preserved
      expect(lines).toContain(' context line 1');
    });

    it('returns non-string input unchanged', () => {
      expect(shaper.limitContextLines(null)).toBeNull();
      expect(shaper.limitContextLines(undefined)).toBeUndefined();
    });

    it('supports custom limits', () => {
      const diff = ['+change', ' c1', ' c2', ' c3', ' c4'].join('\n');

      const limited = shaper.limitContextLines(diff, 1);
      const lines = limited.split('\n');

      expect(lines).toContain(' c1');
      expect(lines).not.toContain(' c2');
    });
  });

  describe('extractChangedFilePaths()', () => {
    it('extracts b/ paths from diff headers', () => {
      const diff = ['diff --git a/src/a.js b/src/a.js', 'diff --git a/lib/old.js b/lib/new.js'].join('\n');

      expect(shaper.extractChangedFilePaths(diff)).toEqual(['src/a.js', 'lib/new.js']);
    });

    it('returns empty array for invalid input', () => {
      expect(shaper.extractChangedFilePaths(null)).toEqual([]);
    });
  });

  describe('getCompatibleTypeHint()', () => {
    it('only returns hints that agree with the analysis', () => {
      const analysis = { type: 'fix', confidence: 0.8 };

      expect(shaper.getCompatibleTypeHint('fix', analysis)).toBe('fix');
      expect(shaper.getCompatibleTypeHint('style', analysis)).toBeNull();
      expect(shaper.getCompatibleTypeHint(null, analysis)).toBeNull();
    });
  });
});
