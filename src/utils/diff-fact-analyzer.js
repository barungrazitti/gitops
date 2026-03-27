/**
 * DiffFactAnalyzer - Extracts concrete, factual information from git diffs
 *
 * Provides hard evidence about what actually changed to prevent AI from
 * hallucinating commit messages. Produces structured facts that can be
 * injected as constraints into AI prompts.
 */

class DiffFactAnalyzer {
  /**
   * Analyze a diff and return concrete facts about what changed
   * @param {string} diff - Git diff string
   * @returns {Object} Diff facts with statistics, patterns, and recommendations
   */
  analyze(diff) {
    if (!diff || typeof diff !== 'string') {
      return this.emptyResult();
    }

    const lines = diff.split('\n');
    const fileChanges = this.parseFileChanges(lines);
    const stats = this.calculateStats(fileChanges);
    const patterns = this.detectPatterns(fileChanges, stats);
    const recommendation = this.recommendType(fileChanges, stats, patterns);

    return {
      stats,
      fileChanges,
      patterns,
      recommendation,
      summary: this.buildSummary(fileChanges, stats, patterns)
    };
  }

  /**
   * Parse individual file changes from diff
   * @private
   */
  parseFileChanges(lines) {
    const files = [];
    let current = null;

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        if (current) files.push(current);
        const match = line.match(/diff --git a\/(.+?) b\/(.+)/);
        current = {
          fileName: match ? match[2] : 'unknown',
          oldFileName: match ? match[1] : 'unknown',
          additions: 0,
          deletions: 0,
          operation: 'modified',
          addedLines: [],
          deletedLines: [],
          isNew: false,
          isDeleted: false
        };
      } else if (current) {
        if (line.startsWith('new file')) {
          current.isNew = true;
          current.operation = 'added';
        } else if (line.startsWith('deleted file')) {
          current.isDeleted = true;
          current.operation = 'deleted';
        } else if (line.startsWith('rename') || line.startsWith('similarity index 100%')) {
          current.operation = 'renamed';
        }

        if (line.startsWith('+') && !line.startsWith('+++')) {
          current.additions++;
          current.addedLines.push(line.substring(1));
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          current.deletions++;
          current.deletedLines.push(line.substring(1));
        }
      }
    }

    if (current) files.push(current);
    return files;
  }

  /**
   * Calculate aggregate statistics
   * @private
   */
  calculateStats(fileChanges) {
    const stats = {
      totalAdditions: 0,
      totalDeletions: 0,
      filesChanged: fileChanges.length,
      filesAdded: 0,
      filesDeleted: 0,
      filesModified: 0,
      filesRenamed: 0,
      netChange: 0
    };

    for (const file of fileChanges) {
      stats.totalAdditions += file.additions;
      stats.totalDeletions += file.deletions;
      if (file.isNew) stats.filesAdded++;
      else if (file.isDeleted) stats.filesDeleted++;
      else if (file.operation === 'renamed') stats.filesRenamed++;
      else stats.filesModified++;
    }

    stats.netChange = stats.totalAdditions - stats.totalDeletions;
    return stats;
  }

  /**
   * Detect specific patterns in changes
   * @private
   */
  detectPatterns(fileChanges, stats) {
    const patterns = {
      isDeletionOnly: false,
      isAdditionOnly: false,
      isMostlyRemovals: false,
      isMostlyAdditions: false,
      isFileDeletion: false,
      isNewFile: false,
      isConfigOnly: false,
      isDocsOnly: false,
      isTestOnly: false,
      detectedOperations: [],
      dominantFileCategory: 'code'
    };

    patterns.isDeletionOnly = stats.totalAdditions === 0 && stats.totalDeletions > 0;
    patterns.isAdditionOnly = stats.totalDeletions === 0 && stats.totalAdditions > 0;
    patterns.isMostlyRemovals = stats.totalDeletions > stats.totalAdditions * 2;
    patterns.isMostlyAdditions = stats.totalAdditions > stats.totalDeletions * 2;
    patterns.isFileDeletion = stats.filesDeleted > 0 && stats.filesDeleted >= stats.filesChanged;
    patterns.isNewFile = stats.filesAdded > 0 && stats.filesAdded >= stats.filesChanged;

    const allDeleted = fileChanges.flatMap(f => f.deletedLines);
    const allAdded = fileChanges.flatMap(f => f.addedLines);

    patterns.detectedOperations = this.detectOperations(allDeleted, allAdded, fileChanges);

    const categories = this.categorizeFiles(fileChanges);
    if (categories.length === 1) {
      const cat = categories[0];
      if (cat === 'config') patterns.isConfigOnly = true;
      else if (cat === 'docs') patterns.isDocsOnly = true;
      else if (cat === 'test') patterns.isTestOnly = true;
    }
    patterns.dominantFileCategory = categories[0] || 'code';

    return patterns;
  }

  /**
   * Detect specific operations in the changed lines
   * @private
   */
  detectOperations(deletedLines, addedLines, fileChanges) {
    const operations = [];

    const allDeletedContent = deletedLines.join('\n');
    const allAddedContent = addedLines.join('\n');
    const allContent = allDeletedContent + '\n' + allAddedContent;

    if (/console\.(log|debug|warn|error|info)/.test(allDeletedContent) &&
        !/console\.(log|debug|warn|error|info)/.test(allAddedContent)) {
      operations.push({ type: 'remove-console-logs', description: 'removed console.log/debug statements' });
    }

    if (/console\.(log|debug|warn|error|info)/.test(allAddedContent) &&
        !/console\.(log|debug|warn|error|info)/.test(allDeletedContent)) {
      operations.push({ type: 'add-logging', description: 'added logging statements' });
    }

    if (/\bfunction\s+\w+/.test(allAddedContent) || /\bclass\s+\w+/.test(allAddedContent)) {
      operations.push({ type: 'add-functions', description: 'added new functions or classes' });
    }

    if (/require\s*\(/.test(allAddedContent) || /import\s+/.test(allAddedContent)) {
      operations.push({ type: 'add-imports', description: 'added new imports or dependencies' });
    }

    if (/export\s+/.test(allAddedContent) && !/export\s+/.test(allDeletedContent)) {
      operations.push({ type: 'add-exports', description: 'added new exports' });
    }

    if (/\/\*\*|^\s*\*|^\s*\/\/[^\n]*[Jj][Ss][Dd]oc/.test(allAddedContent)) {
      operations.push({ type: 'add-comments', description: 'added documentation comments' });
    }

    for (const file of fileChanges) {
      if (file.isDeleted) {
        operations.push({ type: 'delete-file', description: `deleted ${file.fileName}` });
      }
      if (file.isNew) {
        operations.push({ type: 'add-file', description: `added ${file.fileName}` });
      }
    }

    const addedContentLower = allAddedContent.toLowerCase();
    const deletedContentLower = allDeletedContent.toLowerCase();

    if (/TODO|FIXME|HACK/.test(deletedContentLower) && !/TODO|FIXME|HACK/.test(addedContentLower)) {
      operations.push({ type: 'remove-todos', description: 'removed TODO/FIXME/HACK comments' });
    }

    if (/\btry\s*\{/.test(addedContentLower) || /\bcatch\s*\(/.test(addedContentLower)) {
      operations.push({ type: 'add-error-handling', description: 'added error handling' });
    }

    if (/if\s*\(!/.test(addedContentLower) && !/if\s*\(!/.test(deletedContentLower)) {
      operations.push({ type: 'add-validation', description: 'added input validation' });
    }

    return operations;
  }

  /**
   * Categorize changed files
   * @private
   */
  categorizeFiles(fileChanges) {
    const categories = new Set();

    for (const file of fileChanges) {
      const name = file.fileName.toLowerCase();

      if (/\.(md|txt|rst|adoc|doc)$/.test(name) || /readme/i.test(name)) {
        categories.add('docs');
      } else if (/\.(json|yaml|yml|toml|ini|env|conf|config)$/.test(name) ||
                 /\.gitignore$/.test(name) || /\.editorconfig$/.test(name)) {
        categories.add('config');
      } else if (/\.test\.|\.spec\.|tests?\//.test(name) || /__tests__/.test(name)) {
        categories.add('test');
      } else if (/\.(js|ts|jsx|tsx|py|java|go|rb|php|rs)$/.test(name)) {
        categories.add('code');
      } else if (/\.(css|scss|sass|less|html|hbs|ejs)$/.test(name)) {
        categories.add('style');
      } else {
        categories.add('other');
      }
    }

    return [...categories];
  }

  /**
   * Recommend commit type based on hard evidence
   * @private
   */
  recommendType(fileChanges, stats, patterns) {
    const hasConsoleRemoval = patterns.detectedOperations.some(op =>
      op.type === 'remove-console-logs'
    );

    if (patterns.isFileDeletion || (patterns.isDeletionOnly && !hasConsoleRemoval)) {
      return { type: 'chore', confidence: 0.9, reason: 'only file deletions or line removals' };
    }

    if (hasConsoleRemoval && stats.totalAdditions <= 5 && stats.totalDeletions > 5) {
      return { type: 'refactor', confidence: 0.9, reason: 'removed console logging (cleanup)' };
    }

    const hasNewCode = patterns.detectedOperations.some(op =>
      ['add-functions', 'add-imports', 'add-exports', 'add-file'].includes(op.type)
    );

    if (hasNewCode && !patterns.isMostlyRemovals) {
      if (patterns.isTestOnly) {
        return { type: 'test', confidence: 0.9, reason: 'only test files changed' };
      }
      if (patterns.isDocsOnly) {
        return { type: 'docs', confidence: 0.9, reason: 'only documentation changed' };
      }
      if (patterns.isConfigOnly) {
        return { type: 'chore', confidence: 0.85, reason: 'only configuration files changed' };
      }
      return { type: 'feat', confidence: 0.7, reason: 'new code added' };
    }

    if (patterns.isMostlyRemovals && !hasNewCode) {
      return { type: 'refactor', confidence: 0.85, reason: 'predominantly removed code without adding features' };
    }

    if (patterns.isDocsOnly) {
      return { type: 'docs', confidence: 0.9, reason: 'only documentation changed' };
    }

    if (patterns.isConfigOnly) {
      return { type: 'chore', confidence: 0.85, reason: 'only configuration files changed' };
    }

    if (patterns.isTestOnly) {
      return { type: 'test', confidence: 0.9, reason: 'only test files changed' };
    }

    if (stats.totalAdditions > 0 && stats.totalDeletions > 0) {
      const hasValidation = patterns.detectedOperations.some(op =>
        op.type === 'add-validation' || op.type === 'add-error-handling'
      );
      if (hasValidation) {
        return { type: 'fix', confidence: 0.8, reason: 'added validation or error handling' };
      }
      return { type: 'feat', confidence: 0.5, reason: 'mixed changes with additions and deletions' };
    }

    return { type: 'chore', confidence: 0.5, reason: 'general changes' };
  }

  /**
   * Build a human-readable summary of diff facts
   * @private
   */
  buildSummary(fileChanges, stats, patterns) {
    const parts = [];

    parts.push(`${stats.filesChanged} file(s) changed`);
    parts.push(`+${stats.totalAdditions} -${stats.totalDeletions}`);

    if (stats.filesAdded > 0) parts.push(`${stats.filesAdded} added`);
    if (stats.filesDeleted > 0) parts.push(`${stats.filesDeleted} deleted`);
    if (stats.filesModified > 0) parts.push(`${stats.filesModified} modified`);

    const meaningfulOps = patterns.detectedOperations.filter(op =>
      !['delete-file', 'add-file'].includes(op.type)
    );
    if (meaningfulOps.length > 0) {
      parts.push('key changes: ' + meaningfulOps.map(op => op.description).join(', '));
    }

    return parts.join(', ');
  }

  /**
   * Build constraint text for AI prompt injection
   * @param {Object} facts - Output from analyze()
   * @returns {string} Formatted constraints
   */
  buildPromptConstraints(facts) {
    if (!facts || !facts.stats) return '';

    const constraints = [];
    const { stats, patterns, recommendation } = facts;

    constraints.push(`DIFF FACTS (you MUST reflect these in your commit message):`);
    constraints.push(`- Files changed: ${stats.filesChanged} (${stats.filesAdded} added, ${stats.filesDeleted} deleted, ${stats.filesModified} modified)`);
    constraints.push(`- Lines: +${stats.totalAdditions} additions, -${stats.totalDeletions} deletions (net: ${stats.netChange >= 0 ? '+' : ''}${stats.netChange})`);

    if (patterns.isDeletionOnly) {
      constraints.push(`- CRITICAL: This diff contains ONLY deletions. No new functionality was added.`);
      constraints.push(`- The commit type MUST be "chore" or "refactor", NOT "feat" or "fix".`);
    }

    if (patterns.isAdditionOnly) {
      constraints.push(`- This diff contains ONLY additions. No existing code was modified.`);
    }

    if (patterns.isMostlyRemovals && !patterns.isDeletionOnly) {
      constraints.push(`- This diff is predominantly deletions (${stats.totalDeletions} removed vs ${stats.totalAdditions} added).`);
      constraints.push(`- Do NOT describe this as "improved" or "enhanced" - focus on what was removed.`);
    }

    if (patterns.isConfigOnly) {
      constraints.push(`- CRITICAL: Only configuration files changed. The type MUST be "chore".`);
    }

    if (patterns.isDocsOnly) {
      constraints.push(`- CRITICAL: Only documentation files changed. The type MUST be "docs".`);
    }

    if (patterns.isTestOnly) {
      constraints.push(`- Only test files changed. The type should be "test".`);
    }

    if (patterns.detectedOperations.length > 0) {
      const meaningfulOps = patterns.detectedOperations.filter(op =>
        !['delete-file', 'add-file'].includes(op.type)
      );
      if (meaningfulOps.length > 0) {
        constraints.push(`- Detected operations: ${meaningfulOps.map(op => op.description).join(', ')}`);
      }
    }

    if (recommendation && recommendation.confidence >= 0.8) {
      constraints.push(`- RECOMMENDED type: "${recommendation.type}" (${recommendation.reason})`);
    }

    return constraints.join('\n');
  }

  /**
   * Empty result for null/empty input
   * @private
   */
  emptyResult() {
    return {
      stats: {
        totalAdditions: 0, totalDeletions: 0, filesChanged: 0,
        filesAdded: 0, filesDeleted: 0, filesModified: 0,
        filesRenamed: 0, netChange: 0
      },
      fileChanges: [],
      patterns: {
        isDeletionOnly: false, isAdditionOnly: false, isMostlyRemovals: false,
        isMostlyAdditions: false, isFileDeletion: false, isNewFile: false,
        isConfigOnly: false, isDocsOnly: false, isTestOnly: false,
        detectedOperations: [], dominantFileCategory: 'code'
      },
      recommendation: { type: 'chore', confidence: 0, reason: 'no diff provided' },
      summary: 'no changes'
    };
  }
}

module.exports = DiffFactAnalyzer;
