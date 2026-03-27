/**
 * ComponentDetector Unit Tests
 */

const path = require('path');

// Mock ProjectTypeDetector to avoid fs dependency chain
jest.mock('../../src/utils/project-type-detector', () => ({
  detectMonorepo: jest.fn(),
  detectProjectType: jest.fn(),
  detectWordPress: jest.fn()
}));

// Mock conf to avoid config file dependency
jest.mock('conf', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockReturnValue({})
  }));
});

const ProjectTypeDetector = require('../../src/utils/project-type-detector');

describe('ComponentDetector', () => {
  let ComponentDetector;
  let repoRoot;

  beforeEach(() => {
    jest.resetModules();
    ComponentDetector = require('../../src/detectors/component-detector');
    repoRoot = '/test/repo';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('detect()', () => {
    it('should detect monorepo package boundaries', async () => {
      const detector = new ComponentDetector(repoRoot);

      // Mock as monorepo
      ProjectTypeDetector.detectMonorepo.mockResolvedValue(true);

      const result = await detector.detect(['packages/auth/src/login.js']);

      // In monorepo, packages/auth triggers auto-detect since we can't walk the filesystem
      // The monorepo path walk needs a real package.json, so it falls through to auto-detect
      expect(result[0]).toMatchObject({
        component: 'auth',
        scope: 'packages/auth',
        boundary: expect.stringMatching(/directory|package/)
      });
    });

    it('should detect service directory patterns', async () => {
      const detector = new ComponentDetector(repoRoot);

      // Not a monorepo
      ProjectTypeDetector.detectMonorepo.mockResolvedValue(false);

      const result = await detector.detect(['services/user-service/handler.js']);

      expect(result[0]).toMatchObject({
        component: 'user-service',
        scope: 'services/user-service',
        boundary: 'directory'
      });
    });

    it('should detect app directory patterns', async () => {
      const detector = new ComponentDetector(repoRoot);

      // Not a monorepo
      ProjectTypeDetector.detectMonorepo.mockResolvedValue(false);

      const result = await detector.detect(['apps/web/src/App.js']);

      expect(result[0]).toMatchObject({
        component: 'web',
        scope: 'apps/web',
        boundary: 'directory'
      });
    });

    it('should detect modules directory patterns', async () => {
      const detector = new ComponentDetector(repoRoot);

      // Not a monorepo
      ProjectTypeDetector.detectMonorepo.mockResolvedValue(false);

      const result = await detector.detect(['modules/payment/process.js']);

      expect(result[0]).toMatchObject({
        component: 'payment',
        scope: 'modules/payment',
        boundary: 'directory'
      });
    });

    it('should detect libs directory patterns', async () => {
      const detector = new ComponentDetector(repoRoot);

      // Not a monorepo
      ProjectTypeDetector.detectMonorepo.mockResolvedValue(false);

      const result = await detector.detect(['libs/shared/utils.js']);

      expect(result[0]).toMatchObject({
        component: 'shared',
        scope: 'libs/shared',
        boundary: 'directory'
      });
    });

    it('should detect components directory patterns', async () => {
      const detector = new ComponentDetector(repoRoot);

      // Not a monorepo
      ProjectTypeDetector.detectMonorepo.mockResolvedValue(false);

      const result = await detector.detect(['components/Button/index.js']);

      expect(result[0]).toMatchObject({
        component: 'Button',
        scope: 'components/Button',
        boundary: 'directory'
      });
    });

    it('should extract first meaningful directory in non-monorepo', async () => {
      const detector = new ComponentDetector(repoRoot);

      // Not a monorepo
      ProjectTypeDetector.detectMonorepo.mockResolvedValue(false);

      const result = await detector.detect(['src/auth/login.js']);

      expect(result[0]).toMatchObject({
        component: 'auth',
        scope: expect.stringContaining('auth'),
        boundary: 'directory'
      });
    });

    it('should return null when no component detected for root-level file', async () => {
      const detector = new ComponentDetector(repoRoot);

      // Not a monorepo
      ProjectTypeDetector.detectMonorepo.mockResolvedValue(false);

      const result = await detector.detect(['config.js']);

      expect(result[0]).toEqual({ component: null, scope: null, boundary: null });
    });

    it('should handle deeply nested paths extracting nearest component', async () => {
      const detector = new ComponentDetector(repoRoot);

      // Not a monorepo
      ProjectTypeDetector.detectMonorepo.mockResolvedValue(false);

      const result = await detector.detect(['src/auth/controllers/loginController.js']);

      expect(result[0]).toMatchObject({
        component: 'auth',
        scope: expect.stringContaining('auth'),
        boundary: 'directory'
      });
    });

    it('should skip common prefixes like lib/ and extract meaningful component', async () => {
      const detector = new ComponentDetector(repoRoot);

      // Not a monorepo
      ProjectTypeDetector.detectMonorepo.mockResolvedValue(false);

      const result = await detector.detect(['lib/api/client.js']);

      expect(result[0]).toMatchObject({
        component: 'api',
        scope: expect.stringContaining('api'),
        boundary: 'directory'
      });
    });
  });

  describe('detectBatch()', () => {
    it('should return array of results for multiple file paths', async () => {
      const detector = new ComponentDetector(repoRoot);

      // Not a monorepo
      ProjectTypeDetector.detectMonorepo.mockResolvedValue(false);

      const results = await detector.detectBatch([
        'src/auth/login.js',
        'src/auth/logout.js',
        'src/api/routes.js'
      ]);

      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty('component');
      expect(results[0]).toHaveProperty('scope');
      expect(results[0]).toHaveProperty('boundary');
    });
  });

  describe('getComponentsSummary()', () => {
    it('should aggregate files by component', async () => {
      const detector = new ComponentDetector(repoRoot);

      // Not a monorepo
      ProjectTypeDetector.detectMonorepo.mockResolvedValue(false);

      const summary = await detector.getComponentsSummary([
        'src/auth/login.js',
        'src/auth/logout.js',
        'src/api/routes.js'
      ]);

      expect(summary).toHaveProperty('components');
      expect(summary).toHaveProperty('filesByComponent');
      expect(summary.components).toContain('auth');
      expect(summary.components).toContain('api');
      expect(summary.filesByComponent.auth).toHaveLength(2);
      expect(summary.filesByComponent.api).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should return nulls for empty file path', async () => {
      const detector = new ComponentDetector(repoRoot);

      const result = await detector.detect(['']);

      expect(result[0]).toEqual({ component: null, scope: null, boundary: null });
    });

    it('should handle file path with only one segment', async () => {
      const detector = new ComponentDetector(repoRoot);

      ProjectTypeDetector.detectMonorepo.mockResolvedValue(false);

      const result = await detector.detect(['singlefile.js']);

      expect(result[0]).toEqual({ component: null, scope: null, boundary: null });
    });
  });
});
