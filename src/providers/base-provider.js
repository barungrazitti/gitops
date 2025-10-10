/**
 * Base AI Provider - Abstract class for all AI providers
 */

const ConfigManager = require("../core/config-manager");

class BaseProvider {
  constructor() {
    this.configManager = new ConfigManager();
    this.name = "base";
  }

  /**
   * Generate commit messages - must be implemented by subclasses
   */
  async generateCommitMessages(diff, options = {}) {
    throw new Error("generateCommitMessages must be implemented by subclass");
  }

  /**
   * Validate provider configuration
   */
  async validate(config) {
    throw new Error("validate must be implemented by subclass");
  }

  /**
   * Preprocess diff to make it more AI-friendly while preserving context
   */
  preprocessDiff(diff) {
    // Remove binary file indicators
    let processed = diff.replace(
      /^Binary files? .* differ$/gm,
      "[Binary file modified]",
    );

    // Split into lines for intelligent processing
    const lines = processed.split("\n");
    const processedLines = [];
    let contextLines = [];
    let importantLines = [];

    // First pass: identify important lines and preserve context
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Always keep diff headers and file indicators
      if (
        line.startsWith("diff --git") ||
        line.startsWith("index ") ||
        line.startsWith("---") ||
        line.startsWith("+++") ||
        line.startsWith("@@")
      ) {
        processedLines.push(line);
        continue;
      }

      // Keep added/removed lines (these are most important)
      if (line.startsWith("+") || line.startsWith("-")) {
        // Skip trivial changes
        if (!this.isTrivialChange(line)) {
          importantLines.push(line);
        }
        continue;
      }

      // Keep context lines that might be important
      if (line.trim() && !line.startsWith(" ")) {
        contextLines.push(line);
      }
    }

    // Combine important lines with some context
    processedLines.push(...importantLines);

    // Add some context lines (but limit them)
    const maxContextLines = 20;
    if (contextLines.length > 0) {
      const contextSample = contextLines
        .filter((line) => line.length < 200) // Skip very long context lines
        .slice(0, maxContextLines);
      processedLines.push(...contextSample.map((line) => " " + line)); // Add as context
    }

    // Limit total size but be more generous
    const maxLines = 200; // Increased from 100
    if (processedLines.length > maxLines) {
      // Prioritize: keep all diff headers, then important changes, then context
      const headers = processedLines.filter(
        (line) =>
          line.startsWith("diff --git") ||
          line.startsWith("index ") ||
          line.startsWith("---") ||
          line.startsWith("+++") ||
          line.startsWith("@@"),
      );

      const changes = processedLines.filter(
        (line) => line.startsWith("+") || line.startsWith("-"),
      );

      const context = processedLines.filter(
        (line) =>
          !line.startsWith("diff --git") &&
          !line.startsWith("index ") &&
          !line.startsWith("---") &&
          !line.startsWith("+++") &&
          !line.startsWith("@@") &&
          !line.startsWith("+") &&
          !line.startsWith("-"),
      );

      const finalLines = [
        ...headers,
        ...changes.slice(0, maxLines - headers.length - 10),
        ...context.slice(0, 10),
      ];

      processed = finalLines.join("\n") + "\n... (diff truncated)";
    } else {
      processed = processedLines.join("\n");
    }

    // Handle very long lines more intelligently
    processed = processed.replace(/^.{300,}$/gm, (match) => {
      // Try to preserve some meaningful content from long lines
      if (match.includes("import") || match.includes("require")) {
        return match.substring(0, 150) + "... [import statement truncated]";
      }
      return "[Long line truncated]";
    });

    return processed;
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
    const { context, type, language, conventional } = options;

    // Analyze diff for better context
    const diffAnalysis = this.analyzeDiffContent(diff);

    // Ensure options has count
    if (!options.count) {
      options.count = 3;
    }

