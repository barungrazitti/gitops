const MetricsScorer = require('../src/utils/metrics-scorer');

describe('MetricsScorer', () => {
  let scorer;

  beforeEach(() => {
    scorer = new MetricsScorer();
  });

  describe('calculateSpecificityScore', () => {
    test('returns high score when message entities match diff entities', () => {
      const message = 'fix(auth): resolve validateToken error';
      const diff = '+ function validateToken() { return true; }';
      const score = scorer.calculateSpecificityScore(message, diff);
      expect(score).toBeGreaterThanOrEqual(50);
    });

    test('returns low score for generic message with no entity overlap', () => {
      const message = 'fix: update file';
      const diff = '+ function calculateTotal() {}';
      const score = scorer.calculateSpecificityScore(message, diff);
      expect(score).toBeLessThan(50);
    });

    test('returns 0 for empty message or diff', () => {
      expect(scorer.calculateSpecificityScore('', '+ const x = 1')).toBe(0);
      expect(scorer.calculateSpecificityScore('fix: bug', '')).toBe(0);
      expect(scorer.calculateSpecificityScore(null, null)).toBe(0);
    });

    test('returns score between 0 and 100', () => {
      const message = 'feat: add new feature';
      const diff = '+ function newFeature() {}';
      const score = scorer.calculateSpecificityScore(message, diff);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('checkConventionalFormat', () => {
    test('valid message returns isConventional true', () => {
      const result = scorer.checkConventionalFormat('feat(api): add endpoint');
      expect(result.isConventional).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('invalid type returns isConventional false', () => {
      const result = scorer.checkConventionalFormat(
        'invalid(scope): description'
      );
      expect(result.isConventional).toBe(false);
      expect(result.issues[0]).toContain('Invalid type "invalid"');
    });

    test('missing format returns isConventional false', () => {
      const result = scorer.checkConventionalFormat('Just a message');
      expect(result.isConventional).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test('empty message returns isConventional false', () => {
      const result = scorer.checkConventionalFormat('');
      expect(result.isConventional).toBe(false);
      expect(result.issues).toContain('Message is empty');
    });
  });

  describe('checkLengthCompliance', () => {
    test('compliant message returns isCompliant true', () => {
      const result = scorer.checkLengthCompliance('Add user authentication');
      expect(result.isCompliant).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('message over 72 chars returns isCompliant false', () => {
      const longMessage = 'A'.repeat(73);
      const result = scorer.checkLengthCompliance(longMessage);
      expect(result.isCompliant).toBe(false);
      expect(result.issues.some((i) => i.includes('72'))).toBe(true);
    });

    test('message ending with period returns isCompliant false', () => {
      const result = scorer.checkLengthCompliance('Add feature.');
      expect(result.isCompliant).toBe(false);
      expect(result.issues.some((i) => i.includes('period'))).toBe(true);
    });

    test('lowercase start returns isCompliant false', () => {
      const result = scorer.checkLengthCompliance('add feature');
      expect(result.isCompliant).toBe(false);
      expect(result.issues.some((i) => i.includes('capital'))).toBe(true);
    });

    test('progressive tense returns isCompliant false', () => {
      const result = scorer.checkLengthCompliance('Adding feature');
      expect(result.isCompliant).toBe(false);
      expect(result.issues.some((i) => i.includes('ing'))).toBe(true);
    });
  });

  describe('categorizeScore', () => {
    test('91-100 returns Excellent', () => {
      expect(scorer.categorizeScore(95)).toEqual({
        category: 'Excellent',
        color: '92',
      });
    });

    test('81-90 returns Good', () => {
      expect(scorer.categorizeScore(85)).toEqual({
        category: 'Good',
        color: '32',
      });
    });

    test('61-80 returns Fair', () => {
      expect(scorer.categorizeScore(70)).toEqual({
        category: 'Fair',
        color: '33',
      });
    });

    test('0-60 returns Poor', () => {
      expect(scorer.categorizeScore(50)).toEqual({
        category: 'Poor',
        color: '31',
      });
    });
  });

  describe('calculateOverallScore', () => {
    test('good message returns high score', () => {
      const message = 'feat(api): add user endpoint';
      const diff = '+ function addUser() {}';
      const score = scorer.calculateOverallScore(message, diff);
      expect(score).toBeGreaterThanOrEqual(60);
    });

    test('returns score between 0 and 100', () => {
      const message = 'bad message';
      const diff = '+ const x = 1';
      const score = scorer.calculateOverallScore(message, diff);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});
