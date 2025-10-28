/**
 * Lint Manager - Handles syntax linting for different project types
 */

const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

class LintManager {
  constructor() {
    this.lintConfigs = {
      // WordPress/PHP projects
      wordpress: {
        extensions: ['.php'],
        linters: [
          {
            name: 'php',
            command: 'php',
            args: ['-l', '{file}'],
            fixable: false,
            installHint:
              'Install PHP CLI: apt-get install php-cli (Ubuntu) or brew install php (macOS)',
          },
          {
            name: 'phpcs',
            command: 'phpcs',
            args: ['--standard=WordPress', '{file}'],
            fixCommand: 'phpcbf',
            fixArgs: ['--standard=WordPress', '{file}'],
            fixable: true,
            installHint:
              'Install WordPress Coding Standards: composer require wp-coding-standards/wpcs',
          },
        ],
      },

      // Node.js/JavaScript projects
      nodejs: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs'],
        linters: [
          {
            name: 'eslint',
            command: 'npx eslint',
            args: ['{file}'],
            fixCommand: 'npx eslint',
            fixArgs: ['--fix', '{file}'],
            fixable: true,
            installHint: 'Install ESLint: npm install --save-dev eslint',
          },
          {
            name: 'prettier',
            command: 'npx prettier',
            args: ['--check', '{file}'],
            fixCommand: 'npx prettier',
            fixArgs: ['--write', '{file}'],
            fixable: true,
            installHint: 'Install Prettier: npm install --save-dev prettier',
          },
        ],
      },

      // Frontend/JavaScript with jQuery projects
      frontend: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.html'],
        linters: [
          {
            name: 'eslint',
            command: 'npx eslint',
            args: ['{file}'],
            fixCommand: 'npx eslint',
            fixArgs: ['--fix', '{file}'],
            fixable: true,
            installHint: 'Install ESLint: npm install --save-dev eslint',
          },
          {
            name: 'prettier',
            command: 'npx prettier',
            args: ['--check', '{file}'],
            fixCommand: 'npx prettier',
            fixArgs: ['--write', '{file}'],
            fixable: true,
            installHint: 'Install Prettier: npm install --save-dev prettier',
          },
          {
            name: 'htmlhint',
            command: 'npx htmlhint',
            args: ['{file}'],
            fixable: false,
            installHint: 'Install HTMLHint: npm install --save-dev htmlhint',
          },
        ],
      },

      // jQuery projects
      jquery: {
        extensions: ['.js', '.html', '.htm', '.css'],
        linters: [
          {
            name: 'eslint',
            command: 'npx eslint',
            args: ['{file}', '--env', 'browser', '--env', 'jquery'],
            fixCommand: 'npx eslint',
            fixArgs: ['--fix', '{file}', '--env', 'browser', '--env', 'jquery'],
            fixable: true,
            installHint:
              'Install ESLint with jQuery plugin: npm install --save-dev eslint eslint-plugin-jquery',
          },
          {
            name: 'htmlhint',
            command: 'npx htmlhint',
            args: ['{file}'],
            fixable: false,
            installHint: 'Install HTMLHint: npm install --save-dev htmlhint',
          },
          {
            name: 'prettier',
            command: 'npx prettier',
            args: ['--check', '{file}'],
            fixCommand: 'npx prettier',
            fixArgs: ['--write', '{file}'],
            fixable: true,
            installHint: 'Install Prettier: npm install --save-dev prettier',
          },
        ],
      },

      // Python projects
      python: {
        extensions: ['.py'],
        linters: [
          {
            name: 'flake8',
            command: 'flake8',
            args: ['{file}'],
            fixable: false,
            installHint: 'Install flake8: pip install flake8',
          },
          {
            name: 'black',
            command: 'black',
            args: ['--check', '{file}'],
            fixCommand: 'black',
            fixArgs: ['{file}'],
            fixable: true,
            installHint: 'Install black: pip install black',
          },
        ],
      },

      // Java projects
      java: {
        extensions: ['.java'],
        linters: [
          {
            name: 'checkstyle',
            command: 'checkstyle',
            args: ['-c', '/google_checks.xml', '{file}'],
            fixable: false,
            installHint:
              'Install Checkstyle: apt-get install checkstyle (Ubuntu) or brew install checkstyle (macOS)',
          },
        ],
      },

