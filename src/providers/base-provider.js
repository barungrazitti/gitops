/**
 * Base AI Provider - Abstract class for all AI providers
 */

const ConfigManager = require('../core/config-manager');

class BaseProvider {
  constructor() {
    this.configManager = new ConfigManager();
    this.name = 'base';
  }

  /**
   * Generate commit messages - must be implemented by subclasses
   */
  async generateCommitMessages(diff, _options = {}) {
    throw new Error('generateCommitMessages must be implemented by subclass');
  }

  /**
   * Generate AI response for general prompts - must be implemented by subclasses
   */
  async generateResponse(prompt, _options = {}) {
    throw new Error('generateResponse must be implemented by subclass');
  }

  /**
   * Validate provider configuration
   */
  async validate(_config) {
    throw new Error('validate must be implemented by subclass');
  }

  /**
   * Preprocess diff to make it more AI-friendly while preserving context
   */
  preprocessDiff(diff) {
    // Check if diff is too large to process efficiently
    if (diff.length > 500000) {
      // 500KB limit
      return (
        diff.substring(0, 10000) +
        '\n... (diff too large, truncated for processing)'
      );
    }

    // Remove binary file indicators
    let processed = diff.replace(
      /^Binary files? .* differ$/gm,
      '[Binary file modified]'
    );

    // Split into lines for intelligent processing
    const lines = processed.split('\n');
    const processedLines = [];
    const importantLines = [];
    const contextLines = [];
    const functionSignatures = [];

    // First pass: identify important patterns
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Always keep diff headers
      if (
        line.startsWith('diff --git') ||
        line.startsWith('index ') ||
        line.startsWith('---') ||
        line.startsWith('+++') ||
        line.startsWith('@@')
      ) {
        processedLines.push(line);
        continue;
      }

      // Keep added/removed lines
      if (line.startsWith('+') || line.startsWith('-')) {
        if (!this.isTrivialChange(line)) {
          importantLines.push(line);

          // Extract function signatures from changes
          const trimmedLine = line.substring(1).trim();
          if (trimmedLine.match(/^(function|class|def|const|let|var)\s+\w+/)) {
            functionSignatures.push(trimmedLine);
          }
        }
        continue;
      }

      // Keep context lines that contain important patterns
      if (this.isImportantContext(line)) {
        contextLines.push(line);
      }
    }

    // Combine lines intelligently
    processedLines.push(...importantLines);

    // Add context lines with priority
    if (contextLines.length > 0) {
      const maxContextLines = 30;
      const prioritizedContext = this.prioritizeContextLines(
        contextLines,
        functionSignatures
      );
      processedLines.push(
        ...prioritizedContext
          .slice(0, maxContextLines)
          .map((line) => ' ' + line)
      );
    }

    // Limit total size while preserving important content
    const maxLines = 250; // Increased limit for better context
    if (processedLines.length > maxLines) {
      const headers = processedLines.filter(
        (line) =>
          line.startsWith('diff --git') ||
          line.startsWith('index ') ||
          line.startsWith('---') ||
          line.startsWith('+++') ||
          line.startsWith('@@')
      );

      const changes = processedLines.filter(
        (line) => line.startsWith('+') || line.startsWith('-')
      );

      const context = processedLines.filter(
        (line) =>
          !line.startsWith('diff --git') &&
          !line.startsWith('index ') &&
          !line.startsWith('---') &&
          !line.startsWith('+++') &&
          !line.startsWith('@@') &&
          !line.startsWith('+') &&
          !line.startsWith('-')
      );

      const finalLines = [
        ...headers,
        ...changes.slice(0, maxLines - headers.length - 20),
        ...context.slice(0, 20),
      ];

      processed = finalLines.join('\n') + '\n... (diff truncated)';
    } else {
      processed = processedLines.join('\n');
    }

    // Handle very long lines more intelligently
    processed = processed.replace(/^.{300,}$/gm, (match) => {
      if (match.includes('import') || match.includes('require')) {
        return match.substring(0, 150) + '... [import statement truncated]';
      }
      if (match.includes('function') || match.includes('class')) {
        return match.substring(0, 180) + '... [function/class truncated]';
      }
      return '[Long line truncated]';
    });

