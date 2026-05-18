/**
 * InputValidator Tests
 */

describe('InputValidator', () => {
  let InputValidator;

  beforeEach(() => {
    jest.resetModules();
    InputValidator = require('../../src/utils/input-validator');
  });

  describe('validateInput', () => {
    it('should validate valid string input', () => {
      expect(InputValidator.validateInput('test')).toBe(true);
    });

    it('should reject empty strings', () => {
      expect(() => InputValidator.validateInput('')).toThrow();
    });

    it('should reject null', () => {
      expect(() => InputValidator.validateInput(null)).toThrow();
    });

    it('should reject undefined', () => {
      expect(() => InputValidator.validateInput(undefined)).toThrow();
    });

    it('should reject whitespace-only strings', () => {
      expect(() => InputValidator.validateInput('   ')).toThrow();
    });

    it('should reject non-string inputs', () => {
      expect(() => InputValidator.validateInput(123)).toThrow();
      expect(() => InputValidator.validateInput({})).toThrow();
    });
  });
});