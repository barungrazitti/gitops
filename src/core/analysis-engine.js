/**
 * Analysis Engine - Analyzes repository context and patterns
 */

const GitManager = require('./git-manager');
const fs = require('fs-extra');
const path = require('path');

class AnalysisEngine {
  constructor() {
    this.gitManager = new GitManager();
  }

  /**
   * Analyze repository for context
   */
  async analyzeRepository() {
    try {
      const [
        repoInfo,
        commitPatterns,
        fileContext,
        projectType
      ] = await Promise.all([
        this.gitManager.getRepositoryInfo(),
        this.gitManager.getCommitPatterns(),
        this.analyzeFileContext(),
        this.detectProjectType()
      ]);

      return {
        repository: repoInfo,
        patterns: commitPatterns,
        files: fileContext,
        project: projectType,
        timestamp: Date.now()
      };
    } catch (error) {
      console.warn('Repository analysis failed:', error.message);
      return {
        repository: {},
        patterns: {},
        files: {},
        project: { type: 'unknown' },
        timestamp: Date.now()
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
      
      const context = {
        totalFiles: stagedFiles.length,
        fileTypes: this.categorizeFiles(stagedFiles),
        changes: {
          insertions: fileStats.insertions,
          deletions: fileStats.deletions,
          modified: fileStats.changed
        },
        scope: this.inferScope(stagedFiles)
      };

      return context;
    } catch (error) {
      console.warn('File context analysis failed:', error.message);
      return {
        totalFiles: 0,
        fileTypes: {},
        changes: { insertions: 0, deletions: 0, modified: 0 },
        scope: 'unknown'
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
      other: 0
    };

    const patterns = {
      source: /\.(js|ts|jsx|tsx|py|java|cpp|c|cs|php|rb|go|rs|swift|kt)$/i,
      test: /\.(test|spec)\.(js|ts|jsx|tsx|py|java|cpp|c|cs|php|rb|go|rs)$|test.*\.(js|ts|py)$|.*test\.(js|ts|py)$/i,
      config: /\.(json|yaml|yml|toml|ini|conf|config|env)$|Dockerfile|Makefile|CMakeLists\.txt|package\.json|requirements\.txt|Gemfile|Cargo\.toml$/i,
      docs: /\.(md|txt|rst|adoc|tex)$|README|CHANGELOG|LICENSE|CONTRIBUTING/i,
      assets: /\.(png|jpg|jpeg|gif|svg|ico|css|scss|sass|less|woff|woff2|ttf|eot)$/i
    };

    files.forEach(file => {
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
   * Infer scope from file paths
   */
  inferScope(files) {
    const scopePatterns = {
      'api': /api|endpoint|route|controller/i,
      'ui': /ui|component|view|page|frontend/i,
      'auth': /auth|login|user|session|security/i,
      'db': /database|db|model|schema|migration/i,
      'config': /config|setting|env/i,
      'test': /test|spec/i,
      'docs': /doc|readme|changelog/i,
      'build': /build|webpack|rollup|vite|babel|grunt|gulp/i,
      'ci': /\.github|\.gitlab|jenkins|travis|circle/i
    };

    const scopeCounts = {};
    
    files.forEach(file => {
      for (const [scope, pattern] of Object.entries(scopePatterns)) {
        if (pattern.test(file)) {
          scopeCounts[scope] = (scopeCounts[scope] || 0) + 1;
        }
      }
    });

    // Return the most common scope
    const topScope = Object.entries(scopeCounts)
      .sort((a, b) => b[1] - a[1])[0];
    
    return topScope ? topScope[0] : 'general';
  }

  /**
   * Detect project type
   */
  async detectProjectType() {
    try {
      const repoRoot = await this.gitManager.getRepositoryRoot();
      
      const indicators = {
        'nodejs': ['package.json', 'node_modules'],
        'python': ['requirements.txt', 'setup.py', 'pyproject.toml', '__pycache__'],
        'java': ['pom.xml', 'build.gradle', 'src/main/java'],
        'react': ['package.json'], // Will check package.json content
        'vue': ['package.json'], // Will check package.json content
        'angular': ['angular.json', 'package.json'],
        'dotnet': ['*.csproj', '*.sln', 'Program.cs'],
        'php': ['composer.json', 'index.php'],
        'ruby': ['Gemfile', 'Rakefile'],
        'go': ['go.mod', 'main.go'],
        'rust': ['Cargo.toml', 'src/main.rs'],
        'docker': ['Dockerfile', 'docker-compose.yml']
      };

      const detectedTypes = [];

      for (const [type, files] of Object.entries(indicators)) {
        for (const file of files) {
          const filePath = path.join(repoRoot, file);
          if (await fs.pathExists(filePath)) {
            detectedTypes.push(type);
            break;
          }
        }
      }

      // Special handling for JavaScript frameworks
      if (detectedTypes.includes('nodejs')) {
        const packageJsonPath = path.join(repoRoot, 'package.json');
        if (await fs.pathExists(packageJsonPath)) {
          try {
            const packageJson = await fs.readJson(packageJsonPath);
            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
            
            if (deps.react || deps['@types/react']) {
              detectedTypes.push('react');
            }
            if (deps.vue || deps['@vue/cli']) {
              detectedTypes.push('vue');
            }
            if (deps['@angular/core']) {
              detectedTypes.push('angular');
            }
            if (deps.next || deps['next.js']) {
              detectedTypes.push('nextjs');
            }
            if (deps.express || deps.fastify || deps.koa) {
              detectedTypes.push('backend');
            }
          } catch (error) {
            // Ignore package.json parsing errors
          }
        }
      }

      return {
        types: [...new Set(detectedTypes)], // Remove duplicates
        primary: detectedTypes[0] || 'unknown',
        isMonorepo: await this.detectMonorepo(repoRoot),
        hasTests: await this.hasTestFiles(repoRoot),
        hasCI: await this.hasCIConfig(repoRoot)
      };
    } catch (error) {
      console.warn('Project type detection failed:', error.message);
      return {
        types: ['unknown'],
        primary: 'unknown',
        isMonorepo: false,
        hasTests: false,
        hasCI: false
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
      'yarn.lock' // with workspaces in package.json
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
    const testPatterns = [
      'test/**',
      'tests/**',
      'spec/**',
      '__tests__/**',
      '*.test.*',
      '*.spec.*'
    ];

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
      'azure-pipelines.yml'
    ];

    for (const file of ciFiles) {
      if (await fs.pathExists(path.join(repoRoot, file))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Analyze code complexity (basic)
   */
  async analyzeComplexity(diff) {
    const lines = diff.split('\n');
    const addedLines = lines.filter(line => line.startsWith('+')).length;
    const removedLines = lines.filter(line => line.startsWith('-')).length;
    
    // Simple complexity indicators
    const complexity = {
      linesAdded: addedLines,
      linesRemoved: removedLines,
      netChange: addedLines - removedLines,
      hasLogic: /if|else|for|while|switch|try|catch/.test(diff),
      hasImports: /import|require|from/.test(diff),
      hasExports: /export|module\.exports/.test(diff),
      hasFunctions: /function|=>|def |class /.test(diff),
      hasTests: /test|spec|describe|it\(/.test(diff)
    };

    // Determine change type
    if (complexity.hasTests) {
      complexity.changeType = 'test';
    } else if (complexity.hasImports || complexity.hasExports) {
      complexity.changeType = 'refactor';
    } else if (complexity.hasFunctions && addedLines > removedLines) {
      complexity.changeType = 'feat';
    } else if (addedLines === 0 && removedLines > 0) {
      complexity.changeType = 'remove';
    } else if (complexity.hasLogic) {
      complexity.changeType = 'fix';
    } else {
      complexity.changeType = 'chore';
    }

    return complexity;
  }
}

module.exports = AnalysisEngine;