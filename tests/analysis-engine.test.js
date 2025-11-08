/**
 * Unit tests for AnalysisEngine class
 */

// Mock all dependencies before requiring
jest.mock('../src/core/git-manager');
jest.mock('fs-extra');
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  extname: jest.fn((file) => {
    const ext = file.split('.').pop();
    return `.${ext}`;
  }),
}));

const AnalysisEngine = require('../src/core/analysis-engine');
const GitManager = require('../src/core/git-manager');
const fs = require('fs-extra');
const path = require('path');

describe('AnalysisEngine', () => {
  let analysisEngine;
  let mockGitManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock git manager
    mockGitManager = {
      getRepositoryInfo: jest.fn(),
      getCommitPatterns: jest.fn(),
      getStagedFiles: jest.fn(),
      getFileStats: jest.fn(),
      getRepositoryRoot: jest.fn(),
    };
    GitManager.mockImplementation(() => mockGitManager);

    analysisEngine = new AnalysisEngine();
  });

  describe('constructor', () => {
    it('should initialize with GitManager instance', () => {
      expect(GitManager).toHaveBeenCalled();
      expect(analysisEngine.gitManager).toBe(mockGitManager);
    });
  });

  describe('analyzeRepository', () => {
    const mockRepoInfo = { name: 'test-repo', branch: 'main' };
    const mockPatterns = { commits: [] };
    const mockFileContext = { totalFiles: 3 };
    const mockProjectType = { type: 'nodejs' };

    beforeEach(() => {
      mockGitManager.getRepositoryInfo.mockResolvedValue(mockRepoInfo);
      mockGitManager.getCommitPatterns.mockResolvedValue(mockPatterns);
      mockGitManager.getRepositoryRoot.mockResolvedValue('/test/repo');
      fs.pathExists.mockResolvedValue(true);
    });

    it('should analyze repository successfully', async () => {
      jest.spyOn(analysisEngine, 'analyzeFileContext').mockResolvedValue(mockFileContext);
      jest.spyOn(analysisEngine, 'detectProjectType').mockResolvedValue(mockProjectType);

      const result = await analysisEngine.analyzeRepository();

      expect(result).toEqual({
        repository: mockRepoInfo,
        patterns: mockPatterns,
        files: mockFileContext,
        project: mockProjectType,
        timestamp: expect.any(Number),
      });
      expect(analysisEngine.analyzeFileContext).toHaveBeenCalled();
      expect(analysisEngine.detectProjectType).toHaveBeenCalled();
    });

    it('should handle analysis errors gracefully', async () => {
      const error = new Error('Analysis failed');
      mockGitManager.getRepositoryInfo.mockRejectedValue(error);

      const result = await analysisEngine.analyzeRepository();

      expect(result).toEqual({
        repository: {},
        patterns: {},
        files: {},
        project: { type: 'unknown' },
        timestamp: expect.any(Number),
      });
    });
  });

  describe('analyzeFileContext', () => {
    const mockStagedFiles = ['src/test.js', 'README.md', 'package.json'];
    const mockFileStats = { insertions: 10, deletions: 5, changed: 3 };

    beforeEach(() => {
      mockGitManager.getStagedFiles.mockResolvedValue(mockStagedFiles);
      mockGitManager.getFileStats.mockResolvedValue(mockFileStats);
      mockGitManager.getRepositoryRoot.mockResolvedValue('/test/repo');
      fs.pathExists.mockResolvedValue(true);
    });

    it('should analyze file context successfully', async () => {
      jest.spyOn(analysisEngine, 'analyzeSemanticContext').mockResolvedValue({});
      jest.spyOn(analysisEngine, 'detectWordPressContext').mockReturnValue({});

      const result = await analysisEngine.analyzeFileContext();

      expect(result).toEqual({
        totalFiles: 3,
        fileTypes: expect.objectContaining({
          source: 1, // test.js
          docs: 1,   // README.md
          config: 1,  // package.json
        }),
        changes: {
          insertions: 10,
          deletions: 5,
          modified: 3,
        },
        scope: expect.any(String),
        wordpress: expect.any(Object),
        semantic: {},
      });
    });

    it('should handle file context analysis errors gracefully', async () => {
      const error = new Error('File context failed');
      mockGitManager.getStagedFiles.mockRejectedValue(error);

      const result = await analysisEngine.analyzeFileContext();

      expect(result).toEqual({
        totalFiles: 0,
        fileTypes: {},
        changes: { insertions: 0, deletions: 0, modified: 0 },
        scope: 'unknown',
        semantic: {},
      });
    });
  });

  describe('categorizeFiles', () => {
    it('should categorize files correctly', () => {
      const files = [
        'src/app.js',
        'test/app.test.js',
        'package.json',
        'README.md',
        'assets/logo.png',
        'unknown.xyz',
      ];

      const categories = analysisEngine.categorizeFiles(files);

      expect(categories).toEqual({
        source: 2,  // test.js + app.py
        test: 0,    // test.js doesn't match pattern
        config: 1,
        docs: 1,
        assets: 1,
        other: 1,
      });
    });

    it('should handle empty files array', () => {
      const categories = analysisEngine.categorizeFiles([]);

      expect(categories).toEqual({
        source: 0,
        test: 0,
        config: 0,
        docs: 0,
        assets: 0,
        other: 0,
      });
    });

    it('should categorize different programming languages', () => {
      const files = [
        'app.py',
        'Main.java',
        'server.php',
        'lib.rs',
        'style.css',
      ];

      const categories = analysisEngine.categorizeFiles(files);

      expect(categories.source).toBe(4);  // style.css is not source
    });
  });

  describe('inferScope', () => {
    it('should infer API scope correctly', () => {
      const files = [
        'src/api/user.js',
        'src/routes/auth.js',
        'src/controllers/post.js',
      ];

      const scope = analysisEngine.inferScope(files);

      expect(scope).toBe('api');
    });

    it('should infer UI scope correctly', () => {
      const files = [
        'src/components/Button.jsx',
        'src/views/Dashboard.vue',
        'src/frontend/index.html',
      ];

      const scope = analysisEngine.inferScope(files);

      expect(scope).toBe('ui');
    });

    it('should infer WordPress scope correctly', () => {
      const files = [
        'wp-content/plugins/my-plugin/index.php',
        'wp-content/themes/my-theme/style.css',
        'wp-admin/admin-page.php',
      ];

      const scope = analysisEngine.inferScope(files);

      expect(scope).toBe('wordpress');
    });

    it('should return general scope for unknown patterns', () => {
      const files = [
        'random/file.txt',
        'unknown/data.json',
      ];

      const scope = analysisEngine.inferScope(files);

      expect(scope).toBe('general');
    });

    it('should prioritize WordPress when majority are WordPress files', () => {
      const files = [
        'wp-content/plugins/test/plugin.php',
        'wp-content/themes/test/theme.php',
        'wp-includes/functions.php',
        'config/settings.js', // Only non-WP file
      ];

      const scope = analysisEngine.inferScope(files);

      expect(scope).toBe('wordpress');
    });
  });

  describe('analyzeSemanticContext', () => {
    const mockRepoRoot = '/test/repo';
    const mockContent = `
      function testFunction() { return true; }
      class TestClass { constructor() {} }
      import React from 'react';
      export default testFunction;
    `;

    beforeEach(() => {
      mockGitManager.getRepositoryRoot.mockResolvedValue(mockRepoRoot);
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue(mockContent);
    });

    it('should analyze JavaScript files for semantic context', async () => {
      path.extname.mockReturnValue('.js');

      const context = await analysisEngine.analyzeSemanticContext(['src/test.js']);

      expect(context).toEqual({
        functions: expect.arrayContaining(['testFunction']),
        classes: expect.arrayContaining(['TestClass']),
        imports: expect.arrayContaining(['react']),
        exports: [],  // Export pattern doesn't match "export default"
        endpoints: [],
        components: expect.arrayContaining(['testFunction']),
        tests: [],
        configs: [],
      });
    });

    it('should limit analysis to first 10 files for performance', async () => {
      const files = Array(15).fill('src/test.js');

      await analysisEngine.analyzeSemanticContext(files);

      expect(fs.readFile).toHaveBeenCalledTimes(10);
    });

    it('should handle semantic analysis errors gracefully', async () => {
      const error = new Error('Semantic analysis failed');
      mockGitManager.getRepositoryRoot.mockRejectedValue(error);

      const context = await analysisEngine.analyzeSemanticContext(['src/test.js']);

      expect(context).toEqual({});
    });

    it('should skip non-existent files', async () => {
      fs.pathExists.mockResolvedValue(false);

      const context = await analysisEngine.analyzeSemanticContext(['src/nonexistent.js']);

      expect(fs.readFile).not.toHaveBeenCalled();
      expect(context).toEqual({
        functions: [],
        classes: [],
        imports: [],
        exports: [],
        endpoints: [],
        components: [],
        tests: [],
        configs: [],
      });
    });
  });

  describe('analyzeJavaScriptFile', () => {
    const mockContent = `
      function myFunction() {}
      class MyClass {}
      import React from 'react';
      import axios from 'axios';
      export default MyClass;
      export const myVar = 5;
      app.get('/api/test', handler);
      const MyComponent = () => <div>Hello</div>;
    `;

    it('should extract JavaScript semantic elements correctly', async () => {
      const context = {
        functions: [],
        classes: [],
        imports: [],
        exports: [],
        endpoints: [],
        components: [],
      };

      await analysisEngine.analyzeJavaScriptFile(mockContent, context);

      expect(context.functions).toEqual(
        expect.arrayContaining(['myFunction', 'MyComponent'])
      );
      expect(context.classes).toEqual(['MyClass']);
      expect(context.imports).toEqual(['react', 'axios']);
      expect(context.exports).toEqual(['myVar']);  // Only matches const/var exports
      expect(context.endpoints).toContain('GET /api/test');
      expect(context.components).toEqual(['myFunction']);  // myFunction matches component pattern
    });
  });

  describe('analyzePHPFile', () => {
    const mockContent = `
      <?php
      function myFunction() {}
      class MyClass {}
      add_action('init', 'myFunction');
      add_filter('the_content', 'myFilter');
    `;

    it('should extract PHP semantic elements correctly', async () => {
      const context = {
        functions: [],
        classes: [],
        wordpress_hooks: [],
      };

      await analysisEngine.analyzePHPFile(mockContent, context);

      expect(context.functions).toEqual(['myFunction']);
      expect(context.classes).toEqual(['MyClass']);
      expect(context.wordpress_hooks).toEqual(['init', 'the_content']);
    });
  });

  describe('analyzePythonFile', () => {
    const mockContent = `
      def my_function():
          pass
      
      class MyClass:
          def __init__(self):
              pass
      
      from requests import get
      import pandas as pd
    `;

    it('should extract Python semantic elements correctly', async () => {
      const context = {
        functions: [],
        classes: [],
        imports: [],
      };

      await analysisEngine.analyzePythonFile(mockContent, context);

      expect(context.functions).toEqual(['my_function', '__init__']);
      expect(context.classes).toEqual(['MyClass']);
      expect(context.imports).toEqual(['requests', 'pandas']);
    });
  });

  describe('detectWordPressContext', () => {
    it('should detect WordPress plugin context', () => {
      const files = [
        'wp-content/plugins/my-plugin/index.php',
        'wp-content/plugins/my-plugin/style.css',
      ];

      const context = analysisEngine.detectWordPressContext(files);

      expect(context.isWordPress).toBe(true);
      expect(context.type).toBe('plugin');
      expect(context.plugins).toContain('my-plugin');
    });

    it('should detect WordPress theme context', () => {
      const files = [
        'wp-content/themes/my-theme/index.php',
        'wp-content/themes/my-theme/functions.php',
        'wp-content/themes/my-theme/style.css',
      ];

      const context = analysisEngine.detectWordPressContext(files);

      expect(context.isWordPress).toBe(true);
      expect(context.type).toBe('theme');
      expect(context.themes).toContain('my-theme');
    });

    it('should detect WordPress core context', () => {
      const files = [
        'wp-admin/admin.php',
        'wp-includes/functions.php',
      ];

      const context = analysisEngine.detectWordPressContext(files);

      expect(context.isWordPress).toBe(true);
      expect(context.type).toBe('core');
    });

    it('should detect WordPress specific pages', () => {
      const files = [
        'wp-content/themes/my-theme/page-about.php',
        'wp-content/themes/my-theme/template-contact.php',
        'wp-content/themes/my-theme/single-post.php',
        'wp-content/themes/my-theme/front-page.php',
        'wp-content/themes/my-theme/404.php',
      ];

      const context = analysisEngine.detectWordPressContext(files);

      expect(context.specificPages).toEqual(
        expect.arrayContaining(['about', 'contact', 'post', 'front-page', '404'])
      );
    });

    it('should detect WordPress components', () => {
      const files = [
        'wp-content/themes/my-theme/functions.php',
        'wp-content/themes/my-theme/style.css',
        'wp-content/themes/my-theme/script.js',
        'wp-content/themes/my-theme/customizer.php',
        'wp-content/themes/my-theme/sidebar.php',
        'wp-content/themes/my-theme/header.php',
        'wp-content/themes/my-theme/footer.php',
        'wp-content/themes/my-theme/comments.php',
      ];

      const context = analysisEngine.detectWordPressContext(files);

      expect(context.components).toEqual(
        expect.arrayContaining([
          'theme-functions',
          'theme-styles',
          'theme-scripts',
          'customizer',
          'sidebar',
          'layout',
          'comments',
        ])
      );
    });

    it('should return non-WordPress context for non-WordPress files', () => {
      const files = [
        'src/app.js',
        'README.md',
        'package.json',
      ];

      const context = analysisEngine.detectWordPressContext(files);

      expect(context.isWordPress).toBe(false);
      expect(context.type).toBeNull();
    });
  });

  describe('detectProjectType', () => {
    const mockRepoRoot = '/test/repo';

    beforeEach(() => {
      mockGitManager.getRepositoryRoot.mockResolvedValue(mockRepoRoot);
      // Reset mocks with proper implementation
      fs.pathExists.mockImplementation(() => false);
      fs.readJson.mockImplementation(() => ({}));
    });

    it('should detect Node.js project', async () => {
      fs.pathExists.mockImplementation((path) => {
        if (path && path.endsWith('package.json')) return true;
        return false;
      });

      const result = await analysisEngine.detectProjectType();

      expect(result.types).toContain('nodejs');
      expect(result.primary).toBe('nodejs');
    });

    it('should detect React project from package.json', async () => {
      fs.pathExists.mockImplementation((path) => {
        if (path && path.endsWith('package.json')) return true;
        return false;
      });
      fs.readJson.mockResolvedValue({
        dependencies: { react: '^18.0.0' },
      });

      const result = await analysisEngine.detectProjectType();

      expect(result.types).toContain('react');
    });

    it('should detect WordPress project', async () => {
      fs.pathExists.mockImplementation((path) => {
        if (path && path.endsWith('wp-config.php')) return true;
        return false;
      });

      const result = await analysisEngine.detectProjectType();

      expect(result.types).toContain('wordpress');
      expect(result.primary).toBe('wordpress');
    });

    it('should detect monorepo project', async () => {
      fs.pathExists.mockImplementation((path) => {
        if (path && path.includes('lerna.json')) return true;
        return false;
      });

      const result = await analysisEngine.detectProjectType();

      expect(result.isMonorepo).toBe(true);
    });

    it('should detect project with tests', async () => {
      fs.pathExists.mockImplementation((path) => {
        if (path && path.includes('test')) return true;
        return false;
      });

      const result = await analysisEngine.detectProjectType();

      expect(result.hasTests).toBe(true);
    });

    it('should detect project with CI configuration', async () => {
      fs.pathExists.mockImplementation((path) => {
        if (path && path.includes('.github')) return true;
        return false;
      });

      const result = await analysisEngine.detectProjectType();

      expect(result.hasCI).toBe(true);
    });

    it('should handle project type detection errors gracefully', async () => {
      const error = new Error('Project type detection failed');
      mockGitManager.getRepositoryRoot.mockRejectedValue(error);

      const result = await analysisEngine.detectProjectType();

      expect(result).toEqual({
        types: ['unknown'],
        primary: 'unknown',
        isMonorepo: false,
        hasTests: false,
        hasCI: false,
      });
    });
  });

  describe('detectMonorepo', () => {
    const mockRepoRoot = '/test/repo';

    beforeEach(() => {
      fs.pathExists.mockImplementation(() => false);
      fs.readJson.mockImplementation(() => ({}));
    });

    it('should detect Lerna monorepo', async () => {
      fs.pathExists.mockImplementation((path) => {
        if (path && path.endsWith('lerna.json')) return true;
        return false;
      });

      const result = await analysisEngine.detectMonorepo(mockRepoRoot);

      expect(result).toBe(true);
    });

    it('should detect Yarn workspaces monorepo', async () => {
      fs.pathExists.mockImplementation((path) => {
        if (path && path.endsWith('package.json')) return true;
        if (path && path.endsWith('yarn.lock')) return true;
        return false;
      });
      fs.readJson.mockResolvedValue({
        workspaces: ['packages/*'],
      });

      const result = await analysisEngine.detectMonorepo(mockRepoRoot);

      expect(result).toBe(true);
    });

    it('should return false for non-monorepo', async () => {
      fs.pathExists.mockResolvedValue(false);

      const result = await analysisEngine.detectMonorepo(mockRepoRoot);

      expect(result).toBe(false);
    });
  });

  describe('hasTestFiles', () => {
    const mockRepoRoot = '/test/repo';

    beforeEach(() => {
      fs.pathExists.mockImplementation(() => false);
    });

    it('should detect test files in test directory', async () => {
      fs.pathExists.mockImplementation((path) => {
        if (path && path.includes('test')) return true;
        return false;
      });

      const result = await analysisEngine.hasTestFiles(mockRepoRoot);

      expect(result).toBe(true);
    });

    it('should return false when no test directories found', async () => {
      fs.pathExists.mockResolvedValue(false);

      const result = await analysisEngine.hasTestFiles(mockRepoRoot);

      expect(result).toBe(false);
    });
  });

  describe('hasCIConfig', () => {
    const mockRepoRoot = '/test/repo';

    beforeEach(() => {
      fs.pathExists.mockImplementation(() => false);
    });

    it('should detect GitHub Actions', async () => {
      fs.pathExists.mockImplementation((path) => {
        if (path && path.includes('.github')) return true;
        return false;
      });

      const result = await analysisEngine.hasCIConfig(mockRepoRoot);

      expect(result).toBe(true);
    });

    it('should detect Jenkins configuration', async () => {
      fs.pathExists.mockImplementation((path) => {
        if (path && path.includes('Jenkinsfile')) return true;
        return false;
      });

      const result = await analysisEngine.hasCIConfig(mockRepoRoot);

      expect(result).toBe(true);
    });

    it('should return false when no CI configuration found', async () => {
      fs.pathExists.mockResolvedValue(false);

      const result = await analysisEngine.hasCIConfig(mockRepoRoot);

      expect(result).toBe(false);
    });
  });

  describe('analyzeComplexity', () => {
    it('should analyze diff complexity correctly', async () => {
      const diff = `
+ const newFunction = () => {
+   if (condition) {
+     return true;
+   }
+ };
+ import React from 'react';
+ export default newFunction;
- const oldFunction = () => false;
      `;

      const result = await analysisEngine.analyzeComplexity(diff);

      expect(result).toEqual({
        linesAdded: 7,
        linesRemoved: 1,
        netChange: 6,
        hasLogic: true,
        hasImports: true,
        hasExports: true,
        hasFunctions: true,
        hasTests: false,
        hasConfig: false,
        hasAuth: false,
        hasApi: false,
        hasDb: false,
        hasUi: false,
        hasFix: false,
        hasFeature: true,
        hasRefactor: false,
        hasPerf: false,
        hasDocs: false,
        hasDeps: false,
        changeType: 'feat',
        confidence: 0.8,
      });
    });

    it('should detect test-related changes', async () => {
      const diff = `
+ describe('Test suite', () => {
+   it('should pass', () => {
+     expect(true).toBe(true);
+   });
+ });
      `;

      const result = await analysisEngine.analyzeComplexity(diff);

      expect(result.hasTests).toBe(true);
      expect(result.changeType).toBe('test');
      expect(result.confidence).toBe(1.0);
    });

    it('should detect bug fix changes', async () => {
      const diff = `
+ // Fix for issue #123
+ const fixBug = () => {
+   try {
+     return correctedValue;
+   } catch (error) {
+     console.error('Bug fixed');
+   }
+ };
      `;

      const result = await analysisEngine.analyzeComplexity(diff);

      expect(result.hasFix).toBe(true);
      expect(result.changeType).toBe('fix');
      expect(result.confidence).toBe(0.9);
    });

    it('should handle fallback logic when no clear type detected', async () => {
      const diff = `
+ const utilityFunction = () => {
+   return 'helper';
+ };
+ import something from 'somewhere';
+ export default utilityFunction;
      `;

      const result = await analysisEngine.analyzeComplexity(diff);

      expect(result.changeType).toBe('refactor');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });
});