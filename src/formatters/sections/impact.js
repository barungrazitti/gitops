/**
 * ImpactFormatter - Formats the "impact" section of commit messages
 *
 * Uses DependencyMapper output to document:
 * - Breaking changes and migration notes
 * - Affected downstream components/modules
 * - Performance implications
 * - Required follow-up actions
 *
 * Per FMT-03: Documents the impact and consequences of changes
 */

class ImpactFormatter {
  constructor() {
    this.impactLevels = {
      none: { label: 'No breaking changes', icon: '✓' },
      minor: { label: 'Minor impact', icon: '⚠' },
      moderate: { label: 'Moderate impact', icon: '⚠⚠' },
      major: { label: 'Major impact', icon: '⚠⚠⚠' },
      critical: { label: 'Critical impact', icon: '🚨' }
    };

    this.breakingPatterns = [
      /breaking\s*change/i,
      /backwards?\s*incompatible/i,
      /api\s*change/i,
      /signature\s*change/i,
      /removed?\s*(function|method|class|interface|export)/i,
      /renamed?\s*(function|method|class|interface|export)/i,
      /changed\s*(parameter|argument|return\s*type)/i,
      /migrat(e|ion)\s*(required|needed)/i
    ];
  }

  /**
   * Format impact section from detector context
   * @param {Object} context - Detector context with dependency info
   * @param {string} message - Original commit message
   * @returns {string} Formatted impact section
   */
  format(context, message = '') {
    const sections = [];

    // Breaking changes detection
    const breakingInfo = this._detectBreakingChanges(message, context);
    if (breakingInfo) {
      sections.push(breakingInfo);
    }

    // Dependency impact (from DependencyMapper)
    if (context?.dependencies?.affected?.length > 0) {
      const depImpact = this._formatDependencyImpact(context.dependencies);
      if (depImpact) {
        sections.push(depImpact);
      }
    }

    // Downstream impact
    if (context?.dependencies?.downstream?.length > 0) {
      const downstreamImpact = this._formatDownstreamImpact(context.dependencies.downstream);
      if (downstreamImpact) {
        sections.push(downstreamImpact);
      }
    }

    // Performance implications
    if (context?.conventions?.performanceImpact) {
      const perfImpact = this._formatPerformanceImpact(context.conventions.performanceImpact);
      if (perfImpact) {
        sections.push(perfImpact);
      }
    }

    // Required actions
    if (context?.dependencies?.requiredActions?.length > 0) {
      const actions = this._formatRequiredActions(context.dependencies.requiredActions);
      if (actions) {
        sections.push(actions);
      }
    }

    return sections.length > 0 ? sections.join('\n') : this._formatNoImpact();
  }

  /**
   * Detect breaking changes from message and context
   * @param {string} message - Commit message
   * @param {Object} context - Detector context
   * @returns {string} Breaking change notice or null
   */
  _detectBreakingChanges(message, context) {
    const isBreaking = this.breakingPatterns.some(pattern => pattern.test(message));
    
    // Check context for breaking change indicators
    const hasBreakingContext = context?.conventions?.breakingChange ||
                               context?.dependencies?.breakingChange ||
                               context?.components?.breakingChange;

    if (!isBreaking && !hasBreakingContext) {
      return null;
    }

    const level = this._assessBreakingLevel(message, context);
    const impact = this.impactLevels[level];

    return `Impact: ${impact.icon} ${impact.label}`;
  }

