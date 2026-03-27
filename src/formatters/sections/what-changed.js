/**
 * WhatChangedFormatter - Formats the "what changed" section of commit messages
 *
 * Uses ComponentDetector and FileTypeDetector outputs to describe:
 * - Which components/modules were affected
 * - Specific files changed
 * - Nature of changes (added, removed, modified)
 *
 * Per FMT-01: Leverages detector context for component-aware formatting
 */

class WhatChangedFormatter {
  constructor() {
    this.changeVerbs = {
      added: ['added', 'created', 'introduced', 'implemented'],
      removed: ['removed', 'deleted', 'dropped', 'eliminated'],
      modified: ['modified', 'updated', 'changed', 'adjusted', 'refactored'],
      renamed: ['renamed', 'moved', 'relocated'],
    };
  }

  /**
   * Format what changed section from detector context
   * @param {Object} context - Detector context with component/file info
   * @param {string} message - Original commit message
   * @returns {string} Formatted what-changed section
   */
  format(context, message = '') {
    if (!context || (!context.components && !context.files)) {
      return this._formatGenericWhatChanged(message);
    }

    const sections = [];

    // Component-level changes (from ComponentDetector)
    if (context.components && Object.keys(context.components).length > 0) {
      const componentSection = this._formatComponentChanges(context.components);
      if (componentSection) {
        sections.push(componentSection);
      }
    }

    // File-level changes (from FileTypeDetector)
    if (context.files && context.files.changed) {
      const fileSection = this._formatFileChanges(context.files.changed);
      if (fileSection) {
        sections.push(fileSection);
      }
    }

    // WordPress-specific changes
    if (context.files?.wordpress?.isWordPress) {
      const wpSection = this._formatWordPressChanges(context.files.wordpress);
      if (wpSection) {
        sections.push(wpSection);
      }
    }

    return sections.length > 0 ? sections.join('\n') : this._formatGenericWhatChanged(message);
  }

  /**
   * Format component-level changes
   * @param {Object} components - Component detection results
   * @returns {string} Formatted component changes
   */
  _formatComponentChanges(components) {
    const lines = [];

    // Handle monorepo packages
    if (components.packages && components.packages.length > 0) {
      const packageList = components.packages.join(', ');
      lines.push(`Affected packages: ${packageList}`);
    }

    // Handle custom components
    if (components.custom && components.custom.length > 0) {
      const componentList = components.custom.join(', ');
      lines.push(`Affected components: ${componentList}`);
    }

    // Handle detected boundaries
    if (components.boundaries && components.boundaries.length > 0) {
      const boundaryList = components.boundaries.join(', ');
      lines.push(`Module boundaries: ${boundaryList}`);
    }

    return lines.length > 0 ? lines.join('\n') : '';
  }

  /**
   * Format file-level changes
   * @param {Array} files - Array of changed file objects
   * @returns {string} Formatted file changes
   */
  _formatFileChanges(files) {
    if (!files || files.length === 0) {
      return '';
    }

    const lines = [];
    const grouped = this._groupFilesByDirectory(files);

    // Group by directory for cleaner output
    for (const [dir, dirFiles] of Object.entries(grouped)) {
      const fileNames = dirFiles.map(f => this._truncateFileName(f.path, 40)).join(', ');
      
      if (dir === '.') {
        lines.push(`Root files: ${fileNames}`);
      } else {
        lines.push(`${dir}: ${fileNames}`);
      }
    }

    return lines.length > 0 ? `Files changed: ${lines.join('; ')}` : '';
  }

  /**
   * Format WordPress-specific changes
   * @param {Object} wpContext - WordPress context from FileTypeDetector
   * @returns {string} Formatted WordPress changes
   */
  _formatWordPressChanges(wpContext) {
    const lines = [];
    const { type, plugins, themes, specificPages, components } = wpContext;

    if (type) {
      lines.push(`WordPress ${type} changes`);
    }

    if (plugins && plugins.length > 0) {
      lines.push(`Plugins affected: ${plugins.join(', ')}`);
    }

    if (themes && themes.length > 0) {
      lines.push(`Themes affected: ${themes.join(', ')}`);
    }

    if (specificPages && specificPages.length > 0) {
      lines.push(`Pages/templates: ${specificPages.join(', ')}`);
    }

    if (components && components.length > 0) {
      lines.push(`Components: ${components.join(', ')}`);
    }

    return lines.length > 0 ? lines.join('\n') : '';
  }

  /**
   * Format generic what-changed when no detector context available
   * @param {string} message - Original commit message
   * @returns {string} Generic what-changed section
   */
  _formatGenericWhatChanged(message) {
    if (!message) {
      return '';
    }

    // Extract basic info from message
    const changeType = this._inferChangeType(message);
    return changeType ? `Changes: ${changeType}` : '';
  }

  /**
   * Group files by their directory
   * @param {Array} files - Array of file objects
   * @returns {Object} Grouped files by directory
   */
  _groupFilesByDirectory(files) {
    const grouped = {};

    for (const file of files) {
      const dir = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : '.';
      if (!grouped[dir]) {
        grouped[dir] = [];
      }
      grouped[dir].push(file);
    }

    return grouped;
  }

  /**
   * Truncate file name for display
   * @param {string} name - File name
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated file name
   */
  _truncateFileName(name, maxLength = 40) {
    if (name.length <= maxLength) {
      return name;
    }
    return '...' + name.substring(name.length - maxLength + 3);
  }

  /**
   * Infer change type from message
   * @param {string} message - Commit message
   * @returns {string} Inferred change type
   */
  _inferChangeType(message) {
    const lower = message.toLowerCase();

    for (const [type, verbs] of Object.entries(this.changeVerbs)) {
      if (verbs.some(verb => lower.includes(verb))) {
        return type;
      }
    }

    return 'modified';
  }
}

module.exports = WhatChangedFormatter;
