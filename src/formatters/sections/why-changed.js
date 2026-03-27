/**
 * WhyChangedFormatter - Formats the "why changed" section of commit messages
 *
 * Analyzes commit context and message patterns to detect:
 * - Bug fixes (resolving issues, preventing errors)
 * - Features (new functionality, capabilities)
 * - Refactoring (code improvement, cleanup)
 * - Documentation (docs, comments, guides)
 * - Performance (optimization, caching)
 * - Maintenance (updates, dependencies)
 *
 * Per FMT-02: Explains the motivation and reasoning behind changes
 */

class WhyChangedFormatter {
  constructor() {
    this.motivationPatterns = {
      bugfix: {
        keywords: [
          'fix', 'bug', 'issue', 'error', 'problem', 'broken',
          'crash', 'fail', 'exception', 'throw', 'prevent',
          'resolve', 'correct', 'patch', 'hotfix', 'regression',
          'handle', 'guard', 'catch', 'debug'
        ],
        templates: [
          'Fixes {issue} that caused {symptom}',
          'Resolves {issue} in {component}',
          'Prevents {error} when {condition}',
          'Handles edge case: {condition}'
        ]
      },
      feature: {
        keywords: [
          'add', 'new', 'feature', 'functionality', 'capability',
          'implement', 'create', 'introduce', 'enable', 'support',
          'build', 'develop', 'launch', 'release'
        ],
        templates: [
          'Adds {feature} to {component}',
          'Implements {capability} for {purpose}',
          'Enables {functionality} to {benefit}',
          'Introduces {feature} for {user}'
        ]
      },
      refactor: {
        keywords: [
          'refactor', 'restructure', 'reorganize', 'clean',
          'improve', 'optimize', 'simplify', 'streamline',
          'extract', 'consolidate', 'merge', 'split',
          'rename', 'reorder', 'rearrange', 'modularize'
        ],
        templates: [
          'Refactors {component} for {benefit}',
          'Improves {aspect} by {approach}',
          'Simplifies {code} to {goal}',
          'Reorganizes {structure} for {purpose}'
        ]
      },
      docs: {
        keywords: [
          'doc', 'readme', 'comment', 'documentation',
          'guide', 'tutorial', 'example', 'explanation',
          'describe', 'document', 'annotate'
        ],
        templates: [
          'Documents {feature} for {audience}',
          'Adds {type} to {component}',
          'Improves {aspect} documentation'
        ]
      },
      perf: {
        keywords: [
          'performance', 'optimize', 'speed', 'fast', 'slow',
          'cache', 'lazy', 'memo', 'async', 'parallel',
          'boost', 'accelerate', 'efficient', 'memory'
        ],
        templates: [
          'Optimizes {component} for {metric}',
          'Improves {metric} by {approach}',
          'Reduces {cost} through {technique}'
        ]
      },
      maintenance: {
        keywords: [
          'update', 'upgrade', 'bump', 'version',
          'dependency', 'package', 'npm', 'yarn',
          'maintenance', 'housekeeping', 'chore'
        ],
        templates: [
          'Updates {dependency} to {version}',
          'Upgrades {package} for {reason}',
          'Maintains {component} by {action}'
        ]
      },
      test: {
        keywords: [
          'test', 'spec', 'coverage', 'jest', 'mocha',
          'cypress', 'unit', 'integration', 'e2e',
          'mock', 'fixture', 'assert'
        ],
        templates: [
          'Adds {type} tests for {component}',
          'Improves test coverage for {feature}',
          'Fixes {type} test for {scenario}'
        ]
      },
      security: {
        keywords: [
          'security', 'vulnerability', 'cve', 'sanitize',
          'validate', 'escape', 'encrypt', 'protect',
          'auth', 'permission', 'access', 'token'
        ],
        templates: [
          'Fixes security vulnerability: {issue}',
          'Adds {protection} to {component}',
          'Validates {input} to prevent {attack}'
        ]
      }
    };
  }

  /**
   * Format why changed section from detector context and message
   * @param {Object} context - Detector context with convention info
   * @param {string} message - Original commit message
   * @returns {string} Formatted why-changed section
   */
  format(context, message = '') {
    if (!message) {
      return '';
    }

    const motivation = this._detectMotivation(message, context);
    
    if (!motivation || motivation.type === 'unknown') {
      return this._formatGenericWhy(message);
    }

    return this._formatSpecificWhy(motivation, context);
  }

