/**
 * Asset Filter Tests - Test that assets are filtered and summarized correctly
 */

const BaseProvider = require('../src/providers/base-provider');

describe('Asset Filtering in Diff Processing', () => {
  let provider;

  beforeEach(() => {
    provider = new BaseProvider();
  });

  describe('Asset Detection', () => {
    test('should detect and summarize image files', () => {
      const diff = `diff --git a/assets/icon.svg b/assets/icon.svg
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/assets/icon.svg
@@ -0,0 +1,50 @@
+<svg width="28" height="28">
+<path d="M21.28 2.60C18.60 0.42..."/>
+<!-- 50 more lines of SVG content -->
+</svg>
diff --git a/src/index.js b/src/index.js
index 1234567..abcdefg 100644
--- a/src/index.js
+++ b/src/index.js
@@ -1,5 +1,6 @@
+function init() {
+  console.log('hello');
+}`;

      const processed = provider.preprocessDiff(diff);
      
      expect(processed).toContain('# ASSETS SUMMARY: 1 image(s) added');
      expect(processed).toContain('# Asset file added: assets/icon.svg');
      expect(processed).not.toContain('<svg width="28" height="28">');
      expect(processed).toContain('function init()');
    });

    test('should detect multiple asset types', () => {
      const diff = `diff --git a/assets/icon.svg b/assets/icon.svg
new file mode 100644
--- /dev/null
+++ b/assets/icon.svg
@@ -0,0 +1,10 @@
+<svg>content</svg>
diff --git a/fonts/Roboto.woff2 b/fonts/Roboto.woff2
new file mode 100644
Binary files /dev/null and b/fonts/Roboto.woff2 differ
diff --git a/images/logo.png b/images/logo.png
new file mode 100644
Binary files /dev/null and b/images/logo.png differ`;

      const processed = provider.preprocessDiff(diff);
      
      expect(processed).toContain('# ASSETS SUMMARY:');
      expect(processed).toContain('image(s)');
      expect(processed).toContain('font(s)');
      expect(processed).toContain('# Asset file added: assets/icon.svg');
      expect(processed).toContain('# Asset file added: fonts/Roboto.woff2');
      expect(processed).toContain('# Asset file added: images/logo.png');
    });

    test('should preserve code changes while filtering assets', () => {
      const diff = `diff --git a/assets/icon.svg b/assets/icon.svg
new file mode 100644
--- /dev/null
+++ b/assets/icon.svg
@@ -0,0 +1,10 @@
+<svg>content</svg>
diff --git a/src/utils.js b/src/utils.js
index 1234567..abcdefg 100644
--- a/src/utils.js
+++ b/src/utils.js
@@ -1,5 +1,7 @@
-export function helper() {
+export function helper() {
+  const x = 1;
+  return x;
 }
diff --git a/styles/main.css b/styles/main.css
index 1234567..abcdefg 100644
--- a/styles/main.css
+++ b/styles/main.css
@@ -1,3 +1,4 @@
 .btn {
+  background: red;
 }`;

      const processed = provider.preprocessDiff(diff);
      
      expect(processed).toContain('# ASSETS SUMMARY: 1 image(s) added');
      expect(processed).toContain('export function helper()');
      expect(processed).toContain('background: red');
      expect(processed).not.toContain('<svg>');
    });

    test('should handle mixed asset and code files', () => {
      const diff = `diff --git a/wp-content/themes/theme/img/icon.svg b/wp-content/themes/theme/img/icon.svg
new file mode 100644
--- /dev/null
+++ b/wp-content/themes/theme/img/icon.svg
@@ -0,0 +1,5 @@
+<svg>content</svg>
diff --git a/wp-content/themes/theme/inc/shortcodes.php b/wp-content/themes/theme/inc/shortcodes.php
index 1234567..abcdefg 100644
--- a/wp-content/themes/theme/inc/shortcodes.php
+++ b/wp-content/themes/theme/inc/shortcodes.php
@@ -10,5 +10,7 @@
 function topbar_shortcode($atts) {
+  $output = '<div class="topbar">';
+  $output .= 'Content';
+  return $output;
 }`;

      const processed = provider.preprocessDiff(diff);
      
      expect(processed).toContain('# ASSETS SUMMARY: 1 image(s) added');
      expect(processed).toContain('function topbar_shortcode');
      expect(processed).not.toContain('<svg>');
    });
  });

  describe('Asset Summary Generation', () => {
    test('should group assets by type', () => {
      const assets = [
        'assets/icon1.svg',
        'assets/icon2.png',
        'fonts/Roboto.woff2',
        'media/video.mp4'
      ];

      const summary = provider.generateAssetSummary(assets);
      
      expect(summary).toContain('2 image(s)');
      expect(summary).toContain('1 font(s)');
      expect(summary).toContain('1 media file(s)');
    });

    test('should handle single asset type', () => {
      const assets = [
        'assets/icon1.svg',
        'assets/icon2.png'
      ];

      const summary = provider.generateAssetSummary(assets);
      
      expect(summary).toBe('# ASSETS SUMMARY: 2 image(s) added\n');
    });

    test('should handle unknown asset types', () => {
      const assets = [
        'data/file.zip',
        'docs/report.pdf'
      ];

      const summary = provider.generateAssetSummary(assets);
      
      expect(summary).toContain('2 other asset(s)');
    });
  });

  describe('Token Savings', () => {
    test('should significantly reduce diff size with many assets', () => {
      const diffWithAssets = `
diff --git a/assets/hero.svg b/assets/hero.svg
new file mode 100644
--- /dev/null
+++ b/assets/hero.svg
@@ -0,0 +1,100 @@
+<svg width="1000" height="1000">
+<!-- Imagine 100 lines of SVG content here -->
+<!-- This is a complex icon with many paths -->
+</svg>
diff --git a/assets/background.jpg b/assets/background.jpg
new file mode 100644
Binary files /dev/null and b/assets/background.jpg differ
diff --git a/src/index.js b/src/index.js
index 1234567..abcdefg 100644
--- a/src/index.js
+++ b/src/index.js
@@ -1,3 +1,4 @@
 const x = 1;
+const y = 2;
`;

      const originalSize = diffWithAssets.length;
      const processed = provider.preprocessDiff(diffWithAssets);
      const processedSize = processed.length;

      const savings = ((originalSize - processedSize) / originalSize * 100).toFixed(1);
      
      console.log(`Token savings: ${savings}% (${originalSize} → ${processedSize} chars)`);
      
      expect(processedSize).toBeLessThan(originalSize * 0.5); // At least 50% reduction
      expect(processed).toContain('# ASSETS SUMMARY:');
    });
  });
});
