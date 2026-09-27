/**
 * Unit tests for SecretScanner
 */

describe('SecretScanner', () => {
  let SecretScanner;
  let scanner;

  beforeEach(() => {
    jest.resetModules();
    SecretScanner = require('../src/utils/secret-scanner');
    scanner = new SecretScanner();
  });

  describe('constructor', () => {
    it('should initialize secret patterns', () => {
      expect(scanner.secretPatterns).toBeDefined();
      expect(Array.isArray(scanner.secretPatterns)).toBe(true);
      expect(scanner.secretPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('scanAndRedact', () => {
    it('should return non-string values unchanged', () => {
      expect(scanner.scanAndRedact(null)).toBeNull();
      expect(scanner.scanAndRedact(123)).toBe(123);
    });

    it('should redact API keys', () => {
      const content = 'api_key = "sk-1234567890abcdefghijklmnop"';
      const result = scanner.scanAndRedact(content);
      expect(result).not.toContain('sk-1234567890');
    });

    it('should redact AWS access keys', () => {
      const content = 'AKIAIOSFODNN7EXAMPLE';
      const result = scanner.scanAndRedact(content);
      expect(result).not.toContain('AKIAIOSFODNN7');
    });

    it('should redact database connection strings', () => {
      const content = 'mongodb://user:password@localhost:27017/mydb';
      const result = scanner.scanAndRedact(content);
      expect(result).toContain('[USER]');
      expect(result).toContain('[PASSWORD]');
    });

    it('should redact passwords in URLs', () => {
      const content = 'https://user:secret@example.com/api';
      const result = scanner.scanAndRedact(content);
      expect(result).toContain('[USER]:[PASSWORD]');
    });

    it('should handle empty string', () => {
      const result = scanner.scanAndRedact('');
      expect(result).toBe('');
    });
  });

  describe('scanner gap fixes', () => {
    it('redacts a PEM private key where every line carries a diff + prefix', () => {
      const content = [
        '+-----BEGIN RSA PRIVATE KEY-----',
        '+MIIEowIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF6PZF1pG',
        '+-----END RSA PRIVATE KEY-----',
      ].join('\n');
      const result = scanner.scanAndRedact(content);
      expect(result).toContain('[REDACTED_SSH_PRIVATE_KEY]');
      expect(result).not.toContain('MIIEowIBAAKCAQEA');
    });

    it('redacts AWS secret access keys under the full label', () => {
      const content = `+AWS_SECRET_ACCESS_KEY=${'A'.repeat(40)}`;
      const result = scanner.scanAndRedact(content);
      expect(result).not.toContain('A'.repeat(40));
      expect(result).toContain('[REDACTED_AWS_SECRET_KEY]');
    });

    it('redacts GitHub fine-grained personal access tokens', () => {
      const content = `github_pat_${'a'.repeat(60)}`;
      const result = scanner.scanAndRedact(content);
      expect(result).not.toContain('github_pat_');
      expect(result).toContain('[REDACTED_GITHUB_TOKEN]');
    });

    it('redacts GitHub OAuth tokens (gho_)', () => {
      const content = `gho_${'a'.repeat(36)}`;
      const result = scanner.scanAndRedact(content);
      expect(result).not.toContain('gho_');
      expect(result).toContain('[REDACTED_GITHUB_TOKEN]');
    });

    it('redacts GitLab personal access tokens', () => {
      const content = `glpat-${'x'.repeat(20)}`;
      const result = scanner.scanAndRedact(content);
      expect(result).not.toContain('glpat-');
      expect(result).toContain('[REDACTED_GITLAB_TOKEN]');
    });

    it('redacts SendGrid API keys', () => {
      const content = `SG.${'a'.repeat(20)}.${'b'.repeat(20)}`;
      const result = scanner.scanAndRedact(content);
      expect(result).not.toContain('SG.');
      expect(result).toContain('[REDACTED_SENDGRID_TOKEN]');
    });

    it('redacts npm access tokens', () => {
      const content = `npm_${'a'.repeat(36)}`;
      const result = scanner.scanAndRedact(content);
      expect(result).not.toContain('npm_');
      expect(result).toContain('[REDACTED_NPM_TOKEN]');
    });

    it('redacts Stripe live keys', () => {
      const content = `rk_live_${'a'.repeat(24)}`;
      const result = scanner.scanAndRedact(content);
      expect(result).not.toContain('rk_live_');
      expect(result).toContain('[REDACTED_STRIPE_TOKEN]');
    });

    it('redacts Twilio API key SIDs', () => {
      const content = `SK${'a'.repeat(32)}`;
      const result = scanner.scanAndRedact(content);
      expect(result).not.toContain(`SK${'a'.repeat(32)}`);
      expect(result).toContain('[REDACTED_TWILIO_TOKEN]');
    });
  });
});