  /**
   * Detect motivation type from message and context
   * @param {string} message - Commit message
   * @param {Object} context - Detector context
   * @returns {Object} Detected motivation info
   */
  _detectMotivation(message, context) {
    const lowerMessage = message.toLowerCase();
    const scores = {};

    // Score each motivation type
    for (const [type, config] of Object.entries(this.motivationPatterns)) {
      let score = 0;
      
      // Keyword matching
      for (const keyword of config.keywords) {
        if (lowerMessage.includes(keyword)) {
          score += 2;
        }
      }

      // Convention detector context boost
      if (context?.conventions?.commitType) {
        const conventionType = context.conventions.commitType.toLowerCase();
        if (this._matchesConventionType(type, conventionType)) {
          score += 3;
        }
      }

      // File type context boost
      if (context?.files?.types) {
        const fileTypes = context.files.types;
        if (this._matchesFileTypes(type, fileTypes)) {
          score += 2;
        }
      }

      if (score > 0) {
        scores[type] = score;
      }
    }

    // Return highest scoring motivation
    if (Object.keys(scores).length === 0) {
      return { type: 'unknown', confidence: 0 };
    }

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [type, score] = sorted[0];
    
    return {
      type,
      confidence: Math.min(score / 5, 1), // Normalize to 0-1
      alternatives: sorted.slice(1, 3).map(([t, s]) => t)
    };
  }

  /**
   * Format specific why explanation
   * @param {Object} motivation - Detected motivation
   * @param {Object} context - Detector context
   * @returns {string} Formatted why explanation
   */
  _formatSpecificWhy(motivation, context) {
    const { type, confidence } = motivation;
    const config = this.motivationPatterns[type];

    if (!config) {
      return this._formatGenericWhy('');
    }

    // Build explanation from template
    const explanation = this._buildExplanation(type, config, context);

    // Add confidence indicator for low confidence
    const confidenceNote = confidence < 0.5 ? ' (inferred)' : '';

    return `Why${confidenceNote}: ${explanation}`;
  }

  /**
   * Build explanation from motivation config
   * @param {string} type - Motivation type
   * @param {Object} config - Motivation config
   * @param {Object} context - Detector context
   * @returns {string} Built explanation
   */
  _buildExplanation(type, config, context) {
    // Use first template as base
    const template = config.templates[0];

    // Extract placeholders from context
    const placeholders = {
      issue: this._extractIssue(context),
      symptom: this._extractSymptom(context),
      component: this._extractComponent(context),
      feature: this._extractFeature(context),
      purpose: this._extractPurpose(context),
      benefit: this._extractBenefit(context),
      approach: this._extractApproach(context),
      technique: this._extractTechnique(context),
      metric: this._extractMetric(context),
      cost: this._extractCost(context),
      dependency: this._extractDependency(context),
      version: this._extractVersion(context),
      protection: this._extractProtection(context),
      input: this._extractInput(context),
      attack: this._extractAttack(context),
      user: this._extractUser(context),
      functionality: this._extractFunctionality(context),
      code: this._extractCode(context),
      goal: this._extractGoal(context),
      structure: this._extractStructure(context),
      aspect: this._extractAspect(context),
      audience: this._extractAudience(context),
      action: this._extractAction(context),
      reason: this._extractReason(context),
      condition: this._extractCondition(context),
      error: this._extractError(context)
    };

    // Fill template
    let explanation = template;
    for (const [key, value] of Object.entries(placeholders)) {
      explanation = explanation.replace(
        new RegExp(`\\{${key}\\}`, 'g'),
        value || 'related functionality'
      );
    }

    return explanation;
  }

  /**
   * Format generic why when no specific motivation detected
   * @param {string} message - Commit message
   * @returns {string} Generic why explanation
   */
  _formatGenericWhy(message) {
    if (!message) {
      return '';
    }

    // Generic fallback based on common patterns
    if (/(fix|bug|error|issue)/i.test(message)) {
      return 'Why: Addresses an issue or bug in the codebase';
    }
    if (/(add|new|create|implement)/i.test(message)) {
      return 'Why: Introduces new functionality or improvements';
    }
    if (/(update|upgrade|change|modify)/i.test(message)) {
      return 'Why: Updates or modifies existing functionality';
    }

    return 'Why: Improves or maintains the codebase';
  }

