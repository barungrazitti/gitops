/**
 * Orchestrates sequential AI provider processing with fallback
 */

const chalk = require('chalk');
const AIProviderFactory = require('../providers/ai-provider-factory');

class ProviderOrchestrator {
  constructor() {}

  /**
   * Generate commit messages with sequential fallback
   */
  async generateWithSequentialFallback(diff, options, activityLogger, statsManager) {
    const { preferredProvider, context, ...generationOptions } = options;

    // Determine providers to use - preferred first, then fallback
    const allProviders = ['groq', 'ollama'];
    const providers = preferredProvider ?
      [preferredProvider, ...allProviders.filter(p => p !== preferredProvider)] :
      allProviders;

    // Enrich options with context first
    const enrichedOptions = {
      ...generationOptions,
      context: {
        ...context,
        hasSemanticContext: !!(
          context?.files?.semantic &&
          Object.keys(context.files.semantic).length > 0
        ),
      },
    };

    // Step 1: Intelligent diff management with semantic context
    const diffManagement = await this.manageDiffForAI(diff, enrichedOptions);

    // Step 2: Use sequential fallback mode
    return await this.generateWithSequentialProviders(diffManagement, enrichedOptions, providers, activityLogger, statsManager);
  }

  /**
   * Intelligently manage diff for optimal AI processing
   */
  async manageDiffForAI(diff, options = {}) {
    const diffSize = diff.length;
    const MAX_SAFE_SIZE = 60000; // ~20K tokens, safe for modern Groq (131K context) and Ollama
    const { context } = options;

    if (diffSize <= MAX_SAFE_SIZE) {
      return {
        strategy: 'full',
        data: diff,
        chunks: null,
        info: {
          strategy: 'full',
          size: diffSize,
          chunks: 1,
          reasoning: 'Full diff sent to AI for fast processing',
          pluginUpdate: false
        }
      };
    }

    const smartTruncated = await this.smartTruncateDiff(diff, MAX_SAFE_SIZE, context);
    return {
      strategy: 'smart-truncated',
      data: smartTruncated.data,
      chunks: null,
      info: {
        strategy: 'smart-truncated',
        size: smartTruncated.data.length,
        chunks: 1,
        reasoning: smartTruncated.reasoning,
        truncated: true,
        originalSize: diffSize,
        preservedFiles: smartTruncated.preservedFiles,
        skippedFiles: smartTruncated.skippedFiles
      }
    };
  }

