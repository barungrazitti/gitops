/**
 * DependencyMapper - Parses imports/exports and traces direct dependents
 *
 * Uses regex-based parsing for CommonJS and ESM import/export statements.
 * Traces direct dependents only — no transitive closure per D-05.
 *
 * Per D-04: Regex-based parsing, no AST dependency
 * Per D-06: Returns flat context objects
 */

const fs = require('fs-extra');
const path = require('path');

/** CommonJS static require pattern */
const COMMONJS_REQUIRE = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** ESM import patterns */
const ESM_NAMED_IMPORT = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
const ESM_SIDE_EFFECT = /import\s+['"]([^'"]+)['"]/g;
const ESM_REEXPORT = /export\s+\{[^}]*\}\s+from\s+['"]([^'"]+)['"]/g;

/** CommonJS export patterns */
const COMMONJS_NAMED_EXPORT = /exports\.(\w+)\s*=/g;
const COMMONJS_MODULE_EXPORTS = /module\.exports\s*=/g;

/** ESM export patterns */
const ESM_NAMED_EXPORT = /export\s+(?:const|let|var|function|class)\s+(\w+)/g;
const ESM_DEFAULT_EXPORT = /export\s+default/g;
const ESM_REEXPORT_EXPORT = /export\s+\{[^}]*\}\s+from/g;

/** Directories to skip when scanning */
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', 'dist', 'build',
  'coverage', '.next', '.nuxt', '__pycache__',
  '.cache', '.turbo', '.tmp', 'vendor'
]);

class DependencyMapper {
  /**
   * Create a DependencyMapper instance
   * @param {string} repoRoot - Absolute path to repository root
   */
  constructor(repoRoot) {
    this.repoRoot = repoRoot;
  }

  /**
   * Parse import statements from file content
   * @param {string} fileContent - Source file content
   * @returns {Array<{module: string, type: string, resolvedPath: null}>} Parsed imports
   */
  parseImports(fileContent) {
    if (!fileContent || typeof fileContent !== 'string') {
      return [];
    }

    const imports = [];
    const seen = new Set();

    const addImport = (module, type) => {
      // Skip non-relative imports (node_modules, builtins)
      if (!module.startsWith('.')) return;
      // Skip duplicates
      if (seen.has(module)) return;
      seen.add(module);

      imports.push({ module, type, resolvedPath: null });
    };

    // Parse CommonJS requires
    let match;
    const cjsPattern = /require\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g;
    while ((match = cjsPattern.exec(fileContent)) !== null) {
      const quote = match[1];
      const modulePath = match[2];
      // Skip dynamic/template literal requires
      if (quote === '`') continue;
      addImport(modulePath, 'commonjs');
    }

    // Parse ESM imports (avoid matching side-effect as duplicate of named)
    const esmNamedPattern = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    while ((match = esmNamedPattern.exec(fileContent)) !== null) {
      addImport(match[1], 'esm');
    }

    const esmSideEffectPattern = /import\s+['"]([^'"]+)['"]/g;
    while ((match = esmSideEffectPattern.exec(fileContent)) !== null) {
      addImport(match[1], 'esm');
    }

    const esmReexportPattern = /export\s+\{[^}]*\}\s+from\s+['"]([^'"]+)['"]/g;
    while ((match = esmReexportPattern.exec(fileContent)) !== null) {
      addImport(match[1], 'esm');
    }

