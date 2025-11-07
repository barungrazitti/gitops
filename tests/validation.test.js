/**
 * Validation Utils Tests
 */

const {
  validateEmail,
  validatePhone,
  isValidEmail
} = require('../src/utils/validation');

describe('Validation Utils', () => {
  describe('validateEmail', () => {
    test('should return true for valid email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.org')).toBe(true);
      expect(validateEmail('user123@test-domain.com')).toBe(true);
    });

    test('should return false for invalid email addresses', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('test@.com')).toBe(false);
      expect(validateEmail('test@example')).toBe(false);
      // Note: The regex is simple and may allow some edge cases
      expect(validateEmail('test space@example.com')).toBe(false);
    });

    test('should handle edge cases', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail(null)).toBe(false);
      expect(validateEmail(undefined)).toBe(false);
      expect(validateEmail(123)).toBe(false);
    });
  });

  describe('validatePhone', () => {
    test('should return true for valid phone numbers', () => {
      expect(validatePhone('+1234567890')).toBe(true);
      expect(validatePhone('123-456-7890')).toBe(true);
      expect(validatePhone('(123) 456-7890')).toBe(true);
      expect(validatePhone('123 456 7890')).toBe(true);
      expect(validatePhone('+1 (123) 456-7890')).toBe(true);
      expect(validatePhone('1234567890')).toBe(true);
    });

    test('should return false for invalid phone numbers', () => {
      expect(validatePhone('abc')).toBe(false);
      expect(validatePhone('123abc456')).toBe(false);
      expect(validatePhone('123-456-789a')).toBe(false);
      expect(validatePhone('!@#$%^&*()')).toBe(false);
      expect(validatePhone('')).toBe(false);
    });

    test('should handle edge cases', () => {
      expect(validatePhone(null)).toBe(false);
      expect(validatePhone(undefined)).toBe(false);
      // Note: The regex is simple and may allow numbers
      expect(validatePhone('')).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    test('should return true for valid email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
    });

    test('should return false for invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });

    test('should handle edge cases', () => {
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
      expect(isValidEmail(123)).toBe(false);
    });

    test('should behave consistently with validateEmail', () => {
      const testEmails = [
        'test@example.com',
        'invalid',
        'user@domain.com',
        '@example.com',
        '',
        null,
        undefined
      ];

      testEmails.forEach(email => {
        expect(validateEmail(email)).toBe(isValidEmail(email));
      });
    });
  });
});