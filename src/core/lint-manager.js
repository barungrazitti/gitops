/**
 * Lint Manager - Handles syntax linting for different project types
 */

const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

class LintManager {
  constructor(aiProvider = null) {
    this.aiProvider = aiProvider;
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
  async getLintersForProject(projectType, repoRoot = process.cwd()) {
    const config = this.lintConfigs[projectType];
    if (!config) {
      return [];
    }

    // Check if configuration files exist and create them if needed
    await this.ensureLintingSetup(projectType, repoRoot);

    // Check which linters are actually available
    let availableLinters = [];

    for (const linter of config.linters) {
      if (await this.isCommandAvailable(linter.command)) {
        // Additional check for configuration files
        if (await this.hasRequiredConfig(linter, projectType, repoRoot)) {
          availableLinters.push(linter);
        } else {
          console.log(
            chalk.yellow(
              `   ⚠️  ${linter.name} configuration missing, skipping...`
            )
          );
        }
      }
    }

    // If still no linters are available after setup, show hints
    if (availableLinters.length === 0) {
      this.showInstallHints(projectType);
    }

    return availableLinters;
  }

  /**
   * Check if linter has required configuration files
   */
  async hasRequiredConfig(linter, projectType, repoRoot) {
    switch (linter.name) {
      case 'stylelint': {
        const stylelintConfigs = [
          '.stylelintrc.json',
          '.stylelintrc.js',
          '.stylelintrc.yml',
          '.stylelintrc.yaml',
        ];
        for (const config of stylelintConfigs) {
          if (await fs.pathExists(path.join(repoRoot, config))) {
            return true;
          }
        }
        return false;
      }

      case 'eslint': {
        const eslintConfigs = [
          '.eslintrc.js',
          '.eslintrc.json',
          '.eslintrc.yml',
          '.eslintrc.yaml',
          '.eslintrc',
        ];
        for (const config of eslintConfigs) {
          if (await fs.pathExists(path.join(repoRoot, config))) {
            return true;
          }
        }
        return false;
      }

      case 'prettier': {
        const prettierConfigs = [
          '.prettierrc',
          '.prettierrc.json',
          '.prettierrc.yml',
          '.prettierrc.yaml',
          '.prettierrc.js',
          'prettier.config.js',
        ];
        for (const config of prettierConfigs) {
          if (await fs.pathExists(path.join(repoRoot, config))) {
            return true;
          }
        }
        // Prettier can work without config file, so return true
        return true;
      }

      default:
        return true; // Assume other linters work without config
    }
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
   * Auto-create configuration files and install dependencies if needed
   */
  async ensureLintingSetup(projectType, repoRoot) {
    const setupActions = [];

    switch (projectType) {
      case 'css':
        await this.ensureStylelintSetup(repoRoot, setupActions);
        break;
      case 'nodejs':
      case 'frontend':
        await this.ensureESLintSetup(repoRoot, setupActions);
        break;
      case 'python':
        await this.ensurePythonSetup(repoRoot, setupActions);
        break;
    }

    return setupActions;
  }

  /**
   * Ensure stylelint configuration exists
   */
  async ensureStylelintSetup(repoRoot, setupActions) {
    const stylelintConfigPath = path.join(repoRoot, '.stylelintrc.json');
    const packageJsonPath = path.join(repoRoot, 'package.json');

    // Check if stylelint config exists
    if (!(await fs.pathExists(stylelintConfigPath))) {
      console.log(chalk.yellow('📝 Creating stylelint configuration...'));

      const defaultConfig = {
        extends: 'stylelint-config-standard',
        rules: {
          // Disable most formatting rules - focus on syntax errors only
          indentation: null,
          'no-empty-source': null,
          'string-quotes': null,
          'no-duplicate-selectors': null,
          'color-hex-case': null,
          'color-hex-length': null,
          'selector-combinator-space-after': null,
          'selector-attribute-quotes': null,
          'selector-attribute-operator-space-before': null,
          'selector-attribute-operator-space-after': null,
          'selector-attribute-brackets-space-inside': null,
          'declaration-block-trailing-semicolon': null,
          'declaration-no-important': null,
          'declaration-colon-space-before': null,
          'declaration-colon-space-after': null,
          'number-leading-zero': null,
          'number-no-trailing-zeros': null,
          'function-url-quotes': null,
          'font-weight-notation': null,
          'comment-whitespace-inside': null,
          'rule-empty-line-before': null,
          'shorthand-property-no-redundant-values': null,

          // Allow unknown properties and at-rules (for frameworks and vendor prefixes)
          'property-no-unknown': null,
          'at-rule-no-unknown': null,
          'selector-type-no-unknown': null,
          'unit-no-unknown': null,

          // Allow empty blocks and comments
          'block-no-empty': null,
          'comment-no-empty': null,

          // Allow various CSS features
          'declaration-block-no-redundant-longhand-properties': null,
          'value-no-vendor-prefix': null,
          'property-no-vendor-prefix': null,
          'selector-no-vendor-prefix': null,

          // Allow duplicate properties (last one wins)
          'declaration-block-no-duplicate-properties': null,

          // Allow various units and values
          'length-zero-no-unit': null,
          'color-named': null,
          'color-function-notation': null,

          // Allow various selectors
          'selector-pseudo-class-no-unknown': null,
          'selector-pseudo-element-no-unknown': null,

          // Allow various at-rules
          'at-rule-allowed-list': null,
          'at-rule-disallowed-list': null,

          // Allow various declarations
          'declaration-property-value-no-unknown': null,
          'declaration-property-unit-allowed-list': null,

          // Allow various CSS patterns
          'function-linear-gradient-no-nonstandard-direction': null,
          'function-no-unknown': null,

          // Allow various CSS hacks and workarounds
          'property-blacklist': null,
          'unit-blacklist': null,
          'value-keyword-case': null,
        },
      };

      await fs.writeFile(
        stylelintConfigPath,
        JSON.stringify(defaultConfig, null, 2)
      );
      console.log(chalk.green('   ✅ Created .stylelintrc.json'));
      setupActions.push('Created stylelint configuration');
    }

    // Create package.json if it doesn't exist
    if (!(await fs.pathExists(packageJsonPath))) {
      console.log(chalk.yellow('📝 Creating package.json...'));

      const defaultPackageJson = {
        name: path.basename(repoRoot),
        version: '1.0.0',
        description: '',
        devDependencies: {},
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(defaultPackageJson, null, 2)
      );
      console.log(chalk.green('   ✅ Created package.json'));
      setupActions.push('Created package.json');
    }

    // Check if stylelint is installed
    try {
      const packageJson = await fs.readJson(packageJsonPath);
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      if (!deps.stylelint) {
        console.log(chalk.yellow('📦 Installing stylelint dependencies...'));

        const installResult = await this.runCommand(
          'npm',
          ['install', '--save-dev', 'stylelint', 'stylelint-config-standard'],
          repoRoot
        );
        if (installResult.success) {
          console.log(
            chalk.green(
              '   ✅ Installed stylelint and stylelint-config-standard'
            )
          );
          setupActions.push('Installed stylelint dependencies');
        } else {
          console.log(
            chalk.red('   ❌ Failed to install stylelint dependencies')
          );
          console.log(chalk.dim(`     ${installResult.error}`));
        }
      }
    } catch (error) {
      console.log(
        chalk.yellow('   ⚠️  Could not check package.json dependencies')
      );
    }
  }

  /**
   * Ensure ESLint configuration exists
   */
  async ensureESLintSetup(repoRoot, setupActions) {
    const eslintConfigPath = path.join(repoRoot, '.eslintrc.js');
    const packageJsonPath = path.join(repoRoot, 'package.json');

    // Check if ESLint config exists
    if (!(await fs.pathExists(eslintConfigPath))) {
      console.log(chalk.yellow('📝 Creating ESLint configuration...'));

      const defaultConfig = `module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    'indent': ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
  },
};`;

      await fs.writeFile(eslintConfigPath, defaultConfig);
      console.log(chalk.green('   ✅ Created .eslintrc.js'));
      setupActions.push('Created ESLint configuration');
    }

    // Create package.json if it doesn't exist
    if (!(await fs.pathExists(packageJsonPath))) {
      console.log(chalk.yellow('📝 Creating package.json...'));

      const defaultPackageJson = {
        name: path.basename(repoRoot),
        version: '1.0.0',
        description: '',
        devDependencies: {},
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(defaultPackageJson, null, 2)
      );
      console.log(chalk.green('   ✅ Created package.json'));
      setupActions.push('Created package.json');
    }

    // Check if ESLint is installed
    try {
      const packageJson = await fs.readJson(packageJsonPath);
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      if (!deps.eslint) {
        console.log(chalk.yellow('📦 Installing ESLint...'));

        const installResult = await this.runCommand(
          'npm',
          ['install', '--save-dev', 'eslint'],
          repoRoot
        );
        if (installResult.success) {
          console.log(chalk.green('   ✅ Installed ESLint'));
          setupActions.push('Installed ESLint');
        } else {
          console.log(chalk.red('   ❌ Failed to install ESLint'));
          console.log(chalk.dim(`     ${installResult.error}`));
        }
      }
    } catch (error) {
      console.log(
        chalk.yellow('   ⚠️  Could not check package.json dependencies')
      );
    }
  }

  /**
   * Ensure Python linting setup
   */
  async ensurePythonSetup(repoRoot, setupActions) {
    const requirementsPath = path.join(repoRoot, 'requirements.txt');

    // Check if requirements.txt exists and has linting tools
    if (await fs.pathExists(requirementsPath)) {
      try {
        const content = await fs.readFile(requirementsPath, 'utf8');
        const hasFlake8 = content.includes('flake8');
        const hasBlack = content.includes('black');

        if (!hasFlake8 || !hasBlack) {
          console.log(
            chalk.yellow(
              '📝 Adding Python linting tools to requirements.txt...'
            )
          );

          let newContent = content;
          if (!hasFlake8) newContent += '\nflake8>=3.8.0';
          if (!hasBlack) newContent += '\nblack>=21.0.0';

          await fs.writeFile(requirementsPath, newContent.trim());
          console.log(
            chalk.green('   ✅ Added flake8 and black to requirements.txt')
          );
          setupActions.push('Added Python linting tools to requirements.txt');
        }
      } catch (error) {
        console.log(chalk.yellow('   ⚠️  Could not update requirements.txt'));
      }
    }
  }

  /**
   * Run a command and return result
   */
  async runCommand(command, args, cwd) {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: cwd || process.cwd(),
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          exitCode: code,
          output: stdout,
          error: stderr,
        });
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
        });
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

      const linters = await this.getLintersForProject(type, repoRoot);

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
    const fileExt = path.extname(filePath).toLowerCase();

    for (const linter of linters) {
      // Skip HTMLHint for non-HTML files
      if (linter.name === 'htmlhint' && !['.html', '.htm'].includes(fileExt)) {
        continue;
      }

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

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      child.on('close', (code) => {
        // For ESLint, treat warnings as success (exit code 1 with only warnings)
        let success = code === 0;
        if (linter.name === 'eslint' && code === 1) {
          const output = stdout || stderr;
          // Check if output contains only warnings (no errors)
          if (output && !output.includes('error')) {
            success = true;
          }
        }

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
   * Fix linting errors using AI when traditional linters can't fix them
   */
  async fixWithAI(filePath, linterOutput, projectType) {
    if (!this.aiProvider) {
      console.log(
        chalk.yellow('   ⚠️  No AI provider available for intelligent fixing')
      );
      return false;
    }

    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const fileExt = path.extname(filePath).toLowerCase();

      // Create a focused prompt for the AI
      const prompt = this.createAIFixPrompt(
        fileContent,
        linterOutput,
        fileExt,
        projectType
      );

      console.log(
        chalk.dim(`   🤖 Using AI to fix ${path.basename(filePath)}...`)
      );

      // Get AI fix with retry logic and rate limiting
      const aiResponses = await this.aiProvider.generateResponse(prompt, {
        maxTokens: 2000,
        temperature: 0.3,
      });
      const aiResponse = aiResponses[0];

      if (!aiResponse || aiResponse.trim().length === 0) {
        console.log(chalk.yellow('   ⚠️  AI could not generate a fix'));
        return false;
      }

      // Extract the fixed code from AI response
      const fixedContent = this.extractFixedCode(aiResponse, fileContent);

      if (fixedContent && fixedContent !== fileContent) {
        // Create backup before applying fix
        const backupPath = `${filePath}.backup.${Date.now()}`;
        await fs.copy(filePath, backupPath);

        // Apply the fix
        await fs.writeFile(filePath, fixedContent);

        console.log(
          chalk.green(
            `   ✅ AI fix applied (backup: ${path.basename(backupPath)})`
          )
        );
        return true;
      } else {
        console.log(chalk.yellow('   ⚠️  AI could not improve the code'));
        return false;
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ AI fix failed: ${error.message}`));
      return false;
    }
  }

  /**
   * Create a focused prompt for AI-based linting fixes
   */
  createAIFixPrompt(fileContent, linterOutput, fileExt, projectType) {
    const languageMap = {
      '.js': 'JavaScript',
      '.jsx': 'React JSX',
      '.ts': 'TypeScript',
      '.tsx': 'React TypeScript',
      '.php': 'PHP',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.html': 'HTML',
      '.json': 'JSON',
      '.py': 'Python',
      '.java': 'Java',
      '.go': 'Go',
      '.rs': 'Rust',
    };

    const language = languageMap[fileExt] || fileExt.slice(1);
    const projectContext =
      projectType === 'jquery' ? 'jQuery-based' : projectType;

    return `Fix the following ${language} code issues in a ${projectContext} project.

Linter Output:
${linterOutput}

Original Code:
\`\`\`${language}
${fileContent}
\`\`\`

Requirements:
1. Fix ALL linting errors mentioned in the linter output
2. Preserve the original functionality and logic - DO NOT change the code into comments or descriptions
3. Follow ${language} best practices and coding standards
4. Make minimal changes necessary to fix the issues
5. Return ONLY the fixed code without explanations or markdown formatting
6. Do not add comments unless required to fix an issue
7. For unused variables/imports, either remove them or export them if they're part of an API
8. Keep the code structure similar to the original
9. IMPORTANT: The output must be valid ${language} code, not a commit message or description

Fixed Code:`;
  }

  /**
   * Extract the fixed code from AI response
   */
  extractFixedCode(aiResponse, originalContent, filePath = null) {
    let fixedContent = aiResponse.trim();

    // Remove markdown code blocks if present
    if (fixedContent.includes('```')) {
      const lines = fixedContent.split('\n');
      let codeStart = -1;
      let codeEnd = -1;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('```') && codeStart === -1) {
          codeStart = i;
        } else if (lines[i].includes('```') && codeStart !== -1) {
          codeEnd = i;
          break;
        }
      }

      if (codeStart !== -1 && codeEnd !== -1) {
        fixedContent = lines.slice(codeStart + 1, codeEnd).join('\n');
      } else if (codeStart !== -1) {
        // Try to find the end of the code block
        const remainingLines = lines.slice(codeStart + 1);
        fixedContent = remainingLines.join('\n');
      }
    }

    // Remove any explanatory text before code
    const codeLines = fixedContent.split('\n');
    const codeLineIndex = codeLines.findIndex(
      (line) =>
        line.trim().length > 0 &&
        !line.toLowerCase().includes('here') &&
        !line.toLowerCase().includes('fixed') &&
        !line.toLowerCase().includes('solution')
    );

    if (codeLineIndex > 0) {
      fixedContent = codeLines.slice(codeLineIndex).join('\n');
    }

    // Validate the fix
    if (!fixedContent || fixedContent.length === 0) {
      return null;
    }

    // Check if AI response is clearly not code (commit messages, descriptions, etc.)
    const nonCodePatterns = [
      /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?:/,
      /^(added|removed|updated|fixed|improved)/i,
      /^(this|the|a|an) \w+ (is|was|has)/i,
      /^[A-Z][a-z]+(?: [a-z]+)*:/,
    ];

    for (const pattern of nonCodePatterns) {
      if (pattern.test(fixedContent.trim())) {
        console.log(
          chalk.yellow(
            '   ⚠️  AI response appears to be a commit message, not code'
          )
        );
        return null;
      }
    }

    // Check if the fix is reasonable (not completely different)
    // Only apply similarity check for very different content (less than 5% similar)
    const similarity = this.calculateSimilarity(originalContent, fixedContent);
    if (similarity < 0.05) {
      console.log(
        chalk.yellow(
          `   ⚠️  AI fix seems too different (similarity: ${similarity.toFixed(2)}), skipping`
        )
      );
      return null;
    }

    // For formatting fixes, allow more significant changes
    const fileExt = path.extname(filePath).toLowerCase();
    if (['.js', '.jsx', '.ts', '.tsx'].includes(fileExt) && similarity < 0.1) {
      console.log(
        chalk.yellow(
          `   ⚠️  AI fix seems too different for formatting (similarity: ${similarity.toFixed(2)}), skipping`
        )
      );
      return null;
    }

    return fixedContent;
  }

  /**
   * Calculate similarity between two strings (simple implementation)
   */
  calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Enhanced linting with AI fallback for unfixable errors
   */
  async lintFilesWithAI(files, options = {}) {
    const {
      autoFix = true,
      useAI = true,
      projectType = null,
      repoRoot = process.cwd(),
    } = options;

    // First, run standard linting
    const standardResults = await this.lintFiles(files, {
      autoFix: autoFix && !useAI, // Don't auto-fix if we're using AI
      projectType,
      repoRoot,
    });

    // If no errors or AI is disabled, return standard results
    if (standardResults.success || !useAI) {
      return standardResults;
    }

    console.log(chalk.blue('\n🤖 Attempting AI fixes for unfixable errors...'));

    const aiFixedResults = [];
    let aiFixedCount = 0;

    // Process failed results with AI
    for (const result of standardResults.results) {
      if (!result.success && !result.fixed) {
        const fileExt = path.extname(result.file).toLowerCase();

        // Only attempt AI fixes for supported file types
        if (
          [
            '.js',
            '.jsx',
            '.ts',
            '.tsx',
            '.php',
            '.css',
            '.html',
            '.json',
          ].includes(fileExt)
        ) {
          const fixed = await this.fixWithAI(
            result.file,
            result.output,
            result.projectType || projectType || 'unknown'
          );

          if (fixed) {
            aiFixedCount++;

            // Re-run linter to verify the fix
            const linters = await this.getLintersForProject(
              result.projectType || projectType || 'unknown'
            );

            if (linters.length > 0) {
              const recheckResults = await this.lintFile(
                result.file,
                linters,
                false
              );
              aiFixedResults.push(...recheckResults);
            }
          }
        }
      }
    }

    // Update results with AI fixes
    if (aiFixedCount > 0) {
      console.log(chalk.green(`   ✅ AI fixed ${aiFixedCount} file(s)`));

      // Recalculate summary
      const newResults = await this.lintFiles(files, {
        autoFix: false,
        projectType,
        repoRoot,
      });

      return {
        ...newResults,
        aiFixed: aiFixedCount,
        originalResults: standardResults,
      };
    }

    return standardResults;
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

    if (results.aiFixed > 0) {
      console.log(chalk.cyan(`   AI Fixed: ${results.aiFixed}`));
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
