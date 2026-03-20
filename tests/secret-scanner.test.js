/**
 * Unit tests for SecretScanner
 */

describe('SecretScanner', () => {
  let SecretScanner;
  let scanner;

  beforeEach(() => {
    jest.resetModules();
    SecretScanner = require('../src/utils/secret-scanner');
    scanner = new SecretScanner();
  });

  describe('constructor', () => {
    it('should initialize secret patterns', () => {
      expect(scanner.secretPatterns).toBeDefined();
      expect(Array.isArray(scanner.secretPatterns)).toBe(true);
      expect(scanner.secretPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('scanAndRedact', () => {
    it('should return non-string values unchanged', () => {
      expect(scanner.scanAndRedact(null)).toBeNull();
      expect(scanner.scanAndRedact(123)).toBe(123);
    });

    it('should redact API keys', () => {
      const content = 'api_key = "sk-1234567890abcdefghijklmnop"';
      const result = scanner.scanAndRedact(content);
      expect(result).not.toContain('sk-1234567890');
    });

    it('should redact AWS access keys', () => {
      const content = 'AKIAIOSFODNN7EXAMPLE';
      const result = scanner.scanAndRedact(content);
      expect(result).not.toContain('AKIAIOSFODNN7');
    });

    it('should redact database connection strings', () => {
      const content = 'mongodb://user:password@localhost:27017/mydb';
      const result = scanner.scanAndRedact(content);
      expect(result).toContain('[USER]');
      expect(result).toContain('[PASSWORD]');
    });

    it('should redact passwords in URLs', () => {
      const content = 'https://user:secret@example.com/api';
      const result = scanner.scanAndRedact(content);
      expect(result).toContain('[USER]:[PASSWORD]');
    });

    it('should handle empty string', () => {
      const result = scanner.scanAndRedact('');
      expect(result).toBe('');
    });
  });

  describe('scan', () => {
    it('should return empty array for non-string', () => {
      expect(scanner.scan(null)).toEqual([]);
      expect(scanner.scan(123)).toEqual([]);
    });

    it('should return empty array for no secrets', () => {
      const result = scanner.scan('normal content');
      expect(result).toEqual([]);
    });

    it('should detect secrets', () => {
      const content = 'API Key: sk-test1234567890';
      const result = scanner.scan(content);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('getPatternInfo', () => {
    it('should return pattern info by name', () => {
      const patternInfo = scanner.getPatternInfo('jwt_token');
      expect(patternInfo).toBeDefined();
    });

    it('should return undefined for unknown pattern', () => {
      const patternInfo = scanner.getPatternInfo('unknown');
      expect(patternInfo).toBeUndefined();
    });
  });

  describe('addCustomPattern', () => {
    it('should add custom pattern', () => {
      const initialLength = scanner.secretPatterns.length;
      scanner.addCustomPattern({
        name: 'custom',
        pattern: /CUSTOM/g,
        replacement: '[REDACTED]'
      });
      expect(scanner.secretPatterns.length).toBe(initialLength + 1);
    });
  });
});
