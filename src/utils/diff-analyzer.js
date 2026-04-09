/**
 * Diff Analyzer - Analyzes git diffs for semantic changes and metadata
 */

class DiffAnalyzer {
  constructor() {}

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
        wordpress_hooks: [],
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
      documentation: /doc|readme|comment|wiki|guide/i,
      security: /security|encrypt|decrypt|hash|salt|signature|oauth/i,
      wordpress: /wp\-|wordpress|plugin|theme|add_action|add_filter/i,
    };

    // Check which areas are affected
    for (const [area, pattern] of Object.entries(patterns)) {
      if (
        pattern.test(addedLines) ||
        pattern.test(removedLines)
      ) {
        analysis.affectedAreas.push(area);
      }
    }

    // Determine likely purpose based on changes
    if (analysis.affectedAreas.length > 0) {
      analysis.hasInsights = true;
      
      // Simple heuristic for likely purpose
      if (analysis.affectedAreas.includes('testing')) {
        analysis.likelyPurpose = 'testing';
      } else if (analysis.affectedAreas.includes('database')) {
        analysis.likelyPurpose = 'database changes';
      } else if (analysis.affectedAreas.includes('api endpoints')) {
        analysis.likelyPurpose = 'API development';
      } else if (analysis.affectedAreas.includes('ui components')) {
        analysis.likelyPurpose = 'UI/UX changes';
      } else if (analysis.affectedAreas.includes('wordpress')) {
        analysis.likelyPurpose = 'WordPress customization';
      } else {
        analysis.likelyPurpose = 'general development';
      }
    }

    return analysis;
  }

  /**
   * Analyze diff for semantic changes (alternative method)
   */
  analyzeDiff(diff) {
    const lines = diff.split('\n');
    const changes = [];
    let currentFile = null;

    lines.forEach(line => {
      if (line.startsWith('diff --git')) {
        // New file section
        const match = line.match(/diff --git a\/(.+) b\/(.+)/);
        if (match) {
          currentFile = match[2]; // Use the b/ path (new file)
          changes.push({
            type: 'file',
            file: currentFile,
            changes: []
          });
        }
      } else if (line.startsWith('+++') || line.startsWith('---')) {
        // File header - skip
      } else if (line.startsWith('@@')) {
        // Hunk header - skip
      } else if (currentFile && (line.startsWith('+') || line.startsWith('-'))) {
        // Actual change
        const changeType = line.startsWith('+') ? 'added' : 'removed';
        const content = line.substring(1);
        
        // Find the current file object
        const fileChange = changes.find(c => c.file === currentFile);
        if (fileChange) {
          fileChange.changes.push({
            type: changeType,
            line: content,
            raw: line
          });
        }
      }
    });

    return changes;
  }

  /**
   * Analyze diff with full summary including per-file changes
   */
  analyzeDiffWithSummary(diff) {
    const lines = diff.split('\n');
    const changes = [];
    let currentFile = null;

    lines.forEach(line => {
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
}

module.exports = DiffAnalyzer;