    let prompt = `You are an expert software developer specializing in writing precise, meaningful commit messages. Analyze the following git diff and generate ${options.count || 3} highly relevant commit messages.

CRITICAL REQUIREMENTS:
- Be extremely specific about WHAT changed and WHY it matters
- Use active voice and imperative mood (e.g., "Add feature" not "Added feature")
- Keep titles under 72 characters, focus on the most important change
- Prioritize semantic meaning over generic descriptions
- Consider the business impact or technical significance`;

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

    if (type) {
      prompt += `\n- Primary change type detected: ${type}`;
    }

    if (language !== "en") {
      prompt += `\n- Write commit messages in ${this.getLanguageName(language)}`;
    }

    // Enhanced repository context
    if (context) {
      prompt += `\n\nREPOSITORY CONTEXT:`;
      if (context.patterns) {
        const commonTypes = context.patterns.mostUsedTypes
          ? context.patterns.mostUsedTypes.map(([type]) => type).join(", ")
          : "none detected";
        const commonScopes = context.patterns.mostUsedScopes
          ? context.patterns.mostUsedScopes.map(([scope]) => scope).join(", ")
          : "none detected";

        prompt += `
- Preferred format: ${context.patterns.preferredFormat || "freeform"}
- Common types: ${commonTypes}
- Common scopes: ${commonScopes}`;
      }
      if (context.files) {
        const fileTypes = context.files.fileTypes || {};
        const changedTypes =
          Object.entries(fileTypes)
            .filter(([_, count]) => count > 0)
            .map(([type, count]) => `${type}(${count})`)
            .join(", ") || "none";

        prompt += `
- File types changed: ${changedTypes}
- Inferred scope: ${context.files.scope || "general"}
- Changes: +${context.files.changes?.insertions || 0} -${context.files.changes?.deletions || 0}`;
      }
      if (context.project) {
        prompt += `
- Project type: ${context.project.primary || "unknown"}`;
      }
    }

    // Diff analysis insights
    if (diffAnalysis.hasInsights) {
      prompt += `\n\nDIFF ANALYSIS:`;
      if (diffAnalysis.keyChanges.length > 0) {
        prompt += `\n- Key changes detected: ${diffAnalysis.keyChanges.join(", ")}`;
      }
      if (diffAnalysis.likelyPurpose) {
        prompt += `\n- Likely purpose: ${diffAnalysis.likelyPurpose}`;
      }
      if (diffAnalysis.affectedAreas.length > 0) {
        prompt += `\n- Affected areas: ${diffAnalysis.affectedAreas.join(", ")}`;
      }
    }

