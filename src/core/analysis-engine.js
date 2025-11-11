/**
 * Analysis Engine - Analyzes repository context and patterns
 */

const GitManager = require('./git-manager');
const fs = require('fs-extra');
const path = require('path');
const ProjectTypeDetector = require('../utils/project-type-detector');

class AnalysisEngine {
  constructor() {
    this.gitManager = new GitManager();
  }

  /**
   * Analyze repository for context
   */
  async analyzeRepository() {
    try {
      const [repoInfo, commitPatterns, fileContext, projectType] =
        await Promise.all([
          this.gitManager.getRepositoryInfo(),
          this.gitManager.getCommitPatterns(),
          this.analyzeFileContext(),
          this.detectProjectType(),
        ]);

      return {
        repository: repoInfo,
        patterns: commitPatterns,
        files: fileContext,
        project: projectType,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.warn('Repository analysis failed:', error.message);
      return {
        repository: {},
        patterns: {},
        files: {},
        project: { type: 'unknown' },
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Analyze file context from staged changes
   */
  async analyzeFileContext() {
    try {
      const stagedFiles = await this.gitManager.getStagedFiles();
      const fileStats = await this.gitManager.getFileStats();
      const semanticContext = await this.analyzeSemanticContext(stagedFiles);

      const context = {
        totalFiles: stagedFiles.length,
        fileTypes: this.categorizeFiles(stagedFiles),
        changes: {
          insertions: fileStats.insertions,
          deletions: fileStats.deletions,
          modified: fileStats.changed,
        },
        scope: this.inferScope(stagedFiles),
        wordpress: this.detectWordPressContext(stagedFiles),
        semantic: semanticContext, // Add semantic context
      };

      return context;
    } catch (error) {
      console.warn('File context analysis failed:', error.message);
      return {
        totalFiles: 0,
        fileTypes: {},
        changes: { insertions: 0, deletions: 0, modified: 0 },
        scope: 'unknown',
        semantic: {},
      };
    }
  }

  /**
   * Categorize files by type
   */
  categorizeFiles(files) {
    const categories = {
      source: 0,
      test: 0,
      config: 0,
      docs: 0,
      assets: 0,
      other: 0,
    };

    const patterns = {
      source: /\.(js|ts|jsx|tsx|py|java|cpp|c|cs|php|rb|go|rs|swift|kt)$/i,
      test: /\.(test|spec)\.(js|ts|jsx|tsx|py|java|cpp|c|cs|php|rb|go|rs)$|test.*\.(js|ts|py)$|.*test\.(js|ts|py)$/i,
      config:
        /\.(json|yaml|yml|toml|ini|conf|config|env)$|Dockerfile|Makefile|CMakeLists\.txt|package\.json|requirements\.txt|Gemfile|Cargo\.toml$/i,
      docs: /\.(md|txt|rst|adoc|tex)$|README|CHANGELOG|LICENSE|CONTRIBUTING/i,
      assets:
        /\.(png|jpg|jpeg|gif|svg|ico|css|scss|sass|less|woff|woff2|ttf|eot)$/i,
    };

    files.forEach((file) => {
      let categorized = false;

      for (const [category, pattern] of Object.entries(patterns)) {
        if (pattern.test(file)) {
          categories[category]++;
          categorized = true;
          break;
        }
      }

      if (!categorized) {
        categories.other++;
      }
    });

    return categories;
  }

  /**
   * Infer scope from file paths with enhanced patterns
   */
  inferScope(files) {
    const scopePatterns = {
      api: /api|endpoint|route|controller|handler|service/i,
      ui: /ui|component|view|page|frontend|client|template/i,
      auth: /auth|login|user|session|security|passport|jwt/i,
      db: /database|db|model|schema|migration|repository|dao/i,
      config: /config|setting|env|environment|constant/i,
      test: /test|spec|mock|fixture|cypress|jest/i,
      docs: /doc|readme|changelog|guide|tutorial/i,
      build: /build|webpack|rollup|vite|babel|grunt|gulp|parcel/i,
      ci: /\.github|\.gitlab|jenkins|travis|circle|action|workflow/i,
      utils: /util|helper|common|shared|lib/i,
      types: /type|interface|dto|entity|model/i,
      deps: /package|npm|yarn|dependency|requirement/i,
      perf: /performance|optimize|cache|lazy|memo/i,
      // WordPress-specific patterns with higher priority
      wordpress: /wp-config\.php|wp-content|wp-includes|wp-admin|wordpress|\.php$/i,
      plugins: /wp-content\/plugins|wp-plugins|plugins\//i,
      themes: /wp-content\/themes|wp-themes|themes\//i,
      core: /wp-includes|wp-admin|wp-[^/]*\.php$/i,
      posts: /posts?|article|blog|content/i,
      pages: /pages?|template|page-[^/]*\.php|front-page\.php|home\.php|single\.php|archive\.php|category\.php|tag\.php/i,
      media: /media|uploads|images?|assets?\/uploads/i,
      widgets: /widgets?|sidebar|footer|header/i,
      customizer: /customizer|customize|theme-options/i,
      woocommerce: /woocommerce|wc-|shop|product|cart|checkout/i,
      // More specific patterns for better scope detection
      shopping: /shopping|cart|checkout|product|item/i,
      ecommerce: /ecommerce|e-commerce|store|shop/i,
      examples: /example|demo|sample|test/i,
    };

    const scopeCounts = {};

    files.forEach((file) => {
      for (const [scope, pattern] of Object.entries(scopePatterns)) {
        if (pattern.test(file)) {
          scopeCounts[scope] = (scopeCounts[scope] || 0) + 1;
        }
      }
    });

    // Enhanced scope prioritization with WordPress taking higher priority
    const prioritizedScopes = [
      'wordpress',    // Top priority - WordPress-specific
      'core',         // WordPress core
      'themes',       // WordPress themes
      'plugins',      // WordPress plugins
      'woocommerce',  // WordPress e-commerce
      'posts',        // WordPress content
      'pages',        // WordPress pages
      'media',        // WordPress media
      'widgets',      // WordPress widgets
      'customizer',   // WordPress customizer
      'api',          // Standard scopes follow
      'ui',
      'auth',
      'db',
      'config',
      'test',
      'docs',
      'build',
      'ci',
      'utils',
      'types',
      'deps',
      'perf',
    ];

    // Sort by count first for WordPress-related scopes, then by priority
    const sortedScopes = Object.entries(scopeCounts).sort((a, b) => {
      // First check if either scope is WordPress-related
      const isAWordpress = prioritizedScopes.slice(0, 8).includes(a[0]); // WordPress top priorities
      const isBWordpress = prioritizedScopes.slice(0, 8).includes(b[0]); // WordPress top priorities
      
      // If one is WordPress-related and the other isn't, prioritize WordPress
      if (isAWordpress && !isBWordpress) return -1;
      if (!isAWordpress && isBWordpress) return 1;
      
      // If both are WordPress-related or both are not, sort by count first
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      
      // Then sort by priority
      const aPriority = prioritizedScopes.indexOf(a[0]);
      const bPriority = prioritizedScopes.indexOf(b[0]);
      return aPriority - bPriority;
    });

    const topScope = sortedScopes[0];

    // If WordPress-related files are detected, prioritize them
    const wordpressRelatedScopes = ['wordpress', 'themes', 'plugins', 'core', 'woocommerce'];
    const hasWordpressFiles = files.some(file => 
      /wp-content|wp-includes|wp-admin|wp-config\.php|\.php$/i.test(file)
    );

    // If WordPress files exist and top scope is WordPress-related, return it
    if (hasWordpressFiles && topScope && wordpressRelatedScopes.includes(topScope[0])) {
      return topScope[0];
    }

    // If WordPress files exist but no specific WordPress scope was found, return 'wordpress' as general
    if (hasWordpressFiles && (!topScope || !wordpressRelatedScopes.includes(topScope[0]))) {
      return 'wordpress';
    }

    return topScope ? topScope[0] : 'general';
  }

  /**
   * Analyze semantic context from changed files
   */
  async analyzeSemanticContext(stagedFiles) {
    try {
      const repoRoot = await this.gitManager.getRepositoryRoot();
      const semanticContext = {
        functions: [],
        classes: [],
        imports: [],
        exports: [],
        endpoints: [],
        components: [],
        tests: [],
        configs: [],
      };

      for (const file of stagedFiles.slice(0, 10)) {
        // Limit to prevent performance issues
        const filePath = path.join(repoRoot, file);
        if (!(await fs.pathExists(filePath))) continue;

        const content = await fs.readFile(filePath, 'utf8');
        const ext = path.extname(file).toLowerCase();

        // Analyze based on file type
        if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
          await this.analyzeJavaScriptFile(content, semanticContext);
        } else if (['.php'].includes(ext)) {
          await this.analyzePHPFile(content, semanticContext);
        } else if (['.py'].includes(ext)) {
          await this.analyzePythonFile(content, semanticContext);
        }
      }

      return semanticContext;
    } catch (error) {
      console.warn('Semantic analysis failed:', error.message);
      return {};
    }
  }

  /**
   * Analyze JavaScript/TypeScript files for semantic context
   */
  async analyzeJavaScriptFile(content, context) {
    // Function detection
    const functionMatches = content.match(
      /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>|(\w+)\s*:\s*\([^)]*\)\s*=>)/g
    );
    if (functionMatches) {
      context.functions.push(
        ...functionMatches.map((m) =>
          m
            .replace(/.*function\s+|const\s+|:.*/, '')
            .replace(/\s*=.*/, '')
            .trim()
        )
      );
    }

    // Class detection
    const classMatches = content.match(/class\s+(\w+)/g);
    if (classMatches) {
      context.classes.push(
        ...classMatches.map((m) => m.replace('class ', '').trim())
      );
    }

    // Import/Export detection
    const importMatches = content.match(/import.*from\s+['"]([^'"]+)['"]/g);
    if (importMatches) {
      context.imports.push(
        ...importMatches.map((m) => m.match(/from\s+['"]([^'"]+)['"]/)[1])
      );
    }

    const exportMatches = content.match(
      /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g
    );
    if (exportMatches) {
      context.exports.push(
        ...exportMatches.map((m) =>
          m
            .replace(
              /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+/,
              ''
            )
            .trim()
        )
      );
    }

    // API endpoint detection
    const endpointMatches = content.match(
      /(?:app\.(get|post|put|delete|patch)|router\.(get|post|put|delete|patch))\s*\(\s*['"]([^'"]+)['"]/g
    );
    if (endpointMatches) {
      context.endpoints.push(
        ...endpointMatches.map(
          (m) =>
            `${m.match(/\.(get|post|put|delete|patch)/)[1].toUpperCase()} ${m.match(/['"]([^'"]+)['"]/)[1]}`
        )
      );
    }

    // React component detection
    const componentMatches = content.match(
      /(?:function\s+(\w+)\s*\([^)]*\)\s*{|const\s+(\w+)\s*=\s*(?:React\.)?(?:forwardRef\s*\()?\([^)]*\)\s*=>\s*{)/g
    );
    if (componentMatches) {
      context.components.push(
        ...componentMatches.map((m) =>
          m
            .replace(/.*function\s+|const\s+|.*React\.forwardRef.*\(/, '')
            .replace(/\s*\(.*/, '')
            .trim()
        )
      );
    }
  }

  /**
   * Analyze PHP files for semantic context
   */
  async analyzePHPFile(content, context) {
    // Function detection with better pattern
    const functionMatches = content.match(/function\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
    if (functionMatches) {
      const functionNames = functionMatches.map((m) => m.replace('function ', '').trim());
      context.functions.push(...functionNames);
    }

    // Class detection
    const classMatches = content.match(/class\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
    if (classMatches) {
      const classNames = classMatches.map((m) => m.replace('class ', '').trim());
      context.classes.push(...classNames);
    }

    // WordPress hook detection with broader patterns
    const actionMatches = content.match(/add_action\s*\(\s*['"][^'"]+['"]/g);
    const filterMatches = content.match(/add_filter\s*\(\s*['"][^'"]+['"]/g);
    const shortcodeMatches = content.match(/add_shortcode\s*\(\s*['"][^'"]+['"]/g);
    const actionMatchesFull = content.match(/add_action\s*\(\s*['"]([^'"]+)['"]/g);
    const filterMatchesFull = content.match(/add_filter\s*\(\s*['"]([^'"]+)['"]/g);
    const shortcodeMatchesFull = content.match(/add_shortcode\s*\(\s*['"]([^'"]+)['"]/g);

    if (actionMatches || filterMatches || shortcodeMatches) {
      context.wordpress_hooks = context.wordpress_hooks || [];
      if (actionMatchesFull) {
        const actions = actionMatchesFull.map(m => m.match(/['"]([^'"]+)['"]/)[1]);
        context.wordpress_hooks.push(...actions);
      }
      if (filterMatchesFull) {
        const filters = filterMatchesFull.map(m => m.match(/['"]([^'"]+)['"]/)[1]);
        context.wordpress_hooks.push(...filters);
      }
      if (shortcodeMatchesFull) {
        const shortcodes = shortcodeMatchesFull.map(m => m.match(/['"]([^'"]+)['"]/)[1]);
        context.wordpress_hooks.push(...shortcodes);
      }
    }

    // WordPress function detection
    const wpFunctionMatches = content.match(/(?:wp_|get_|is_|the_|do_|apply_|current_)\w+/g);
    if (wpFunctionMatches) {
      const wpFunctions = wpFunctionMatches.filter(func => 
        !['function', 'if', 'else', 'for', 'while', 'return'].includes(func) &&
        !func.includes('(') // Avoid matches that include parentheses
      );
      context.wordpress_functions = context.wordpress_functions || [];
      context.wordpress_functions.push(...wpFunctions);
    }

    // WordPress template detection
    const templateMatches = content.match(/(?:get_template_part|get_header|get_footer|get_sidebar|load_template)\s*\(/g);
    if (templateMatches) {
      context.wordpress_templates = context.wordpress_templates || [];
      context.wordpress_templates.push(...templateMatches);
    }
  }

  /**
   * Analyze Python files for semantic context
   */
  async analyzePythonFile(content, context) {
    // Function detection
    const functionMatches = content.match(/def\s+(\w+)/g);
    if (functionMatches) {
      context.functions.push(
        ...functionMatches.map((m) => m.replace('def ', '').trim())
      );
    }

    // Class detection
    const classMatches = content.match(/class\s+(\w+)/g);
    if (classMatches) {
      context.classes.push(
        ...classMatches.map((m) => m.replace('class ', '').trim())
      );
    }

    // Import detection
    const importMatches = content.match(
      /from\s+(\w+)(?:\.\w+)*\s+import|import\s+(\w+)/g
    );
    if (importMatches) {
      context.imports.push(
        ...importMatches.map((m) => m.match(/(?:from\s+|import\s+)(\w+)/)[1])
      );
    }
  }
  detectWordPressContext(files) {
    const context = {
      isWordPress: false,
      type: null,
      components: [],
      specificPages: [],
      plugins: [],
      themes: [],
    };

    // Check if this is a WordPress project
    const hasWordPressFiles = files.some((file) =>
      /wp-content|wp-includes|wp-admin|wp-config\.php/i.test(file)
    );

    if (!hasWordPressFiles) {
      return context;
    }

    context.isWordPress = true;

    // Analyze each file for WordPress-specific context
    files.forEach((file) => {
      const lowerFile = file.toLowerCase();

      // Detect WordPress components
      if (/wp-content\/plugins/i.test(lowerFile)) {
        context.type = 'plugin';
        const pluginMatch = file.match(/wp-content\/plugins\/([^/]+)/i);
        if (pluginMatch && !context.plugins.includes(pluginMatch[1])) {
          context.plugins.push(pluginMatch[1]);
        }
      }

      if (/wp-content\/themes/i.test(lowerFile)) {
        context.type = 'theme';
        const themeMatch = file.match(/wp-content\/themes\/([^/]+)/i);
        if (themeMatch && !context.themes.includes(themeMatch[1])) {
          context.themes.push(themeMatch[1]);
        }
      }

      if (/wp-includes|wp-admin/i.test(lowerFile)) {
        context.type = 'core';
      }

      // Detect specific pages or templates
      const pagePatterns = [
        /page-([^.]+)\.php/,
        /template-([^.]+)\.php/,
        /single-([^.]+)\.php/,
        /archive-([^.]+)\.php/,
        /category-([^.]+)\.php/,
        /tag-([^.]+)\.php/,
        /taxonomy-([^.]+)\.php/,
        /author-([^.]+)\.php/,
        /date-([^.]+)\.php/,
        /search-([^.]+)\.php/,
        /404\.php/,
        /front-page\.php/,
        /home\.php/,
        /index\.php/,
      ];

      for (const pattern of pagePatterns) {
        const match = file.match(pattern);
        if (match) {
          const pageName = match[1] || match[0].replace('.php', '');
          if (!context.specificPages.includes(pageName)) {
            context.specificPages.push(pageName);
          }
        }
      }

      // Detect WordPress components
      if (/functions\.php/i.test(lowerFile)) {
        context.components.push('theme-functions');
      }
      if (/style\.css/i.test(lowerFile)) {
        context.components.push('theme-styles');
      }
      if (/script\.js|main\.js/i.test(lowerFile)) {
        context.components.push('theme-scripts');
      }
      if (/customizer/i.test(lowerFile)) {
        context.components.push('customizer');
      }
      if (/widget/i.test(lowerFile)) {
        context.components.push('widgets');
      }
      if (/sidebar/i.test(lowerFile)) {
        context.components.push('sidebar');
      }
      if (/header|footer/i.test(lowerFile)) {
        context.components.push('layout');
      }
      if (/loop|content/i.test(lowerFile)) {
        context.components.push('content-loop');
      }
      if (/comment/i.test(lowerFile)) {
        context.components.push('comments');
      }
      if (/woocommerce|wc-/i.test(lowerFile)) {
        context.components.push('woocommerce');
      }
    });

    // Remove duplicates
    context.components = [...new Set(context.components)];

    return context;
  }

  /**
   * Detect project type
   */
  async detectProjectType() {
    try {
      const repoRoot = await this.gitManager.getRepositoryRoot();

      // Use the enhanced project type detector
      return await ProjectTypeDetector.detectProjectType(repoRoot);
    } catch (error) {
      console.warn('Project type detection failed:', error.message);
      return {
        types: ['unknown'],
        primary: 'unknown',
        isMonorepo: false,
        hasTests: false,
        hasCI: false,
        wordpress: null,
      };
    }
  }

  /**
   * Detect if project is a monorepo
   */
  async detectMonorepo(repoRoot) {
    const monorepoIndicators = [
      'lerna.json',
      'nx.json',
      'rush.json',
      'pnpm-workspace.yaml',
      'yarn.lock', // with workspaces in package.json
    ];

    for (const indicator of monorepoIndicators) {
      if (await fs.pathExists(path.join(repoRoot, indicator))) {
        return true;
      }
    }

    // Check for workspaces in package.json
    try {
      const packageJsonPath = path.join(repoRoot, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        if (packageJson.workspaces) {
          return true;
        }
      }
    } catch (error) {
      // Ignore errors
    }

    return false;
  }

  /**
   * Check if project has test files
   */
  async hasTestFiles(repoRoot) {
    // Test patterns for future use
    // const _testPatterns = [
    //   '*.test.*',
    //   '*.spec.*',
    // ];

    // Simple check for common test directories
    const testDirs = ['test', 'tests', 'spec', '__tests__'];
    for (const dir of testDirs) {
      if (await fs.pathExists(path.join(repoRoot, dir))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if project has CI configuration
   */
  async hasCIConfig(repoRoot) {
    const ciFiles = [
      '.github/workflows',
      '.gitlab-ci.yml',
      'jenkins.yml',
      'Jenkinsfile',
      '.travis.yml',
      'circle.yml',
      '.circleci/config.yml',
      'azure-pipelines.yml',
    ];

    for (const file of ciFiles) {
      if (await fs.pathExists(path.join(repoRoot, file))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Analyze code complexity with enhanced detection
   */
  async analyzeComplexity(diff) {
    const lines = diff.split('\n');
    const addedLines = lines.filter((line) => line.startsWith('+')).length;
    const removedLines = lines.filter((line) => line.startsWith('-')).length;

    // Enhanced complexity indicators
    const complexity = {
      linesAdded: addedLines,
      linesRemoved: removedLines,
      netChange: addedLines - removedLines,
      hasLogic: /if|else|for|while|switch|try|catch/.test(diff),
      hasImports: /import|require|from/.test(diff),
      hasExports: /export|module\.exports/.test(diff),
      hasFunctions: /function|=>|def |class |constructor/.test(diff),
      hasTests: /test|spec|describe|it\(|expect|assert/.test(diff),
      hasConfig: /config|env|setting|constant/.test(diff),
      hasAuth: /auth|login|user|session|jwt|passport/.test(diff),
      hasApi: /api|endpoint|route|controller|handler/.test(diff),
      hasDb: /database|db|model|schema|migration|sql/.test(diff),
      hasUi: /component|view|template|style|css|html/.test(diff),
      hasFix: /fix|bug|error|issue|problem|correct/.test(diff),
      hasFeature: /add|new|implement|create|introduce|feature/.test(diff),
      hasRefactor: /refactor|restructure|reorganize|clean|improve/.test(diff),
      hasPerf: /performance|optimize|cache|lazy|memo|speed/.test(diff),
      hasDocs: /doc|readme|comment|documentation/.test(diff),
      hasDeps: /package|npm|yarn|dependency|requirement/.test(diff),
    };

    // Enhanced change type determination with priority scoring
    const typeScores = {
      test: complexity.hasTests ? 10 : 0,
      fix: complexity.hasFix ? 9 : 0,
      feat: complexity.hasFeature ? 8 : 0,
      refactor: complexity.hasRefactor ? 7 : 0,
      perf: complexity.hasPerf ? 6 : 0,
      docs: complexity.hasDocs ? 5 : 0,
      deps: complexity.hasDeps ? 4 : 0,
      chore: complexity.hasConfig ? 3 : 0,
      build: 0,
      ci: 0,
      style: 0,
    };

    // Determine primary change type based on highest score
    let maxScore = 0;
    let primaryType = 'chore';

    for (const [type, score] of Object.entries(typeScores)) {
      if (score > maxScore) {
        maxScore = score;
        primaryType = type;
      }
    }

    // Fallback logic for edge cases
    if (maxScore === 0) {
      if (complexity.hasImports || complexity.hasExports) {
        primaryType = 'refactor';
      } else if (addedLines === 0 && removedLines > 0) {
        primaryType = 'remove';
      } else if (complexity.hasFunctions && addedLines > removedLines) {
        primaryType = 'feat';
      } else if (complexity.hasLogic) {
        primaryType = 'fix';
      }
    }

    complexity.changeType = primaryType;
    complexity.confidence = maxScore > 0 ? maxScore / 10 : 0.1;

    return complexity;
  }

  /**
   * Analyze code complexity with enhanced detection
   */
  analyzeComplexityWithEnhancement(diff) {
    const lines = diff.split('\n');
    const addedLines = lines.filter((line) => line.startsWith('+')).length;
    const removedLines = lines.filter((line) => line.startsWith('-')).length;

    // Enhanced complexity indicators
    const complexity = {
      linesAdded: addedLines,
      linesRemoved: removedLines,
      netChange: addedLines - removedLines,
      hasLogic: /if|else|for|while|switch|try|catch/.test(diff),
      hasImports: /import|require|from/.test(diff),
      hasExports: /export|module\.exports/.test(diff),
      hasFunctions: /function|=>|def |class |constructor/.test(diff),
      hasTests: /test|spec|describe|it\(|expect|assert/.test(diff),
      hasConfig: /config|env|setting|constant/.test(diff),
      hasAuth: /auth|login|user|session|jwt|passport/.test(diff),
      hasApi: /api|endpoint|route|controller|handler/.test(diff),
      hasDb: /database|db|model|schema|migration|sql/.test(diff),
      hasUi: /component|view|template|style|css|html/.test(diff),
      hasFix: /fix|bug|error|issue|problem|correct/.test(diff),
      hasFeature: /add|new|implement|create|introduce|feature/.test(diff),
      hasRefactor: /refactor|restructure|reorganize|clean|improve/.test(diff),
      hasPerf: /performance|optimize|cache|lazy|memo|speed/.test(diff),
      hasDocs: /doc|readme|comment|documentation/.test(diff),
      hasDeps: /package|npm|yarn|dependency|requirement/.test(diff),
    };

    // Enhanced change type determination with priority scoring
    const typeScores = {
      test: complexity.hasTests ? 10 : 0,
      fix: complexity.hasFix ? 9 : 0,
      feat: complexity.hasFeature ? 8 : 0,
      refactor: complexity.hasRefactor ? 7 : 0,
      perf: complexity.hasPerf ? 6 : 0,
      docs: complexity.hasDocs ? 5 : 0,
      deps: complexity.hasDeps ? 4 : 0,
      chore: complexity.hasConfig ? 3 : 0,
      build: 0,
      ci: 0,
      style: 0,
    };

    // Determine primary change type based on highest score
    let maxScore = 0;
    let primaryType = 'chore';

    for (const [type, score] of Object.entries(typeScores)) {
      if (score > maxScore) {
        maxScore = score;
        primaryType = type;
      }
    }

    // Fallback logic for edge cases
    if (maxScore === 0) {
      if (complexity.hasImports || complexity.hasExports) {
        primaryType = 'refactor';
      } else if (addedLines === 0 && removedLines > 0) {
        primaryType = 'remove';
      } else if (complexity.hasFunctions && addedLines > removedLines) {
        primaryType = 'feat';
      } else if (complexity.hasLogic) {
        primaryType = 'fix';
      }
    }

    complexity.changeType = primaryType;
    complexity.confidence = maxScore > 0 ? maxScore / 10 : 0.1;

    return complexity;
  }

  /**
   * Extract code changes from diff with advanced filtering
   */
  extractCodeChanges(diff, minLineLength = 10) {
    const lines = diff.split('\n');
    let currentFile = '';
    const changes = [];

    // Track current file context
    lines.forEach(line => {
      const fileMatch = line.match(/diff --git a\/(.+) b\/(.+)/);
      if (fileMatch) {
        currentFile = fileMatch[2];
      }

      // Capture + and - lines that are meaningful code changes
      if ((line.startsWith('+') || line.startsWith('-')) && 
          !line.startsWith('+++') && 
          !line.startsWith('---') && 
          !/^[\s\-\+]*(function|class|import|export|const|let|var|def|if|else|for|while|return|switch|case).*$/i.test(line.substring(1).trim())) {
        const content = line.substring(1).trim();
        
        // Filter out comments and very short lines
        if (content.length >= minLineLength && 
            !content.startsWith('//') && 
            !content.startsWith('/*') && 
            !content.startsWith('*') && 
            !content.startsWith('*/') && 
            !content.startsWith('#') &&
            !content.match(/^[\s\*\/]+$/)) { // Empty or whitespace-only lines
          changes.push({
            file: currentFile,
            type: line.startsWith('+') ? 'addition' : 'deletion',
            content: content,
            lineNum: -1 // Not tracking exact line numbers in diff analysis
          });
        }
      }
    });

    return changes;
  }
}

module.exports = AnalysisEngine;
