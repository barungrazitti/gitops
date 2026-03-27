/**
 * ConventionDetector - Analyzes project conventions using lightweight heuristics
 *
 * Detects naming patterns, file structure patterns, and import/export conventions.
 * Uses file name sampling and regex on file contents — no AST dependencies.
 * Target: <100ms execution per D-03.
 *
 * Per D-06: Returns flat context objects (no wrappers/metadata/confidence/timestamps)
 */

const fs = require('fs-extra');
const path = require('path');

/** @type {Set<string>} Directories to skip during recursive scanning */
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', 'dist', 'build',
  'coverage', '.next', '.nuxt', '__pycache__',
  '.cache', '.turbo', '.tmp', 'vendor'
]);

/** Directories that indicate feature-based structure */
const FEATURE_INDICATORS = ['features', 'modules', 'domains', 'screens', 'views'];

/** Directories that indicate layered structure */
const LAYER_INDICATORS = ['controllers', 'models', 'views', 'services', 'utils',
  'middleware', 'repositories', 'entities', 'dto', 'routes', 'handlers'];

class ConventionDetector {
  /**
   * Create a ConventionDetector instance
   * @param {string} repoRoot - Absolute path to repository root
   */
  constructor(repoRoot) {
    this.repoRoot = repoRoot;
  }

