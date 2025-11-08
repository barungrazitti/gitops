/**
 * Unit tests for Utility Components - Target 90% Coverage
 */

const DateUtils = require('../src/utils/date-utils');
const InputValidator = require('../src/utils/input-validator');
const Validation = require('../src/utils/validation');

describe('Utils - Target 90% Coverage', () => {
  describe('DateUtils', () => {
    let dateUtils;

    beforeEach(() => {
      dateUtils = new DateUtils();
    });

    describe('format', () => {
      it('should format date with default pattern', () => {
        const date = new Date('2023-01-01T12:00:00Z');
        const formatted = dateUtils.format(date);

        expect(formatted).toMatch(/\d{4}-\d{2}-\d{2}/);
      });

      it('should format date with custom pattern', () => {
        const date = new Date('2023-01-01T12:00:00Z');
        const formatted = dateUtils.format(date, 'YYYY/MM/DD');

        expect(formatted).toBe('2023/01/01');
      });

      it('should handle invalid date', () => {
        const formatted = dateUtils.format(new Date('invalid'));

        expect(formatted).toBeDefined();
      });

      it('should handle null date', () => {
        const formatted = dateUtils.format(null);

        expect(formatted).toBeDefined();
      });

      it('should handle undefined date', () => {
        const formatted = dateUtils.format(undefined);

        expect(formatted).toBeDefined();
      });

      it('should format with different locales', () => {
        const date = new Date('2023-01-01T12:00:00Z');
        const formatted = dateUtils.format(date, 'DD/MM/YYYY', 'en-GB');

        expect(formatted).toBe('01/01/2023');
      });

      it('should handle Unicode date patterns', () => {
        const date = new Date('2023-01-01T12:00:00Z');
        const formatted = dateUtils.format(date, 'YYYY年MM月DD日');

        expect(formatted).toContain('2023');
        expect(formatted).toContain('01');
      });
    });

    describe('parse', () => {
      it('should parse standard date string', () => {
        const parsed = dateUtils.parse('2023-01-01');

        expect(parsed).toBeInstanceOf(Date);
        expect(parsed.getFullYear()).toBe(2023);
        expect(parsed.getMonth()).toBe(0);
        expect(parsed.getDate()).toBe(1);
      });

      it('should parse ISO date string', () => {
        const parsed = dateUtils.parse('2023-01-01T12:00:00Z');

        expect(parsed).toBeInstanceOf(Date);
        expect(parsed.getFullYear()).toBe(2023);
      });

      it('should handle invalid date string', () => {
        const parsed = dateUtils.parse('invalid-date');

        expect(parsed).toBeInstanceOf(Date);
        expect(isNaN(parsed.getTime())).toBe(true);
      });

      it('should handle null input', () => {
        const parsed = dateUtils.parse(null);

        expect(parsed).toBeInstanceOf(Date);
      });

      it('should handle undefined input', () => {
        const parsed = dateUtils.parse(undefined);

        expect(parsed).toBeInstanceOf(Date);
      });

      it('should handle empty string', () => {
        const parsed = dateUtils.parse('');

        expect(parsed).toBeInstanceOf(Date);
      });

      it('should parse with custom format', () => {
        const parsed = dateUtils.parse('01/01/2023', 'DD/MM/YYYY');

        expect(parsed.getFullYear()).toBe(2023);
        expect(parsed.getMonth()).toBe(0);
        expect(parsed.getDate()).toBe(1);
      });
    });

    describe('isValid', () => {
      it('should return true for valid date', () => {
        const valid = dateUtils.isValid(new Date('2023-01-01'));

        expect(valid).toBe(true);
      });

      it('should return false for invalid date', () => {
        const invalid = dateUtils.isValid(new Date('invalid'));

        expect(invalid).toBe(false);
      });

      it('should return false for null', () => {
        const invalid = dateUtils.isValid(null);

        expect(invalid).toBe(false);
      });

      it('should return false for undefined', () => {
        const invalid = dateUtils.isValid(undefined);

        expect(invalid).toBe(false);
      });

      it('should return true for current date', () => {
        const current = dateUtils.isValid(new Date());

        expect(current).toBe(true);
      });
    });

    describe('addDays', () => {
      it('should add days to date', () => {
        const date = new Date('2023-01-01');
        const result = dateUtils.addDays(date, 5);

        expect(result.getDate()).toBe(6);
        expect(result.getMonth()).toBe(0);
        expect(result.getFullYear()).toBe(2023);
      });

      it('should handle negative days', () => {
        const date = new Date('2023-01-10');
        const result = dateUtils.addDays(date, -5);

        expect(result.getDate()).toBe(5);
        expect(result.getMonth()).toBe(0);
        expect(result.getFullYear()).toBe(2023);
      });

      it('should handle month rollover', () => {
        const date = new Date('2023-01-28');
        const result = dateUtils.addDays(date, 5);

        expect(result.getDate()).toBe(2);
        expect(result.getMonth()).toBe(1); // February
        expect(result.getFullYear()).toBe(2023);
      });

      it('should handle year rollover', () => {
        const date = new Date('2023-12-31');
        const result = dateUtils.addDays(date, 1);

        expect(result.getDate()).toBe(1);
        expect(result.getMonth()).toBe(0); // January
        expect(result.getFullYear()).toBe(2024);
      });

      it('should handle leap year', () => {
        const date = new Date('2020-02-28');
        const result = dateUtils.addDays(date, 1);

        expect(result.getDate()).toBe(29); // February 29th
        expect(result.getMonth()).toBe(1); // February
        expect(result.getFullYear()).toBe(2020);
      });
    });

    describe('difference', () => {
      it('should calculate difference in days', () => {
        const date1 = new Date('2023-01-01');
        const date2 = new Date('2023-01-06');

        const diff = dateUtils.difference(date1, date2, 'days');

        expect(diff).toBe(5);
      });

      it('should calculate difference in hours', () => {
        const date1 = new Date('2023-01-01T12:00:00Z');
        const date2 = new Date('2023-01-01T18:00:00Z');

        const diff = dateUtils.difference(date1, date2, 'hours');

        expect(diff).toBe(6);
      });

      it('should calculate difference in minutes', () => {
        const date1 = new Date('2023-01-01T12:00:00Z');
        const date2 = new Date('2023-01-01T12:30:00Z');

        const diff = dateUtils.difference(date1, date2, 'minutes');

        expect(diff).toBe(30);
      });

      it('should calculate negative difference', () => {
        const date1 = new Date('2023-01-06');
        const date2 = new Date('2023-01-01');

        const diff = dateUtils.difference(date1, date2, 'days');

        expect(diff).toBe(-5);
      });

      it('should handle null dates', () => {
        const diff = dateUtils.difference(null, new Date(), 'days');

        expect(diff).toBe(0);
      });

      it('should handle unsupported unit', () => {
        const date1 = new Date('2023-01-01');
        const date2 = new Date('2023-01-02');

        const diff = dateUtils.difference(date1, date2, 'weeks');

        expect(diff).toBe(0);
      });
    });

    describe('isBefore', () => {
      it('should return true when date is before', () => {
        const date1 = new Date('2023-01-01');
        const date2 = new Date('2023-01-02');

        const isBefore = dateUtils.isBefore(date1, date2);

        expect(isBefore).toBe(true);
      });

      it('should return false when date is after', () => {
        const date1 = new Date('2023-01-02');
        const date2 = new Date('2023-01-01');

        const isBefore = dateUtils.isBefore(date1, date2);

        expect(isBefore).toBe(false);
      });

      it('should return false when dates are equal', () => {
        const date1 = new Date('2023-01-01');
        const date2 = new Date('2023-01-01');

        const isBefore = dateUtils.isBefore(date1, date2);

        expect(isBefore).toBe(false);
      });
    });

    describe('isAfter', () => {
      it('should return true when date is after', () => {
        const date1 = new Date('2023-01-02');
        const date2 = new Date('2023-01-01');

        const isAfter = dateUtils.isAfter(date1, date2);

        expect(isAfter).toBe(true);
      });

      it('should return false when date is before', () => {
        const date1 = new Date('2023-01-01');
        const date2 = new Date('2023-01-02');

        const isAfter = dateUtils.isAfter(date1, date2);

        expect(isAfter).toBe(false);
      });

      it('should return false when dates are equal', () => {
        const date1 = new Date('2023-01-01');
        const date2 = new Date('2023-01-01');

        const isAfter = dateUtils.isAfter(date1, date2);

        expect(isAfter).toBe(false);
      });
    });
  });

  describe('InputValidator', () => {
    let inputValidator;

    beforeEach(() => {
      inputValidator = new InputValidator();
    });

    describe('validateEmail', () => {
      it('should validate valid email', () => {
        const result = inputValidator.validateEmail('test@example.com');

        expect(result.valid).toBe(true);
      });

      it('should validate email with subdomains', () => {
        const result = inputValidator.validateEmail('test@mail.example.com');

        expect(result.valid).toBe(true);
      });

      it('should reject invalid email format', () => {
        const result = inputValidator.validateEmail('invalid-email');

        expect(result.valid).toBe(false);
      });

      it('should reject email without domain', () => {
        const result = inputValidator.validateEmail('test@');

        expect(result.valid).toBe(false);
      });

      it('should reject email without local part', () => {
        const result = inputValidator.validateEmail('@example.com');

        expect(result.valid).toBe(false);
      });

      it('should reject null email', () => {
        const result = inputValidator.validateEmail(null);

        expect(result.valid).toBe(false);
      });

      it('should reject undefined email', () => {
        const result = inputValidator.validateEmail(undefined);

        expect(result.valid).toBe(false);
      });

      it('should reject empty email', () => {
        const result = inputValidator.validateEmail('');

        expect(result.valid).toBe(false);
      });

      it('should handle Unicode email addresses', () => {
        const result = inputValidator.validateEmail('测试@example.com');

        expect(result.valid).toBe(true);
      });
    });

    describe('validateUrl', () => {
      it('should validate HTTP URL', () => {
        const result = inputValidator.validateUrl('http://example.com');

        expect(result.valid).toBe(true);
      });

      it('should validate HTTPS URL', () => {
        const result = inputValidator.validateUrl('https://example.com');

        expect(result.valid).toBe(true);
      });

      it('should validate URL with port', () => {
        const result = inputValidator.validateUrl('http://example.com:8080');

        expect(result.valid).toBe(true);
      });

      it('should validate URL with path', () => {
        const result = inputValidator.validateUrl('https://example.com/path/to/resource');

        expect(result.valid).toBe(true);
      });

      it('should validate URL with query', () => {
        const result = inputValidator.validateUrl('https://example.com?param=value');

        expect(result.valid).toBe(true);
      });

      it('should reject URL without protocol', () => {
        const result = inputValidator.validateUrl('example.com');

        expect(result.valid).toBe(false);
      });

      it('should reject invalid URL', () => {
        const result = inputValidator.validateUrl('not-a-url');

        expect(result.valid).toBe(false);
      });

      it('should reject null URL', () => {
        const result = inputValidator.validateUrl(null);

        expect(result.valid).toBe(false);
      });

      it('should reject undefined URL', () => {
        const result = inputValidator.validateUrl(undefined);

        expect(result.valid).toBe(false);
      });
    });

    describe('validateRequired', () => {
      it('should accept non-empty string', () => {
        const result = inputValidator.validateRequired('test');

        expect(result.valid).toBe(true);
      });

      it('should reject empty string', () => {
        const result = inputValidator.validateRequired('');

        expect(result.valid).toBe(false);
      });

      it('should reject whitespace-only string', () => {
        const result = inputValidator.validateRequired('   ');

        expect(result.valid).toBe(false);
      });

      it('should accept non-zero number', () => {
        const result = inputValidator.validateRequired(123);

        expect(result.valid).toBe(true);
      });

      it('should reject zero', () => {
        const result = inputValidator.validateRequired(0);

        expect(result.valid).toBe(false);
      });

      it('should accept non-empty array', () => {
        const result = inputValidator.validateRequired(['item']);

        expect(result.valid).toBe(true);
      });

      it('should reject empty array', () => {
        const result = inputValidator.validateRequired([]);

        expect(result.valid).toBe(false);
      });

      it('should accept non-empty object', () => {
        const result = inputValidator.validateRequired({ key: 'value' });

        expect(result.valid).toBe(true);
      });

      it('should reject empty object', () => {
        const result = inputValidator.validateRequired({});

        expect(result.valid).toBe(false);
      });

      it('should reject null', () => {
        const result = inputValidator.validateRequired(null);

        expect(result.valid).toBe(false);
      });

      it('should reject undefined', () => {
        const result = inputValidator.validateRequired(undefined);

        expect(result.valid).toBe(false);
      });
    });

    describe('validateLength', () => {
      it('should accept string with correct length', () => {
        const result = inputValidator.validateLength('test', 3, 5);

        expect(result.valid).toBe(true);
      });

      it('should reject string too short', () => {
        const result = inputValidator.validateLength('t', 3, 5);

        expect(result.valid).toBe(false);
      });

      it('should reject string too long', () => {
        const result = inputValidator.validateLength('toolong', 3, 5);

        expect(result.valid).toBe(false);
      });

      it('should handle minimum only', () => {
        const result = inputValidator.validateLength('test', 3);

        expect(result.valid).toBe(true);
      });

      it('should handle null string', () => {
        const result = inputValidator.validateLength(null, 3, 5);

        expect(result.valid).toBe(false);
      });

      it('should handle undefined string', () => {
        const result = inputValidator.validateLength(undefined, 3, 5);

        expect(result.valid).toBe(false);
      });

      it('should handle Unicode string', () => {
        const result = inputValidator.validateLength('测试', 2, 3);

        expect(result.valid).toBe(true);
      });
    });

    describe('validatePattern', () => {
      it('should accept matching pattern', () => {
        const result = inputValidator.validatePattern('abc123', /^[a-z]+[0-9]+$/);

        expect(result.valid).toBe(true);
      });

      it('should reject non-matching pattern', () => {
        const result = inputValidator.validatePattern('123abc', /^[a-z]+[0-9]+$/);

        expect(result.valid).toBe(false);
      });

      it('should handle null value', () => {
        const result = inputValidator.validatePattern(null, /test/);

        expect(result.valid).toBe(false);
      });

      it('should handle undefined value', () => {
        const result = inputValidator.validatePattern(undefined, /test/);

        expect(result.valid).toBe(false);
      });

      it('should handle null pattern', () => {
        const result = inputValidator.validatePattern('test', null);

        expect(result.valid).toBe(false);
      });

      it('should handle complex regex', () => {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const result = inputValidator.validatePattern('test@example.com', emailRegex);

        expect(result.valid).toBe(true);
      });
    });

    describe('validateNumber', () => {
      it('should accept valid integer', () => {
        const result = inputValidator.validateNumber(123);

        expect(result.valid).toBe(true);
      });

      it('should accept valid float', () => {
        const result = inputValidator.validateNumber(123.45);

        expect(result.valid).toBe(true);
      });

      it('should accept zero', () => {
        const result = inputValidator.validateNumber(0);

        expect(result.valid).toBe(true);
      });

      it('should accept negative number', () => {
        const result = inputValidator.validateNumber(-123);

        expect(result.valid).toBe(true);
      });

      it('should reject non-numeric string', () => {
        const result = inputValidator.validateNumber('abc');

        expect(result.valid).toBe(false);
      });

      it('should accept numeric string', () => {
        const result = inputValidator.validateNumber('123');

        expect(result.valid).toBe(true);
      });

      it('should reject null', () => {
        const result = inputValidator.validateNumber(null);

        expect(result.valid).toBe(false);
      });

      it('should reject undefined', () => {
        const result = inputValidator.validateNumber(undefined);

        expect(result.valid).toBe(false);
      });

      it('should reject NaN', () => {
        const result = inputValidator.validateNumber(NaN);

        expect(result.valid).toBe(false);
      });

      it('should reject Infinity', () => {
        const result = inputValidator.validateNumber(Infinity);

        expect(result.valid).toBe(false);
      });
    });

    describe('validateBoolean', () => {
      it('should accept true', () => {
        const result = inputValidator.validateBoolean(true);

        expect(result.valid).toBe(true);
      });

      it('should accept false', () => {
        const result = inputValidator.validateBoolean(false);

        expect(result.valid).toBe(true);
      });

      it('should accept boolean string true', () => {
        const result = inputValidator.validateBoolean('true');

        expect(result.valid).toBe(true);
      });

      it('should accept boolean string false', () => {
        const result = inputValidator.validateBoolean('false');

        expect(result.valid).toBe(true);
      });

      it('should reject non-boolean string', () => {
        const result = inputValidator.validateBoolean('maybe');

        expect(result.valid).toBe(false);
      });

      it('should reject number 1', () => {
        const result = inputValidator.validateBoolean(1);

        expect(result.valid).toBe(false);
      });

      it('should reject number 0', () => {
        const result = inputValidator.validateBoolean(0);

        expect(result.valid).toBe(false);
      });

      it('should reject null', () => {
        const result = inputValidator.validateBoolean(null);

        expect(result.valid).toBe(false);
      });

      it('should reject undefined', () => {
        const result = inputValidator.validateBoolean(undefined);

        expect(result.valid).toBe(false);
      });
    });

    describe('validateArray', () => {
      it('should accept array', () => {
        const result = inputValidator.validateArray([1, 2, 3]);

        expect(result.valid).toBe(true);
      });

      it('should accept empty array', () => {
        const result = inputValidator.validateArray([]);

        expect(result.valid).toBe(true);
      });

      it('should reject object', () => {
        const result = inputValidator.validateArray({});

        expect(result.valid).toBe(false);
      });

      it('should reject string', () => {
        const result = inputValidator.validateArray('test');

        expect(result.valid).toBe(false);
      });

      it('should reject number', () => {
        const result = inputValidator.validateArray(123);

        expect(result.valid).toBe(false);
      });

      it('should reject null', () => {
        const result = inputValidator.validateArray(null);

        expect(result.valid).toBe(false);
      });

      it('should reject undefined', () => {
        const result = inputValidator.validateArray(undefined);

        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Validation', () => {
    let validation;

    beforeEach(() => {
      validation = new Validation();
    });

    describe('validateCommitMessage', () => {
      it('should accept valid conventional commit', () => {
        const result = validation.validateCommitMessage('feat: add new feature');

        expect(result.valid).toBe(true);
      });

      it('should accept commit with scope', () => {
        const result = validation.validateCommitMessage('fix(auth): resolve login issue');

        expect(result.valid).toBe(true);
      });

      it('should accept commit with breaking change', () => {
        const result = validation.validateCommitMessage('feat!: breaking change');

        expect(result.valid).toBe(true);
      });

      it('should reject empty commit message', () => {
        const result = validation.validateCommitMessage('');

        expect(result.valid).toBe(false);
      });

      it('should reject whitespace-only commit message', () => {
        const result = validation.validateCommitMessage('   ');

        expect(result.valid).toBe(false);
      });

      it('should reject commit without type', () => {
        const result = validation.validateCommitMessage('add new feature');

        expect(result.valid).toBe(false);
      });

      it('should reject commit with invalid type', () => {
        const result = validation.validateCommitMessage('invalid: add feature');

        expect(result.valid).toBe(false);
      });

      it('should reject commit without description', () => {
        const result = validation.validateCommitMessage('feat:');

        expect(result.valid).toBe(false);
      });

      it('should accept Unicode commit message', () => {
        const result = validation.validateCommitMessage('feat: 添加新功能');

        expect(result.valid).toBe(true);
      });

      it('should reject null commit message', () => {
        const result = validation.validateCommitMessage(null);

        expect(result.valid).toBe(false);
      });

      it('should reject undefined commit message', () => {
        const result = validation.validateCommitMessage(undefined);

        expect(result.valid).toBe(false);
      });
    });

    describe('validateBranchName', () => {
      it('should accept valid branch name', () => {
        const result = validation.validateBranchName('feature/new-feature');

        expect(result.valid).toBe(true);
      });

      it('should accept branch with slashes', () => {
        const result = validation.validateBranchName('feature/auth/login');

        expect(result.valid).toBe(true);
      });

      it('should accept branch with numbers', () => {
        const result = validation.validateBranchName('bugfix/issue-123');

        expect(result.valid).toBe(true);
      });

      it('should reject branch starting with dash', () => {
        const result = validation.validateBranchName('-invalid');

        expect(result.valid).toBe(false);
      });

      it('should reject branch ending with dash', () => {
        const result = validation.validateBranchName('invalid-');

        expect(result.valid).toBe(false);
      });

      it('should reject branch with consecutive slashes', () => {
        const result = validation.validateBranchName('feature//branch');

        expect(result.valid).toBe(false);
      });

      it('should reject branch with invalid characters', () => {
        const result = validation.validateBranchName('feature@branch');

        expect(result.valid).toBe(false);
      });

      it('should reject empty branch name', () => {
        const result = validation.validateBranchName('');

        expect(result.valid).toBe(false);
      });

      it('should reject null branch name', () => {
        const result = validation.validateBranchName(null);

        expect(result.valid).toBe(false);
      });

      it('should accept Unicode branch name', () => {
        const result = validation.validateBranchName('feature/测试功能');

        expect(result.valid).toBe(true);
      });
    });

    describe('validateTag', () => {
      it('should accept valid tag', () => {
        const result = validation.validateTag('v1.0.0');

        expect(result.valid).toBe(true);
      });

      it('should accept semantic versioning tag', () => {
        const result = validation.validateTag('v1.2.3-alpha.1');

        expect(result.valid).toBe(true);
      });

      it('should accept tag with prefix', () => {
        const result = validation.validateTag('release-1.0.0');

        expect(result.valid).toBe(true);
      });

      it('should reject tag starting with dash', () => {
        const result = validation.validateTag('-invalid');

        expect(result.valid).toBe(false);
      });

      it('should reject tag with invalid characters', () => {
        const result = validation.validateTag('v1.0.0@invalid');

        expect(result.valid).toBe(false);
      });

      it('should reject empty tag', () => {
        const result = validation.validateTag('');

        expect(result.valid).toBe(false);
      });

      it('should reject null tag', () => {
        const result = validation.validateTag(null);

        expect(result.valid).toBe(false);
      });

      it('should accept Unicode tag', () => {
        const result = validation.validateTag('测试-1.0.0');

        expect(result.valid).toBe(true);
      });
    });

    describe('validateConfig', () => {
      it('should accept valid config object', () => {
        const config = {
          apiKey: 'sk-123456',
          model: 'mixtral-8x7b-32768',
          temperature: 0.7,
          maxTokens: 150
        };

        const result = validation.validateConfig(config);

        expect(result.valid).toBe(true);
      });

      it('should reject missing required fields', () => {
        const config = {
          model: 'mixtral-8x7b-32768'
          // Missing apiKey
        };

        const result = validation.validateConfig(config);

        expect(result.valid).toBe(false);
      });

      it('should reject invalid field types', () => {
        const config = {
          apiKey: 'sk-123456',
          temperature: 'invalid' // Should be number
        };

        const result = validation.validateConfig(config);

        expect(result.valid).toBe(false);
      });

      it('should reject out-of-range values', () => {
        const config = {
          apiKey: 'sk-123456',
          temperature: 2.0 // Should be 0-1
        };

        const result = validation.validateConfig(config);

        expect(result.valid).toBe(false);
      });

      it('should accept nested config objects', () => {
        const config = {
          provider: {
            name: 'groq',
            apiKey: 'sk-123456'
          },
          settings: {
            timeout: 30000,
            retries: 3
          }
        };

        const result = validation.validateConfig(config);

        expect(result.valid).toBe(true);
      });

      it('should reject null config', () => {
        const result = validation.validateConfig(null);

        expect(result.valid).toBe(false);
      });

      it('should reject undefined config', () => {
        const result = validation.validateConfig(undefined);

        expect(result.valid).toBe(false);
      });

      it('should reject non-object config', () => {
        const result = validation.validateConfig('invalid-config');

        expect(result.valid).toBe(false);
      });

      it('should accept empty config object', () => {
        const result = validation.validateConfig({});

        expect(result.valid).toBe(true); // Empty config is valid (uses defaults)
      });
    });

    describe('validateProviderConfig', () => {
      it('should validate Groq config', () => {
        const config = {
          apiKey: 'gsk_123456',
          model: 'llama3-8b-8192'
        };

        const result = validation.validateProviderConfig('groq', config);

        expect(result.valid).toBe(true);
      });

      it('should validate Ollama config', () => {
        const config = {
          url: 'http://localhost:11434',
          model: 'llama2'
        };

        const result = validation.validateProviderConfig('ollama', config);

        expect(result.valid).toBe(true);
      });

      it('should reject missing API key for Groq', () => {
        const config = {
          model: 'llama3-8b-8192'
        };

        const result = validation.validateProviderConfig('groq', config);

        expect(result.valid).toBe(false);
      });

      it('should reject invalid URL for Ollama', () => {
        const config = {
          url: 'invalid-url',
          model: 'llama2'
        };

        const result = validation.validateProviderConfig('ollama', config);

        expect(result.valid).toBe(false);
      });

      it('should handle unknown provider', () => {
        const config = {
          apiKey: '123456'
        };

        const result = validation.validateProviderConfig('unknown', config);

        expect(result.valid).toBe(false);
      });

      it('should accept Unicode config values', () => {
        const config = {
          model: 'llama3-8b-8192',
          customPrompt: '测试提示词'
        };

        const result = validation.validateProviderConfig('groq', config);

        expect(result.valid).toBe(true);
      });
    });
  });
});