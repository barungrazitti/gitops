/**
 * Message Formatter - Formats commit messages according to conventions
 */

class MessageFormatter {
  constructor() {
    this.conventionalTypes = [
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
  }

  /**
   * Format commit message according to options
   */
  format(message, options = {}) {
    if (!message || typeof message !== 'string') {
      return message;
    }

    let formatted = message.trim();

    // Apply conventional commit format if requested
    if (options.conventional) {
      formatted = this.applyConventionalFormat(formatted, options);
    }

    // Apply language-specific formatting
    if (options.language && options.language !== 'en') {
      formatted = this.applyLanguageFormatting(formatted, options.language);
    }

    // Apply length constraints
    formatted = this.applyLengthConstraints(formatted);

    // Clean up formatting
    formatted = this.cleanupFormatting(formatted);

    return formatted;
  }

  /**
   * Apply conventional commit format
   */
  applyConventionalFormat(message, options) {
    // If already in conventional format, return as is
    if (this.isConventionalFormat(message)) {
      return message;
    }

    // Extract type from options or infer from message
    const type = options.type || this.inferType(message);
    const scope = options.scope || this.inferScope(message, options.context);

    // Build conventional format
    let conventional = type;
    if (scope) {
      conventional += `(${scope})`;
    }
    conventional += ': ';

    // Clean the message description
    const description = this.cleanDescription(message);
    conventional += description;

    return conventional;
  }

  /**
   * Check if message is already in conventional format
   */
  isConventionalFormat(message) {
    const conventionalPattern = /^(\w+)(\(.+\))?: .+/;
    return conventionalPattern.test(message);
  }

  /**
   * Infer commit type from message content with enhanced patterns
   */
  inferType(message) {
    const lowerMessage = message.toLowerCase();

    // Enhanced type patterns with better specificity
    const typePatterns = {
      feat: [
        /add\s+(new\s+)?(feature|functionality|capability)/,
        /implement|create|introduce|build/,
        /new\s+(feature|function|class|component|endpoint|service)/,
        /enable|support|add\s+support/,
        // WordPress-specific
        /add\s+(plugin|theme|widget|shortcode|hook|filter)/,
        /register\s+(post\s+type|taxonomy|menu|sidebar|widget)/,
        /create\s+(template|page|post|custom\s+post)/,
      ],
      fix: [
        /fix|bug|issue|error|problem|resolve|correct/,
        /broken|crash|fail|exception|throw/,
        /patch|hotfix|regression/,
        /prevent|handle|catch|guard/,
        // WordPress-specific
        /fix\s+(plugin|theme|widget|shortcode)/,
        /resolve\s+(conflict|error|issue)\s+with\s+(plugin|theme)/,
        /debug\s+(wordpress|wp|hook|filter)/,
      ],
      docs: [
        /doc|readme|comment|documentation/,
        /guide|tutorial|example|explanation/,
        /update\s+doc|add\s+doc|improve\s+doc/,
        // WordPress-specific
        /update\s+(readme|changelog|documentation)\s+for\s+(plugin|theme)/,
        /add\s+(inline|php|code)\s+comments/,
        /document\s+(hook|filter|action|function)/,
      ],
      style: [
        /format|style|lint|prettier|whitespace/,
        /indentation|spacing|line\s+ending/,
        /cosmetic|visual|appearance/,
        // WordPress-specific
        /update\s+(css|scss|style)\s+for\s+(theme|plugin)/,
        /improve\s+(design|layout|visual|ui|ux)/,
        /adjust\s+(spacing|color|typography|font)/,
      ],
      refactor: [
        /refactor|restructure|reorganize|clean/,
        /improve|optimize|simplify|streamline/,
        /extract|consolidate|merge|split/,
        /rename|reorder|rearrange/,
        // WordPress-specific
        /refactor\s+(wordpress|wp|hook|filter|function)/,
        /reorganize\s+(theme|plugin)\s+(structure|code)/,
        /optimize\s+(wordpress|database|query)/,
      ],
      perf: [
        /performance|perf|optimize|speed|fast/,
        /cache|lazy|memo|async|parallel/,
        /improve\s+performance|boost|accelerate/,
        // WordPress-specific
        /optimize\s+(wordpress|wp|database|query|performance)/,
        /improve\s+(page\s+load|loading|site\s+speed)/,
        /add\s+(caching|cache)\s+to\s+(plugin|theme)/,
      ],
      test: [
        /test|spec|coverage|jest|mocha|cypress/,
        /unit\s+test|integration\s+test|e2e/,
        /add\s+test|fix\s+test|improve\s+test/,
        // WordPress-specific
        /test\s+(wordpress|plugin|theme|hook|filter)/,
        /add\s+(php|wordpress)\s+tests/,
        /improve\s+(plugin|theme)\s+testing/,
      ],
      chore: [
        /chore|maintenance|update|upgrade|bump/,
        /version|dependency|package|npm|yarn/,
        /cleanup|housekeeping|tidy/,
        // WordPress-specific
        /update\s+(wordpress|wp|plugin|theme)\s+version/,
        /upgrade\s+(wordpress|plugin|theme)/,
        /cleanup\s+(wordpress|wp|database|code)/,
      ],
      ci: [
        /ci|pipeline|workflow|github|gitlab/,
        /action|build|deploy|release/,
        /continuous|integration|delivery/,
      ],
      build: [
        /build|webpack|rollup|babel|compile/,
        /bundle|package|transpile|minify/,
        /script|task|automation/,
        // WordPress-specific
        /build\s+(wordpress|theme|plugin)/,
        /compile\s+(assets|css|js|scss)\s+for\s+(theme|plugin)/,
        /minify\s+(css|js|assets)/,
      ],
    };

    // Score each type based on pattern matches
    const typeScores = {};

    for (const [type, patterns] of Object.entries(typePatterns)) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(lowerMessage)) {
          // Higher score for more specific patterns
          score += pattern.source.length > 20 ? 2 : 1;
        }
      }
      if (score > 0) {
        typeScores[type] = score;
      }
    }

    // Return type with highest score, or default
    if (Object.keys(typeScores).length > 0) {
      return Object.entries(typeScores).sort((a, b) => b[1] - a[1])[0][0];
    }

    // Enhanced fallback logic
    if (/(add|new|create|implement)/.test(lowerMessage)) return 'feat';
    if (/(fix|bug|error|issue)/.test(lowerMessage)) return 'fix';
    if (/(update|upgrade|bump)/.test(lowerMessage)) return 'chore';

    return 'chore';
  }

  /**
   * Infer scope from message and context with enhanced detection
   */
  inferScope(message, context) {
    if (!context || !context.files) {
      return this.inferScopeFromMessage(message);
    }

    // Handle WordPress-specific context
    if (context.files.wordpress && context.files.wordpress.isWordPress) {
      const wpScope = this.inferWordPressScope(
        message,
        context.files.wordpress
      );
      if (wpScope) {
        return wpScope;
      }
    }

    // Use the inferred scope from file analysis with confidence scoring
    const fileScope = context.files.scope;
    if (fileScope && fileScope !== 'general' && fileScope !== 'unknown') {
      // Verify scope matches message content
      const messageScope = this.inferScopeFromMessage(message);
      if (messageScope && messageScope !== fileScope) {
        // If message suggests different scope, use message scope (more specific)
        return messageScope;
      }
      return fileScope;
    }

    // Try to infer from message content
    return this.inferScopeFromMessage(message);
  }

  /**
   * Infer scope from message content only
   */
  inferScopeFromMessage(message) {
    const lowerMessage = message.toLowerCase();

    // Enhanced scope patterns with better specificity
    const scopePatterns = {
      api: [
        /api|endpoint|route|server|handler|controller/,
        /request|response|http|rest|graphql/,
      ],
      ui: [
        /ui|component|interface|frontend|client/,
        /view|page|template|render|jsx|tsx|html/,
      ],
      auth: [
        /auth|login|user|session|security/,
        /jwt|passport|token|password|credential/,
      ],
      db: [
        /database|db|model|schema|migration/,
        /sql|query|repository|dao|entity/,
      ],
      config: [
        /config|setting|env|environment/,
        /constant|variable|parameter|option/,
      ],
      test: [
        /test|spec|mock|fixture|cypress/,
        /jest|mocha|unit|integration|e2e/,
      ],
      utils: [/util|helper|common|shared|lib/, /tool|function|method|utility/],
      deps: [
        /dependency|package|npm|yarn|requirement/,
        /module|import|export|bundle/,
      ],
      perf: [
        /performance|optimize|cache|lazy|memo/,
        /speed|fast|async|parallel|concurrent/,
      ],
      docs: [
        /doc|readme|guide|tutorial|example/,
        /comment|documentation|explanation/,
      ],
      build: [
        /build|webpack|rollup|vite|babel/,
        /compile|transpile|bundle|package/,
      ],
      ci: [
        /ci|pipeline|workflow|github|gitlab/,
        /action|deploy|release|continuous/,
      ],
      types: [
        /type|interface|dto|entity|model/,
        /schema|definition|declaration/,
      ],
    };

    // Score each scope based on pattern matches
    const scopeScores = {};

    for (const [scope, patterns] of Object.entries(scopePatterns)) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(lowerMessage)) {
          score += pattern.source.length > 15 ? 2 : 1;
        }
      }
      if (score > 0) {
        scopeScores[scope] = score;
      }
    }

    // Return scope with highest score
    if (Object.keys(scopeScores).length > 0) {
      return Object.entries(scopeScores).sort((a, b) => b[1] - a[1])[0][0];
    }

    return null;
  }

  /**
   * Infer WordPress-specific scope from context
   */
  inferWordPressScope(message, wordpressContext) {
    const { type, specificPages, plugins, themes, components } =
      wordpressContext;
    const lowerMessage = message.toLowerCase();

    // Priority 1: Specific pages/templates
    if (specificPages.length > 0) {
      for (const page of specificPages) {
        if (lowerMessage.includes(page.toLowerCase())) {
          return page;
        }
      }
      // If no specific match but we have page changes, use the first page
      if (specificPages.length === 1) {
        return specificPages[0];
      }
    }

    // Priority 2: Plugin or theme names
    if (plugins.length > 0) {
      for (const plugin of plugins) {
        if (lowerMessage.includes(plugin.toLowerCase())) {
          return plugin;
        }
      }
      if (plugins.length === 1) {
        return plugins[0];
      }
    }

    if (themes.length > 0) {
      for (const theme of themes) {
        if (lowerMessage.includes(theme.toLowerCase())) {
          return theme;
        }
      }
      if (themes.length === 1) {
        return themes[0];
      }
    }

    // Priority 3: WordPress component types
    if (components.length > 0) {
      const componentScopeMap = {
        'theme-functions': 'functions',
        'theme-styles': 'styles',
        'theme-scripts': 'scripts',
        customizer: 'customizer',
        widgets: 'widgets',
        sidebar: 'sidebar',
        layout: 'layout',
        'content-loop': 'content',
        comments: 'comments',
        woocommerce: 'woocommerce',
      };

      for (const component of components) {
        if (lowerMessage.includes(component.replace('-', ' '))) {
          return componentScopeMap[component] || component;
        }
      }

      // If single component, use it
      if (components.length === 1) {
        return componentScopeMap[components[0]] || components[0];
      }
    }

    // Priority 4: WordPress type (plugin/theme/core)
    if (type) {
      const typeScopeMap = {
        plugin: 'plugin',
        theme: 'theme',
        core: 'wordpress-core',
      };
      return typeScopeMap[type];
    }

    // Priority 5: General WordPress
    return 'wordpress';
  }

  /**
   * Clean message description
   */
  cleanDescription(message) {
    let description = message.trim();

    // Remove common prefixes
    const prefixes = [
      /^(add|added|adds)\s+/i,
      /^(fix|fixed|fixes)\s+/i,
      /^(update|updated|updates)\s+/i,
      /^(remove|removed|removes)\s+/i,
      /^(implement|implemented|implements)\s+/i,
    ];

    for (const prefix of prefixes) {
      description = description.replace(prefix, '');
    }

    // Ensure first letter is lowercase (conventional commit style)
    if (description.length > 0) {
      description = description.charAt(0).toLowerCase() + description.slice(1);
    }

    // Remove trailing periods
    description = description.replace(/\.$/, '');

    return description;
  }

  /**
   * Apply language-specific formatting
   */
  applyLanguageFormatting(message, _language) {
    // For now, just return the message as-is
    // In the future, this could handle language-specific conventions
    return message;
  }

  /**
   * Apply length constraints
   */
  applyLengthConstraints(message) {
    const lines = message.split('\n');
    const title = lines[0];
    const body = lines.slice(1).join('\n').trim();

    // Limit title to 72 characters but be smarter about truncation
    let formattedTitle = title;
    if (title.length > 72) {
      // Try to truncate at word boundaries
      const truncated = title.substring(0, 72);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > 40) {
        // Only truncate at space if we have enough content
        formattedTitle = truncated.substring(0, lastSpace);
      } else {
        formattedTitle = truncated;
      }
    }

    // If there's a body, add it back
    if (body) {
      return formattedTitle + '\n\n' + body;
    }

    return formattedTitle;
  }

  /**
   * Clean up formatting issues
   */
  cleanupFormatting(message) {
    return message
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Multiple newlines to double newline
      .trim();
  }

  /**
   * Format message with template
   */
  formatWithTemplate(data, template) {
    const { type, scope, description, body } = data;

    return template
      .replace('{type}', type || '')
      .replace('{scope}', scope || '')
      .replace('{description}', description || '')
      .replace('{body}', body || '')
      .replace(/\(\)/g, '') // Remove empty parentheses
      .replace(/\s+/g, ' ') // Clean up spaces
      .trim();
  }

  /**
   * Parse conventional commit message
   */
  parseConventionalCommit(message) {
    const match = message.match(/^(\w+)(\(([^)]+)\))?: (.+)$/);

    if (!match) {
      return {
        type: null,
        scope: null,
        description: message,
        body: null,
      };
    }

    const [, type, , scope, description] = match;
    const lines = message.split('\n');
    const body = lines.slice(1).join('\n').trim() || null;

    return {
      type,
      scope: scope || null,
      description,
      body,
    };
  }

  /**
   * Validate commit message format
   */
  validate(message, options = {}) {
    const errors = [];
    const warnings = [];

    if (!message || typeof message !== 'string') {
      errors.push('Message is required');
      return { valid: false, errors, warnings };
    }

    const trimmed = message.trim();

    // Length validation
    const lines = trimmed.split('\n');
    const title = lines[0];

    if (title.length === 0) {
      errors.push('Title cannot be empty');
    } else if (title.length > 72) {
      warnings.push('Title should be 72 characters or less');
    }

    // Conventional commit validation
    if (options.conventional) {
      const parsed = this.parseConventionalCommit(title);

      if (!parsed.type) {
        errors.push(
          'Conventional commit format required: type(scope): description'
        );
      } else if (!this.conventionalTypes.includes(parsed.type)) {
        warnings.push(`Unknown commit type: ${parsed.type}`);
      }
    }

    // General formatting validation
    if (title.endsWith('.')) {
      warnings.push('Title should not end with a period');
    }

    if (
      title.charAt(0) === title.charAt(0).toUpperCase() &&
      !options.conventional
    ) {
      warnings.push('Title should start with lowercase letter');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get formatting suggestions
   */
  getSuggestions(message, options = {}) {
    const suggestions = [];
    const validation = this.validate(message, options);

    if (validation.warnings.length > 0) {
      suggestions.push(...validation.warnings.map((w) => `Consider: ${w}`));
    }

    // Suggest conventional format if not used
    if (options.conventional && !this.isConventionalFormat(message)) {
      const formatted = this.applyConventionalFormat(message, options);
      suggestions.push(`Conventional format: ${formatted}`);
    }

    return suggestions;
  }

  /**
   * Validate if response is a valid commit message (not explanatory text)
   */
  isValidCommitMessage(message) {
    if (!message || typeof message !== 'string') {
      return false;
    }

    const trimmed = message.trim();
    
    // Reject empty messages
    if (trimmed.length === 0) {
      return false;
    }

    // Reject obviously non-commit messages
    const invalidPatterns = [
      // Explanatory phrases
      /^(here's|here is|this is|the following|below is|above is)/i,
      /^(a|an|the)\s+\w+\s+(commit|message|change|update)/i,
      /^(breakdown|explanation|description|summary|overview)/i,
      /^(what|how|why|when|where)\s+(does|do|is|are|was|were)/i,
      // Generic educational phrases
      /^(this code|the code|javascript code|php code|python code)/i,
      /^(has been|have been|was|were)\s+(modularized|refactored|updated|changed)/i,
      // Questions and incomplete thoughts
      /\?$/,
      /^(here's|here is|this is)\s+(a|the)\s+breakdown/i,
      // Non-imperative explanations
      /^(the|this)\s+(code|function|method|class)/i,
      // Generic template responses
      /^generate\s+\d+\s+(commit|conventional)/i,
      // Colon-ended explanations (like the problematic examples)
      /:$/,
      // Very long single sentences (likely explanations)
      /^.{100,}$/,
    ];

    // Check if message matches any invalid pattern
    for (const pattern of invalidPatterns) {
      if (pattern.test(trimmed)) {
        return false;
      }
    }

    // Check for minimum commit message characteristics
    const validPatterns = [
      // Conventional commit format
      /^(\w+)(\(.+\))?: .+/,
      // Imperative mood (Add, Fix, Remove, etc.)
      /^(add|fix|remove|update|create|delete|implement|refactor|optimize|improve|enhance|modify|adjust|correct|prevent|handle|resolve|merge|split|extract|consolidate|rename|reorder|revert|bump|upgrade|downgrade|disable|enable|migrate|convert|transform|simplify|streamline|standardize|normalize|validate|verify|test|document|format|lint|clean|cleanup|prepare|restore|backup|archive|deploy|release|publish|distribute|install|uninstall|configure|setup|initialize|reset|clear|empty|flush|refresh|reload|rebuild|recompile|retest|reverify|revalidate|recheck|review|audit|analyze|monitor|track|log|debug|trace|profile|benchmark|measure|calculate|compute|process|handle|manage|control|coordinate|synchronize|automate|schedule|queue|prioritize|organize|structure|restructure|reorganize|rearrange|reposition|relocate|move|copy|clone|duplicate|replicate|mirror|sync|align|center|justify|indent|outdent|wrap|unwrap|fold|unfold|expand|collapse|show|hide|display|reveal|conceal|mask|filter|sort|search|find|locate|identify|detect|recognize|classify|categorize|group|ungroup|merge|split|divide|separate|combine|join|connect|disconnect|link|unlink|attach|detach|bind|unbind|map|unmap|assign|unassign|allocate|deallocate|reserve|release|lock|unlock|secure|unsecure|protect|unprotect|encrypt|decrypt|encode|decode|compress|decompress|zip|unzip|pack|unpack|load|unload|import|export|transfer|transmit|receive|send|deliver|distribute|route|redirect|forward|backward|rewind|fast|slow|pause|resume|start|stop|begin|end|finish|complete|incomplete|partial|full|total|overall|final|initial|first|last|next|previous|current|old|new|latest|recent|past|future|temporary|permanent|fixed|variable|static|dynamic|public|private|protected|internal|external|global|local|universal|specific|general|common|rare|unique|standard|custom|default|alternative|optional|required|mandatory|optional|extra|additional|missing|removed|added|changed|modified|updated|upgraded|downgraded|improved|degraded|enhanced|reduced|increased|optimized|deoptimized)s+/i,
      // Simple descriptive messages
      /^\w+\s+\w+.*\w+(s|ed|ing)?\s+\w+/,
    ];

    // Check if message looks like a commit message
    let isValid = false;
    for (const pattern of validPatterns) {
      if (pattern.test(trimmed)) {
        isValid = true;
        break;
      }
    }

    // Additional heuristic: should contain action words and be reasonably concise
    if (!isValid) {
      const words = trimmed.toLowerCase().split(/\s+/);
      const actionWords = [
        'add', 'fix', 'remove', 'update', 'create', 'delete', 'implement', 
        'refactor', 'optimize', 'improve', 'enhance', 'modify', 'adjust', 
        'correct', 'prevent', 'handle', 'resolve', 'merge', 'split', 
        'extract', 'consolidate', 'rename', 'reorder', 'revert', 'bump', 
        'upgrade', 'disable', 'enable', 'migrate', 'convert', 'transform'
      ];
      
      const hasActionWord = words.some(word => actionWords.includes(word));
      const reasonableLength = trimmed.length >= 10 && trimmed.length <= 200;
      
      isValid = hasActionWord && reasonableLength;
    }

    return isValid;
  }

  /**
   * Get detailed validation result for commit message
   */
  getCommitMessageValidation(message) {
    const result = {
      isValid: false,
      isExplanatory: false,
      isGeneric: false,
      issues: [],
      suggestions: []
    };

    if (!message || typeof message !== 'string') {
      result.issues.push('Message is required and must be a string');
      return result;
    }

    const trimmed = message.trim();
    
    // Check for explanatory patterns
    const explanatoryPatterns = [
      /^(here's|here is|this is|the following|below is|above is)/i,
      /^(breakdown|explanation|description|summary|overview)/i,
      /^(what|how|why|when|where)\s+(does|do|is|are|was|were)/i,
      /^(this code|the code|javascript code|php code|python code)/i,
      /^(here's|here is|this is)\s+(a|the)\s+breakdown/i,
    ];

    for (const pattern of explanatoryPatterns) {
      if (pattern.test(trimmed)) {
        result.isExplanatory = true;
        result.issues.push('Message appears to be explanatory text, not a commit message');
        break;
      }
    }

    // Check for generic patterns
    const genericPatterns = [
      /^(has been|have been|was|were)\s+(modularized|refactored|updated|changed)/i,
      /^(the|this)\s+(code|function|method|class)/i,
      /:$/,
      /^.{100,}$/, // Very long single sentences
    ];

    for (const pattern of genericPatterns) {
      if (pattern.test(trimmed)) {
        result.isGeneric = true;
        result.issues.push('Message is too generic or incomplete');
        break;
      }
    }

    // Final validation
    result.isValid = this.isValidCommitMessage(message);

    if (!result.isValid) {
      result.suggestions.push('Use imperative mood: "Add feature" instead of "Added feature"');
      result.suggestions.push('Be specific about what changed: "fix(auth): resolve login timeout"');
      result.suggestions.push('Keep it concise and focused on the change');
    }

    return result;
  }

  /**
   * Calculate relevance score for commit message (0-100)
   */
  calculateRelevanceScore(message) {
    let score = 50; // Base score

    const trimmed = message.toLowerCase().trim();

    // Bonus for conventional format
    if (/^\w+\(\w+\):/.test(message)) {
      score += 15;
    }

    // Bonus for clear action words
    const actionWords = ['add', 'fix', 'remove', 'update', 'improve', 'enhance', 'optimize', 'refactor'];
    if (actionWords.some(word => trimmed.includes(word))) {
      score += 10;
    }

    // Bonus for specific scope
    if (/\((auth|api|ui|db|config|theme|plugin|utils|test)\)/.test(message)) {
      score += 10;
    }

    // Penalty for vague terms
    const vagueTerms = ['update', 'change', 'modify', 'improve'];
    const vagueCount = vagueTerms.filter(term => trimmed.includes(term)).length;
    score -= vagueCount * 5;

    // Penalty for overly technical
    const technicalTerms = ['function', 'signature', 'logic', 'handler', 'implementation'];
    const technicalCount = technicalTerms.filter(term => trimmed.includes(term)).length;
    score -= technicalCount * 3;

    // Penalty for file-specific scopes
    if (/\.js:|\.php:|\.css:|\.html:/.test(message)) {
      score -= 10;
    }

    // Penalty for generic plugin/theme updates
    if (/^(plugin|theme|elementor)\s+(update|upgrade)/.test(trimmed)) {
      score -= 15;
    }

    // Bonus for business value indicators
    const businessTerms = ['user', 'customer', 'security', 'performance', 'feature', 'experience'];
    if (businessTerms.some(term => trimmed.includes(term))) {
      score += 8;
    }

    // Ensure score is within bounds
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get improved commit message suggestions based on context
   */
  getImprovedMessageSuggestions(originalMessage, context = {}) {
    const suggestions = [];
    const validation = this.getCommitMessageValidation(originalMessage);

    if (validation.relevanceScore > 70) {
      return suggestions; // Already good enough
    }

    // Analyze original message to understand intent
    const lowerMessage = originalMessage.toLowerCase();

    // Handle generic plugin/theme updates
    if (/^(plugin|theme|elementor)\s+(update|upgrade)/.test(lowerMessage)) {
      if (context.files?.wordpress?.plugins?.length > 0) {
        const plugin = context.files.wordpress.plugins[0];
        suggestions.push(`chore(${plugin}): update to latest version`);
      } else if (context.files?.wordpress?.themes?.length > 0) {
        const theme = context.files.wordpress.themes[0];
        suggestions.push(`chore(${theme}): update theme files`);
      }
    }

    // Handle generic DB updates
    if (/db\s+(creds?|credentials?|config)\s+update/i.test(lowerMessage)) {
      suggestions.push('config(database): update connection credentials');
      suggestions.push('chore(security): rotate database credentials');
    }

    // Handle overly technical messages
    if (validation.isTooTechnical) {
      if (lowerMessage.includes('placeholder')) {
        suggestions.push('feat(forms): add dynamic placeholder text for better UX');
      }
      if (lowerMessage.includes('sticky')) {
        suggestions.push('feat(ui): implement sticky sidebar for better navigation');
      }
      if (lowerMessage.includes('cookie')) {
        suggestions.push('feat(privacy): implement cookie consent banner');
      }
    }

    // Handle vague style updates
    if (/^style:\s+(update|fix|change)\s+styles?$/i.test(lowerMessage)) {
      suggestions.push('style(ui): improve component styling and layout');
      if (context.files?.fileTypes?.css > 0) {
        suggestions.push('style(css): optimize responsive design and spacing');
      }
    }

    return suggestions;
  }
}

module.exports = MessageFormatter;
