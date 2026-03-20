/**
 * Fallback Commit Message Generator
 * Provides basic commit message generation when AI providers fail
 */

class FallbackCommitGenerator {
  constructor() {
    this.changeTypes = {
      'feat': ['add', 'create', 'implement', 'new'],
      'fix': ['fix', 'bug', 'resolve', 'patch', 'correct'],
      'docs': ['doc', 'readme', 'comment', 'documentation'],
      'style': ['format', 'lint', 'whitespace', 'prettier', 'style'],
      'refactor': ['refactor', 'rewrite', 'restructure', 'rename', 'move'],
      'test': ['test', 'spec', 'jest', 'cypress'],
      'chore': ['update', 'upgrade', 'maintain', 'config', 'build']
    };
    
    this.genericMessages = [
      'Update files',
      'Make changes',
      'Improve functionality',
      'Fix issues',
      'Add features',
      'Refactor code',
      'Update dependencies',
      'Clean up code',
      'Improve performance',
      'Fix typo'
    ];
  }

  /**
   * Generate a fallback commit message based on diff analysis
   */
  generateFallbackMessage(diff) {
    if (!diff) {
      return 'Update files';
    }

    // Analyze the diff to determine the most appropriate commit type
    const analysis = this.analyzeDiff(diff);
    
    // Generate message based on analysis
    if (analysis.primaryChangeType) {
      return this.generateMessageWithType(analysis);
    } 
      // Fallback to generic message
      return this.generateGenericMessage(diff, analysis);
    
  }

  /**
   * Analyze the diff to determine change types and patterns
   */
  analyzeDiff(diff) {
    const lines = diff.split('\n');
    const analysis = {
      additions: 0,
      deletions: 0,
      fileTypes: new Set(),
      changeTypes: new Map(),
      primaryChangeType: null,
      fileCount: 0,
      hasNewFiles: false,
      hasDeletedFiles: false
    };

    // Count additions and deletions
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        analysis.additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        analysis.deletions++;
      }
    }

    // Extract file information
    const fileMatches = diff.match(/diff --git a\/(.+?) b\/(.+)/g) || [];
    analysis.fileCount = fileMatches.length;

    for (const match of fileMatches) {
      const fileMatch = match.match(/diff --git a\/(.+?) b\/(.+)/);
      if (fileMatch) {
        const filePath = fileMatch[2];
        const ext = filePath.split('.').pop();
        if (ext) analysis.fileTypes.add(ext);
      }
    }

    // Analyze change patterns
    for (const [type, keywords] of Object.entries(this.changeTypes)) {
      let count = 0;
      for (const keyword of keywords) {
        const regex = new RegExp(keyword, 'gi');
        count += (diff.match(regex) || []).length;
      }
      if (count > 0) {
        analysis.changeTypes.set(type, count);
      }
    }

    // Determine primary change type
    if (analysis.changeTypes.size > 0) {
      const sortedTypes = Array.from(analysis.changeTypes.entries())
        .sort((a, b) => b[1] - a[1]);
      analysis.primaryChangeType = sortedTypes[0][0];
    }

    return analysis;
  }

  /**
   * Generate a message based on the determined change type
   */
  generateMessageWithType(analysis) {
    const type = analysis.primaryChangeType;
    
    switch (type) {
      case 'feat':
        return `feat: Add new functionality`;
      case 'fix':
        return `fix: Resolve issues`;
      case 'docs':
        return `docs: Update documentation`;
      case 'style':
        return `style: Format code`;
      case 'refactor':
        return `refactor: Restructure code`;
      case 'test':
        return `test: Add/update tests`;
      case 'chore':
        return `chore: Maintenance updates`;
      default:
        return `${type}: Make changes`;
    }
  }

  /**
   * Generate a generic message when type detection fails
   */
  generateGenericMessage(diff, analysis) {
    // Try to extract meaningful information from the diff
    const functionsAdded = (diff.match(/\+.*function\s+\w+/g) || []).length;
    const classesAdded = (diff.match(/\+.*class\s+\w+/g) || []).length;
    const filesModified = analysis.fileCount;
    
    if (functionsAdded > 0) {
      return `Add ${functionsAdded} function${functionsAdded > 1 ? 's' : ''}`;
    } if (classesAdded > 0) {
      return `Add ${classesAdded} class${classesAdded > 1 ? 'es' : ''}`;
    } if (filesModified > 0) {
      return `Update ${filesModified} file${filesModified > 1 ? 's' : ''}`;
    } 
      // Pick a random generic message
      const randomIndex = Math.floor(Math.random() * this.genericMessages.length);
      return this.genericMessages[randomIndex];
    
  }

  /**
   * Generate a simple commit message based on file extensions
   */
  generateByFileTypes(diff) {
    const analysis = this.analyzeDiff(diff);
    
    if (analysis.fileTypes.size === 0) {
      return 'Update files';
    }

    const fileTypes = Array.from(analysis.fileTypes);
    const typeCounts = {};
    
    for (const fileType of fileTypes) {
      typeCounts[fileType] = typeCounts[fileType] ? typeCounts[fileType] + 1 : 1;
    }

    // Determine the predominant file type
    const predominantType = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])[0][0];

    switch (predominantType) {
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
        return 'chore: Update JavaScript files';
      case 'css':
      case 'scss':
      case 'sass':
        return 'style: Update stylesheets';
      case 'html':
      case 'vue':
        return 'feat: Update markup';
      case 'md':
      case 'txt':
        return 'docs: Update documentation';
      case 'json':
      case 'yml':
      case 'yaml':
        return 'chore: Update configuration';
      default:
        return `chore: Update ${predominantType} files`;
    }
  }
}

module.exports = FallbackCommitGenerator;