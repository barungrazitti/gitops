/**
 * Unit tests for InputSanitizer
 */

// Mock the secret-scanner module
jest.mock(
  '../src/utils/secret-scanner',
  () =>
    class MockSecretScanner {
      scanAndRedact(input) {
        return input;
      }
    }
);

const InputSanitizer = require('../src/utils/input-sanitizer');

describe('InputSanitizer', () => {
  describe('sanitizeGitArgs', () => {
    it('should handle single string', () => {
      const result = InputSanitizer.sanitizeGitArgs('commit message');
      expect(result).toEqual(['commit message']);
    });

    it('should reject semicolons', () => {
      expect(() => {
        InputSanitizer.sanitizeGitArgs('test; rm -rf /');
      }).toThrow();
    });

    it('should reject pipes', () => {
      expect(() => {
        InputSanitizer.sanitizeGitArgs('test | cat');
      }).toThrow();
    });

    it('should handle non-string arguments', () => {
      const result = InputSanitizer.sanitizeGitArgs([123, 'string']);
      expect(result).toEqual([123, 'string']);
    });
  });

  describe('sanitizeString', () => {
    it('should return non-string unchanged', () => {
      expect(InputSanitizer.sanitizeString(123)).toBe(123);
      expect(InputSanitizer.sanitizeString(null)).toBe(null);
    });

    it('should remove control characters', () => {
      const result = InputSanitizer.sanitizeString('test\x00data');
      expect(result).not.toContain('\x00');
    });

    it('should remove command injection chars', () => {
      const result = InputSanitizer.sanitizeString('test; ls');
      expect(result).not.toContain(';');
    });

    it('should trim whitespace', () => {
      const result = InputSanitizer.sanitizeString('  test  ');
      expect(result).toBe('test');
    });
  });

  describe('sanitizeCommitMessage', () => {
    it('should return non-string unchanged', () => {
      expect(InputSanitizer.sanitizeCommitMessage(123)).toBe(123);
    });

    it('should limit length to 1000 chars', () => {
      const long = 'a'.repeat(1500);
      const result = InputSanitizer.sanitizeCommitMessage(long);
      expect(result.length).toBe(1000);
    });

    it('should preserve multi-line bodies with bullets and Refs trailers', () => {
      const message = 'feat: add modal\n\n- Add validation\n- Load scripts\n\nRefs: #123';
      const result = InputSanitizer.sanitizeCommitMessage(message);
      expect(result).toBe(message);
      expect(result.includes('\n')).toBe(true);
    });

    it('should keep legitimate metacharacters in commit messages', () => {
      const message = 'fix: handle $ref forwarding and a || b';
      expect(InputSanitizer.sanitizeCommitMessage(message)).toBe(message);
    });

    it('should still remove control characters except newline', () => {
      const result = InputSanitizer.sanitizeCommitMessage('feat:\x00\x07 ok');
      expect(result).not.toContain('\x00');
      expect(result).not.toContain('\x07');
      expect(result).toBe('feat: ok');
    });
  });

  describe('validateGitReference', () => {
    it('should return false for non-string', () => {
      expect(InputSanitizer.validateGitReference(null)).toBe(false);
      expect(InputSanitizer.validateGitReference(123)).toBe(false);
    });

    it('should reject refs starting with /', () => {
      expect(InputSanitizer.validateGitReference('/main')).toBe(false);
    });

    it('should reject refs ending with .lock', () => {
      expect(InputSanitizer.validateGitReference('main.lock')).toBe(false);
    });

    it('should accept valid branch names', () => {
      expect(InputSanitizer.validateGitReference('main')).toBe(true);
      expect(InputSanitizer.validateGitReference('feature/new-feature')).toBe(true);
    });
  });
});
