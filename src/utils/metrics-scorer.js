const EntityExtractor = require('./entity-extractor');

const ALLOWED_TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'chore',
  'ci',
  'build',
];
const CONVENTIONAL_PATTERN = /^(\w+)(?:\(([^)]+)\))?: (.+)$/;

class MetricsScorer {
  constructor() {
    this.entityExtractor = new EntityExtractor();
  }

  calculateSpecificityScore(message, diff) {
    if (!message || !diff) {
      return 0;
    }

    const messageLower = message.toLowerCase();
    const words = messageLower.split(/\s+/).filter((w) => w.length > 2);
    const entities = this.entityExtractor.extractEntities(diff);

    const allEntityNames = [
      ...entities.functions,
      ...entities.classes,
      ...entities.variables,
    ].map((n) => n.toLowerCase());

    if (allEntityNames.length === 0) {
      return 50;
    }

    let matchCount = 0;
    for (const word of words) {
      for (const entityName of allEntityNames) {
        if (entityName.includes(word) || word.includes(entityName)) {
          matchCount++;
          break;
        }
      }
    }

    const overlapPercentage = (matchCount / allEntityNames.length) * 100;
    return Math.min(100, Math.round(overlapPercentage));
  }

  checkConventionalFormat(message) {
    const issues = [];

    if (!message) {
      issues.push('Message is empty');
      return { isConventional: false, issues };
    }

    const firstLine = message.split('\n')[0];
    const match = firstLine.match(CONVENTIONAL_PATTERN);

    if (!match) {
      issues.push(
        'Does not follow conventional format (type(scope): description)'
      );
      return { isConventional: false, issues };
    }

    const [full, type, scope, description] = match;

    if (!ALLOWED_TYPES.includes(type)) {
      issues.push(
        `Invalid type "${type}". Allowed: ${ALLOWED_TYPES.join(', ')}`
      );
    }

    if (description && description.length === 0) {
      issues.push('Description is empty');
    }

    if (description && description.endsWith('.')) {
      issues.push('Description should not end with period');
    }

    return {
      isConventional: issues.length === 0,
      issues,
      parsed: { type, scope, description },
    };
  }

  checkLengthCompliance(message) {
    const issues = [];

    if (!message) {
      issues.push('Message is empty');
      return { isCompliant: false, issues };
    }

    const firstLine = message.split('\n')[0];

    if (firstLine.length > 72) {
      issues.push(`First line exceeds 72 characters (${firstLine.length})`);
    }

    if (firstLine.endsWith('.')) {
      issues.push('First line should not end with period');
    }

    if (!/^[A-Z]/.test(firstLine)) {
      issues.push('Should start with capital letter (imperative mood)');
    }

    if (/\b\w+ing\b/.test(firstLine)) {
      issues.push(
        'Should use imperative mood, not progressive tense (avoid "ing" words)'
      );
    }

    return { isCompliant: issues.length === 0, issues };
  }

  categorizeScore(score) {
    if (score >= 91) {
      return { category: 'Excellent', color: '92' };
    }
    if (score >= 81) {
      return { category: 'Good', color: '32' };
    }
    if (score >= 61) {
      return { category: 'Fair', color: '33' };
    }
    return { category: 'Poor', color: '31' };
  }

  calculateOverallScore(message, diff) {
    const specificity = this.calculateSpecificityScore(message, diff);
    const conventional = this.checkConventionalFormat(message);
    const length = this.checkLengthCompliance(message);

    let score = specificity;

    if (conventional.isConventional) {
      score += 10;
    }
    if (length.isCompliant) {
      score += 10;
    }

    return Math.min(100, score);
  }
}

module.exports = MetricsScorer;
module.exports.ALLOWED_TYPES = ALLOWED_TYPES;