  /**
   * Recursively collect files up to a limit
   * @param {string} dir - Directory to scan
   * @param {string[]} results - Accumulator for file paths
   * @param {number} [limit=50] - Maximum files to collect
   * @returns {string[]} File paths found
   */
  _collectFiles(dir, results = [], limit = 50) {
    if (results.length >= limit) return results;

    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        if (results.length >= limit) break;

        if (SKIP_DIRS.has(item) || item.startsWith('.')) continue;

        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          this._collectFiles(fullPath, results, limit);
        } else {
          results.push(fullPath);
        }
      }
    } catch {
      // Permission errors or missing dirs — skip
    }

    return results;
  }

  /**
   * Recursively collect JS files for import analysis
   * @param {string} dir - Directory to scan
   * @param {string[]} results - Accumulator
   * @param {number} [limit=20] - Maximum files
   * @returns {string[]} JS file paths found
   */
  _collectJsFiles(dir, results = [], limit = 20) {
    if (results.length >= limit) return results;

    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        if (results.length >= limit) break;

        if (SKIP_DIRS.has(item) || item.startsWith('.')) continue;

        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          this._collectJsFiles(fullPath, results, limit);
        } else if (item.endsWith('.js') || item.endsWith('.mjs') || item.endsWith('.jsx')) {
          results.push(fullPath);
        }
      }
    } catch {
      // Skip
    }

    return results;
  }

  /**
   * Detect dominant naming pattern from file names
   * @param {string[]} filePaths - Array of file paths
   * @returns {string} Dominant naming pattern
   */
  _detectNaming(filePaths) {
    if (filePaths.length === 0) return 'unknown';

    const counts = {
      camelCase: 0,
      snake_case: 0,
      'kebab-case': 0,
      PascalCase: 0,
      other: 0
    };

    for (const filePath of filePaths) {
      const basename = path.basename(filePath, path.extname(filePath));

      // Skip non-informative names
      if (basename.length < 2 || basename === 'index') continue;

      if (/^[a-z][a-zA-Z0-9]*$/.test(basename)) {
        counts.camelCase++;
      } else if (/^[a-z][a-z0-9_]*$/.test(basename) && basename.includes('_')) {
        counts.snake_case++;
      } else if (/^[a-z][a-z0-9-]*$/.test(basename) && basename.includes('-')) {
        counts['kebab-case']++;
      } else if (/^[A-Z][a-zA-Z0-9]*$/.test(basename)) {
        counts.PascalCase++;
      } else {
        counts.other++;
      }
    }

    const total = counts.camelCase + counts.snake_case +
      counts['kebab-case'] + counts.PascalCase;

    if (total === 0) return 'unknown';

    const threshold = total * 0.5;

    if (counts.camelCase >= threshold) return 'camelCase';
    if (counts.snake_case >= threshold) return 'snake_case';
    if (counts['kebab-case'] >= threshold) return 'kebab-case';
    if (counts.PascalCase >= threshold) return 'PascalCase';

    return 'mixed';
  }

  /**
   * Detect file structure pattern
   * @returns {string} Structure type
   */
  _detectStructure() {
    const srcDir = path.join(this.repoRoot, 'src');

    // Determine where to look
    let targetDir;
    if (fs.existsSync(srcDir)) {
      try {
        fs.statSync(srcDir);
        targetDir = srcDir;
      } catch {
        targetDir = this.repoRoot;
      }
    } else {
      targetDir = this.repoRoot;
    }

    let topDirs;
    try {
      topDirs = fs.readdirSync(targetDir).filter(item => {
        if (SKIP_DIRS.has(item) || item.startsWith('.')) return false;
        try {
          return fs.statSync(path.join(targetDir, item)).isDirectory();
        } catch {
          return false;
        }
      });
    } catch {
      return 'unknown';
    }

    if (topDirs.length === 0) return 'flat';

    // Check for feature-based: multiple dirs with similar substructure
    const featureCount = topDirs.filter(d => FEATURE_INDICATORS.includes(d)).length;
    if (featureCount >= 2) {
      return 'feature-based';
    }

    // Check if top-level dirs have feature-like parallel substructure
    if (topDirs.length >= 3) {
      const subDirSets = topDirs.map(dir => {
        try {
          return new Set(
            fs.readdirSync(path.join(targetDir, dir))
              .filter(sub => {
                try {
                  return fs.statSync(path.join(targetDir, dir, sub)).isDirectory();
                } catch {
                  return false;
                }
              })
          );
        } catch {
          return new Set();
        }
      });

      // Check if multiple dirs share similar subdirectory names
      const commonSubs = new Set(subDirSets[0]);
      for (let i = 1; i < subDirSets.length; i++) {
        for (const sub of commonSubs) {
          if (!subDirSets[i].has(sub)) commonSubs.delete(sub);
        }
      }

      if (commonSubs.size >= 2 && topDirs.length >= 2) {
        return 'feature-based';
      }
    }

    // Check for layered structure
    const layerCount = topDirs.filter(d => LAYER_INDICATORS.includes(d)).length;
    if (layerCount >= 2) {
      return 'layered';
    }

    // Check for deeply nested structure
    let maxDepth = 0;
    for (const dir of topDirs.slice(0, 3)) {
      const depth = this._measureDepth(path.join(targetDir, dir), 0);
      maxDepth = Math.max(maxDepth, depth);
    }

    if (maxDepth >= 3) return 'nested';

    // Count total files vs directories to detect flat
    let fileCount = 0;
    try {
      const items = fs.readdirSync(targetDir);
      for (const item of items) {
        if (SKIP_DIRS.has(item) || item.startsWith('.')) continue;
        try {
          if (!fs.statSync(path.join(targetDir, item)).isDirectory()) {
            fileCount++;
          }
        } catch {
          // skip
        }
      }
    } catch {
      // skip
    }

    if (fileCount > topDirs.length) return 'flat';

    return 'unknown';
  }

  /**
   * Measure directory nesting depth
   * @param {string} dir - Directory to measure
   * @param {number} current - Current depth
   * @returns {number} Maximum depth found
   */
  _measureDepth(dir, current) {
    if (current >= 4) return current;

    try {
      const items = fs.readdirSync(dir);
      const subDirs = items.filter(item => {
        if (SKIP_DIRS.has(item) || item.startsWith('.')) return false;
        try {
          return fs.statSync(path.join(dir, item)).isDirectory();
        } catch {
          return false;
        }
      });

      if (subDirs.length === 0) return current;

      let maxSubDepth = current;
      for (const sub of subDirs.slice(0, 3)) {
        const d = this._measureDepth(path.join(dir, sub), current + 1);
        maxSubDepth = Math.max(maxSubDepth, d);
      }

      return maxSubDepth;
    } catch {
      return current;
    }
  }

  /**
   * Detect import convention from JS file contents
   * @param {string[]} jsFilePaths - Array of JS file paths to read
   * @returns {string} Import convention type
   */
  _detectImports(jsFilePaths) {
    if (jsFilePaths.length === 0) return 'unknown';

    let relative = 0;
    let absolute = 0;
    let totalImportLines = 0;

    for (const filePath of jsFilePaths) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();

          // Relative require/import
          if (/require\s*\(\s*['"]\.\.?\//.test(trimmed) ||
              /from\s+['"]\.\.?\//.test(trimmed)) {
            relative++;
            totalImportLines++;
          }
          // Absolute require/import (scoped packages, aliased paths)
          else if (/require\s*\(\s*['"]@/.test(trimmed) ||
                   /from\s+['"]@/.test(trimmed)) {
            absolute++;
            totalImportLines++;
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    if (totalImportLines === 0) return 'unknown';

    const threshold = totalImportLines * 0.7;

    if (relative >= threshold) return 'relative';
    if (absolute >= threshold) return 'absolute';

    return 'mixed';
  }

  /**
   * Analyze all conventions for the repository
   * @returns {Object} Convention analysis result
   */
  analyze() {
    const srcDir = path.join(this.repoRoot, 'src');

    // Collect files for naming analysis
    const allFiles = fs.existsSync(srcDir)
      ? this._collectFiles(srcDir)
      : this._collectFiles(this.repoRoot);

    const naming = this._detectNaming(allFiles);

    // Structure detection
    const structure = this._detectStructure();

    // Import convention detection
    const jsFiles = fs.existsSync(srcDir)
      ? this._collectJsFiles(srcDir)
      : this._collectJsFiles(this.repoRoot);
    const imports = this._detectImports(jsFiles);

    return { naming, structure, imports };
  }

  /**
   * Analyze conventions for specific file paths
   * @param {string[]} filePaths - Array of file paths
   * @returns {Object} Convention analysis result
   */
  analyzeFiles(filePaths) {
    if (!filePaths || filePaths.length === 0) {
      return { naming: 'unknown', structure: 'unknown', imports: 'unknown' };
    }

    const naming = this._detectNaming(filePaths);
    const imports = this._detectImports(filePaths.filter(f =>
      f.endsWith('.js') || f.endsWith('.mjs') || f.endsWith('.jsx')));

    // Structure analysis requires filesystem — not available from file paths alone
    const structure = 'unknown';

    return { naming, structure, imports };
  }
}

module.exports = ConventionDetector;
