/**
 * ConventionDetector Unit Tests
 */

const path = require('path');

// Mock fs-extra to avoid filesystem dependency
jest.mock('fs-extra', () => {
  const actualFs = jest.requireActual('fs-extra');
  return {
    ...actualFs,
    existsSync: jest.fn().mockReturnValue(false),
    readdirSync: jest.fn().mockReturnValue([]),
    statSync: jest.fn().mockImplementation(() => ({
      isDirectory: () => false
    })),
    readFileSync: jest.fn().mockReturnValue('')
  };
});

const fs = require('fs-extra');
const ConventionDetector = require('../../src/detectors/convention-detector');

describe('ConventionDetector', () => {
  const repoRoot = '/test/repo';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('naming detection', () => {
    it('should detect camelCase naming', () => {
      const detector = new ConventionDetector(repoRoot);

      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation((dir) => {
        if (dir.endsWith('src')) {
          return ['getUser.js', 'setUser.js', 'deleteUser.js'];
        }
        return [];
      });
      fs.statSync.mockImplementation(() => ({
        isDirectory: () => false
      }));

      const result = detector.analyze();

      expect(result.naming).toBe('camelCase');
    });

    it('should detect snake_case naming', () => {
      const detector = new ConventionDetector(repoRoot);

      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation((dir) => {
        if (dir.endsWith('src')) {
          return ['get_user.py', 'set_user.py', 'delete_user.py'];
        }
        return [];
      });
      fs.statSync.mockImplementation(() => ({
        isDirectory: () => false
      }));

      const result = detector.analyze();

      expect(result.naming).toBe('snake_case');
    });

    it('should detect kebab-case naming', () => {
      const detector = new ConventionDetector(repoRoot);

      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation((dir) => {
        if (dir.endsWith('src')) {
          return ['get-user.js', 'set-user.js', 'delete-user.js'];
        }
        return [];
      });
      fs.statSync.mockImplementation(() => ({
        isDirectory: () => false
      }));

      const result = detector.analyze();

      expect(result.naming).toBe('kebab-case');
    });

    it('should detect PascalCase naming', () => {
      const detector = new ConventionDetector(repoRoot);

      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation((dir) => {
        if (dir.endsWith('src')) {
          return ['UserService.js', 'AuthService.js', 'PaymentService.js'];
        }
        return [];
      });
      fs.statSync.mockImplementation(() => ({
        isDirectory: () => false
      }));

      const result = detector.analyze();

      expect(result.naming).toBe('PascalCase');
    });

    it('should detect mixed naming when no dominant pattern', () => {
      const detector = new ConventionDetector(repoRoot);

      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation((dir) => {
        if (dir.endsWith('src')) {
          return ['getUser.js', 'get_user.py', 'get-user.js', 'UserService.js'];
        }
        return [];
      });
      fs.statSync.mockImplementation(() => ({
        isDirectory: () => false
      }));

      const result = detector.analyze();

      expect(result.naming).toBe('mixed');
    });
  });

  describe('structure detection', () => {
    it('should detect feature-based structure', () => {
      const detector = new ConventionDetector(repoRoot);

      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation((dir) => {
        if (dir.endsWith('/src')) {
          return ['auth', 'payments', 'shared'];
        }
        if (dir.endsWith('/auth') || dir.endsWith('/payments')) {
          return ['components', 'pages', 'hooks'];
        }
        if (dir.endsWith('/shared')) {
          return ['components', 'pages', 'utils'];
        }
        return [];
      });
      fs.statSync.mockImplementation(() => ({
        isDirectory: () => true
      }));

      const result = detector.analyze();

      expect(result.structure).toBe('feature-based');
    });

    it('should detect layered structure', () => {
      const detector = new ConventionDetector(repoRoot);

      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation((dir) => {
        if (dir.endsWith('/src')) {
          return ['controllers', 'models', 'views', 'services', 'utils'];
        }
        return [];
      });
      fs.statSync.mockImplementation(() => ({
        isDirectory: () => true
      }));

      const result = detector.analyze();

      expect(result.structure).toBe('layered');
    });

    it('should detect flat structure', () => {
      const detector = new ConventionDetector(repoRoot);

      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation((dir) => {
        if (dir.endsWith('/src')) {
          return ['main.js', 'helper.js', 'config.js', 'utils.js'];
        }
        return [];
      });
      fs.statSync.mockImplementation((filePath) => ({
        isDirectory: () => false
      }));

      const result = detector.analyze();

      expect(result.structure).toBe('flat');
    });
  });

  describe('import convention detection', () => {
    it('should detect relative imports', () => {
      const detector = new ConventionDetector(repoRoot);

      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation((dir) => {
        if (dir.endsWith('/src')) {
          return ['auth.js', 'utils.js'];
        }
        return [];
      });
      fs.statSync.mockImplementation(() => ({
        isDirectory: () => false
      }));
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('auth.js')) {
          return "const utils = require('./utils');\nconst helper = require('../lib/helper');";
        }
        return '';
      });

      const result = detector.analyze();

      expect(result.imports).toBe('relative');
    });

    it('should detect absolute imports', () => {
      const detector = new ConventionDetector(repoRoot);

      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation((dir) => {
        if (dir.endsWith('/src')) {
          return ['auth.js', 'utils.js'];
        }
        return [];
      });
      fs.statSync.mockImplementation(() => ({
        isDirectory: () => false
      }));
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('auth.js')) {
          return "import { auth } from '@company/auth';\nimport { util } from '@company/utils';";
        }
        return '';
      });

      const result = detector.analyze();

      expect(result.imports).toBe('absolute');
    });

    it('should detect mixed imports', () => {
      const detector = new ConventionDetector(repoRoot);

      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation((dir) => {
        if (dir.endsWith('/src')) {
          return ['auth.js', 'utils.js'];
        }
        return [];
      });
      fs.statSync.mockImplementation(() => ({
        isDirectory: () => false
      }));
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('auth.js')) {
          return "const utils = require('./utils');\nimport { auth } from '@company/auth';";
        }
        return "const express = require('express');";
      });

      const result = detector.analyze();

      expect(result.imports).toBe('mixed');
    });
  });

  describe('analyzeFiles()', () => {
    it('should analyze specific file paths', () => {
      const detector = new ConventionDetector(repoRoot);

      const result = detector.analyzeFiles(['getUser.js', 'setUser.js', 'deleteUser.js']);

      expect(result).toHaveProperty('naming');
      expect(result).toHaveProperty('structure');
      expect(result).toHaveProperty('imports');
      expect(result.naming).toBe('camelCase');
    });

    it('should return unknown when no files provided', () => {
      const detector = new ConventionDetector(repoRoot);

      const result = detector.analyzeFiles([]);

      expect(result).toEqual({ naming: 'unknown', structure: 'unknown', imports: 'unknown' });
    });
  });

  describe('edge cases', () => {
    it('should return unknown when no source files exist', () => {
      const detector = new ConventionDetector(repoRoot);

      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue([]);
      fs.statSync.mockImplementation(() => ({
        isDirectory: () => true
      }));

      const result = detector.analyze();

      expect(result.naming).toBe('unknown');
    });
  });
});
