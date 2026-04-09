/**
 * Unit tests for AnalysisEngine
 */

describe('AnalysisEngine', () => {
  let AnalysisEngine;
  let engine;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    
<<<<<<< HEAD
    jest.mock('../src/core/git-manager', () => jest.fn().mockImplementation(() => ({
        getRepositoryInfo: jest.fn().mockResolvedValue({ branch: 'main' }),
        getCommitPatterns: jest.fn().mockResolvedValue({ mostUsedTypes: ['feat'] }),
        getStagedFiles: jest.fn().mockResolvedValue(['src/index.js']),
        getFileStats: jest.fn().mockResolvedValue({ insertions: 10, deletions: 5 }),
        getCommitHistory: jest.fn().mockResolvedValue([]),
        getRepositoryRoot: jest.fn().mockResolvedValue('/test/repo'),
      })));
=======
     jest.mock('../src/core/git-manager', () => {
       return jest.fn().mockImplementation(() => ({
         getRepositoryInfo: jest.fn().mockResolvedValue({ branch: 'main' }),
         getCommitPatterns: jest.fn().mockResolvedValue({ mostUsedTypes: ['feat'] }),
         getStagedFiles: jest.fn().mockResolvedValue(['src/index.js']),
         getFileStats: jest.fn().mockResolvedValue({ insertions: 10, deletions: 5 }),
       }));
     });
>>>>>>> cea4c8218d91195730c9ef779506932cef526efa
    
    jest.mock('fs-extra', () => ({
      pathExists: jest.fn().mockResolvedValue(true),
      readFile: jest.fn().mockResolvedValue('content'),
    }));
    
<<<<<<< HEAD
    jest.mock('../src/utils/project-type-detector', () => ({
      detectProjectType: jest.fn().mockResolvedValue({ primary: 'nodejs' }),
    }));
=======
     jest.mock('../src/utils/project-type-detector', () => ({
       detectProjectType: jest.fn().mockResolvedValue({ primary: 'nodejs' }),
     }));
>>>>>>> cea4c8218d91195730c9ef779506932cef526efa
    
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
      const files = ['index.js', 'app.ts', 'utils.py'];
      const categories = engine.categorizeFiles(files);
      expect(categories.source).toBe(3);
    });

    it('should categorize source files first (source pattern checked before test)', () => {
      const files = ['app.test.js', 'utils.spec.js'];
      const categories = engine.categorizeFiles(files);
      expect(categories.source).toBe(2);
    });

    it('should categorize config files', () => {
      const files = ['config.json', 'app.yaml', 'Dockerfile'];
      const categories = engine.categorizeFiles(files);
      expect(categories.config).toBe(3);
    });

    it('should handle empty array', () => {
      const files = [];
      const categories = engine.categorizeFiles(files);
      expect(categories.source).toBe(0);
    });
  });

  describe('inferScope', () => {
    it('should infer scope from file paths', () => {
      const files = ['src/auth/login.js'];
      const scope = engine.inferScope(files);
      expect(scope).toBe('auth');
    });

    it('should return general for unknown scope', () => {
      const files = ['index.js'];
      const scope = engine.inferScope(files);
      expect(scope).toBe('general');
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
