/**
 * ComponentDetector - Maps changed file paths to logical components
 *
 * Detects monorepo package boundaries, custom component mappings,
 * and common directory patterns (packages/, apps/, services/, etc.)
 *
 * Per D-01: Extends existing project-type-detector.js for monorepo/WordPress detection
 * Per D-02: Supports custom component mappings from config (componentMap key)
 * Per D-06: Returns flat context objects (no wrappers/metadata/confidence/timestamps)
 */

const path = require('path');
const fs = require('fs-extra');
const ProjectTypeDetector = require('../utils/project-type-detector');

class ComponentDetector {
  /**
   * Create a ComponentDetector instance
   * @param {string} repoRoot - Absolute path to repository root
   */
  constructor(repoRoot) {
    this.repoRoot = repoRoot;
    this._isMonorepo = null;
    this._componentMap = null;
  }

  /**
   * Check if repository is a monorepo (cached)
   * @returns {Promise<boolean>}
   */
  async _checkMonorepo() {
    if (this._isMonorepo !== null) {
      return this._isMonorepo;
    }
    try {
      this._isMonorepo = await ProjectTypeDetector.detectMonorepo(this.repoRoot);
    } catch {
      this._isMonorepo = false;
    }
    return this._isMonorepo;
  }

  /**
   * Load custom component mappings from config
   * @returns {Object} Component map { 'path/prefix': 'component-name' }
   */
  _loadComponentMap() {
    if (this._componentMap !== null) {
      return this._componentMap;
    }
    try {
      const Conf = require('conf');
      const conf = new Conf();
      this._componentMap = conf.get('componentMap', {});
    } catch {
      this._componentMap = {};
    }
    return this._componentMap;
  }

  /**
   * Try to match a file path against custom component mappings
   * @param {string} filePath - File path to check
   * @returns {Object|null} Match result or null
   */
  _matchCustomMapping(filePath) {
    const componentMap = this._loadComponentMap();
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Sort prefixes by length (longest first) for most specific match
    const sortedPrefixes = Object.keys(componentMap).sort(
      (a, b) => b.length - a.length
    );

    for (const prefix of sortedPrefixes) {
      const normalizedPrefix = prefix.replace(/\\/g, '/');
      if (normalizedPath.startsWith(normalizedPrefix)) {
        return {
          component: componentMap[prefix],
          scope: normalizedPrefix,
          boundary: 'config'
        };
      }
    }

    return null;
  }

  /**
   * Try to resolve a file to its monorepo package
   * @param {string} filePath - File path within the repo
   * @returns {Promise<Object|null>} Package info or null
   */
  async _resolveMonorepoPackage(filePath) {
    const isMonorepo = await this._checkMonorepo();
    if (!isMonorepo) {
      return null;
    }

    const normalizedPath = filePath.replace(/\\/g, '/');
    const parts = normalizedPath.split('/');

    // Walk up from the file to find nearest package.json
    for (let i = parts.length - 1; i >= 1; i--) {
      const dirPath = parts.slice(0, i).join('/');
      const packageJsonPath = path.join(this.repoRoot, dirPath, 'package.json');

      try {
        if (await fs.pathExists(packageJsonPath)) {
          const pkg = await fs.readJson(packageJsonPath);
          if (pkg.name) {
            return {
              component: pkg.name,
              scope: dirPath,
              boundary: 'package'
            };
          }
        }
      } catch {
        // Continue walking up
      }
    }

    return null;
  }

  /**
   * Auto-detect component from common directory patterns
   * @param {string} filePath - File path
   * @returns {Object|null} Component info or null
   */
  _autoDetectPattern(filePath) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const patterns = [
      'packages/', 'apps/', 'services/',
      'modules/', 'libs/', 'components/'
    ];

    for (const pattern of patterns) {
      const idx = normalizedPath.indexOf(pattern);
      if (idx === 0) {
        const remaining = normalizedPath.slice(pattern.length);
        const segments = remaining.split('/');
        if (segments.length > 0 && segments[0]) {
          const component = segments[0];
          return {
            component,
            scope: pattern + component,
            boundary: 'directory'
          };
        }
      }
    }

    return null;
  }

  /**
   * Extract first meaningful directory as component fallback
   * @param {string} filePath - File path
   * @returns {Object|null} Component info or null
   */
  _extractMeaningfulDirectory(filePath) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const segments = normalizedPath.split('/').filter(Boolean);

    if (segments.length <= 1) {
      return null;
    }

    // Common prefixes to skip for component extraction
    const skipPrefixes = ['src', 'lib', 'dist', 'build', 'out'];

    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      if (!skipPrefixes.includes(segment)) {
        return {
          component: segment,
          scope: segments.slice(0, i + 1).join('/'),
          boundary: 'directory'
        };
      }
    }

    return null;
  }

  /**
   * Detect component for a single file path
   * @param {string} filePath - File path (relative to repo root)
   * @returns {Promise<Object>} Component detection result
   */
  async _detectSingle(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return { component: null, scope: null, boundary: null };
    }

    const normalizedPath = filePath.replace(/\\/g, '/').replace(/^\//, '');

    // 1. Check custom component mappings first (highest priority)
    const customMatch = this._matchCustomMapping(normalizedPath);
    if (customMatch) {
      return customMatch;
    }

    // 2. Check monorepo package boundaries
    const packageMatch = await this._resolveMonorepoPackage(normalizedPath);
    if (packageMatch) {
      return packageMatch;
    }

    // 3. Auto-detect common directory patterns
    const autoMatch = this._autoDetectPattern(normalizedPath);
    if (autoMatch) {
      return autoMatch;
    }

    // 4. Fallback: extract first meaningful directory
    const dirMatch = this._extractMeaningfulDirectory(normalizedPath);
    if (dirMatch) {
      return dirMatch;
    }

    // 5. No component detected
    return { component: null, scope: null, boundary: null };
  }

  /**
   * Detect component boundaries for changed file paths
   * @param {string[]} filePaths - Array of file paths (relative to repo root)
   * @returns {Promise<Object[]>} Array of component detection results
   */
  async detect(filePaths) {
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      return [];
    }

    const results = [];
    for (const filePath of filePaths) {
      const result = await this._detectSingle(filePath);
      results.push(result);
    }

    return results;
  }

  /**
   * Detect components for a batch of files
   * @param {string[]} filePaths - Array of file paths
   * @returns {Promise<Object[]>} Array of detection results
   */
  async detectBatch(filePaths) {
    return this.detect(filePaths);
  }

  /**
   * Get aggregated component summary for a set of files
   * @param {string[]} filePaths - Array of file paths
   * @returns {Promise<Object>} Component summary with files grouped by component
   */
  async getComponentsSummary(filePaths) {
    const results = await this.detect(filePaths);

    const filesByComponent = {};
    const components = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const file = filePaths[i];

      if (result.component) {
        if (!filesByComponent[result.component]) {
          filesByComponent[result.component] = [];
          components.push(result.component);
        }
        filesByComponent[result.component].push(file);
      }
    }

    return {
      components,
      filesByComponent
    };
  }
}

module.exports = ComponentDetector;