  /**
   * Smart truncate diff to preserve most relevant content
   */
  async smartTruncateDiff(diff, maxSize, semanticContext) {
    const fileChunks = this.parseDiffIntoFileChunks(diff);

    const IGNORED_PATTERNS = [
      'node_modules/', 'dist/', 'build/', 'vendor/', '.git/',
      '.lock', '.min.js', '.min.css', '.map'
    ];

    const filteredChunks = fileChunks.filter(fc => {
      return !IGNORED_PATTERNS.some(pattern => fc.fileName.includes(pattern));
    });

    const scoredChunks = filteredChunks.map(fc => {
      const score = this.scoreFileChunk(fc, semanticContext);
      return { ...fc, score };
    });

    scoredChunks.sort((a, b) => b.score - a.score);

    let selectedContent = [];
    let preservedFiles = [];
    let skippedFiles = [];
    let currentSize = 0;
    const HEADER_BUDGET = Math.min(2000, maxSize * 0.05);

    for (const chunk of scoredChunks) {
      const headerSize = chunk.header.length;
      const contentSize = chunk.content.length;
      const totalSize = headerSize + contentSize;

      if (currentSize + totalSize <= maxSize) {
        selectedContent.push(chunk.header);
        if (chunk.content.trim()) {
          selectedContent.push(chunk.content);
        }
        currentSize += totalSize;
        preservedFiles.push(chunk.fileName);
      } else {
        skippedFiles.push(chunk);
      }

      if (currentSize >= maxSize * 0.9) {
        break;
      }
    }

    let remainingHeaderSpace = Math.max(0, maxSize - currentSize);
    const skippedHeaders = [];
    // Track which files were added from skipped files to preserved files to avoid duplicates
    const additionalPreservedFiles = [];

    for (const chunk of skippedFiles) {
      if (remainingHeaderSpace <= 0) break;
      if (chunk.header.length <= remainingHeaderSpace) {
        skippedHeaders.push(chunk.header);
        remainingHeaderSpace -= chunk.header.length;
        // Only add to preservedFiles if it's not already there to avoid duplicates
        if (!preservedFiles.includes(chunk.fileName)) {
          preservedFiles.push(chunk.fileName);
        }
        additionalPreservedFiles.push(chunk.fileName);
      }
    }

    // Build summary of skipped files for context
    const trulySkipped = skippedFiles
      .filter(f => !additionalPreservedFiles.includes(f.fileName))
      .map(f => f.fileName);

    const skippedFileSummary = this.buildSkippedFileSummary(trulySkipped);

    let reasoning = `Preserved ${preservedFiles.length} files with full content, ${trulySkipped.length} skipped (node_modules ignored)`;
    if (preservedFiles.length === 0 && filteredChunks.length > 0) {
      reasoning = 'No files fit within token limits - diff too large';
    }

    return {
      data: [...selectedContent, ...skippedHeaders, skippedFileSummary].join('\n'),
      reasoning,
      preservedFiles,
      skippedFiles: trulySkipped
    };
  }

  /**
   * Build a summary of skipped files grouped by pattern
   */
  buildSkippedFileSummary(skippedFiles) {
    if (!skippedFiles.length) return '';

    const groups = {
      plugin: [],
      theme: [],
      vendor: [],
      assets: [],
      config: [],
      other: []
    };

    skippedFiles.forEach(file => {
      if (file.includes('/plugins/') || file.includes('\\plugins\\')) {
        groups.plugin.push(file);
      } else if (file.includes('/themes/') || file.includes('\\themes\\')) {
        groups.theme.push(file);
      } else if (file.includes('vendor/') || file.includes('node_modules/')) {
        groups.vendor.push(file);
      } else if (file.match(/\.(js|css|woff|png|jpg|svg|ico)$/i)) {
        groups.assets.push(file);
      } else if (file.match(/\.(json|xml|yml|yaml|lock|config)$/i)) {
        groups.config.push(file);
      } else {
        groups.other.push(file);
      }
    });

    const summary = [];
    summary.push('\n# SKIPPED FILES (too large, but changed):');

    if (groups.plugin.length) {
      const plugins = new Set(groups.plugin.map(f => {
        const match = f.match(/\/plugins\/([^\/]+)/);
        return match ? match[1] : f;
      }));
      summary.push(`# Plugins: ${Array.from(plugins).join(', ')} (${groups.plugin.length} files)`);
    }

    if (groups.theme.length) {
      const themes = new Set(groups.theme.map(f => {
        const match = f.match(/\/themes\/([^\/]+)/);
        return match ? match[1] : f;
      }));
      summary.push(`# Themes: ${Array.from(themes).join(', ')} (${groups.theme.length} files)`);
    }

    if (groups.assets.length > 5) {
      summary.push(`# Assets: ${groups.assets.length} files (JS bundles, CSS, fonts, images)`);
    } else if (groups.assets.length) {
      summary.push(`# Assets: ${groups.assets.map(f => f.split('/').pop()).join(', ')}`);
    }

    if (groups.config.length) {
      summary.push(`# Config files: ${groups.config.map(f => f.split('/').pop()).join(', ')}`);
    }

    if (groups.vendor.length) {
      const vendorTypes = new Set(groups.vendor.map(f => {
        if (f.includes('node_modules')) return 'npm';
        if (f.includes('vendor/composer')) return 'composer';
        return 'vendor';
      }));
      summary.push(`# Dependencies: ${Array.from(vendorTypes).join(', ')} (${groups.vendor.length} files)`);
    }

    if (groups.other.length <= 10) {
      summary.push(`# Other: ${groups.other.join(', ')}`);
    } else if (groups.other.length) {
      summary.push(`# Other: ${groups.other.length} files`);
    }

    return summary.join('\n');
  }