      // Go projects
      go: {
        extensions: ['.go'],
        linters: [
          {
            name: 'gofmt',
            command: 'gofmt',
            args: ['-l', '{file}'],
            fixCommand: 'gofmt',
            fixArgs: ['-w', '{file}'],
            fixable: true,
            installHint: 'Install Go: https://golang.org/dl/',
          },
          {
            name: 'golint',
            command: 'golint',
            args: ['{file}'],
            fixable: false,
            installHint:
              'Install golint: go install golang.org/x/lint/golint@latest',
          },
        ],
      },

      // Rust projects
      rust: {
        extensions: ['.rs'],
        linters: [
          {
            name: 'rustfmt',
            command: 'rustfmt',
            args: ['--check', '{file}'],
            fixCommand: 'rustfmt',
            fixArgs: ['{file}'],
            fixable: true,
            installHint: 'Install rustfmt: rustup component add rustfmt',
          },
          {
            name: 'clippy',
            command: 'cargo',
            args: ['clippy', '--', '-A', 'warnings'],
            fixable: false,
            installHint: 'Install clippy: rustup component add clippy',
          },
        ],
      },

      // CSS/SCSS projects
      css: {
        extensions: ['.css', '.scss', '.sass', '.less'],
        linters: [
          {
            name: 'stylelint',
            command: 'npx stylelint',
            args: ['--fix', '--formatter', 'compact', '{file}'],
            fixCommand: 'npx stylelint',
            fixArgs: ['--fix', '--formatter', 'compact', '{file}'],
            fixable: true,
            installHint: 'Install stylelint: npm install --save-dev stylelint',
          },
          {
            name: 'prettier',
            command: 'npx prettier',
            args: ['--check', '{file}'],
            fixCommand: 'npx prettier',
            fixArgs: ['--write', '{file}'],
            fixable: true,
            installHint: 'Install Prettier: npm install --save-dev prettier',
          },
        ],
      },