  /**
   * Assess breaking change severity level
   * @param {string} message - Commit message
   * @param {Object} context - Detector context
   * @returns {string} Impact level key
   */
  _assessBreakingLevel(message, context) {
    const lowerMessage = message.toLowerCase();
    let score = 0;

    // Score based on message patterns
    if (/critical|urgent|emergency/i.test(lowerMessage)) score += 3;
    if (/major|significant/i.test(lowerMessage)) score += 2;
    if (/minor|small/i.test(lowerMessage)) score -= 1;

    // Score based on dependency count
    const affectedCount = context?.dependencies?.affected?.length || 0;
    if (affectedCount > 10) score += 2;
    else if (affectedCount > 5) score += 1;
    else if (affectedCount > 0) score += 0;

    // Score based on downstream count
    const downstreamCount = context?.dependencies?.downstream?.length || 0;
    if (downstreamCount > 5) score += 2;
    else if (downstreamCount > 2) score += 1;

    // Determine level
    if (score >= 5) return 'critical';
    if (score >= 3) return 'major';
    if (score >= 1) return 'moderate';
    if (score >= 0) return 'minor';
    return 'none';
  }

  /**
   * Format dependency impact
   * @param {Object} dependencies - Dependency info from DependencyMapper
   * @returns {string} Formatted dependency impact
   */
  _formatDependencyImpact(dependencies) {
    const { affected, imports, exports } = dependencies;

    if (!affected || affected.length === 0) {
      return null;
    }

    const lines = [];
    lines.push(`Dependencies: ${affected.length} module(s) affected`);

    // Show top 5 affected modules
    const topAffected = affected.slice(0, 5);
    if (topAffected.length > 0) {
      const moduleList = topAffected.map(m => this._truncateModule(m, 30)).join(', ');
      lines.push(`  Affected: ${moduleList}${affected.length > 5 ? ` (+${affected.length - 5} more)` : ''}`);
    }

    // Import/export changes
    if (imports?.changed?.length > 0) {
      lines.push(`  Imports changed: ${imports.changed.length}`);
    }
    if (exports?.changed?.length > 0) {
      lines.push(`  Exports changed: ${exports.changed.length}`);
    }

    return lines.join('\n');
  }

  /**
   * Format downstream impact
   * @param {Array} downstream - Array of downstream modules
   * @returns {string} Formatted downstream impact
   */
  _formatDownstreamImpact(downstream) {
    if (!downstream || downstream.length === 0) {
      return null;
    }

    const lines = [];
    lines.push(`Downstream: ${downstream.length} module(s) may require updates`);

    // Show top 5 downstream modules
    const topDownstream = downstream.slice(0, 5);
    if (topDownstream.length > 0) {
      const moduleList = topDownstream.map(m => this._truncateModule(m, 30)).join(', ');
      lines.push(`  Modules: ${moduleList}${downstream.length > 5 ? ` (+${downstream.length - 5} more)` : ''}`);
    }

    return lines.join('\n');
  }

  /**
   * Format performance impact
   * @param {Object} perfImpact - Performance impact info
   * @returns {string} Formatted performance impact
   */
  _formatPerformanceImpact(perfImpact) {
    const { type, metric, estimatedChange } = perfImpact;

    if (!type) {
      return null;
    }

    const icon = type === 'improvement' ? '📈' : type === 'degradation' ? '📉' : '⚡';
    const direction = estimatedChange ? (estimatedChange > 0 ? '+' : '') + estimatedChange : '';

    return `Performance: ${icon} ${type} ${metric ? `(${metric}${direction ? ' ' + direction : ''})` : ''}`;
  }

  /**
   * Format required actions
   * @param {Array} actions - Array of required action strings
   * @returns {string} Formatted required actions
   */
  _formatRequiredActions(actions) {
    if (!actions || actions.length === 0) {
      return null;
    }

    const lines = ['Required actions:'];
    
    for (const action of actions.slice(0, 5)) {
      lines.push(`  • ${action}`);
    }

    if (actions.length > 5) {
      lines.push(`  • ...and ${actions.length - 5} more`);
    }

    return lines.join('\n');
  }

  /**
   * Format no impact message
   * @returns {string} No impact message
   */
  _formatNoImpact() {
    return 'Impact: ✓ No breaking changes detected';
  }

  /**
   * Truncate module name for display
   * @param {string} name - Module name
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated module name
   */
  _truncateModule(name, maxLength = 30) {
    if (!name) return 'unknown';
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 3) + '...';
  }
}

module.exports = ImpactFormatter;