  /**
   * Parse diff into individual file chunks with headers and content
   */
  parseDiffIntoFileChunks(diff) {
    const fileChunks = [];
    const lines = diff.split('\n');
    let currentFile = null;
    let currentContent = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('diff --git')) {
        if (currentFile) {
          fileChunks.push({
            header: currentFile.header,
            content: currentContent.join('\n'),
            fileName: currentFile.fileName,
            isNewFile: currentFile.isNewFile,
            changeCount: currentFile.changeCount
          });
        }

        const fileMatch = line.match(/diff --git a\/(.+?) b\/(.+)/);
        const fileName = fileMatch ? fileMatch[2] : 'unknown';
        let isNewFile = line.includes('/dev/null') || (i > 0 && lines[i - 1] && lines[i - 1].includes('new file mode'));
        if (!isNewFile && lines[i + 1] && lines[i + 1].includes('new file mode')) {
          isNewFile = true;
        }

        currentFile = {
          header: line,
          fileName,
          isNewFile,
          changeCount: 0
        };
        currentContent = [];
      } else if (line.startsWith('@@')) {
        if (currentFile) {
          currentFile.header += '\n' + line;
          currentFile.changeCount++;
        }
      } else if (currentFile) {
        currentContent.push(line);
      }
    }

    // Push the last file
    if (currentFile) {
      fileChunks.push({
        header: currentFile.header,
        content: currentContent.join('\n'),
        fileName: currentFile.fileName,
        isNewFile: currentFile.isNewFile,
        changeCount: currentFile.changeCount
      });
    }

    return fileChunks;
  }

  /**
   * Score file chunk based on semantic importance
   */
  scoreFileChunk(chunk, semanticContext) {
    let score = 0;
    const fileName = chunk.fileName.toLowerCase();

    // Prioritize certain file types
    if (fileName.endsWith('.js') || fileName.endsWith('.ts') || 
        fileName.endsWith('.py') || fileName.endsWith('.java')) {
      score += 3;
    } else if (fileName.endsWith('.json') || fileName.endsWith('.yaml') || 
               fileName.endsWith('.yml') || fileName.endsWith('.toml')) {
      score += 2;
    } else if (fileName.includes('package') || fileName.includes('requirements') ||
               fileName.includes('pom.xml') || fileName.includes('build.gradle')) {
      score += 4;
    }

    // Boost score for files mentioned in semantic context
    if (semanticContext && semanticContext.files && semanticContext.files.semantic) {
      const semanticFiles = Object.keys(semanticContext.files.semantic);
      if (semanticFiles.includes(chunk.fileName)) {
        score += 5;
      }
    }

    // Prefer files with more changes (indicating importance)
    score += Math.min(chunk.changeCount, 10); // Cap at 10 to avoid over-prioritizing

    return score;
  }

  /**
   * Generate commit messages with sequential provider processing (with fallback)
   */
  async generateWithSequentialProviders(diffManagement, options, providers, activityLogger, statsManager) {
    const startTime = Date.now();

    // Try providers sequentially
    for (const providerName of providers) {
      try {
        const startProviderTime = Date.now();
        const provider = AIProviderFactory.create(providerName);

        let messages;
        let actualPrompt;

        // Handle different diff strategies
        if (diffManagement.strategy === 'full' || diffManagement.strategy === 'smart-truncated') {
          // Simple case: diff in one prompt (full or smart-truncated)
          const prompt = provider.buildPrompt(diffManagement.data, options);
          messages = await provider.generateCommitMessages(diffManagement.data, options);
          actualPrompt = prompt;
        } else {
          // Complex case: chunked processing
          const chunkMessages = [];

          for (let i = 0; i < diffManagement.data.length; i++) {
            const chunk = diffManagement.data[i];
            const isLastChunk = i === diffManagement.data.length - 1;

            const chunkOptions = {
              ...options,
              chunkIndex: i,
              totalChunks: diffManagement.data.length,
              isLastChunk,
              chunkContext: isLastChunk ? 'final' : i === 0 ? 'initial' : 'middle',
              // Add chunk-specific context
              context: {
                ...options.context,
                chunkInfo: {
                  index: i,
                  total: diffManagement.data.length,
                  size: chunk.size,
                  files: chunk.context.files,
                  functions: chunk.context.functions,
                  classes: chunk.context.classes,
                  hasSignificantChanges: chunk.context.hasSignificantChanges
                }
              }
            };

            // Generate with this chunk
            const chunkPrompt = provider.buildPrompt(chunk.content, chunkOptions);
            const chunkResult = await provider.generateCommitMessages(chunk.content, chunkOptions);

            if (chunkResult && chunkResult.length > 0) {
              chunkMessages.push(...chunkResult);

              // Log the actual prompt for this chunk
              await activityLogger.logAIInteraction(
                providerName,
                'commit_generation_chunk',
                chunkPrompt,
                chunkResult[0], // Log first message
                Date.now() - startProviderTime,
                true
              );
            }
          }

          messages = this.selectBestMessages(chunkMessages, options.count || 3);
          actualPrompt = `Chunked processing (${diffManagement.chunks} chunks)`;
        }

        const responseTime = Date.now() - startProviderTime;

        if (messages && messages.length > 0) {
          await statsManager.recordCommit(providerName);

          // Log the actual interaction with full prompt
          await activityLogger.logAIInteraction(
            providerName,
            'commit_generation',
            actualPrompt,
            messages.join('\n'),
            responseTime,
            true
          );

          // Log diff management info
          await activityLogger.info('diff_management', {
            ...diffManagement.info,
            provider: providerName,
            responseTime,
            success: true
          });

          return messages;
        }
      } catch (error) {
        const responseTime = Date.now() - startTime;

        // Log failed interaction
        await activityLogger.logAIInteraction(
          providerName,
          'commit_generation',
          diffManagement.strategy === 'full' || diffManagement.strategy === 'smart-truncated' 
            ? diffManagement.data 
            : `Chunked processing (${diffManagement.chunks} chunks)`,
          null,
          responseTime,
          false
        );

        // Log diff management info for failure
        await activityLogger.info('diff_management', {
          ...diffManagement.info,
          provider: providerName,
          responseTime,
          success: false,
          error: error.message
        });

        // Continue to next provider in sequence
        continue;
      }
    }

    throw new Error('All AI providers failed to generate commit messages.');
  }

  /**
   * Select best commit messages from chunked results (with quality scoring)
   */
  selectBestMessages(messages, count = 3, diff = null) {
    if (!messages || messages.length === 0) return [];

    // Remove duplicates
    const uniqueMessages = [...new Set(messages)];

    // Score messages based on quality factors
    const scored = uniqueMessages.map((msg) => ({
      message: msg,
      score: this.scoreCommitMessage(msg, diff),
    }));

    // Sort by score and take best ones
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, count).map((item) => item.message);
  }

  /**
   * Score a commit message based on quality factors
   */
  scoreCommitMessage(message, diff = null) {
    let score = 0;

    // Prefer conventional commit format
    if (/^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?:/.test(message)) {
      score += 10;
    }

    // Prefer reasonable length (not too short, not too long)
    const length = message.length;
    if (length >= 20 && length <= 100) {
      score += 5;
    } else if (length >= 10 && length <= 150) {
      score += 2;
    }

    // Prefer messages with proper capitalization
    if (message[0] === message[0].toUpperCase() && message[0] !== message[0].toLowerCase()) {
      score += 2;
    }

    // Prefer messages without period at the end (conventional commit standard)
    if (!message.endsWith('.')) {
      score += 1;
    }

    // REWARD specific technical terms
    const specificPatterns = [
      /\b[A-Z][a-zA-Z]*\b/, // Class names
      /\b\w+\(\)/, // Function calls
      /\b(add|create|implement|remove|delete|update)\s+\w+/i, // Specific actions
      /\b(class|function|const|let|var)\s+\w+/i, // Code constructs
    ];

    specificPatterns.forEach((pattern) => {
      if (pattern.test(message)) {
        score += 3;
      }
    });

    // HEAVILY PENALIZE generic messages
    const genericPatterns = [
      /\b(add|update|fix|change|modify|remove)\s+(functionality|features?|code|files?)\b/i,
      /\b(new|additional|extra)\s+(stuff|things|items)\b/i,
      /\b(general|misc|various|multiple)\s+(changes|updates|fixes)\b/i,
      /^\s*(improvements?|bug fix|updates?|refactor)\s*$/i,
    ];

    genericPatterns.forEach((pattern) => {
      if (pattern.test(message)) {
        score -= 20;
      }
    });

    // BANNED patterns - instant low score
    const bannedPatterns = [
      /^\s*update\s*$/i,
      /^\s*fix\s*$/i,
      /^\s*commit\s*$/i,
      /^\s*changes\s*$/i,
    ];

    bannedPatterns.forEach((pattern) => {
      if (pattern.test(message)) {
        score = -100;
      }
    });

    // Penalize very short, non-specific messages
    if (message.split(' ').length <= 3 && !/[A-Z]\w+/.test(message)) {
      score -= 3;
    }

    // RELEVANCE SCORING - only if diff is provided
    if (diff) {
      score += this.calculateRelevanceScore(message, diff);
    }

    return score;
  }

  /**
   * Calculate relevance score based on how well the commit message matches the actual diff
   */
  calculateRelevanceScore(message, diff) {
    let relevanceScore = 0;

    // Extract key entities from diff (functions, classes, filenames, etc.)
    const entitiesFromDiff = this.extractEntitiesFromDiff(diff);

    // Extract keywords from commit message
    const messageKeywords = this.extractKeywordsFromMessage(message);

    // Calculate overlap between diff entities and message
    const entityOverlap = this.calculateEntityOverlap(entitiesFromDiff, messageKeywords);
    relevanceScore += entityOverlap * 8; // Weight entity overlap heavily

    // Check if the commit type matches the diff type
    const typeMatch = this.checkTypeMatch(message, diff);
    if (typeMatch) {
      relevanceScore += 5;
    }

    // Check if the scope matches the file types changed
    const scopeMatch = this.checkScopeMatch(message, diff);
    if (scopeMatch) {
      relevanceScore += 3;
    }

    // Penalize if message is too generic relative to specific changes
    if (this.isMessageTooGenericForDiff(message, diff)) {
      relevanceScore -= 10;
    }

    return relevanceScore;
  }

  /**
   * Extract key entities from diff (functions, classes, filenames, etc.)
   */
  extractEntitiesFromDiff(diff) {
    const entities = {
      functions: [],
      classes: [],
      variables: [],
      filenames: [],
      fileTypes: [],
      methods: []
    };

    // Extract file names from diff
    const fileMatches = diff.match(/diff --git a\/(.+?) b\/(.+)/g) || [];
    for (const match of fileMatches) {
      const fileMatch = match.match(/diff --git a\/(.+?) b\/(.+)/);
      if (fileMatch) {
        const filePath = fileMatch[2];
        entities.filenames.push(filePath);

        // Extract file type/extension
        const ext = filePath.split('.').pop();
        if (ext) entities.fileTypes.push(ext);
      }
    }

    // Extract function/class definitions from diff
    const functionMatches = diff.match(/(?:function\s+|def\s+)([A-Za-z_][A-Za-z0-9_]*)/g) || [];
    for (const match of functionMatches) {
      const funcName = match.replace(/function\s+|def\s+/, '').trim();
      if (funcName) entities.functions.push(funcName);
    }

    const classMatches = diff.match(/(?:class\s+)([A-Za-z_][A-Za-z0-9_]*)/g) || [];
    for (const match of classMatches) {
      const className = match.replace('class\s+', '').replace('class ', '').trim();
      if (className) entities.classes.push(className);
    }

    // Extract variable declarations
    const varMatches = diff.match(/(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)/g) || [];
    for (const match of varMatches) {
      const varName = match.replace(/(?:const|let|var)\s+/, '').trim();
      if (varName) entities.variables.push(varName);
    }

    // Extract method definitions in diff
    const methodMatches = diff.match(/[A-Za-z_][A-Za-z0-9_]*\s*:\s*function|([A-Za-z_][A-Za-z0-9_]*)\s*\(/g) || [];
    for (const match of methodMatches) {
      const methodName = match.replace(/\s*:\s*function|\s*\(/, '').trim();
      if (methodName && !entities.functions.includes(methodName)) {
        entities.methods.push(methodName);
      }
    }

    // Extract import/module statements
    const importMatches = diff.match(/(?:import|from|require)\s*.*?['"`]([^'"`]+)['"`]/g) || [];
    for (const match of importMatches) {
      const importName = match.replace(/(?:import|from|require)\s*/, '').replace(/['"`].*?['"`]/, '').trim();
      if (importName) entities.variables.push(importName);
    }

    return entities;
  }

  /**
   * Extract keywords from commit message
   */
  extractKeywordsFromMessage(message) {
    // Remove conventional commit prefix (type(scope):) to focus on content
    const content = message.replace(/^[a-z]+(\([^)]+\))?:\s*/, '');

    // Extract words that could be relevant
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.isCommonStopWord(word));

    return [...new Set(words)]; // Remove duplicates
  }

  /**
   * Check if word is a common stop word that should be ignored
   */
  isCommonStopWord(word) {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we',
      'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its',
      'our', 'their', 'what', 'which', 'who', 'when', 'where', 'why', 'how',
      'if', 'then', 'else', 'so', 'than', 'too', 'very', 'just', 'now', 'up',
      'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once'
    ]);

    return stopWords.has(word.toLowerCase());
  }

  /**
   * Calculate overlap between entities from diff and keywords from message
   */
  calculateEntityOverlap(entities, messageKeywords) {
    let overlapCount = 0;

    // Check for function name matches
    for (const func of entities.functions) {
      const funcName = func.toLowerCase();
      if (messageKeywords.some(keyword =>
        funcName.includes(keyword) || keyword.includes(funcName)
      )) {
        overlapCount++;
      }
    }

    // Check for class name matches
    for (const cls of entities.classes) {
      const className = cls.toLowerCase();
      if (messageKeywords.some(keyword =>
        className.includes(keyword) || keyword.includes(className)
      )) {
        overlapCount++;
      }
    }

    // Check for variable name matches
    for (const varName of entities.variables) {
      const varNameLower = varName.toLowerCase();
      if (messageKeywords.some(keyword =>
        varNameLower.includes(keyword) || keyword.includes(varNameLower)
      )) {
        overlapCount++;
      }
    }

    // Check for filename matches
    for (const file of entities.filenames) {
      const fileName = file.toLowerCase().replace(/\.[^/.]+$/, ''); // Remove extension
      const fileNameParts = fileName.split(/[\/\\]/); // Split by path separators

      for (const part of fileNameParts) {
        if (messageKeywords.some(keyword =>
          part.includes(keyword) || keyword.includes(part)
        )) {
          overlapCount++;
          break;
        }
      }
    }

    return overlapCount;
  }

  /**
   * Check if commit type matches the type of changes in diff
   */
  checkTypeMatch(message, diff) {
    const typeMatch = message.match(/^([a-z]+)(\(.+\))?:/);
    if (!typeMatch) return false;

    const changeType = typeMatch[1];

    // Determine what type of changes are in the diff
    const diffIndicators = {
      feat: /(\+.*function|\+.*class|\+.*def|\+.*export|\+.*import)/.test(diff),
      fix: /(\-.*bug|\-.*error|\-.*issue|\+.*correct|\+.*resolve|\+.*patch)/i.test(diff),
      docs: /(\+.*\.(md|txt|rst)|\+.*README|\+.*documentation)/i.test(diff),
      refactor: /(\+.*refactor|\+.*restructure|\-.*\s+\+.*\s+.*reorganized)/.test(diff),
      test: /(\+.*test|\+.*spec|\+.*describe|\+.*it\(|\+.*expect|\+.*assert)/i.test(diff),
      style: /(\+.*css|\+.*style|\+.*format|\+.*indent|\+.*prettier)/i.test(diff),
    };

    return diffIndicators[changeType] || false;
  }

  /**
   * Check if commit scope matches file types changed
   */
  checkScopeMatch(message, diff) {
    const scopeMatch = message.match(/^[a-z]+\(([^)]+)\):/);
    if (!scopeMatch) return false;

    const scope = scopeMatch[1];

    // Extract file types from diff
    const fileTypes = this.extractEntitiesFromDiff(diff).fileTypes;

    // Common scope-type mappings
    const scopeTypeMap = {
      'api': ['js', 'ts', 'py', 'php', 'java', 'go', 'rb'],
      'ui': ['jsx', 'tsx', 'vue', 'html', 'css', 'scss', 'sass', 'less'],
      'auth': ['js', 'ts', 'py', 'php', 'java', 'go'],
      'db': ['sql', 'js', 'ts', 'py', 'php'],
      'config': ['json', 'yaml', 'yml', 'env', 'xml', 'toml', 'conf'],
      'test': ['test.js', 'spec.js', 'test.ts', 'spec.ts', 'test.py', 'spec.rb'],
      'docs': ['md', 'txt', 'rst', 'adoc', 'tex'],
      'build': ['js', 'ts', 'json', 'lock', 'yml', 'yaml', 'sh', 'gradle', 'xml'],
      'ci': ['yml', 'yaml', 'sh', 'json'],
      'utils': ['js', 'ts', 'py', 'php', 'java', 'go', 'rb'],
      'types': ['ts', 'js', 'py', 'java', 'go'],
      'perf': ['js', 'ts', 'py', 'java', 'go', 'php'],
      'deps': ['json', 'lock', 'yml', 'yaml', 'xml', 'txt']
    };

    if (scopeTypeMap[scope]) {
      return fileTypes.some(type => scopeTypeMap[scope].includes(type));
    }

    return false;
  }

  /**
   * Check if message is too generic for the specific changes in the diff
   */
  isMessageTooGenericForDiff(message, diff) {
    const entities = this.extractEntitiesFromDiff(diff);
    const hasSpecificEntities = entities.functions.length > 0 ||
                                entities.classes.length > 0 ||
                                entities.variables.length > 0;

    const genericTerms = [
      /\bchanges?\b/i, /\bupdates?\b/i, /\bfixes?\b/i,
      /\bstuff\b/i, /\bthings?\b/i, /\bvarious\b/i,
      /\bimprovements?\b/i, /\benhancements?\b/i
    ];

    const hasGenericTerms = genericTerms.some(regex => regex.test(message));

    return hasSpecificEntities && hasGenericTerms;
  }
}

module.exports = ProviderOrchestrator;