      // JSON/YAML projects
      config: {
        extensions: ['.json', '.yaml', '.yml', '.toml'],
        linters: [
          {
            name: 'jsonlint',
            command: 'jsonlint',
            args: ['{file}'],
            fixable: false,
            installHint: 'Install jsonlint: npm install -g jsonlint',
          },
        ],
      },
    };
  }

  /**
   * Detect project type based on files and configuration
   */
  async detectProjectType(repoRoot, files) {
    const indicators = {
      wordpress: ['wp-config.php', 'wp-content', 'wp-includes', 'wp-admin'],
      nodejs: ['package.json', 'node_modules'],
      frontend: ['package.json'], // Will check for frontend-specific dependencies
      python: ['requirements.txt', 'setup.py', 'pyproject.toml', '__pycache__'],
      java: ['pom.xml', 'build.gradle', 'src/main/java'],
      go: ['go.mod', 'main.go'],
      rust: ['Cargo.toml', 'src/main.rs'],
      css: ['package.json'], // Will check for stylelint config
    };

    const detectedTypes = [];

    // Check for project indicators
    for (const [type, indicatorFiles] of Object.entries(indicators)) {
      for (const indicator of indicatorFiles) {
        const indicatorPath = path.join(repoRoot, indicator);
        if (await fs.pathExists(indicatorPath)) {
          detectedTypes.push(type);
          break;
        }
      }
    }

    // Special handling for frontend projects (check for frontend-specific dependencies)
    if (
      detectedTypes.includes('nodejs') ||
      detectedTypes.includes('frontend')
    ) {
      const packageJsonPath = path.join(repoRoot, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        try {
          const packageJson = await fs.readJson(packageJsonPath);
          const deps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
          };

          // Check for CSS/Style tools
          if (deps.stylelint || deps.postcss || deps.sass || deps.less) {
            detectedTypes.push('css');
          }

          // Check for frontend/jQuery indicators
          if (
            deps.jquery ||
            deps.bootstrap ||
            deps.leaflet ||
            deps.chartjs ||
            deps.react ||
            deps.vue ||
            deps.angular ||
            deps['@angular/core'] ||
            deps.webpack ||
            deps.vite ||
            deps.parcel ||
            deps.rollup ||
            deps.prettier ||
            deps.htmlhint
          ) {
            detectedTypes.push('frontend');
          }

          // Check for jQuery specifically
          if (deps.jquery) {
            detectedTypes.push('jquery');
          }
        } catch (error) {
          // Ignore package.json parsing errors
        }
      }
    }

    // Determine primary project type based on file extensions
    const fileExtensions = files.map((file) =>
      path.extname(file).toLowerCase()
    );
    const extensionCounts = {};

    fileExtensions.forEach((ext) => {
      extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
    });

    // Map extensions to project types
    const extensionToType = {
      '.php': 'wordpress',
      '.js': 'nodejs',
      '.jsx': 'frontend',
      '.ts': 'nodejs',
      '.tsx': 'frontend',
      '.mjs': 'nodejs',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.css': 'css',
      '.scss': 'css',
      '.sass': 'css',
      '.less': 'css',
      '.html': 'frontend',
      '.htm': 'frontend',
      '.json': 'config',
      '.yaml': 'config',
      '.yml': 'config',
      '.toml': 'config',
    };

    // Find dominant file type
    let maxCount = 0;
    let dominantType = null;

    for (const [ext, count] of Object.entries(extensionCounts)) {
      if (count > maxCount && extensionToType[ext]) {
        maxCount = count;
        dominantType = extensionToType[ext];
      }
    }

    // Prioritize detected types over file extension analysis
    if (detectedTypes.length > 0) {
      return detectedTypes[0];
    }

    return dominantType || 'unknown';
  }

  /**
   * Get appropriate linters for detected project type
   */
  async getLintersForProject(projectType) {
    const config = this.lintConfigs[projectType];
    if (!config) {
      return [];
    }

    // Check which linters are actually available
    const availableLinters = [];

    for (const linter of config.linters) {
      if (await this.isCommandAvailable(linter.command)) {
        availableLinters.push(linter);
      }
    }

    return availableLinters;
  }

  /**
   * Check if a command is available on system
   */
  async isCommandAvailable(command) {
    return new Promise((resolve) => {
      const baseCommand = command.split(' ')[0];

      // Special handling for npx commands
      if (baseCommand === 'npx') {
        spawn('npx', ['--version'], { stdio: 'ignore' })
          .on('close', (code) => {
            resolve(code === 0);
          })
          .on('error', () => {
            resolve(false);
          });
        return;
      }

      spawn('which', [baseCommand], { stdio: 'ignore' })
        .on('close', (code) => {
          resolve(code === 0);
        })
        .on('error', () => {
          resolve(false);
        });
    });
  }

  /**
   * Group files by type for appropriate linting
   */
  async groupFilesByType(files, repoRoot, primaryType) {
    const fileGroups = {};

    // Initialize all relevant types
    const relevantTypes = [
      'wordpress',
      'nodejs',
      'frontend',
      'jquery',
      'python',
      'java',
      'go',
      'rust',
      'css',
      'config',
    ];
    relevantTypes.forEach((type) => (fileGroups[type] = []));

    // Enhanced detection for mixed projects
    const packageJsonPath = path.join(repoRoot, 'package.json');
    let hasJQuery = false;
    let hasFrontendDeps = false;

    if (await fs.pathExists(packageJsonPath)) {
      try {
        const packageJson = await fs.readJson(packageJsonPath);
        const deps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        hasJQuery = !!deps.jquery;
        hasFrontendDeps = !!(
          deps.react ||
          deps.vue ||
          deps.angular ||
          deps['@angular/core'] ||
          deps.webpack ||
          deps.vite ||
          deps.parcel ||
          deps.rollup
        );
      } catch (error) {
        // Ignore package.json parsing errors
      }
    }

    // Check for WordPress indicators
    const hasWordPressFiles = files.some((file) =>
      /wp-content|wp-includes|wp-admin|wp-config\.php/i.test(file)
    );

    // Group files by extension and context
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();

      // PHP files - likely WordPress if WordPress indicators exist
      if (ext === '.php') {
        if (hasWordPressFiles || primaryType === 'wordpress') {
          fileGroups.wordpress.push(file);
        } else {
          fileGroups.nodejs.push(file); // Generic PHP project
        }
      }
      // JavaScript files - determine by context
      else if (['.js', '.mjs'].includes(ext)) {
        // Check file content for jQuery usage
        try {
          const filePath = path.join(repoRoot, file);
          if (await fs.pathExists(filePath)) {
            const content = await fs.readFile(filePath, 'utf8');
            const hasJQueryUsage = /\$\(|jQuery\(/.test(content);

            if (hasJQueryUsage || hasJQuery) {
              fileGroups.jquery.push(file);
            } else if (
              hasFrontendDeps ||
              /import.*react|from.*react|jsx/.test(content)
            ) {
              fileGroups.frontend.push(file);
            } else {
              fileGroups.nodejs.push(file);
            }
          }
        } catch (error) {
          // Fallback to primary type
          fileGroups[primaryType] = fileGroups[primaryType] || [];
          fileGroups[primaryType].push(file);
        }
      }
      // TypeScript/JSX files
      else if (['.ts', '.tsx', '.jsx'].includes(ext)) {
        fileGroups.frontend.push(file);
      }
      // HTML files
      else if (['.html', '.htm'].includes(ext)) {
        fileGroups.frontend.push(file);
      }
      // CSS files
      else if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
        fileGroups.css.push(file);
      }
      // Config files
      else if (['.json', '.yaml', '.yml', '.toml'].includes(ext)) {
        fileGroups.config.push(file);
      }
      // Other languages
      else if (ext === '.py') {
        fileGroups.python.push(file);
      } else if (ext === '.java') {
        fileGroups.java.push(file);
      } else if (ext === '.go') {
        fileGroups.go.push(file);
      } else if (ext === '.rs') {
        fileGroups.rust.push(file);
      }
      // Fallback to primary type
      else {
        fileGroups[primaryType] = fileGroups[primaryType] || [];
        fileGroups[primaryType].push(file);
      }
    }

    // Remove empty groups
    Object.keys(fileGroups).forEach((type) => {
      if (fileGroups[type].length === 0) {
        delete fileGroups[type];
      }
    });

    return fileGroups;
  }

  /**
   * Run linting on staged files
   */
  async lintFiles(files, options = {}) {
    const {
      autoFix = false,
      projectType = null,
      repoRoot = process.cwd(),
    } = options;

    if (files.length === 0) {
      return {
        success: true,
        results: [],
        summary: { total: 0, passed: 0, failed: 0, fixed: 0 },
      };
    }

    // Detect primary project type if not provided
    const primaryType =
      projectType || (await this.detectProjectType(repoRoot, files));

    if (primaryType === 'unknown') {
      console.log(
        chalk.yellow('⚠️  Unknown project type, using file-based detection')
      );
    }

    console.log(chalk.blue('🔍 Linting files for mixed project types...'));

    // Group files by type for appropriate linting
    const fileGroups = await this.groupFilesByType(
      files,
      repoRoot,
      primaryType
    );

    const allResults = [];
    const allSummaries = [];

    // Process each file group with appropriate linters
    for (const [type, filesOfType] of Object.entries(fileGroups)) {
      if (filesOfType.length === 0) continue;

      console.log(
        chalk.dim(
          `\n📁 Processing ${type} files (${filesOfType.length} file${filesOfType.length > 1 ? 's' : ''})...`
        )
      );

      const linters = await this.getLintersForProject(type);

      if (linters.length === 0) {
        console.log(
          chalk.yellow(`   ⚠️  No linters available for ${type} files`)
        );
        this.showInstallHints(type);
        continue;
      }

      const groupResults = [];
      let groupFixed = 0;

      for (const file of filesOfType) {
        const fileResults = await this.lintFile(file, linters, autoFix);
        groupResults.push(...fileResults);

        if (autoFix) {
          const fixedCount = fileResults.filter((r) => r.fixed).length;
          groupFixed += fixedCount;
        }
      }

      const failed = groupResults.filter((r) => !r.success && !r.fixed).length;
      const passed = groupResults.filter((r) => r.success || r.fixed).length;

      allResults.push(...groupResults);
      allSummaries.push({
        type,
        total: filesOfType.length,
        passed,
        failed,
        fixed: groupFixed,
      });

      if (failed === 0) {
        console.log(chalk.green(`   ✅ ${type}: All files passed`));
      } else {
        console.log(
          chalk.red(
            `   ❌ ${type}: ${failed} file${failed > 1 ? 's' : ''} failed`
          )
        );
      }
    }

    // Calculate overall summary
    const totalSummary = allSummaries.reduce(
      (acc, summary) => ({
        total: acc.total + summary.total,
        passed: acc.passed + summary.passed,
        failed: acc.failed + summary.failed,
        fixed: acc.fixed + summary.fixed,
      }),
      { total: 0, passed: 0, failed: 0, fixed: 0 }
    );

    return {
      success: totalSummary.failed === 0,
      results: allResults,
      summary: totalSummary,
      projectType: primaryType,
      fileGroups: allSummaries,
    };
  }

  /**
   * Lint a single file with multiple linters
   */
  async lintFile(filePath, linters, autoFix = false) {
    const results = [];

    for (const linter of linters) {
      const result = await this.runLinter(filePath, linter, autoFix);
      results.push(result);

      // If linter failed and we can't fix it, continue to next linter
      if (!result.success && !result.fixed && !autoFix) {
        continue;
      }
    }

    return results;
  }

  /**
   * Run a single linter on a file
   */
  async runLinter(filePath, linter, autoFix = false) {
    const command =
      autoFix && linter.fixable ? linter.fixCommand : linter.command;
    const args = autoFix && linter.fixable ? linter.fixArgs : linter.args;

    // Replace {file} placeholder with actual file path
    const processedArgs = args.map((arg) => arg.replace('{file}', filePath));

    return new Promise((resolve) => {
      const child = spawn(command, processedArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        const success = code === 0;
        const fixed = autoFix && linter.fixable && success;

        resolve({
          file: filePath,
          linter: linter.name,
          success,
          fixed,
          exitCode: code,
          output: stdout || stderr,
          command: `${command} ${processedArgs.join(' ')}`,
        });
      });

      child.on('error', (error) => {
        resolve({
          file: filePath,
          linter: linter.name,
          success: false,
          fixed: false,
          error: error.message,
          command: `${command} ${processedArgs.join(' ')}`,
        });
      });
    });
  }

  /**
   * Show installation hints for missing linters
   */
  showInstallHints(projectType) {
    const config = this.lintConfigs[projectType];
    if (!config) return;

    console.log(
      chalk.yellow('\n💡 Installation hints for ' + projectType + ' linting:')
    );

    const hints = [...new Set(config.linters.map((l) => l.installHint))];
    hints.forEach((hint) => {
      console.log(chalk.dim(`   • ${hint}`));
    });
    console.log();
  }

  /**
   * Print linting results summary
   */
  printResults(results) {
    const { success, summary } = results;

    if (summary.total === 0) {
      console.log(chalk.green('✅ No files to lint'));
      return;
    }

    console.log(chalk.cyan('\n📊 Overall Linting Summary:'));
    console.log(
      `   Total: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed}`
    );

    if (summary.fixed > 0) {
      console.log(chalk.green(`   Fixed: ${summary.fixed}`));
    }

    if (!success) {
      console.log(chalk.red('\n❌ Linting failed for some files:'));

      results.results
        .filter((r) => !r.success && !r.fixed)
        .forEach((result) => {
          console.log(chalk.red(`   ${result.file} (${result.linter}):`));
          if (result.output) {
            console.log(chalk.dim(`     ${result.output}`));
          }
          if (result.error) {
            console.log(chalk.dim(`     Error: ${result.error}`));
          }
          console.log(chalk.dim(`     Command: ${result.command}`));
        });

      console.log(chalk.yellow('\n💡 Fix issues with: aic --lint-fix'));
    } else {
      console.log(chalk.green('\n✅ All linting checks passed!'));
    }
  }
}

module.exports = LintManager;
