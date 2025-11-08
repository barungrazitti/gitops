/**
 * Unit tests for BaseProvider class
 */

// Mock all dependencies before requiring
jest.mock('../src/core/config-manager');
jest.mock('fs');
jest.mock('path');

const BaseProvider = require('../src/providers/base-provider');
const ConfigManager = require('../src/core/config-manager');
const fs = require('fs');
const path = require('path');

describe('BaseProvider', () => {
  let baseProvider;
  let mockConfigManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock config manager
    mockConfigManager = {
      get: jest.fn(),
      getConfigPath: jest.fn(),
    };
    ConfigManager.mockImplementation(() => mockConfigManager);

    baseProvider = new BaseProvider();
  });

  describe('constructor', () => {
    it('should initialize with ConfigManager instance', () => {
      expect(ConfigManager).toHaveBeenCalled();
      expect(baseProvider.configManager).toBe(mockConfigManager);
      expect(baseProvider.name).toBe('base');
    });
  });

  describe('generateCommitMessages', () => {
    it('should throw error when not implemented', async () => {
      await expect(baseProvider.generateCommitMessages('test diff'))
        .rejects.toThrow('generateCommitMessages must be implemented by subclass');
    });
  });

  describe('generateResponse', () => {
    it('should throw error when not implemented', async () => {
      await expect(baseProvider.generateResponse('test prompt'))
        .rejects.toThrow('generateResponse must be implemented by subclass');
    });
  });

  describe('validate', () => {
    it('should throw error when not implemented', async () => {
      await expect(baseProvider.validate({}))
        .rejects.toThrow('validate must be implemented by subclass');
    });
  });

  describe('preprocessDiff', () => {
    it('should handle binary files', () => {
      const diff = `Binary files a/image.png and b/image.png differ
diff --git a/src/app.js b/src/app.js
index 123456..789abc 100644
--- a/src/app.js
+++ b/src/app.js
@@ -1,3 +1,4 @@
 function test() {
+  console.log('hello');
   return true;
 }
`;

      const result = baseProvider.preprocessDiff(diff);

      expect(result).toContain('[Binary file modified]');
      expect(result).toContain('function test()');
    });

    it('should split and process lines intelligently', () => {
      const diff = `diff --git a/src/app.js b/src/app.js
index 123456..789abc 100644
--- a/src/app.js
+++ b/src/app.js
@@ -1,3 +1,4 @@
 // This is a comment
 function test() {
   return true;
 }
`;

      const result = baseProvider.preprocessDiff(diff);

      expect(result).toContain('// This is a comment');
      expect(result).toContain('function test()');
    });

    it('should limit total characters while preserving structure', () => {
      const diff = `diff --git a/src/app.js b/src/app.js
index 123456..789abc 100644
--- a/src/app.js
+++ b/src/app.js
@@ -1,3 +1,4 @@
 function test() {
   return '${'x'.repeat(2000)}';
 }
`;

      const result = baseProvider.preprocessDiff(diff);

      // Should be truncated but keep essential parts
      expect(result).toContain('function test()');
      expect(result).toContain('[Long line truncated]');
    });

    it('should handle empty diff', () => {
      const result = baseProvider.preprocessDiff('');
      expect(result).toBe(' ');
    });

    it('should handle null diff gracefully', () => {
      expect(() => baseProvider.preprocessDiff('null')).not.toThrow();
    });

    it('should handle undefined diff gracefully', () => {
      expect(() => baseProvider.preprocessDiff('undefined')).not.toThrow();
    });
  });

  describe('isImportantContext', () => {
    it('should return true for non-empty lines', () => {
      expect(baseProvider.isImportantContext('some content')).toBe(true);
    });

    it('should return false for empty lines', () => {
      expect(baseProvider.isImportantContext('   ')).toBe(false);
    });
  });

  describe('isTrivialChange', () => {
    it('should return true for empty changes', () => {
      expect(baseProvider.isTrivialChange('+')).toBe(true);
      expect(baseProvider.isTrivialChange('-')).toBe(true);
    });

    it('should return false for non-empty changes', () => {
      expect(baseProvider.isTrivialChange('+console.log("test")')).toBe(false);
      expect(baseProvider.isTrivialChange('-console.log("test")')).toBe(false);
    });
  });

  describe('validateCommitMessage', () => {
    it('should validate good commit messages', () => {
      expect(baseProvider.validateCommitMessage('feat: add new feature')).toBe(true);
      expect(baseProvider.validateCommitMessage('fix: resolve bug in auth')).toBe(true);
    });

    it('should reject invalid inputs', () => {
      expect(baseProvider.validateCommitMessage(null)).toBe(false);
      expect(baseProvider.validateCommitMessage(undefined)).toBe(false);
      expect(baseProvider.validateCommitMessage(123)).toBe(false);
    });

    it('should reject messages that are too short', () => {
      expect(baseProvider.validateCommitMessage('a')).toBe(false);
      expect(baseProvider.validateCommitMessage('short')).toBe(false);
    });

    it('should reject messages that are too long', () => {
      const longMessage = 'x'.repeat(201);
      expect(baseProvider.validateCommitMessage(longMessage)).toBe(false);
    });

    it('should reject messages with newlines early', () => {
      expect(baseProvider.validateCommitMessage('feat: add feature\nwith details')).toBe(false);
    });
  });

  describe('handleError', () => {
    it('should handle HTTP 401 errors', () => {
      const error = {
        response: { status: 401 },
        message: 'Unauthorized'
      };

      expect(() => baseProvider.handleError(error, 'TestProvider'))
        .toThrow('Authentication failed for TestProvider. Please check your API key.');
    });

    it('should handle HTTP 403 errors', () => {
      const error = {
        response: { status: 403 },
        message: 'Forbidden'
      };

      expect(() => baseProvider.handleError(error, 'TestProvider'))
        .toThrow('Access forbidden for TestProvider. Please check your permissions.');
    });

    it('should handle HTTP 404 errors', () => {
      const error = {
        response: { status: 404 },
        message: 'Not found'
      };

      expect(() => baseProvider.handleError(error, 'TestProvider'))
        .toThrow('TestProvider API error (404): undefined');
    });

    it('should handle HTTP 429 errors', () => {
      const error = {
        response: { status: 429 },
        message: 'Rate limit exceeded'
      };

      expect(() => baseProvider.handleError(error, 'TestProvider'))
        .toThrow('Rate limit exceeded for TestProvider. Please try again later.');
    });

    it('should handle HTTP 500 errors', () => {
      const error = {
        response: { status: 500 },
        message: 'Internal server error'
      };

      expect(() => baseProvider.handleError(error, 'TestProvider'))
        .toThrow('TestProvider service is temporarily unavailable. Please try again later.');
    });

    it('should handle connection refused errors', () => {
      const error = { code: 'ECONNREFUSED' };

      expect(() => baseProvider.handleError(error, 'TestProvider'))
        .toThrow('Cannot connect to TestProvider. Please check your internet connection.');
    });

    it('should handle timeout errors', () => {
      const error = { code: 'ETIMEDOUT' };

      expect(() => baseProvider.handleError(error, 'TestProvider'))
        .toThrow('Request to TestProvider timed out. Please try again.');
    });

    it('should handle generic errors', () => {
      const error = { message: 'Something went wrong' };

      expect(() => baseProvider.handleError(error, 'TestProvider'))
        .toThrow('TestProvider error: Something went wrong');
    });

    it('should handle undefined error messages', () => {
      const error = {};

      expect(() => baseProvider.handleError(error, 'TestProvider'))
        .toThrow('TestProvider error: Unknown error occurred');
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await baseProvider.withRetry(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');

      const result = await baseProvider.withRetry(mockFn, 2, 10);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on client errors', async () => {
      const mockFn = jest.fn().mockRejectedValue({
        response: { status: 401 }
      });

      await expect(baseProvider.withRetry(mockFn)).rejects.toEqual({
        response: { status: 401 }
      });
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should throw error after max retries', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Persistent error'));

      await expect(baseProvider.withRetry(mockFn, 2, 10))
        .rejects.toThrow('Persistent error');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('getConfig', () => {
    it('should get provider config', async () => {
      mockConfigManager.getProviderConfig = jest.fn().mockResolvedValue({
        apiKey: 'test-key',
        model: 'test-model'
      });

      const config = await baseProvider.getConfig();

      expect(config).toEqual({
        apiKey: 'test-key',
        model: 'test-model'
      });
      expect(mockConfigManager.getProviderConfig).toHaveBeenCalledWith('base');
    });

    it('should handle config errors gracefully', async () => {
      mockConfigManager.getProviderConfig = jest.fn().mockRejectedValue(new Error('Config error'));

      const config = await baseProvider.getConfig();

      expect(config).toEqual({});
    });
  });

  describe('getLanguageName', () => {
    it('should return language names for common codes', () => {
      expect(baseProvider.getLanguageName('en')).toBe('English');
      expect(baseProvider.getLanguageName('es')).toBe('Spanish');
      expect(baseProvider.getLanguageName('fr')).toBe('French');
      expect(baseProvider.getLanguageName('de')).toBe('German');
      expect(baseProvider.getLanguageName('zh')).toBe('Chinese');
      expect(baseProvider.getLanguageName('ja')).toBe('Japanese');
    });

    it('should return English for unknown codes', () => {
      expect(baseProvider.getLanguageName('xyz')).toBe('English');
      expect(baseProvider.getLanguageName('unknown')).toBe('English');
    });

    it('should return English for empty code', () => {
      expect(baseProvider.getLanguageName('')).toBe('English');
    });
  });
});