const EfficientPromptBuilder = require('../src/utils/efficient-prompt-builder');

describe('EfficientPromptBuilder relevance hints', () => {
  let builder;

  beforeEach(() => {
    builder = new EfficientPromptBuilder();
  });

  const wordpressCacheDiff = `diff --git a/wp-content/themes/seoinux-child/inc/su-rest-functions.php b/wp-content/themes/seoinux-child/inc/su-rest-functions.php
index acd6a14108..e1765113af 100644
--- a/wp-content/themes/seoinux-child/inc/su-rest-functions.php
+++ b/wp-content/themes/seoinux-child/inc/su-rest-functions.php
@@ -139,6 +139,26 @@ class My_Rest_Server extends WP_REST_Controller
+    private function su_get_cached_excluded_ids(
+        string $cache_key,
+        array $args
+    ): array {
+        $last_changed = function_exists("wp_cache_get_last_changed")
+            ? wp_cache_get_last_changed("posts")
+            : "";
+        $versioned_cache_key = $cache_key . "_" . md5($last_changed);
+        $cached_ids = get_transient($versioned_cache_key);
+        if (is_array($cached_ids)) {
+            return array_map("absint", $cached_ids);
+        }
+
+        $ids = get_posts($args);
+        $ids = is_array($ids) ? array_map("absint", $ids) : [];
+        set_transient($versioned_cache_key, $ids, HOUR_IN_SECONDS);
+
+        return $ids;
+    }
@@ -315,26 +335,32 @@ class My_Rest_Server extends WP_REST_Controller
-            $excluded_page_ids = get_posts([
+            $excluded_page_ids = $this->su_get_cached_excluded_ids(
+                "su_website_excluded_page_ids",
+                [
+                    "post_type" => "page",
+                    "post_status" => "publish",
+                    "posts_per_page" => -1,
+                    "fields" => "ids",
+                    "meta_key" => "_wp_page_template",
+                    "meta_value" => $excluded_templates,
+                    "meta_compare" => "IN",
+                    "no_found_rows" => true,
+                ],
+            );
@@ -1157,7 +1183,12 @@ class My_Rest_Server extends WP_REST_Controller
-            if (!empty($extracted_shortcodes) && function_exists("error_log")) {
+            if (
+                defined("WP_DEBUG") &&
+                WP_DEBUG &&
+                !empty($extracted_shortcodes) &&
+                function_exists("error_log")
+            ) {`;

  it('omits conflicting file-path type hints from prompts', () => {
    const prompt = builder.buildPrompt(wordpressCacheDiff, {
      conventional: true,
      count: 1,
      context: {
        project: { primary: 'wordpress' },
        files: {
          type: 'style',
          semantic: {
            functions: ['register_routes', 'hook_rest_server'],
            wordpress_hooks: ['rest_api_init'],
          },
        },
        recentCommits: ['style(theme): enqueue global UI fixes styles for improved responsive design'],
      },
    });

    expect(prompt).toContain('Focus: what was optimized');
    expect(prompt).toContain('Examples: perf(database): optimize query with index');
    expect(prompt).toContain('perf(api): cache REST query results');
    expect(prompt).not.toContain('Detected type hint: style');
    expect(prompt).not.toContain('Focus: what is being tested');
    expect(prompt).not.toContain('test(auth): add unit tests');
    expect(prompt).not.toContain('new: register_routes');
    expect(prompt).toContain('symbols: register_routes');
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
      'Focus: what new capability this adds',
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
      'Focus: what was broken and how it was resolved',
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
      'Focus: what new capability this adds',
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
      'Focus: CSS, layout, or formatting changes without new behavior',
    ],
    [
      'documentation',
      `diff --git a/docs/setup.md b/docs/setup.md
--- a/docs/setup.md
+++ b/docs/setup.md
@@ -1,2 +1,5 @@
+## Enterprise mode
+Run 'aic --enterprise-mode' to block commits with sensitive data.`,
      'Focus: what documentation was added or updated',
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
      'Focus: what is being tested and coverage improvements',
    ],
    [
      'dependency update',
      `diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -4,7 +4,7 @@
-    "groq-sdk": "^0.7.0"
+    "groq-sdk": "^0.8.0"`,
      'Focus: dependency, package, or build configuration changes',
    ],
    [
      'configuration',
      `diff --git a/config/app.yaml b/config/app.yaml
--- a/config/app.yaml
+++ b/config/app.yaml
@@ -1,2 +1,3 @@
+enterpriseMode: true`,
      'Focus: primary purpose and key changes',
    ],
  ])('builds %s prompts with relevant focus', (_name, diff, focusText) => {
    const prompt = builder.buildPrompt(diff, {
      conventional: true,
      count: 1,
      context: {
        project: { primary: 'nodejs' },
        files: {},
      },
    });

    expect(prompt).toContain(focusText);
  });

  it('reuses pre-computed diff analysis from options', () => {
    const perfAnalysis = {
      type: 'perf',
      confidence: 0.9,
      keywords: ['cache'],
    };

    const prompt = builder.buildPrompt('diff --git a/f.js b/f.js\n+cache layer', {
      conventional: true,
      count: 1,
      diffAnalysis: perfAnalysis,
      context: { files: {} },
    });

    expect(prompt).toContain('Focus: what was optimized');
  });

  it('uses style examples for CSS changes instead of generic config examples', () => {
    const cssDiff = `diff --git a/assets/styles/buttons.css b/assets/styles/buttons.css
--- a/assets/styles/buttons.css
+++ b/assets/styles/buttons.css
@@ -1,3 +1,6 @@
+.button {
+  margin-block: 1rem;
+}`;

    const prompt = builder.buildPrompt(cssDiff, {
      conventional: true,
      count: 1,
      context: { files: {} },
    });

    expect(prompt).toContain('Examples: style(ui): adjust responsive button spacing');
    expect(prompt).not.toContain('chore(config): update environment variables');
  });
});