  /**
   * Check if motivation type matches convention type
   * @param {string} motivation - Motivation type
   * @param {string} convention - Convention type
   * @returns {boolean} Whether they match
   */
  _matchesConventionType(motivation, convention) {
    const mapping = {
      bugfix: ['fix'],
      feature: ['feat'],
      refactor: ['refactor'],
      docs: ['docs'],
      perf: ['perf'],
      maintenance: ['chore', 'build'],
      test: ['test'],
      security: ['fix', 'feat']
    };

    const matches = mapping[motivation] || [];
    return matches.includes(convention);
  }

  /**
   * Check if motivation matches file types
   * @param {string} motivation - Motivation type
   * @param {Object} fileTypes - File types from context
   * @returns {boolean} Whether they match
   */
  _matchesFileTypes(motivation, fileTypes) {
    const mapping = {
      docs: ['md', 'txt', 'rst'],
      test: ['test.js', 'spec.js', 'test.ts', 'spec.ts'],
      config: ['json', 'yaml', 'yml', 'toml', 'config'],
      style: ['css', 'scss', 'less', 'sass']
    };

    const expectedTypes = mapping[motivation] || [];
    if (expectedTypes.length === 0) return false;

    return Object.keys(fileTypes).some(type =>
      expectedTypes.some(expected => type.includes(expected))
    );
  }

  // ── Extraction helpers ─────────────────────────────────────────────

  _extractIssue(ctx) { return ctx?.conventions?.issue || 'the reported issue'; }
  _extractSymptom(ctx) { return ctx?.conventions?.symptom || 'unexpected behavior'; }
  _extractComponent(ctx) { return ctx?.components?.packages?.[0] || ctx?.files?.scope || 'the component'; }
  _extractFeature(ctx) { return ctx?.conventions?.feature || 'new functionality'; }
  _extractPurpose(ctx) { return ctx?.conventions?.purpose || 'improved functionality'; }
  _extractBenefit(ctx) { return ctx?.conventions?.benefit || 'better maintainability'; }
  _extractApproach(ctx) { return ctx?.conventions?.approach || 'code restructuring'; }
  _extractTechnique(ctx) { return ctx?.conventions?.technique || 'optimization'; }
  _extractMetric(ctx) { return ctx?.conventions?.metric || 'performance'; }
  _extractCost(ctx) { return ctx?.conventions?.cost || 'resource usage'; }
  _extractDependency(ctx) { return ctx?.files?.dependencies?.[0] || 'dependencies'; }
  _extractVersion(ctx) { return ctx?.conventions?.version || 'latest version'; }
  _extractProtection(ctx) { return ctx?.conventions?.protection || 'input validation'; }
  _extractInput(ctx) { return ctx?.conventions?.input || 'user input'; }
  _extractAttack(ctx) { return ctx?.conventions?.attack || 'injection attacks'; }
  _extractUser(ctx) { return ctx?.conventions?.user || 'users'; }
  _extractFunctionality(ctx) { return ctx?.conventions?.functionality || 'the feature'; }
  _extractCode(ctx) { return ctx?.conventions?.code || 'the code'; }
  _extractGoal(ctx) { return ctx?.conventions?.goal || 'improve clarity'; }
  _extractStructure(ctx) { return ctx?.conventions?.structure || 'the codebase'; }
  _extractAspect(ctx) { return ctx?.conventions?.aspect || 'code quality'; }
  _extractAudience(ctx) { return ctx?.conventions?.audience || 'developers'; }
  _extractAction(ctx) { return ctx?.conventions?.action || 'updating dependencies'; }
  _extractReason(ctx) { return ctx?.conventions?.reason || 'security and stability'; }
  _extractCondition(ctx) { return ctx?.conventions?.condition || 'certain conditions'; }
  _extractError(ctx) { return ctx?.conventions?.error || 'errors'; }
}

module.exports = WhyChangedFormatter;