    prompt += `\n\nGIT DIFF:
\`\`\`diff
${this.preprocessDiff(diff)}
\`\`\`

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
    };

    const lines = diff.split("\n");
    const addedLines = lines.filter((line) => line.startsWith("+")).join("\n");
    const removedLines = lines
      .filter((line) => line.startsWith("-"))
      .join("\n");

    // Detect key patterns
    const patterns = {
      authentication: /auth|login|user|session|jwt|passport|password/i,
      "api endpoints": /api|endpoint|route|controller|handler|service/i,
      database: /database|db|model|schema|migration|sql|query/i,
      "ui components": /component|view|template|render|jsx|tsx|html/i,
      configuration: /config|env|setting|constant|environment/i,
      testing: /test|spec|mock|fixture|describe|it\(|expect/i,
      dependencies: /package|npm|yarn|require|import|dependency/i,
      "error handling": /error|exception|try|catch|throw|validation/i,
      performance: /performance|optimize|cache|lazy|memo|async/i,
      security: /security|sanitize|validate|escape|encrypt|hash/i,
    };

    for (const [area, pattern] of Object.entries(patterns)) {
      if (pattern.test(diff)) {
        analysis.affectedAreas.push(area);
      }
    }

    // Detect likely purpose
    if (patterns.authentication.test(diff)) {
      analysis.likelyPurpose = "authentication/security enhancement";
    } else if (patterns["api endpoints"].test(diff)) {
      analysis.likelyPurpose = "API functionality change";
    } else if (patterns.database.test(diff)) {
      analysis.likelyPurpose = "database schema or query modification";
    } else if (patterns["ui components"].test(diff)) {
      analysis.likelyPurpose = "user interface update";
    } else if (patterns.testing.test(diff)) {
      analysis.likelyPurpose = "test coverage or test logic change";
    }

    // Detect specific changes
    if (
      /function|class|const|let|var/.test(addedLines) &&
      !/function|class|const|let|var/.test(removedLines)
    ) {
      analysis.keyChanges.push("new functions/classes added");
    }
    if (/export|module\.exports/.test(addedLines)) {
      analysis.keyChanges.push("new exports added");
    }
    if (/import|require/.test(addedLines)) {
      analysis.keyChanges.push("new dependencies imported");
    }
    if (/console\.log|console\.error|console\.warn/.test(addedLines)) {
      analysis.keyChanges.push("logging statements added");
    }

    analysis.hasInsights =
      analysis.affectedAreas.length > 0 ||
      analysis.likelyPurpose ||
      analysis.keyChanges.length > 0;

    return analysis;
  }

  /**
   * Preprocess diff to make it more AI-friendly
   */
  preprocessDiff(diff) {
    // Remove binary file indicators
    let processed = diff.replace(
      /^Binary files? .* differ$/gm,
      "[Binary file modified]",
    );

    // Limit diff size to prevent token overflow
    const maxLines = 100;
    const lines = processed.split("\n");
    if (lines.length > maxLines) {
      processed =
        lines.slice(0, maxLines).join("\n") + "\n... (diff truncated)";
    }

    // Remove very long lines that might be minified code
    processed = processed.replace(/^.{200,}$/gm, "[Long line truncated]");

    return processed;
  }

  /**
   * Get language name from code
   */
  getLanguageName(code) {
    const languages = {
      en: "English",
      es: "Spanish",
      fr: "French",
      de: "German",
      zh: "Chinese",
      ja: "Japanese",
    };
    return languages[code] || "English";
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
            `Authentication failed for ${providerName}. Please check your API key.`,
          );
        case 403:
          throw new Error(
            `Access forbidden for ${providerName}. Please check your permissions.`,
          );
        case 429:
          throw new Error(
            `Rate limit exceeded for ${providerName}. Please try again later.`,
          );
        case 500:
        case 502:
        case 503:
        case 504:
          throw new Error(
            `${providerName} service is temporarily unavailable. Please try again later.`,
          );
        default:
          throw new Error(`${providerName} API error (${status}): ${message}`);
      }
    } else if (error.code === "ECONNREFUSED") {
      throw new Error(
        `Cannot connect to ${providerName}. Please check your internet connection.`,
      );
    } else if (error.code === "ETIMEDOUT") {
      throw new Error(
        `Request to ${providerName} timed out. Please try again.`,
      );
    } else {
      // Handle undefined error message safely
      const errorMessage = error?.message || "Unknown error occurred";
      throw new Error(`${providerName} error: ${errorMessage}`);
    }
  }

  /**
   * Parse AI response into commit messages
   */
  parseResponse(response) {
    if (typeof response !== "string") {
      throw new Error("Invalid response from AI provider");
    }

    // Split by lines and clean up
    const messages = response
      .split("\n")
      .map(
        (line) =>
          line
            .trim()
            .replace(/^\d+\.?\s*/, "") // Strip numbering
            .replace(/^- \s*/, "") // Strip dashes
            .replace(/^\* \s*/, ""), // Strip asterisks
      )
      .filter((line) => line.length > 0)
      .slice(0, 10); // Limit to 10 messages max

    if (messages.length === 0) {
      throw new Error("No valid commit messages found in AI response");
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
            setTimeout(resolve, delay * Math.pow(2, attempt - 1)),
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
    if (!message || typeof message !== "string") {
      return false;
    }

    const trimmed = message.trim();

    // Basic validation
    if (trimmed.length < 10 || trimmed.length > 200) {
      return false;
    }

    // Should not contain newlines in title
    if (trimmed.includes("\n") && trimmed.indexOf("\n") < 50) {
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
