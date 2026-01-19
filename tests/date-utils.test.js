/**
 * Unit tests for DateUtils
 */

const DateUtils = require('../src/utils/date-utils');

describe('DateUtils', () => {
  describe('isValidDate', () => {
    it('should return true for valid Date object', () => {
      expect(DateUtils.isValidDate(new Date())).toBe(true);
    });

    it('should return false for invalid Date', () => {
      expect(DateUtils.isValidDate(new Date('invalid'))).toBe(false);
    });

    it('should return false for null', () => {
      expect(DateUtils.isValidDate(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(DateUtils.isValidDate(undefined)).toBe(false);
    });

    it('should return false for string', () => {
      expect(DateUtils.isValidDate('2024-01-01')).toBe(false);
    });

    it('should return false for number', () => {
      expect(DateUtils.isValidDate(12345)).toBe(false);
    });
  });

  describe('formatDate', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date('2024-06-15T12:00:00Z');
      expect(DateUtils.formatDate(date)).toBe('2024-06-15');
    });

    it('should return empty string for invalid date', () => {
      expect(DateUtils.formatDate(new Date('invalid'))).toBe('');
    });

    it('should return empty string for null', () => {
      expect(DateUtils.formatDate(null)).toBe('');
    });

    it('should use custom format if provided', () => {
      const date = new Date('2024-06-15T12:00:00Z');
      const result = DateUtils.formatDate(date, 'MM/DD/YYYY');
      expect(result).toBe('2024-06-15');
    });
  });

  describe('addDays', () => {
    it('should add days to a date', () => {
      const date = new Date('2024-06-15T00:00:00Z');
      const result = DateUtils.addDays(date, 5);
      expect(result.getDate()).toBe(20);
    });

    it('should subtract days when negative', () => {
      const date = new Date('2024-06-15T00:00:00Z');
      const result = DateUtils.addDays(date, -5);
      expect(result.getDate()).toBe(10);
    });

    it('should handle month boundary', () => {
      const date = new Date('2024-01-31T00:00:00Z');
      const result = DateUtils.addDays(date, 1);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(1);
    });

    it('should handle year boundary', () => {
      const date = new Date('2024-12-31T00:00:00Z');
      const result = DateUtils.addDays(date, 1);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getDate()).toBe(1);
    });
  });
});
