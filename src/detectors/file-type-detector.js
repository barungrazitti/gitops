/**
 * FileTypeDetector - Categorizes files by type, language, and framework
 *
 * Provides per-file classification and aggregate summaries. Patterns are
 * consistent with analysis-engine.js categorizeFiles() to maintain compatibility.
 *
 * Per D-06: Returns flat context objects (no wrappers/metadata/confidence/timestamps)
 */

const path = require('path');

/** Test file patterns (checked before source) */
const TEST_PATTERN = /\.(test|spec)\.(js|ts|jsx|tsx|py|java|cpp|c|cs|php|rb|go|rs)$/;

/** Source file patterns */
const SOURCE_PATTERN = /\.(js|jsx|mjs|ts|tsx|py|java|cpp|c|cs|php|rb|go|rs|swift|kt|vue|svelte)$/;

/** Config file patterns */
const CONFIG_NAMES = /^(Dockerfile|Makefile|package\.json|requirements\.txt|Gemfile|Cargo\.toml)$/i;
const CONFIG_EXT = /\.(json|yaml|yml|toml|ini|conf|config|env)$/;

/** Docs file patterns */
const DOCS_NAMES = /^(README|CHANGELOG|LICENSE|CONTRIBUTING)/i;
const DOCS_EXT = /\.(md|txt|rst|adoc|tex)$/;

/** Asset file patterns */
const ASSET_PATTERN = /\.(png|jpg|jpeg|gif|svg|ico|css|scss|sass|less|woff|woff2|ttf|eot)$/;

/** Extension to language mapping */
const EXT_TO_LANGUAGE = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.php': 'php',
  '.rb': 'ruby',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.css': 'css',
  '.scss': 'css',
  '.sass': 'css',
  '.less': 'css',
  '.html': 'html',
  '.svelte': 'svelte',
  '.vue': 'vue'
};

/** Framework detection patterns */
const FRAMEWORK_PATTERNS = {
  react: [
    /import\s+.*?\s+from\s+['"]react['"]/,
    /require\s*\(\s*['"]react['"]\s*\)/
  ],
  angular: [
    /@angular\/core/
  ],
  nextjs: [
    /from\s+['"]next(?:\/|['"])/,
    /require\s*\(\s*['"]next(?:\/|['"])\s*\)/
  ],
  express: [
    /express\s*\(\s*\)/,
    /require\s*\(\s*['"]express['"]\s*\)/
  ]
};

class FileTypeDetector {
  /**
   * Create a FileTypeDetector instance
   * @param {string} repoRoot - Absolute path to repository root
   */
  constructor(repoRoot) {
    this.repoRoot = repoRoot;
  }

  /**
   * Detect file type from path
   * @param {string} filePath - File path or basename
   * @returns {string} File type: 'test', 'source', 'config', 'docs', 'asset', 'other'
   */
  _detectType(filePath) {
    const basename = path.basename(filePath);
    const name = path.basename(filePath, path.extname(filePath));

    // Check test FIRST (before source — same priority as Phase 1 fix)
    if (TEST_PATTERN.test(filePath)) return 'test';

    // Check config (specific filenames first, then extensions)
    if (CONFIG_NAMES.test(basename) || CONFIG_EXT.test(filePath)) return 'config';

    // Check docs (specific filenames first, then extensions)
    if (DOCS_NAMES.test(basename) || DOCS_EXT.test(filePath)) return 'docs';

    // Check assets
    if (ASSET_PATTERN.test(filePath)) return 'asset';

    // Check source
    if (SOURCE_PATTERN.test(filePath)) return 'source';

    return 'other';
  }

  /**
   * Detect programming language from file extension
   * @param {string} filePath - File path
   * @param {string} fileType - Detected file type
   * @returns {string|null} Language name or null
   */
  _detectLanguage(filePath, fileType) {
    // Config/docs/asset files don't have a language
    if (fileType === 'config' || fileType === 'docs' || fileType === 'asset') {
      // Exception: CSS is both asset and language
      if (fileType === 'asset') {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.css' || ext === '.scss' || ext === '.sass' || ext === '.less') {
          return 'css';
        }
      }
      return null;
    }

    const ext = path.extname(filePath).toLowerCase();
    return EXT_TO_LANGUAGE[ext] || null;
  }

  /**
   * Detect framework from file content and extension
   * @param {string} filePath - File path
   * @param {string} fileType - Detected file type
   * @param {string|null} fileContent - Optional file content for framework detection
   * @returns {string|null} Framework name or null
   */
  _detectFramework(filePath, fileType, fileContent) {
    const ext = path.extname(filePath).toLowerCase();

    // Svelte detection by extension
    if (ext === '.svelte') return 'svelte';

    // Vue detection by extension
    if (ext === '.vue') return 'vue';

    // Content-based detection only for source/test files
    if (fileType !== 'source' && fileType !== 'test') return null;
    if (!fileContent) return null;

    for (const [framework, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(fileContent)) {
          return framework;
        }
      }
    }

    return null;
  }

  /**
   * Detect type, language, and framework for a single file
   * @param {string} filePath - File path (relative or basename)
   * @param {string|null} [fileContent=null] - Optional file content for framework detection
   * @returns {Object} Detection result { type, language, framework }
   */
  detect(filePath, fileContent = null) {
    const type = this._detectType(filePath);
    const language = this._detectLanguage(filePath, type);
    const framework = this._detectFramework(filePath, type, fileContent);

    return { type, language, framework };
  }

  /**
   * Detect types for multiple files with aggregate summary
   * @param {string[]} filePaths - Array of file paths
   * @param {Map<string, string>|null} [contents=null] - Optional map of filePath → content
   * @returns {Object} Batch result with files array and summary
   */
  detectBatch(filePaths, contents = null) {
    const files = [];
    const countByType = {
      source: 0, test: 0, config: 0,
      docs: 0, asset: 0, other: 0
    };
    const countByLanguage = {};
    const frameworksDetected = new Set();

    for (const filePath of filePaths) {
      const content = contents ? contents.get(filePath) || null : null;
      const result = this.detect(filePath, content);

      files.push({
        path: filePath,
        ...result
      });

      // Aggregate counts
      countByType[result.type] = (countByType[result.type] || 0) + 1;

      if (result.language) {
        countByLanguage[result.language] = (countByLanguage[result.language] || 0) + 1;
      }

      if (result.framework) {
        frameworksDetected.add(result.framework);
      }
    }

    return {
      files,
      summary: {
        totalFiles: files.length,
        countByType,
        countByLanguage,
        frameworksDetected: Array.from(frameworksDetected).sort()
      }
    };
  }
}

module.exports = FileTypeDetector;
