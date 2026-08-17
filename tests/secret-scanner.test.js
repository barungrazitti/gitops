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
});
