/**
 * Input Validator Tests
 */

const { validateInput } = require('../src/utils/input-validator');

describe('Input Validator', () => {
  describe('validateInput', () => {
    test('should return true for valid non-empty string', () => {
      expect(validateInput('valid input')).toBe(true);
      expect(validateInput('a')).toBe(true);
      expect(validateInput('  spaced input  ')).toBe(true);
    });

    test('should throw error for null input', () => {
      expect(() => validateInput(null)).toThrow('Invalid input: must be a non-empty string');
    });

    test('should throw error for undefined input', () => {
      expect(() => validateInput(undefined)).toThrow('Invalid input: must be a non-empty string');
    });

    test('should throw error for empty string', () => {
      expect(() => validateInput('')).toThrow('Invalid input: must be a non-empty string');
    });

    test('should throw error for whitespace-only string', () => {
      expect(() => validateInput('   ')).toThrow('Invalid input: must be a non-empty string');
      expect(() => validateInput('\t\n\r')).toThrow('Invalid input: must be a non-empty string');
    });

    test('should throw error for non-string input', () => {
      expect(() => validateInput(123)).toThrow('Invalid input: must be a non-empty string');
      expect(() => validateInput({})).toThrow('Invalid input: must be a non-empty string');
      expect(() => validateInput([])).toThrow('Invalid input: must be a non-empty string');
      expect(() => validateInput(true)).toThrow('Invalid input: must be a non-empty string');
    });

    test('should handle string with mixed content', () => {
      expect(validateInput('Hello, World! 123')).toBe(true);
      expect(validateInput('🚀 Unicode test')).toBe(true);
    });
  });
});