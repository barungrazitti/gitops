/**
 * Comprehensive Tests for Input Validator
 */

const InputValidator = require('../src/utils/input-validator');

describe('InputValidator', () => {
  describe('validateCommitMessage', () => {
    test('should validate valid commit message', () => {
      const message = 'feat: add new feature';
      const result = InputValidator.validateCommitMessage(message);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject empty commit message', () => {
      const message = '';
      const result = InputValidator.validateCommitMessage(message);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Commit message cannot be empty');
    });

    test('should reject whitespace-only commit message', () => {
      const message = '   \t\n   ';
      const result = InputValidator.validateCommitMessage(message);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Commit message cannot be empty');
    });

    test('should reject too long commit message', () => {
      const message = 'feat: ' + 'a'.repeat(200); // Very long message
      const result = InputValidator.validateCommitMessage(message);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Commit message is too long (max 200 characters)');
    });

    test('should warn about missing conventional format', () => {
      const message = 'add new feature without conventional format';
      const result = InputValidator.validateCommitMessage(message);

      expect(result.isValid).toBe(true); // Still valid, just warning
      expect(result.warnings).toContain('Consider using conventional commit format (type: description)');
    });
  });

  describe('validateDiff', () => {
    test('should validate valid diff', () => {
      const diff = 'diff --git a/file.js b/file.js\n+ new content\n- old content';
      const result = InputValidator.validateDiff(diff);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject empty diff', () => {
      const diff = '';
      const result = InputValidator.validateDiff(diff);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Diff cannot be empty');
    });

    test('should reject whitespace-only diff', () => {
      const diff = '   \n\n   ';
      const result = InputValidator.validateDiff(diff);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Diff cannot be empty');
    });

    test('should warn about very large diff', () => {
      const largeDiff = 'diff --git a/large.js b/large.js\n' + '+ content\n'.repeat(10000);
      const result = InputValidator.validateDiff(largeDiff);

      expect(result.isValid).toBe(true); // Still valid, just warning
      expect(result.warnings).toContain('Large diff detected, consider chunking for better AI processing');
    });

    test('should detect binary file changes', () => {
      const binaryDiff = 'diff --git a/binary.jpg b/binary.jpg\nBinary files a/binary.jpg and b/binary.jpg differ';
      const result = InputValidator.validateDiff(binaryDiff);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Binary file changes detected, AI may have difficulty processing');
    });
  });

  describe('validateProvider', () => {
    test('should validate supported providers', () => {
      const providers = ['groq', 'ollama'];
      providers.forEach(provider => {
        const result = InputValidator.validateProvider(provider);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });
    });

    test('should reject unsupported provider', () => {
      const provider = 'unsupported-provider';
      const result = InputValidator.validateProvider(provider);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unsupported AI provider');
    });

    test('should reject empty provider', () => {
      const result = InputValidator.validateProvider('');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Provider cannot be empty');
    });
  });

  describe('validateModel', () => {
    test('should validate supported models', () => {
      const models = ['mixtral-8x7b-32768', 'deepseek-coder', 'llama3'];
      models.forEach(model => {
        const result = InputValidator.validateModel(model, 'groq');
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });
    });

    test('should reject empty model', () => {
      const result = InputValidator.validateModel('', 'groq');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Model cannot be empty');
    });

    test('should reject invalid model for provider', () => {
      const result = InputValidator.validateModel('invalid-model', 'groq');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid model for provider');
    });
  });

  describe('validateApiKey', () => {
    test('should validate valid API key', () => {
      const apiKeys = [
        'sk-1234567890abcdef', // Groq format
        'gsk_1234567890abcdef', // Another format
        'test-key-with-length'
      ];
      apiKeys.forEach(apiKey => {
        const result = InputValidator.validateApiKey(apiKey, 'groq');
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });
    });

    test('should reject empty API key', () => {
      const result = InputValidator.validateApiKey('', 'groq');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('API key cannot be empty');
    });

    test('should reject too short API key', () => {
      const result = InputValidator.validateApiKey('short', 'groq');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('API key is too short');
    });

    test('should allow empty API key for Ollama', () => {
      const result = InputValidator.validateApiKey('', 'ollama');

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('validateConfig', () => {
    test('should validate complete valid config', () => {
      const config = {
        provider: 'groq',
        model: 'mixtral-8x7b-32768',
        apiKey: 'sk-1234567890abcdef',
        maxTokens: 4096,
        temperature: 0.7,
        conventionalCommits: true,
        language: 'en'
      };
      const result = InputValidator.validateConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject invalid provider in config', () => {
      const config = {
        provider: 'invalid',
        model: 'mixtral-8x7b-32768',
        apiKey: 'sk-1234567890abcdef'
      };
      const result = InputValidator.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid provider');
    });

    test('should reject missing required fields', () => {
      const config = {};
      const result = InputValidator.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Provider is required');
      expect(result.errors).toContain('Model is required');
    });

    test('should reject invalid temperature', () => {
      const config = {
        provider: 'groq',
        model: 'mixtral-8x7b-32768',
        apiKey: 'sk-1234567890abcdef',
        temperature: 2.0 // Too high
      };
      const result = InputValidator.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Temperature must be between 0 and 1');
    });

    test('should reject invalid maxTokens', () => {
      const config = {
        provider: 'groq',
        model: 'mixtral-8x7b-32768',
        apiKey: 'sk-1234567890abcdef',
        maxTokens: -100 // Negative
      };
      const result = InputValidator.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Max tokens must be positive');
    });
  });

  describe('validateLanguage', () => {
    test('should validate supported languages', () => {
      const languages = ['en', 'es', 'fr', 'de', 'zh', 'ja'];
      languages.forEach(language => {
        const result = InputValidator.validateLanguage(language);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });
    });

    test('should reject unsupported language', () => {
      const result = InputValidator.validateLanguage('invalid');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unsupported language');
    });

    test('should reject empty language', () => {
      const result = InputValidator.validateLanguage('');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Language cannot be empty');
    });
  });

  describe('validateCount', () => {
    test('should validate valid count', () => {
      const counts = [1, 3, 5, 10];
      counts.forEach(count => {
        const result = InputValidator.validateCount(count);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });
    });

    test('should reject zero count', () => {
      const result = InputValidator.validateCount(0);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Count must be at least 1');
    });

    test('should reject negative count', () => {
      const result = InputValidator.validateCount(-5);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Count must be at least 1');
    });

    test('should reject too large count', () => {
      const result = InputValidator.validateCount(50);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Count cannot exceed 20');
    });
  });

  describe('sanitizeInput', () => {
    test('should remove dangerous characters', () => {
      const input = 'test<script>alert("xss")</script>content';
      const result = InputValidator.sanitizeInput(input);

      expect(result).toBe('testalert("xss")content');
    });

    test('should handle null input', () => {
      const result = InputValidator.sanitizeInput(null);

      expect(result).toBe('');
    });

    test('should handle undefined input', () => {
      const result = InputValidator.sanitizeInput(undefined);

      expect(result).toBe('');
    });

    test('should preserve safe characters', () => {
      const input = 'feat: add user-authentication with JWT tokens';
      const result = InputValidator.sanitizeInput(input);

      expect(result).toBe(input);
    });
  });

  describe('isValidUrl', () => {
    test('should validate valid URLs', () => {
      const urls = [
        'https://api.example.com',
        'http://localhost:11434',
        'https://api.groq.com/v1/chat'
      ];
      urls.forEach(url => {
        expect(InputValidator.isValidUrl(url)).toBe(true);
      });
    });

    test('should reject invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://invalid-protocol.com',
        'http://',
        'https://',
        ''
      ];
      invalidUrls.forEach(url => {
        expect(InputValidator.isValidUrl(url)).toBe(false);
      });
    });
  });

  describe('isValidEmail', () => {
    test('should validate valid emails', () => {
      const emails = [
        'user@example.com',
        'test.email+tag@domain.co.uk',
        'user123@test-domain.com'
      ];
      emails.forEach(email => {
        expect(InputValidator.isValidEmail(email)).toBe(true);
      });
    });

    test('should reject invalid emails', () => {
      const invalidEmails = [
        'not-an-email',
        '@domain.com',
        'user@',
        'user..name@domain.com',
        ''
      ];
      invalidEmails.forEach(email => {
        expect(InputValidator.isValidEmail(email)).toBe(false);
      });
    });
  });
});