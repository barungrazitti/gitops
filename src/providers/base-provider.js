/**
 * Base AI Provider - Abstract class for all AI providers
 */

const ConfigManager = require('../core/config-manager');
const fs = require('fs');
const path = require('path');

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
   * Preprocess diff to make it more AI-friendly while preserving full context
   */
  preprocessDiff(diff) {
    // Remove binary file indicators but keep everything else
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

      // Keep ALL added/removed lines (no more filtering)
      if (line.startsWith('+') || line.startsWith('-')) {
        importantLines.push(line);

        // Extract function signatures from changes
        const trimmedLine = line.substring(1).trim();
        if (trimmedLine.match(/^(function|class|def|const|let|var)\s+\w+/)) {
          functionSignatures.push(trimmedLine);
        }
        continue;
      }

      // Keep ALL context lines (no more filtering)
      contextLines.push(line);
    }

    // Combine lines to preserve full context
    processedLines.push(...importantLines);
    processedLines.push(...contextLines.map((line) => ' ' + line));

    // Only limit if extremely large (preserve much more content)
    const maxLines = 1000; // Increased from 250 to 1000
    if (processedLines.length > maxLines) {
      // Prioritize keeping headers and changes, limit context
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

      // Keep all headers, all changes, and as much context as possible
      const finalLines = [
        ...headers,
        ...changes,
        ...context.slice(0, maxLines - headers.length - changes.length),
      ];

      processed = finalLines.join('\n') + '\n... (diff truncated for size)';
    } else {
      processed = processedLines.join('\n');
    }

    // Handle very long lines more intelligently
    processed = processed.replace(/^.{500,}$/gm, (match) => {
      if (match.includes('import') || match.includes('require')) {
        return match.substring(0, 200) + '... [import statement truncated]';
      }
      if (match.includes('function') || match.includes('class')) {
        return match.substring(0, 250) + '... [function/class truncated]';
      }
      return '[Long line truncated]';
    });

    return processed;
  }

  /**
   * Check if a context line is important (disabled - keeping all context)
   */
  isImportantContext(line) {
    // Always return true to keep all context lines
    return line.trim().length > 0;
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
   * Check if a change is trivial (only filter out truly empty changes)
   */
  isTrivialChange(line) {
    const content = line.substring(1).trim(); // Remove + or - prefix

    // Only ignore truly empty changes
    if (!content) return true;

    // Keep everything else - no more aggressive filtering
    return false;
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

    // Simplified prompt generation for better focus
    let prompt = `You are an expert software developer. Analyze git diff and generate exactly ${options.count || 3} precise, relevant commit messages.

REQUIREMENTS:
- Be SPECIFIC about what actually changed (use exact function/class names)
- Focus on PRIMARY purpose of these changes
- Use active, imperative voice ("Add X" not "Added X")
- Maximum 72 characters for title, but be descriptive
- NO generic terms like "functionality", "features", "updates", "various"
- Each message must be UNIQUE and highlight different aspects`;

    // Add chunking context if applicable
    if (totalChunks && totalChunks > 1) {
      prompt += `

CHUNKING CONTEXT:
- This is chunk ${chunkIndex + 1} of ${totalChunks} (${chunkContext} position)
- Focus only on changes in this specific chunk`;

      // Add chunk-specific context if available
      if (options.context && options.context.chunkInfo) {
        const chunkInfo = options.context.chunkInfo;
        
        if (chunkInfo.files && chunkInfo.files.length > 0) {
          prompt += `
- Files in this chunk: ${chunkInfo.files.slice(0, 5).join(', ')}`;
        }
        
        if (chunkInfo.functions && chunkInfo.functions.length > 0) {
          prompt += `
- Key functions: ${chunkInfo.functions.slice(0, 3).join(', ')}`;
        }
        
        if (chunkInfo.classes && chunkInfo.classes.length > 0) {
          prompt += `
- Key classes: ${chunkInfo.classes.slice(0, 3).join(', ')}`;
        }
        
        if (!chunkInfo.hasSignificantChanges) {
          prompt += `
- Note: This chunk contains minor/structural changes only`;
        }
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

      // Add semantic context only if it exists
      if (context.files && context.files.semantic) {
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
      wordpress_hooks:
        /^\+.*add_action\s*\(\s*['"]([^'"]+)['"]|^\+.*add_filter\s*\(\s*['"]([^'"]+)['"]|^\+.*add_shortcode\s*\(\s*['"]([^'"]+)['"]/gm,
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

    // Enhanced area patterns with more comprehensive WordPress detection
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
      wordpress: /wordpress|wp_config|wp-|add_action|add_filter|add_shortcode|wp_enqueue|wp_localize|get_template_part|wp_head|wp_footer|the_content|the_title|functions\.php|style\.css|index\.php|single\.php|page\.php|category\.php|tag\.php|archive\.php|search\.php|404\.php|comments\.php|header\.php|footer\.php|sidebar\.php/i,
      typescript: /interface|type\s+\w+|enum|namespace|declare/i,
    };

    for (const [area, pattern] of Object.entries(patterns)) {
      if (pattern.test(diff)) {
        analysis.affectedAreas.push(area);
      }
    }

    // Enhanced likely purpose detection with more comprehensive WordPress detection
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
        patterns: [/wordpress.*hook|wp.*filter|add_action|add_filter|add_shortcode|wp_enqueue|get_template_part|wp_head|wp_footer|the_content|the_title|functions\.php/i],
        purpose: 'WordPress functionality modification',
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
            .replace(/^["']|["']$/g, '') // Strip surrounding quotes
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

        // Log retryable errors but don't show them to user
        this.logError(error, `Attempt ${attempt}/${maxRetries} failed`);

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
   * Get provider configuration
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

  /**
   * Log error to file for debugging
   */
  logError(error, context = '') {
    try {
      const logDir = path.join(process.cwd(), '.aic-logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logFile = path.join(logDir, 'errors.log');
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${context}\n${error.stack || error.message}\n\n`;

      fs.appendFileSync(logFile, logEntry);
    } catch (logError) {
      // Silently fail if logging fails
    }
  }

  /**
   * Preprocess and chunk diff for large content
   */
  preprocessDiff(diff, maxChunkSize = 4000) {
    // First check if diff is already reasonable size
    if (!diff || diff.length < maxChunkSize) {
      return diff;
    }

    // Use the existing preprocessing logic
    return this.preprocessDiff(diff);
  }

  /**
   * Chunk diff into smaller pieces
   */
  chunkDiff(diff, maxTokens = 4000) {
    const lines = diff.split('\n');
    const chunks = [];
    let currentChunk = [];
    let currentSize = 0;

    for (const line of lines) {
      const lineSize = line.length;

      // If a single line is too big, try to break it down
      if (lineSize > maxTokens) {
        // For very long lines, break into smaller segments
        for (let i = 0; i < line.length; i += maxTokens) {
          const segment = line.substring(i, i + maxTokens);
          chunks.push(segment);
        }
        continue;
      }

      if (currentSize + lineSize > maxTokens && currentChunk.length > 0) {
        // Add current chunk to results and start new chunk
        chunks.push(currentChunk.join('\n'));
        currentChunk = [line];
        currentSize = lineSize;
      } else {
        // Add to current chunk
        currentChunk.push(line);
        currentSize += lineSize;
      }
    }

    // Add the last chunk if it's not empty
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks;
  }

  /**
   * Estimate token count in text
   */
  estimateTokens(text) {
    if (!text) return 0;
    
    // Rough estimation: 1 token ≈ 4 characters for English text
    // Be more conservative for Groq due to strict limits
    return Math.ceil(text.length / 3.5);
  }

  /**
   * Analyze diff for semantic changes
   */
  analyzeDiff(diff) {
    const lines = diff.split('\n');
    const changes = [];
    let currentFile = null;

    lines.forEach(line => {
      // Look for file headers
      const fileMatch = line.match(/diff --git a\/(.+) b\/(.+)/);
      if (fileMatch) {
        currentFile = {
          file: fileMatch[2],
          additions: 0,
          deletions: 0,
          changes: []
        };
        changes.push(currentFile);
      }

      // Count additions and deletions
      if (currentFile) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          currentFile.additions++;
          currentFile.changes.push({ type: 'addition', content: line.substring(1) });
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          currentFile.deletions++;
          currentFile.changes.push({ type: 'deletion', content: line.substring(1) });
        }
      }
    });

    // Calculate overall summary
    const summary = {
      files: changes.length,
      additions: changes.reduce((sum, file) => sum + file.additions, 0),
      deletions: changes.reduce((sum, file) => sum + file.deletions, 0)
    };

    return {
      summary,
      changes,
      keyChanges: this.extractKeyChanges(changes),
      semanticChanges: this.extractSemanticChanges(diff),
      likelyPurpose: this.inferLikelyPurpose(changes)
    };
  }

  /**
   * Extract key changes from diff
   */
  extractKeyChanges(changes) {
    const keyChanges = [];
    
    changes.forEach(change => {
      if (change.additions > 0 && change.deletions === 0) {
        keyChanges.push(`new file: ${change.file}`);
      } else if (change.additions > 0 && change.deletions > 0) {
        keyChanges.push(`modifications in: ${change.file}`);
      } else if (change.additions === 0 && change.deletions > 0) {
        keyChanges.push(`deletions in: ${change.file}`);
      }
    });
    
    return keyChanges;
  }

  /**
   * Extract semantic changes from diff (functions, classes, etc.)
   */
  extractSemanticChanges(diff) {
    const semanticChanges = {
      newFunctions: [],
      modifiedFunctions: [],
      newClasses: [],
      apiChanges: [],
      testChanges: [],
      configChanges: [],
      breakingChanges: [],
      wordpressHooks: [],
      wordpressChanges: [],
      wordpressTemplateChanges: [],
    };
    
    const lines = diff.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('+')) {
        const content = line.substring(1);
        
        // Match new functions
        const funcMatch = content.match(/\b(?:function|const|let|var)\s+(\w+)/);
        if (funcMatch) {
          semanticChanges.newFunctions.push(funcMatch[1]);
        }
        
        // Match new classes
        const classMatch = content.match(/\bclass\s+(\w+)/);
        if (classMatch) {
          semanticChanges.newClasses.push(classMatch[1]);
        }
        
        // Match API changes
        const apiMatch = content.match(/app\.(get|post|put|delete|patch)\(['"`](.+?)['"`]/);
        if (apiMatch) {
          semanticChanges.apiChanges.push(`${apiMatch[1].toUpperCase()} ${apiMatch[2]}`);
        }
        
        // Match config changes
        if (/require\(['"`]config|import.*config|process\.env/.test(content)) {
          semanticChanges.configChanges.push(content.trim());
        }
        
        // Match test changes
        if (/\b(describe|it|test|expect|assert)\b/.test(content)) {
          semanticChanges.testChanges.push(content.trim());
        }
        
        // Match potential breaking changes
        if (/\b(?:removed|deleted|breaking|BREAKING)\b/.test(content)) {
          semanticChanges.breakingChanges.push(content.trim());
        }
        
        // Match WordPress-specific changes
        if (content.includes('add_action') || content.includes('add_filter') || content.includes('add_shortcode')) {
          const wpHookMatch = content.match(/(?:add_action|add_filter|add_shortcode)\s*\(\s*['"`]([^'"`]+)['"`]/);
          if (wpHookMatch) {
            semanticChanges.wordpressHooks = semanticChanges.wordpressHooks || [];
            semanticChanges.wordpressHooks.push(wpHookMatch[1]);
          }
        }

        if (content.includes('wp_enqueue') || content.includes('wp_localize_script') || content.includes('wp_localize')) {
          semanticChanges.wordpressChanges = semanticChanges.wordpressChanges || [];
          semanticChanges.wordpressChanges.push(content.trim());
        }

        if (content.includes('get_template_part') || content.includes('get_header') || content.includes('get_footer') || content.includes('get_sidebar')) {
          semanticChanges.wordpressTemplateChanges = semanticChanges.wordpressTemplateChanges || [];
          semanticChanges.wordpressTemplateChanges.push(content.trim());
        }
      }
    }
    
    return semanticChanges;
  }

  /**
   * Infer likely purpose of changes
   */
  inferLikelyPurpose(changes) {
    if (changes.some(change => change.file && change.file.includes('test'))) {
      return 'test-related changes';
    } else if (changes.some(change => change.file && /\.(js|ts|jsx|tsx)$/.test(change.file))) {
      return 'javascript/typescript changes';
    } else if (changes.some(change => change.file && /\.(py)$/.test(change.file))) {
      return 'python changes';
    } else if (changes.some(change => change.file && /\.(php)$/.test(change.file))) {
      return 'php changes';
    } else if (changes.some(change => {
      return change.changes && change.changes.some(c => 
        c.content && /\b(bug|fix|error|issue|resolve|correct)\b/i.test(c.content)
      );
    })) {
      return 'bug fix';
    } else if (changes.some(change => {
      return change.changes && change.changes.some(c => 
        c.content && /\b(feature|add|implement|create|new)\b/i.test(c.content)
      );
    })) {
      return 'feature addition';
    } else {
      return 'general modification';
    }
  }

  /**
   * Preprocess diff before sending to AI
   */
  preprocessDiff(diff) {
    // Remove binary file indicators
    let processed = diff.replace(
      /^Binary files? .* differ$/gm,
      '[Binary file modified]'
    );

    // Remove timestamps and other noise that might confuse the AI
    processed = processed.replace(/index [a-f0-9]+\.\.[a-f0-9]+ [0-7]+/gm, 'index [hash]..[hash] [mode]');
    
    // Truncate very long lines to prevent token flooding
    const lines = processed.split('\n');
    const maxLineLength = 200;
    const truncatedLines = lines.map(line => {
      if (line.length > maxLineLength && 
          (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
        return line.substring(0, maxLineLength) + '... [truncated]';
      }
      return line;
    });
    
    return truncatedLines.join('\n');
  }

  /**
   * Generate commit messages from diff chunks
   */
  async generateFromChunks(diff, options = {}, maxTokens = 4000) {
    const chunks = this.chunkDiff(diff, maxTokens);
    const allMessages = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isLastChunk = i === chunks.length - 1;
      const chunkOptions = {
        ...options,
        chunkIndex: i,
        totalChunks: chunks.length,
        isLastChunk: isLastChunk,
        chunkContext: isLastChunk ? 'final' : i === 0 ? 'initial' : 'middle'
      };

      try {
        const messages = await this.generateCommitMessages(chunk, chunkOptions);
        allMessages.push(...messages);
      } catch (error) {
        // If any chunk fails, return early
        throw error;
      }
    }

    // Return unique messages
    return [...new Set(allMessages)];
  }

  /**
   * Send HTTP request with error handling
   */
  async sendHTTPRequest(url, options = {}) {
    try {
      const config = await this.getConfig();
      const axios = require('axios');
      
      // Set default timeout and merge with user options
      const requestOptions = {
        timeout: config.timeout || 120000,
        ...options
      };

      const response = await axios(url, requestOptions);
      return response.data;
    } catch (error) {
      this.handleError(error, this.name);
    }
  }

  /**
   * Make direct API request for provider-specific operations
   */
  async makeDirectAPIRequest(endpoint, params = {}) {
    try {
      const config = await this.getConfig();
      return await this.sendHTTPRequest(`${this.baseURL}${endpoint}`, params);
    } catch (error) {
      throw new Error(`Direct API request failed: ${error.message}`);
    }
  }

  /**
   * Cleanup method for resource release
   */
  cleanup() {
    // Base cleanup method - can be extended by subclasses
    this.client = null;
  }
}

module.exports = BaseProvider;