    return processed;
  }

  /**
   * Check if a context line is important
   */
  isImportantContext(line) {
    if (!line.trim() || line.startsWith(' ')) return false;

    const importantPatterns = [
      /function\s+\w+/,
      /class\s+\w+/,
      /def\s+\w+/,
      /interface\s+\w+/,
      /type\s+\w+/,
      /const\s+\w+\s*=/,
      /let\s+\w+\s*=/,
      /var\s+\w+\s*=/,
      /import\s+.*from/,
      /require\s*\(/,
      /export\s+/,
      /module\.exports/,
      /app\.(get|post|put|delete|patch)/,
      /router\.(get|post|put|delete|patch)/,
      /add_action|add_filter/, // WordPress
      /@.*\(/, // Decorators
    ];

    return importantPatterns.some((pattern) => pattern.test(line));
  }

  /**
   * Prioritize context lines based on relevance to function signatures
   */
  prioritizeContextLines(contextLines, functionSignatures) {
    if (functionSignatures.length === 0) return contextLines;

    const prioritized = [];
    const remaining = [...contextLines];

    // Prioritize lines that are near function signatures
    for (const signature of functionSignatures) {
      const functionName = signature.match(/\w+/)?.[0];
      if (!functionName) continue;

      for (let i = 0; i < remaining.length; i++) {
        const line = remaining[i];
        if (line.includes(functionName) && line !== signature) {
          prioritized.push(line);
          remaining.splice(i, 1);
          break;
        }
      }
    }

    // Add remaining lines
    prioritized.push(...remaining);
    return prioritized;
  }

  /**
   * Check if a change is trivial and can be ignored
   */
  isTrivialChange(line) {
    const content = line.substring(1).trim(); // Remove + or - prefix

    // Ignore whitespace-only changes
    if (!content) return true;

    // Ignore common trivial changes
    const trivialPatterns = [
      /^\s*$/, // empty lines
      /^\s*\/\/\s*$/, // empty comments
      /^\s*\*\s*$/, // empty docstring lines
      /^\s*}\s*$/, // closing braces
      /^\s*{\s*$/, // opening braces
      /^\s*;\s*$/, // semicolons
      /^\s*\/\/ TODO.*$/, // TODO comments
      /^\s*\/\/ FIXME.*$/, // FIXME comments
      /^\s*console\.log\(['"]test['"].*\)\s*;?\s*$/, // test console logs
      /^\s*debugger;?\s*$/, // debugger statements
    ];

    return trivialPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Build enhanced prompt for commit message generation
   */
  buildPrompt(diff, options = {}) {
    const {
      context,
      conventional,
      chunkIndex,
      totalChunks,
      isLastChunk,
      chunkContext,
    } = options;
    const diffAnalysis = this.analyzeDiffContent(diff);

    if (!options.count) {
      options.count = 3;
    }

    let prompt = `You are an expert software developer specializing in writing precise, meaningful commit messages. Analyze the following git diff and generate ${options.count || 3} highly relevant commit messages.

CRITICAL REQUIREMENTS:
 - Be EXTREMELY SPECIFIC about what changed (use actual function/class names)
 - Focus on the PRIMARY PURPOSE of the changes
 - Use active voice and imperative mood (e.g., "Add ShoppingCart class" not "Added functionality")
 - Keep titles under 72 characters but be descriptive
 - AVOID generic terms like "functionality", "features", "updates"
 - Use specific technical terms from the code
 - Each message should be UNIQUE and highlight different aspects`;

    // Add chunking context if applicable
    if (totalChunks && totalChunks > 1) {
      prompt += `

CHUNKING CONTEXT:
- This is chunk ${chunkIndex + 1} of ${totalChunks}
- Position: ${chunkContext} chunk
- Focus on the changes in this specific chunk
- Generate messages that accurately represent this portion of changes`;

      if (isLastChunk) {
        prompt += `
- This is the final chunk - consider the overall impact`;
      }
    }

    if (conventional) {
      prompt += `

CONVENTIONAL COMMIT FORMAT:
- Use format: type(scope): description
- Types: feat (new feature), fix (bug fix), docs (documentation), style (formatting), 
  refactor (code restructuring), perf (performance), test (testing), chore (maintenance),
  ci (CI/CD), build (build system)
- Scope should be specific: api, ui, auth, db, config, utils, test, etc.
- Description should be concise and in lowercase`;
    }

    // Enhanced repository context with semantic information
    if (context) {
      prompt += `

REPOSITORY CONTEXT:`;

      if (context.patterns) {
        const commonTypes = context.patterns.mostUsedTypes
          ? context.patterns.mostUsedTypes.map(([type]) => type).join(', ')
          : 'none detected';
        const commonScopes = context.patterns.mostUsedScopes
          ? context.patterns.mostUsedScopes.map(([scope]) => scope).join(', ')
          : 'none detected';

        prompt += `
- Preferred format: ${context.patterns.preferredFormat || 'freeform'}
- Common types: ${commonTypes}
- Common scopes: ${commonScopes}`;
      }

      if (context.files) {
        const fileTypes = context.files.fileTypes || {};
        const changedTypes =
          Object.entries(fileTypes)
            .filter(([_, count]) => count > 0)
            .map(([type, count]) => `${type}(${count})`)
            .join(', ') || 'none';

        prompt += `
- File types changed: ${changedTypes}
- Inferred scope: ${context.files.scope || 'general'}
- Changes: +${context.files.changes?.insertions || 0} -${context.files.changes?.deletions || 0}`;
      }

      // Add semantic context
      if (context.files.semantic) {
        const semantic = context.files.semantic;
        const semanticInfo = [];

        if (semantic.functions && semantic.functions.length > 0) {
          semanticInfo.push(
            `Functions: ${semantic.functions.slice(0, 5).join(', ')}`
          );
        }
        if (semantic.classes && semantic.classes.length > 0) {
          semanticInfo.push(
            `Classes: ${semantic.classes.slice(0, 5).join(', ')}`
          );
        }
        if (semantic.components && semantic.components.length > 0) {
          semanticInfo.push(
            `Components: ${semantic.components.slice(0, 5).join(', ')}`
          );
        }
        if (semantic.endpoints && semantic.endpoints.length > 0) {
          semanticInfo.push(
            `Endpoints: ${semantic.endpoints.slice(0, 3).join(', ')}`
          );
        }
        if (semantic.wordpress_hooks && semantic.wordpress_hooks.length > 0) {
          semanticInfo.push(
            `WordPress hooks: ${semantic.wordpress_hooks.slice(0, 3).join(', ')}`
          );
        }

        if (semanticInfo.length > 0) {
          prompt += `
- Semantic context: ${semanticInfo.join('; ')}`;
        }
      }

      if (context.project) {
        prompt += `
- Project type: ${context.project.primary || 'unknown'}`;
      }
    }

    // Diff analysis insights
    if (diffAnalysis.hasInsights) {
      prompt += `

DIFF ANALYSIS:`;
      if (diffAnalysis.keyChanges.length > 0) {
        prompt += `
- Key changes detected: ${diffAnalysis.keyChanges.join(', ')}`;
      }
      if (diffAnalysis.likelyPurpose) {
        prompt += `
- Likely purpose: ${diffAnalysis.likelyPurpose}`;
      }
      if (diffAnalysis.affectedAreas.length > 0) {
        prompt += `
- Affected areas: ${diffAnalysis.affectedAreas.join(', ')}`;
      }
    }

    prompt += `
    
GIT DIFF:
\`\`\`diff
${this.preprocessDiff(diff)}
\`\`\`

EXAMPLES OF GOOD MESSAGES:
- "feat(auth): add JWT token validation middleware"
- "fix(database): resolve null pointer in User.findById"
- "refactor(utils): extract password hashing into separate function"

Generate ${options.count || 3} commit messages that accurately reflect the specific changes and their purpose. Each message should be on a separate line with no numbering or bullets:`;

    return prompt;
  }

  /**
   * Analyze diff content for better context
   */
  analyzeDiffContent(diff) {
    const analysis = {
      hasInsights: false,
      keyChanges: [],
      likelyPurpose: null,
      affectedAreas: [],
      semanticChanges: {
        newFunctions: [],
        modifiedFunctions: [],
        newClasses: [],
        newComponents: [],
        apiChanges: [],
        databaseChanges: [],
        configChanges: [],
      },
    };

    const lines = diff.split('\n');
    const addedLines = lines.filter((line) => line.startsWith('+')).join('\n');
    const removedLines = lines
      .filter((line) => line.startsWith('-'))
      .join('\n');

    // Enhanced semantic change detection
    const semanticPatterns = {
      newFunctions:
        /^\+.*(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>|(\w+)\s*:\s*\([^)]*\)\s*=>)/gm,
      newClasses: /^\+.*class\s+(\w+)/gm,
      newComponents:
        /^\+.*(?:function\s+(\w+)\s*\([^)]*\)\s*\{|const\s+(\w+)\s*=\s*(?:React\.)?(?:forwardRef\s*\()?\([^)]*\)\s*=>\s*{)/gm,
      apiChanges:
        /^\+.*(?:app\.(get|post|put|delete|patch)|router\.(get|post|put|delete|patch))\s*\(\s*['"]([^'"]+)['"]/gm,
      databaseChanges:
        /^\+.*(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\s+(TABLE|INDEX|DATABASE)/gm,
      configChanges: /^\+.*(?:process\.env|config\.|\.env|ENV\[)/gm,
    };

    // Extract semantic changes
    for (const [changeType, pattern] of Object.entries(semanticPatterns)) {
      let match;
      while ((match = pattern.exec(diff)) !== null) {
        if (
          changeType === 'newFunctions' ||
          changeType === 'newClasses' ||
          changeType === 'newComponents'
        ) {
          const name = match[1] || match[2] || match[3];
          if (name) analysis.semanticChanges[changeType].push(name);
        } else if (changeType === 'apiChanges') {
          const method = match[1];
          const endpoint = match[2];
          analysis.semanticChanges[changeType].push(
            `${method.toUpperCase()} ${endpoint}`
          );
        } else if (changeType === 'configChanges') {
          analysis.semanticChanges[changeType].push(
            match[0].substring(1).trim()
          );
        } else {
          analysis.semanticChanges[changeType].push(
            match[0].substring(1).trim()
          );
        }
      }
    }

    // Enhanced area patterns
    const patterns = {
      authentication: /auth|login|user|session|jwt|passport|password|token/i,
      'api endpoints':
        /api|endpoint|route|controller|handler|service|express|router/i,
      database:
        /database|db|model|schema|migration|sql|query|sequelize|mongoose|prisma/i,
      'ui components':
        /component|view|template|render|jsx|tsx|html|react|vue|angular/i,
      configuration: /config|env|setting|constant|environment|dotenv/i,
      testing:
        /test|spec|mock|fixture|describe|it\(|expect|jest|mocha|cypress/i,
      dependencies: /package|npm|yarn|require|import|dependency|node_modules/i,
      'error handling': /error|exception|try|catch|throw|validation|sanitize/i,
      performance: /performance|optimize|cache|lazy|memo|async|await|promise/i,
      security: /security|sanitize|validate|escape|encrypt|hash|bcrypt|crypto/i,
      wordpress: /wordpress|wp-|add_action|add_filter|wp_enqueue|wp_localize/i,
      typescript: /interface|type\s+\w+|enum|namespace|declare/i,
    };

    for (const [area, pattern] of Object.entries(patterns)) {
      if (pattern.test(diff)) {
        analysis.affectedAreas.push(area);
      }
    }

    // Enhanced likely purpose detection
    const purposeDetection = [
      {
        patterns: [/authentication|login|user|session|jwt/i],
        purpose: 'authentication/security enhancement',
      },
      {
        patterns: [/api.*endpoint|route.*controller|handler/i],
        purpose: 'API functionality change',
      },
      {
        patterns: [/database.*schema|migration.*table|model.*change/i],
        purpose: 'database schema or query modification',
      },
      {
        patterns: [/component.*render|template.*update|ui.*change/i],
        purpose: 'user interface update',
      },
      {
        patterns: [/test.*coverage|spec.*add|mock.*create/i],
        purpose: 'test coverage or test logic change',
      },
      {
        patterns: [/wordpress.*hook|wp.*filter|add_action/i],
        purpose: 'WordPress hook or filter modification',
      },
      {
        patterns: [/typescript.*interface|type.*definition/i],
        purpose: 'TypeScript type system update',
      },
    ];

    for (const { patterns, purpose } of purposeDetection) {
      if (patterns.some((p) => p.test(diff))) {
        analysis.likelyPurpose = purpose;
        break;
      }
    }

    // Detect key changes with semantic context
    if (analysis.semanticChanges.newFunctions.length > 0) {
      analysis.keyChanges.push(
        `new functions: ${analysis.semanticChanges.newFunctions.slice(0, 3).join(', ')}`
      );
    }
    if (analysis.semanticChanges.newClasses.length > 0) {
      analysis.keyChanges.push(
        `new classes: ${analysis.semanticChanges.newClasses.slice(0, 3).join(', ')}`
      );
    }
    if (analysis.semanticChanges.apiChanges.length > 0) {
      analysis.keyChanges.push(
        `API changes: ${analysis.semanticChanges.apiChanges.slice(0, 3).join(', ')}`
      );
    }
    if (analysis.semanticChanges.configChanges.length > 0) {
      analysis.keyChanges.push('configuration updates');
    }

    // Traditional detection
    if (
      /function|class|const|let|var/.test(addedLines) &&
      !/function|class|const|let|var/.test(removedLines)
    ) {
      if (!analysis.keyChanges.some((k) => k.includes('new functions'))) {
        analysis.keyChanges.push('new functions/classes added');
      }
    }
    if (/export|module\.exports/.test(addedLines)) {
      if (!analysis.keyChanges.some((k) => k.includes('export'))) {
        analysis.keyChanges.push('new exports added');
      }
    }

    analysis.hasInsights = [
      analysis.affectedAreas.length > 0,
      analysis.likelyPurpose !== null,
      analysis.keyChanges.length > 0,
      Object.values(analysis.semanticChanges).some(
        (changes) => changes.length > 0
      ),
    ].some(Boolean);

    return analysis;
  }

  /**
   * Get language name from code
   */
  getLanguageName(code) {
    const languages = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      zh: 'Chinese',
      ja: 'Japanese',
    };
    return languages[code] || 'English';
  }

  /**
   * Handle API errors consistently
   */
  handleError(error, providerName) {
    // Log the original error for debugging
    console.warn(`Original error from ${providerName}:`, error);

    if (error.response) {
      // HTTP error response
      const status = error.response.status;
      const message =
        error.response.data?.error?.message || error.response.statusText;

      switch (status) {
        case 401:
          throw new Error(
            `Authentication failed for ${providerName}. Please check your API key.`
          );
        case 403:
          throw new Error(
            `Access forbidden for ${providerName}. Please check your permissions.`
          );
        case 429:
          throw new Error(
            `Rate limit exceeded for ${providerName}. Please try again later.`
          );
        case 500:
        case 502:
        case 503:
        case 504:
          throw new Error(
            `${providerName} service is temporarily unavailable. Please try again later.`
          );
        default:
          throw new Error(`${providerName} API error (${status}): ${message}`);
      }
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error(
        `Cannot connect to ${providerName}. Please check your internet connection.`
      );
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error(
        `Request to ${providerName} timed out. Please try again.`
      );
    } else {
      // Handle undefined error message safely
      const errorMessage = error?.message || 'Unknown error occurred';
      throw new Error(`${providerName} error: ${errorMessage}`);
    }
  }

  /**
   * Parse AI response into commit messages
   */
  parseResponse(response) {
    if (typeof response !== 'string') {
      throw new Error('Invalid response from AI provider');
    }

    // Split by lines and clean up
    const messages = response
      .split('\n')
      .map(
        (line) =>
          line
            .trim()
            .replace(/^\d+\.?\s*/, '') // Strip numbering
            .replace(/^- \s*/, '') // Strip dashes
            .replace(/^\* \s*/, '') // Strip asterisks
      )
      .filter((line) => line.length > 0)
      .slice(0, 3); // Limit to 3 messages max

    if (messages.length === 0) {
      throw new Error('No valid commit messages found in AI response');
    }

    return messages;
  }

  /**
   * Retry logic for API calls
   */
  async withRetry(fn, maxRetries = 3, delay = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Do not retry on client-side errors (e.g., 401, 403)
        const status = error.response?.status;
        if (status && status >= 400 && status < 500) {
          throw error;
        }

        if (attempt < maxRetries) {
          // Use exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, delay * Math.pow(2, attempt - 1))
          );
        }
      }
    }
    throw lastError;
  }

  /**
   * Validate commit message format
   */
  validateCommitMessage(message) {
    if (!message || typeof message !== 'string') {
      return false;
    }

    const trimmed = message.trim();

    // Basic validation
    if (trimmed.length < 10 || trimmed.length > 200) {
      return false;
    }

    // Should not contain newlines in title
    if (trimmed.includes('\n') && trimmed.indexOf('\n') < 50) {
      return false;
    }

    // Should not start with special characters
    if (/^[^\w]/.test(trimmed)) {
      return false;
    }

    return true;
  }

  /**
   * Get provider-specific configuration
   */
  async getConfig() {
    try {
      const config = await this.configManager.getProviderConfig(this.name);
      return config || {};
    } catch (error) {
      console.warn(`Failed to get config for ${this.name}:`, error.message);
      return {};
    }
  }
}

module.exports = BaseProvider;
