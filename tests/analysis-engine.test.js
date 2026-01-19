/**
 * Unit tests for AnalysisEngine
 */

describe('AnalysisEngine', () => {
  let AnalysisEngine;
  let engine;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    
    jest.mock('./git-manager', () => {
      return jest.fn().mockImplementation(() => ({
        getRepositoryInfo: jest.fn().mockResolvedValue({ branch: 'main' }),
        getCommitPatterns: jest.fn().mockResolvedValue({ mostUsedTypes: ['feat'] }),
        getStagedFiles: jest.fn().mockResolvedValue(['src/index.js']),
        getFileStats: jest.fn().mockResolvedValue({ insertions: 10, deletions: 5 }),
      }));
    });
    
    jest.mock('fs-extra', () => ({
      pathExists: jest.fn().mockResolvedValue(true),
      readFile: jest.fn().mockResolvedValue('content'),
    }));
    
    jest.mock('../utils/project-type-detector', () => ({
      detectProjectType: jest.fn().mockResolvedValue({ primary: 'nodejs' }),
    }));
    
    AnalysisEngine = require('../src/core/analysis-engine');
    engine = new AnalysisEngine();
  });

  describe('constructor', () => {
    it('should initialize with git manager', () => {
      expect(engine.gitManager).toBeDefined();
    });
  });

  describe('analyzeRepository', () => {
    it('should return repository context', async () => {
      const result = await engine.analyzeRepository();
      expect(result).toHaveProperty('repository');
      expect(result).toHaveProperty('patterns');
      expect(result).toHaveProperty('files');
      expect(result).toHaveProperty('project');
    });
  });

  describe('analyzeFileContext', () => {
    it('should return file context', async () => {
      const result = await engine.analyzeFileContext();
      expect(result).toHaveProperty('totalFiles');
      expect(result).toHaveProperty('fileTypes');
      expect(result).toHaveProperty('changes');
    });
  });

  describe('categorizeFiles', () => {
    it('should categorize source files', () => {
      const files = ['index.js', 'main.py'];
      const categories = engine.categorizeFiles(files);
      expect(categories.source).toBe(2);
    });

    it('should categorize test files', () => {
      const files = ['index.test.js', 'App.spec.ts'];
      const categories = engine.categorizeFiles(files);
      expect(categories.test).toBe(2);
    });

    it('should categorize config files', () => {
      const files = ['package.json', 'Dockerfile'];
      const categories = engine.categorizeFiles(files);
      expect(categories.config).toBe(2);
    });

    it('should handle empty array', () => {
      const categories = engine.categorizeFiles([]);
      expect(categories.source).toBe(0);
    });
  });

  describe('inferScope', () => {
    it('should infer scope from file paths', () => {
      const files = ['src/auth/login.js'];
      const scope = engine.inferScope(files);
      expect(scope).toBe('auth');
    });

    it('should return null for unknown scope', () => {
      const files = ['index.js'];
      const scope = engine.inferScope(files);
      expect(scope).toBeNull();
    });
  });

  describe('detectWordPressContext', () => {
    it('should detect WordPress files', async () => {
      const files = ['wp-content/themes/my-theme/index.php'];
      const context = await engine.detectWordPressContext(files);
      expect(context.isWordPress).toBe(true);
    });

    it('should return false for non-WordPress', async () => {
      const files = ['src/index.js'];
      const context = await engine.detectWordPressContext(files);
      expect(context.isWordPress).toBe(false);
    });
  });
});
