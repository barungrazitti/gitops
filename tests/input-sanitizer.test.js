/**
 * Unit tests for InputSanitizer
 */

// Mock the secret-scanner module
jest.mock('../src/utils/secret-scanner', () => {
  return class MockSecretScanner {
    scanAndRedact(input) {
      return input;
    }
  };
});

const InputSanitizer = require('../src/utils/input-sanitizer');

describe('InputSanitizer', () => {

  describe('sanitizeFilePath', () => {
    it('should return null for null input', () => {
      expect(InputSanitizer.sanitizeFilePath(null)).toBeNull();
    });

    it('should reject directory traversal', () => {
      expect(() => {
        InputSanitizer.sanitizeFilePath('../etc/passwd');
      }).toThrow();
    });

    it('should reject absolute paths', () => {
      expect(() => {
        InputSanitizer.sanitizeFilePath('/etc/passwd');
      }).toThrow();
    });

    it('should accept valid relative paths', () => {
      const result = InputSanitizer.sanitizeFilePath('src/index.js');
      expect(result).toBe('src/index.js');
    });

    it('should normalize paths', () => {
      const result = InputSanitizer.sanitizeFilePath('foo/./bar');
      expect(result).toBe('foo/bar');
    });
  });

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

  describe('sanitizeDiffContent', () => {
    it('should return non-string unchanged', () => {
      expect(InputSanitizer.sanitizeDiffContent(null)).toBe(null);
    });
  });

  describe('sanitizeRepoUrl', () => {
    it('should return non-string unchanged', () => {
      expect(InputSanitizer.sanitizeRepoUrl(null)).toBe(null);
    });

    it('should accept valid http URLs', () => {
      const result = InputSanitizer.sanitizeRepoUrl('http://github.com/user/repo');
      expect(result).toBe('http://github.com/user/repo');
    });

    it('should accept valid https URLs', () => {
      const result = InputSanitizer.sanitizeRepoUrl('https://github.com/user/repo');
      expect(result).toBe('https://github.com/user/repo');
    });

    it('should accept ssh URLs', () => {
      const result = InputSanitizer.sanitizeRepoUrl('ssh://git@github.com/user/repo.git');
      expect(result).toBe('ssh://git@github.com/user/repo.git');
    });

    it('should reject invalid protocols', () => {
      expect(() => {
        InputSanitizer.sanitizeRepoUrl('ftp://github.com/user/repo');
      }).toThrow();
    });

    it('should throw for invalid URLs', () => {
      expect(() => {
        InputSanitizer.sanitizeRepoUrl('not-a-url');
      }).toThrow();
    });
  });
});
