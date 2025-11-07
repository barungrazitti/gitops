/**
 * Date Utils Tests
 */

const {
  isValidDate,
  formatDate,
  addDays
} = require('../src/utils/date-utils');

describe('Date Utils', () => {
  describe('isValidDate', () => {
    test('should return true for valid Date object', () => {
      const validDate = new Date('2023-01-01');
      expect(isValidDate(validDate)).toBe(true);
    });

    test('should return false for invalid Date object', () => {
      const invalidDate = new Date('invalid');
      expect(isValidDate(invalidDate)).toBe(false);
    });

    test('should return false for non-Date objects', () => {
      expect(isValidDate('2023-01-01')).toBe(false);
      expect(isValidDate(1234567890)).toBe(false);
      expect(isValidDate(null)).toBe(false);
      expect(isValidDate(undefined)).toBe(false);
      expect(isValidDate({})).toBe(false);
    });
  });

  describe('formatDate', () => {
    test('should format valid date correctly', () => {
      const date = new Date('2023-01-15T10:30:00.000Z');
      const formatted = formatDate(date);
      expect(formatted).toBe('2023-01-15');
    });

    test('should return empty string for invalid date', () => {
      const invalidDate = new Date('invalid');
      const formatted = formatDate(invalidDate);
      expect(formatted).toBe('');
    });

    test('should return empty string for non-Date input', () => {
      expect(formatDate('2023-01-01')).toBe('');
      expect(formatDate(null)).toBe('');
      expect(formatDate(undefined)).toBe('');
    });

    test('should handle different date formats', () => {
      const date = new Date('2023-12-31T23:59:59.999Z');
      const formatted = formatDate(date);
      expect(formatted).toBe('2023-12-31');
    });
  });

  describe('addDays', () => {
    test('should add days to date correctly', () => {
      const date = new Date('2023-01-01');
      const result = addDays(date, 5);
      expect(result.getDate()).toBe(6);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getFullYear()).toBe(2023);
    });

    test('should subtract days when negative number provided', () => {
      const date = new Date('2023-01-15');
      const result = addDays(date, -5);
      expect(result.getDate()).toBe(10);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getFullYear()).toBe(2023);
    });

    test('should handle month boundaries correctly', () => {
      const date = new Date('2023-01-31');
      const result = addDays(date, 1);
      expect(result.getDate()).toBe(1);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getFullYear()).toBe(2023);
    });

    test('should handle year boundaries correctly', () => {
      const date = new Date('2023-12-31');
      const result = addDays(date, 1);
      expect(result.getDate()).toBe(1);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getFullYear()).toBe(2024);
    });

    test('should handle leap years correctly', () => {
      const date = new Date('2024-02-28');
      const result = addDays(date, 1);
      expect(result.getDate()).toBe(29);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getFullYear()).toBe(2024);
    });

    test('should not modify original date', () => {
      const originalDate = new Date('2023-01-01');
      const originalTime = originalDate.getTime();
      
      addDays(originalDate, 5);
      
      expect(originalDate.getTime()).toBe(originalTime);
    });

    test('should handle zero days', () => {
      const date = new Date('2023-01-01');
      const result = addDays(date, 0);
      expect(result.getTime()).toBe(date.getTime());
    });
  });
});