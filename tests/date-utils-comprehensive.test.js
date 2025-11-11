/**
 * Comprehensive Tests for Date Utils
 */

const DateUtils = require('../src/utils/date-utils');

describe('DateUtils', () => {
  describe('formatDate', () => {
    test('should format date to YYYY-MM-DD', () => {
      const date = new Date('2023-12-25T10:30:00Z');
      const result = DateUtils.formatDate(date);

      expect(result).toBe('2023-12-25');
    });

    test('should format current date when no date provided', () => {
      const today = new Date();
      const expected = today.toISOString().split('T')[0];
      const result = DateUtils.formatDate();

      expect(result).toBe(expected);
    });

    test('should handle string date input', () => {
      const result = DateUtils.formatDate('2023-12-25T10:30:00Z');
      expect(result).toBe('2023-12-25');
    });

    test('should handle invalid date', () => {
      const result = DateUtils.formatDate('invalid');
      expect(result).toBe('Invalid Date');
    });
  });

  describe('formatDateTime', () => {
    test('should format date to YYYY-MM-DD HH:mm:ss', () => {
      const date = new Date('2023-12-25T10:30:45Z');
      const result = DateUtils.formatDateTime(date);

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    test('should format current datetime when no date provided', () => {
      const result = DateUtils.formatDateTime();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
  });

  describe('getTimeAgo', () => {
    test('should format seconds ago', () => {
      const now = Date.now();
      const date = new Date(now - 30 * 1000); // 30 seconds ago
      const result = DateUtils.getTimeAgo(date);

      expect(result).toBe('30 seconds ago');
    });

    test('should format minutes ago', () => {
      const now = Date.now();
      const date = new Date(now - 5 * 60 * 1000); // 5 minutes ago
      const result = DateUtils.getTimeAgo(date);

      expect(result).toBe('5 minutes ago');
    });

    test('should format hours ago', () => {
      const now = Date.now();
      const date = new Date(now - 2 * 60 * 60 * 1000); // 2 hours ago
      const result = DateUtils.getTimeAgo(date);

      expect(result).toBe('2 hours ago');
    });

    test('should format days ago', () => {
      const now = Date.now();
      const date = new Date(now - 3 * 24 * 60 * 60 * 1000); // 3 days ago
      const result = DateUtils.getTimeAgo(date);

      expect(result).toBe('3 days ago');
    });

    test('should format weeks ago', () => {
      const now = Date.now();
      const date = new Date(now - 2 * 7 * 24 * 60 * 60 * 1000); // 2 weeks ago
      const result = DateUtils.getTimeAgo(date);

      expect(result).toBe('2 weeks ago');
    });

    test('should format months ago', () => {
      const now = Date.now();
      const date = new Date(now - 2 * 30 * 24 * 60 * 60 * 1000); // ~2 months ago
      const result = DateUtils.getTimeAgo(date);

      expect(result).toBe('2 months ago');
    });

    test('should format years ago', () => {
      const now = Date.now();
      const date = new Date(now - 2 * 365 * 24 * 60 * 60 * 1000); // ~2 years ago
      const result = DateUtils.getTimeAgo(date);

      expect(result).toBe('2 years ago');
    });

    test('should handle singular forms', () => {
      const now = Date.now();
      const date = new Date(now - 1 * 60 * 1000); // 1 minute ago
      const result = DateUtils.getTimeAgo(date);

      expect(result).toBe('1 minute ago');
    });

    test('should handle future dates', () => {
      const now = Date.now();
      const date = new Date(now + 5 * 60 * 1000); // 5 minutes in future
      const result = DateUtils.getTimeAgo(date);

      expect(result).toBe('in 5 minutes');
    });
  });

  describe('isToday', () => {
    test('should return true for today', () => {
      const today = new Date();
      const result = DateUtils.isToday(today);

      expect(result).toBe(true);
    });

    test('should return false for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const result = DateUtils.isToday(yesterday);

      expect(result).toBe(false);
    });

    test('should return false for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const result = DateUtils.isToday(tomorrow);

      expect(result).toBe(false);
    });
  });

  describe('isYesterday', () => {
    test('should return true for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const result = DateUtils.isYesterday(yesterday);

      expect(result).toBe(true);
    });

    test('should return false for today', () => {
      const today = new Date();
      const result = DateUtils.isYesterday(today);

      expect(result).toBe(false);
    });

    test('should return false for two days ago', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const result = DateUtils.isYesterday(twoDaysAgo);

      expect(result).toBe(false);
    });
  });

  describe('getStartOfDay', () => {
    test('should return start of day', () => {
      const date = new Date('2023-12-25T15:30:45Z');
      const result = DateUtils.getStartOfDay(date);

      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    test('should return start of today when no date provided', () => {
      const result = DateUtils.getStartOfDay();

      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });
  });

  describe('getEndOfDay', () => {
    test('should return end of day', () => {
      const date = new Date('2023-12-25T15:30:45Z');
      const result = DateUtils.getEndOfDay(date);

      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
    });

    test('should return end of today when no date provided', () => {
      const result = DateUtils.getEndOfDay();

      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
    });
  });

  describe('addDays', () => {
    test('should add days to date', () => {
      const date = new Date('2023-12-25T10:30:00Z');
      const result = DateUtils.addDays(date, 5);

      expect(result.getDate()).toBe(30);
      expect(result.getMonth()).toBe(11); // December
      expect(result.getFullYear()).toBe(2023);
    });

    test('should subtract days when negative', () => {
      const date = new Date('2023-12-25T10:30:00Z');
      const result = DateUtils.addDays(date, -5);

      expect(result.getDate()).toBe(20);
      expect(result.getMonth()).toBe(11); // December
      expect(result.getFullYear()).toBe(2023);
    });

    test('should handle month overflow', () => {
      const date = new Date('2023-12-28T10:30:00Z');
      const result = DateUtils.addDays(date, 5);

      expect(result.getDate()).toBe(2);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getFullYear()).toBe(2024);
    });
  });

  describe('getDaysBetween', () => {
    test('should calculate days between dates', () => {
      const start = new Date('2023-12-25T10:30:00Z');
      const end = new Date('2023-12-30T10:30:00Z');
      const result = DateUtils.getDaysBetween(start, end);

      expect(result).toBe(5);
    });

    test('should handle same day', () => {
      const start = new Date('2023-12-25T10:30:00Z');
      const end = new Date('2023-12-25T15:30:00Z');
      const result = DateUtils.getDaysBetween(start, end);

      expect(result).toBe(0);
    });

    test('should handle negative days', () => {
      const start = new Date('2023-12-30T10:30:00Z');
      const end = new Date('2023-12-25T10:30:00Z');
      const result = DateUtils.getDaysBetween(start, end);

      expect(result).toBe(-5);
    });
  });

  describe('isValidDate', () => {
    test('should validate valid date', () => {
      expect(DateUtils.isValidDate(new Date())).toBe(true);
      expect(DateUtils.isValidDate('2023-12-25')).toBe(true);
      expect(DateUtils.isValidDate('2023-12-25T10:30:00Z')).toBe(true);
    });

    test('should reject invalid date', () => {
      expect(DateUtils.isValidDate('invalid')).toBe(false);
      expect(DateUtils.isValidDate('2023-13-45')).toBe(false);
      expect(DateUtils.isValidDate(null)).toBe(false);
      expect(DateUtils.isValidDate(undefined)).toBe(false);
    });
  });

  describe('parseDate', () => {
    test('should parse ISO date string', () => {
      const result = DateUtils.parseDate('2023-12-25T10:30:00Z');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2023);
      expect(result.getMonth()).toBe(11);
      expect(result.getDate()).toBe(25);
    });

    test('should parse date string', () => {
      const result = DateUtils.parseDate('2023-12-25');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2023);
      expect(result.getMonth()).toBe(11);
      expect(result.getDate()).toBe(25);
    });

    test('should return null for invalid date', () => {
      const result = DateUtils.parseDate('invalid-date');
      expect(result).toBeNull();
    });
  });
});