    return imports;
  }

  /**
   * Parse export statements from file content
   * @param {string} fileContent - Source file content
   * @returns {Array<{name: string, type: string}>} Parsed exports
   */
  parseExports(fileContent) {
    if (!fileContent || typeof fileContent !== 'string') {
      return [];
    }

    const exports = [];
    const seen = new Set();

    // CommonJS named exports: exports.foo = ...
    const cjsNamedPattern = /exports\.(\w+)\s*=/g;
    let match;
    while ((match = cjsNamedPattern.exec(fileContent)) !== null) {
      const name = match[1];
      if (!seen.has(name)) {
        seen.add(name);
        exports.push({ name, type: 'named' });
      }
    }

    // ESM named exports: export const/function/class name
    const esmNamedPattern = /export\s+(?:const|let|var|function|class)\s+(\w+)/g;
    while ((match = esmNamedPattern.exec(fileContent)) !== null) {
      const name = match[1];
      if (!seen.has(name)) {
        seen.add(name);
        exports.push({ name, type: 'named' });
      }
    }

    // CommonJS module.exports = something (check if assigning a named identifier)
    const moduleExportPattern = /module\.exports\s*=\s*(\w+)/g;
    while ((match = moduleExportPattern.exec(fileContent)) !== null) {
      exports.push({ name: match[1], type: 'default' });
    }

    // module.exports = { ... } (object literal, not a named thing)
    if (/module\.exports\s*=\s*\{/.test(fileContent) &&
        !/module\.exports\s*=\s*\w+/.test(fileContent.replace(/module\.exports\s*=\s*\{[^}]*\}\s*;?\s*$/m, ''))) {
      // Only add default if not already captured by named pattern above
      if (!exports.some(e => e.type === 'default')) {
        exports.push({ name: 'module.exports', type: 'default' });
      }
    }

    // ESM default export
    if (/export\s+default\b/.test(fileContent)) {
      if (!exports.some(e => e.type === 'default')) {
        exports.push({ name: 'default', type: 'default' });
      }
    }

    // ESM re-exports
    if (/export\s+\{[^}]*\}\s+from/.test(fileContent)) {
      exports.push({ name: 're-export', type: 'reexport' });
    }

    return exports;
  }

  /**
   * Build dependency graph for a set of files
   * @param {Map<string, string>} filesWithContents - Map of filePath → content
   * @returns {Object} Dependency graph with imports, exports, and affected files
   */
  mapDependencies(filesWithContents) {
    const imports = [];
    const exports = [];
    const changedFiles = new Set();

    // Parse each file
    for (const [filePath, content] of filesWithContents) {
      changedFiles.add(filePath);

      const parsedImports = this.parseImports(content);
      for (const imp of parsedImports) {
        imports.push({
          file: filePath,
          module: imp.module,
          type: imp.type
        });
      }

      const parsedExports = this.parseExports(content);
      for (const exp of parsedExports) {
        exports.push({
          file: filePath,
          name: exp.name,
          type: exp.type
        });
      }
    }

    // Find affected files (direct dependents only)
    const affected = this._findAffectedFiles(changedFiles);

    return { imports, exports, affected };
  }

  /**
   * Find files that import any of the changed files (direct dependents only)
   * @param {Set<string>} changedFiles - Set of changed file paths
   * @returns {string[]} List of affected file paths
   */
  _findAffectedFiles(changedFiles) {
    const affected = [];
    const srcDir = path.join(this.repoRoot, 'src');

    // Determine scan directory
    let scanDir;
    if (fs.existsSync(srcDir)) {
      scanDir = srcDir;
    } else {
      scanDir = this.repoRoot;
    }

    // Collect all source files to scan
    const sourceFiles = this._collectSourceFiles(scanDir);

    for (const sourceFile of sourceFiles) {
      // Skip changed files themselves
      if (changedFiles.has(sourceFile)) continue;

      try {
        const content = fs.readFileSync(path.join(this.repoRoot, sourceFile), 'utf-8');
        const imports = this.parseImports(content);

        for (const imp of imports) {
          // Check if this import references a changed file
          if (this._importReferencesFile(imp.module, sourceFile, changedFiles)) {
            if (!affected.includes(sourceFile)) {
              affected.push(sourceFile);
            }
            break;
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return affected;
  }

  /**
   * Collect all source files in a directory recursively
   * @param {string} dir - Directory to scan
   * @param {string[]} results - Accumulator
   * @returns {string[]} Source file paths (relative to repoRoot)
   */
  _collectSourceFiles(dir, results = []) {
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        if (SKIP_DIRS.has(item) || item.startsWith('.')) continue;

        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          this._collectSourceFiles(fullPath, results);
        } else if (item.endsWith('.js') || item.endsWith('.mjs') || item.endsWith('.jsx')) {
          const relativePath = path.relative(this.repoRoot, fullPath);
          results.push(relativePath);
        }
      }
    } catch {
      // Skip
    }

    return results;
  }

  /**
   * Check if an import module path references a changed file
   * @param {string} importModule - Import path (e.g., './utils')
   * @param {string} sourceFile - Source file containing the import
   * @param {Set<string>} changedFiles - Set of changed file paths
   * @returns {boolean}
   */
  _importReferencesFile(importModule, sourceFile, changedFiles) {
    if (!importModule.startsWith('.')) return false;

    // Resolve the import path relative to the source file's directory
    const sourceDir = path.dirname(sourceFile);
    let resolvedImport;

    if (importModule.startsWith('/') || importModule.startsWith('./') || importModule.startsWith('../')) {
      resolvedImport = path.normalize(path.join(sourceDir, importModule));
    } else {
      resolvedImport = importModule;
    }

    // Normalize separators
    resolvedImport = resolvedImport.replace(/\\/g, '/');

    // Check direct match
    if (changedFiles.has(resolvedImport)) return true;

    // Check with common extensions appended
    const extensions = ['.js', '.jsx', '.mjs', '.ts', '.tsx', '/index.js'];
    for (const ext of extensions) {
      if (changedFiles.has(resolvedImport + ext)) return true;
    }

    // Check without extension
    const withoutExt = resolvedImport.replace(/\.(js|jsx|mjs|ts|tsx)$/, '');
    if (changedFiles.has(withoutExt)) return true;

    return false;
  }

  /**
   * Find direct dependents of a changed file
   * @param {string} changedFilePath - Path of the changed file (relative to repoRoot)
   * @param {string[]|null} [repoSourceFiles=null] - Optional list of files to scan
   * @returns {Array<{file: string, importStatement: string}>} Direct dependents
   */
  findDependents(changedFilePath, repoSourceFiles = null) {
    const dependents = [];
    const sourceFiles = repoSourceFiles || this._collectSourceFiles(this.repoRoot);

    const normalizedChanged = changedFilePath.replace(/\\/g, '/');

    for (const sourceFile of sourceFiles) {
      // Skip the changed file itself
      if (sourceFile.replace(/\\/g, '/') === normalizedChanged) continue;

      try {
        const fullPath = path.join(this.repoRoot, sourceFile);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const imports = this.parseImports(content);

        for (const imp of imports) {
          if (this._importReferencesFile(imp.module, sourceFile, new Set([normalizedChanged]))) {
            dependents.push({
              file: sourceFile,
              importStatement: imp.module
            });
            break;
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return dependents;
  }
}

module.exports = DependencyMapper;
