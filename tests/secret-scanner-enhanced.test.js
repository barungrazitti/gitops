/**
 * Secret Scanner Tests - Comprehensive tests for secret and PII detection
 */

const SecretScanner = require('../src/utils/secret-scanner');

describe('SecretScanner', () => {
  let scanner;

  beforeEach(() => {
    scanner = new SecretScanner();
  });

  describe('API Key Detection', () => {
    test('should detect and redact generic API keys', () => {
      const input = 'api_key=sk-1234567890abcdefghijklmno';
      const result = scanner.scanAndRedact(input, false);
      expect(result).toContain('[REDACTED_API_KEY]');
      expect(result).not.toContain('sk-1234567890abcdefghijklmno');
    });

    test('should detect AWS access keys', () => {
      const input = 'AKIA1234567890ABCDEF';
      const result = scanner.scanAndRedact(input, false);
      expect(result).toContain('[REDACTED_AWS_ACCESS_KEY]');
    });

    test('should detect AWS secret keys', () => {
      const input = 'aws_secret_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
      const result = scanner.scanAndRedact(input, false);
      expect(result).toContain('[REDACTED_AWS_SECRET_KEY]');
    });
  });

  describe('PII Detection', () => {
    test('should detect and redact email addresses', () => {
      const input = 'Contact: user@example.com for support';
      const result = scanner.scanAndRedact(input, false);
      expect(result).toContain('[REDACTED_EMAIL]');
      expect(result).not.toContain('user@example.com');
    });

    test('should detect and redact IP addresses', () => {
      const input = 'Server: 192.168.1.1:8080';
      const result = scanner.scanAndRedact(input, false);
      expect(result).toContain('[REDACTED_IP]');
      expect(result).not.toContain('192.168.1.1');
    });

    test('should detect and redact phone numbers', () => {
      const input = 'Phone: +1 (555) 123-4567';
      const result = scanner.scanAndRedact(input, false);
      expect(result).toContain('[REDACTED_PHONE]');
      expect(result).not.toContain('555');
    });

    test('should detect SSN patterns', () => {
      const input = 'SSN: 123-45-6789';
      const result = scanner.scanAndRedact(input, false);
      expect(result).toContain('[REDACTED_SSN]');
      expect(result).not.toContain('123-45-6789');
    });

    test('should detect physical addresses', () => {
      const input = 'Address: 123 Main Street, Springfield';
      const result = scanner.scanAndRedact(input, false);
      expect(result).toContain('[REDACTED_ADDRESS]');
    });
  });

  describe('Token Detection', () => {
    test('should detect JWT tokens', () => {
      const input = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.TEST-TOKEN-NOT-REAL-SKIP-GITHUB-SCAN';
      const result = scanner.scanAndRedact(input, false);
      expect(result).toContain('[REDACTED_JWT]');
    });

    test('should detect GitHub tokens', () => {
      const input = 'ghp_TEST_TOKEN_12345_NOT_REAL_SKIP_SCAN';
      const result = scanner.scanAndRedact(input, false);
      expect(result).toContain('[REDACTED_GITHUB_TOKEN]');
    });

    test('should detect Slack tokens', () => {
      const input = 'xoxb-TEST-TOKEN-NOT-REAL-FOR-TESTING-ONLY-XYZ';
      const result = scanner.scanAndRedact(input, false);
      expect(result).toContain('[REDACTED_SLACK_TOKEN]');
    });
  });

  describe('Code Context Preservation', () => {
    test('should preserve function and class names', () => {
      const input = `
function authenticateUser() {
  const email = 'user@example.com';
  const serverIp = '192.168.1.100';
  return email;
}
class APIHandler {
  constructor() {
    this.endpoint = 'https://api.example.com';
  }
}`;
      const result = scanner.scanAndRedact(input, false);
      expect(result).toContain('authenticateUser');
      expect(result).toContain('APIHandler');
      expect(result).toContain('[REDACTED_EMAIL]');
      expect(result).toContain('[REDACTED_IP]');
      expect(result).toContain('api.example.com'); // Domain should be preserved
    });

    test('should preserve variable names while redacting values', () => {
      const input = 'const apiKey = "sk-1234567890abcdef";';
      const result = scanner.scanAndRedact(input, false);
      expect(result).toContain('apiKey');
      expect(result).toContain('[REDACTED_API_KEY]');
      expect(result).not.toContain('sk-1234567890abcdef');
    });
  });

  describe('Redaction Tracking', () => {
    test('should track what was redacted', () => {
      const input = 'Email: test@example.com, API key: sk-1234567890abcdef';
      scanner.scanAndRedact(input, true);
      const summary = scanner.getRedactionSummary();
      
      expect(summary.found).toBe(true);
      expect(summary.redacted).toBe(2);
      expect(summary.byCategory.pii).toBe(1);
      expect(summary.byCategory.secret).toBe(1);
    });

    test('should return empty summary when nothing redacted', () => {
      const input = 'const foo = "bar";';
      scanner.scanAndRedact(input, true);
      const summary = scanner.getRedactionSummary();
      
      expect(summary.found).toBe(false);
      expect(summary.redacted).toBe(0);
    });

    test('should clear redaction log', () => {
      scanner.scanAndRedact('email: test@example.com', true);
      expect(scanner.getRedactionSummary().found).toBe(true);
      
      scanner.clearRedactionLog();
      expect(scanner.getRedactionSummary().found).toBe(false);
    });
  });

  describe('Safety Check', () => {
    test('should identify content with secrets as unsafe', () => {
      const input = 'password=secret1234567890abcdef';
      const safety = scanner.isSafe(input);
      
      expect(safety.safe).toBe(false);
      expect(safety.detectedCount).toBeGreaterThan(0);
      expect(safety.detected.length).toBeGreaterThan(0);
    });

    test('should identify clean content as safe', () => {
      const input = 'const foo = "bar";';
      const safety = scanner.isSafe(input);
      
      expect(safety.safe).toBe(true);
      expect(safety.detectedCount).toBe(0);
    });
  });

  describe('Real-World Scenarios', () => {
    test('should handle git diff with secrets', () => {
      const diff = `
diff --git a/config.js b/config.js
index 123..456 789
--- a/config.js
+++ b/config.js
@@ -1,5 +1,5 @@
-module.exports = {
-  apiKey: 'sk-1234567890abcdef',
+module.exports = {
+  apiKey: process.env.API_KEY,
   dbUrl: 'mongodb://user:pass123@localhost:27017/mydb',
-  email: 'admin@example.com'
+  email: process.env.ADMIN_EMAIL
 };`;
      
      const result = scanner.scanAndRedact(diff, true);
      const summary = scanner.getRedactionSummary();
      
      expect(result).toContain('[REDACTED_API_KEY]');
      expect(result).toContain('[REDACTED_DATABASE_CONNECTION]');
      expect(result).toContain('[REDACTED_EMAIL]');
      expect(summary.redacted).toBeGreaterThan(0);
    });

    test('should preserve code structure while redacting', () => {
      const code = `
class UserService {
  async login(email, password) {
    const response = await fetch('https://192.168.1.100:8080/auth', {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
      }
    });
    return response.json();
  }
}`;
      
      const result = scanner.scanAndRedact(code, false);
      
      expect(result).toContain('class UserService');
      expect(result).toContain('async login(email, password)');
      expect(result).toContain('[REDACTED_JWT]');
      expect(result).toContain('[REDACTED_IP]');
    });
  });
});
