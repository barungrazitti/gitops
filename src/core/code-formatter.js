/**
 * Code Formatter - Multi-language code formatting with Prettier and language-specific tools
 */

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class CodeFormatter {
  constructor(options = {}) {
    this.options = {
      prettierConfig: options.prettierConfig || null,
      phpTools: options.phpTools !== false,
      pythonTools: options.pythonTools !== false,
      javaTools: options.javaTools !== false,
      cTools: options.cTools !== false,
      goTools: options.goTools !== false,
      rustTools: options.rustTools !== false,
      rubyTools: options.rubyTools !== false,
      swiftTools: options.swiftTools !== false,
      kotlinTools: options.kotlinTools !== false,
      scalaTools: options.scalaTools !== false,
      dartTools: options.dartTools !== false,
      shellTools: options.shellTools !== false,
      sqlTools: options.sqlTools !== false,
      timeout: options.timeout || 30000,
      ...options,
    };

    // File extension mappings
    this.languageMap = {
      // JavaScript/TypeScript
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',

      // Web
      '.html': 'html',
      '.htm': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.vue': 'vue',
      '.svelte': 'svelte',

      // PHP
      '.php': 'php',
      '.phtml': 'php',

      // Python
      '.py': 'python',
      '.pyi': 'python',
      '.pyx': 'python',

      // Java
      '.java': 'java',
      '.jar': 'java',
      '.class': 'java',

      // C/C++
      '.c': 'c',
      '.cpp': 'cpp',
      '.cxx': 'cpp',
      '.cc': 'cpp',
      '.c++': 'cpp',
      '.h': 'c',
      '.hpp': 'cpp',
      '.hxx': 'cpp',

      // C#
      '.cs': 'csharp',

      // Go
      '.go': 'go',

      // Rust
      '.rs': 'rust',

      // Ruby
      '.rb': 'ruby',
      '.rbw': 'ruby',
      '.gem': 'ruby',

      // Swift
      '.swift': 'swift',

      // Kotlin
      '.kt': 'kotlin',
      '.kts': 'kotlin',

      // Scala
      '.scala': 'scala',
      '.sc': 'scala',

      // Dart
      '.dart': 'dart',

      // Data Formats
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.toml': 'toml',
      '.ini': 'ini',
      '.cfg': 'ini',
      '.conf': 'ini',

      // Documentation
      '.md': 'markdown',
      '.mdx': 'markdown',
      '.rst': 'rst',

      // Shell Scripts
      '.sh': 'shell',
      '.bash': 'shell',
      '.zsh': 'shell',
      '.fish': 'shell',
      '.ps1': 'powershell',

      // Configuration
      '.dockerfile': 'docker',
      dockerfile: 'docker',
      '.dockerignore': 'docker',

      // SQL
      '.sql': 'sql',

      // Other
      '.svg': 'xml',
      '.txt': 'text',
      '.gitignore': 'text',
      '.gitattributes': 'text',
      '.editorconfig': 'text',
    };
  }

  /**
   * Format files based on their extensions
   */
  async formatFiles(files = []) {
    const results = {
      formatted: [],
      failed: [],
      skipped: [],
      summary: {
        total: files.length,
        formatted: 0,
        failed: 0,
        skipped: 0,
      },
    };

    // Group files by language
    const filesByLanguage = this.groupFilesByLanguage(files);

    for (const [language, languageFiles] of Object.entries(filesByLanguage)) {
      console.log(chalk.blue(`📝 Formatting ${language} files...`));

      try {
        const languageResults = await this.formatLanguageFiles(
          language,
          languageFiles
        );

        results.formatted.push(...languageResults.formatted);
        results.failed.push(...languageResults.failed);
        results.skipped.push(...languageResults.skipped);

        results.summary.formatted += languageResults.formatted.length;
        results.summary.failed += languageResults.failed.length;
        results.summary.skipped += languageResults.skipped.length;
      } catch (error) {
        console.warn(
          chalk.yellow(
            `⚠️  Failed to format ${language} files: ${error.message}`
          )
        );

        // Mark all files in this language as failed
        languageFiles.forEach((file) => {
          results.failed.push({
            file,
            language,
            error: error.message,
          });
        });

        results.summary.failed += languageFiles.length;
      }
    }

    return results;
  }

  /**
   * Group files by programming language
   */
  groupFilesByLanguage(files) {
    const grouped = {};

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      const language = this.languageMap[ext] || 'unknown';

      if (!grouped[language]) {
        grouped[language] = [];
      }
      grouped[language].push(file);
    }

    return grouped;
  }

  /**
   * Format files for a specific language
   */
  async formatLanguageFiles(language, files) {
    const results = {
      formatted: [],
      failed: [],
      skipped: [],
    };

    switch (language) {
    // Prettier-supported languages
    case 'javascript':
    case 'typescript':
    case 'json':
    case 'markdown':
    case 'yaml':
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
    case 'html':
    case 'vue':
    case 'svelte':
    case 'xml':
      return await this.formatWithPrettier(files, language);

      // PHP formatters
    case 'php':
      return await this.formatPHP(files);

      // Python formatters
    case 'python':
      return await this.formatPython(files);

      // Java formatters
    case 'java':
      return await this.formatJava(files);

      // C/C++ formatters
    case 'c':
    case 'cpp':
      return await this.formatC_CPP(files);

      // C# formatter
    case 'csharp':
      return await this.formatCSharp(files);

      // Go formatter
    case 'go':
      return await this.formatGo(files);

      // Rust formatter
    case 'rust':
      return await this.formatRust(files);

      // Ruby formatter
    case 'ruby':
      return await this.formatRuby(files);

      // Swift formatter
    case 'swift':
      return await this.formatSwift(files);

      // Kotlin formatter
    case 'kotlin':
      return await this.formatKotlin(files);

      // Scala formatter
    case 'scala':
      return await this.formatScala(files);

      // Dart formatter
    case 'dart':
      return await this.formatDart(files);

      // Shell formatters
    case 'shell':
    case 'powershell':
      return await this.formatShell(files);

      // SQL formatter
    case 'sql':
      return await this.formatSQL(files);

      // Docker files
    case 'docker':
      return await this.formatDocker(files);

      // TOML files
    case 'toml':
      return await this.formatTOML(files);

      // INI/Config files
    case 'ini':
      return await this.formatINI(files);

      // Text files (no formatting needed)
    case 'text':
      files.forEach((file) =>
        results.skipped.push({
          file,
          language,
          reason: 'Text file - no formatting needed',
        })
      );
      return results;

    default:
      console.log(chalk.yellow(`⚠️  No formatter available for ${language}`));
      files.forEach((file) =>
        results.skipped.push({ file, language, reason: 'No formatter' })
      );
      return results;
    }
  }

  /**
   * Format files using Prettier
   */
  async formatWithPrettier(files, language) {
    const results = {
      formatted: [],
      failed: [],
      skipped: [],
    };

    try {
      // Check if Prettier is available
      this.checkToolAvailability('prettier');

      // Filter files that Prettier can handle
      const prettierFiles = files.filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return [
          '.js',
          '.jsx',
          '.ts',
          '.tsx',
          '.mjs',
          '.cjs',
          '.json',
          '.md',
          '.yml',
          '.yaml',
          '.css',
          '.scss',
          '.sass',
          '.less',
          '.html',
          '.htm',
          '.vue',
          '.svelte',
          '.xml',
          '.svg',
        ].includes(ext);
      });

      if (prettierFiles.length === 0) {
        files.forEach((file) =>
          results.skipped.push({
            file,
            language,
            reason: 'Unsupported by Prettier',
          })
        );
        return results;
      }

      // Build prettier command
      const configFlag = this.options.prettierConfig
        ? `--config ${this.options.prettierConfig}`
        : '';
      const command = `npx prettier --write ${configFlag} ${prettierFiles.join(' ')}`;

      execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: this.options.timeout,
      });

      prettierFiles.forEach((file) => {
        results.formatted.push({ file, language, tool: 'prettier' });
      });

      console.log(
        chalk.green(`✅ Formatted ${prettierFiles.length} files with Prettier`)
      );
    } catch (error) {
      console.warn(
        chalk.yellow(`⚠️  Prettier formatting failed: ${error.message}`)
      );
      files.forEach((file) => {
        results.failed.push({
          file,
          language,
          error: error.message,
          tool: 'prettier',
        });
      });
    }

    return results;
  }

  /**
   * Format Python files
   */
  async formatPython(files) {
    const results = {
      formatted: [],
      failed: [],
      skipped: [],
    };

    if (!this.options.pythonTools) {
      files.forEach((file) =>
        results.skipped.push({
          file,
          language: 'python',
          reason: 'Python tools disabled',
        })
      );
      return results;
    }

    const formatters = [
      { name: 'Black', command: 'black', check: this.checkBlack.bind(this) },
      {
        name: 'autopep8',
        command: 'autopep8',
        check: this.checkAutopep8.bind(this),
      },
      { name: 'yapf', command: 'yapf', check: this.checkYAPF.bind(this) },
    ];

    for (const formatter of formatters) {
      try {
        if (await formatter.check()) {
          console.log(
            chalk.blue(`🐍 Using ${formatter.name} for Python files...`)
          );
          return await this.formatWithPythonTool(files, formatter);
        }
      } catch (error) {
        console.warn(
          chalk.yellow(`⚠️  ${formatter.name} not available: ${error.message}`)
        );
      }
    }

    console.log(
      chalk.yellow(
        '⚠️  No Python formatter available. Install black, autopep8, or yapf'
      )
    );
    files.forEach((file) =>
      results.skipped.push({
        file,
        language: 'python',
        reason: 'No Python formatter available',
      })
    );
    return results;
  }

  /**
   * Format Java files
   */
  async formatJava(files) {
    const results = {
      formatted: [],
      failed: [],
      skipped: [],
    };

    if (!this.options.javaTools) {
      files.forEach((file) =>
        results.skipped.push({
          file,
          language: 'java',
          reason: 'Java tools disabled',
        })
      );
      return results;
    }

    const formatters = [
      {
        name: 'Google Java Format',
        command: 'google-java-format',
        check: this.checkGoogleJavaFormat.bind(this),
      },
      {
        name: 'Spotless',
        command: 'spotless',
        check: this.checkSpotless.bind(this),
      },
      {
        name: 'Palantir Java Format',
        command: 'palantir-java-format',
        check: this.checkPalantirJavaFormat.bind(this),
      },
    ];

    for (const formatter of formatters) {
      try {
        if (await formatter.check()) {
          console.log(
            chalk.blue(`☕ Using ${formatter.name} for Java files...`)
          );
          return await this.formatWithJavaTool(files, formatter);
        }
      } catch (error) {
        console.warn(
          chalk.yellow(`⚠️  ${formatter.name} not available: ${error.message}`)
        );
      }
    }

    console.log(
      chalk.yellow(
        '⚠️  No Java formatter available. Install google-java-format or spotless'
      )
    );
    files.forEach((file) =>
      results.skipped.push({
        file,
        language: 'java',
        reason: 'No Java formatter available',
      })
    );
    return results;
  }

  /**
   * Format C/C++ files
   */
  async formatC_CPP(files) {
    const results = {
      formatted: [],
      failed: [],
      skipped: [],
    };

    if (!this.options.cTools) {
      files.forEach((file) =>
        results.skipped.push({
          file,
          language: files[0].includes('.cpp') ? 'cpp' : 'c',
          reason: 'C/C++ tools disabled',
        })
      );
      return results;
    }

    const formatters = [
      {
        name: 'clang-format',
        command: 'clang-format',
        check: this.checkClangFormat.bind(this),
      },
      { name: 'astyle', command: 'astyle', check: this.checkAstyle.bind(this) },
      {
        name: 'uncrustify',
        command: 'uncrustify',
        check: this.checkUncrustify.bind(this),
      },
    ];

    for (const formatter of formatters) {
      try {
        if (await formatter.check()) {
          console.log(
            chalk.blue(`⚙️  Using ${formatter.name} for C/C++ files...`)
          );
          return await this.formatWithCTool(files, formatter);
        }
      } catch (error) {
        console.warn(
          chalk.yellow(`⚠️  ${formatter.name} not available: ${error.message}`)
        );
      }
    }

    console.log(
      chalk.yellow(
        '⚠️  No C/C++ formatter available. Install clang-format, astyle, or uncrustify'
      )
    );
    files.forEach((file) =>
      results.skipped.push({
        file,
        language: files[0].includes('.cpp') ? 'cpp' : 'c',
        reason: 'No C/C++ formatter available',
      })
    );
    return results;
  }

  /**
   * Format C# files
   */
  async formatCSharp(files) {
    const results = {
      formatted: [],
      failed: [],
      skipped: [],
    };

    const formatters = [
      {
        name: 'dotnet-format',
        command: 'dotnet-format',
        check: this.checkDotnetFormat.bind(this),
      },
      {
        name: 'csharpier',
        command: 'csharpier',
        check: this.checkCSharpier.bind(this),
      },
    ];

    for (const formatter of formatters) {
      try {
        if (await formatter.check()) {
          console.log(chalk.blue(`🔷 Using ${formatter.name} for C# files...`));
          return await this.formatWithCSharpTool(files, formatter);
        }
      } catch (error) {
        console.warn(
          chalk.yellow(`⚠️  ${formatter.name} not available: ${error.message}`)
        );
      }
    }

    console.log(
      chalk.yellow(
        '⚠️  No C# formatter available. Install dotnet-format or csharpier'
      )
    );
    files.forEach((file) =>
      results.skipped.push({
        file,
        language: 'csharp',
        reason: 'No C# formatter available',
      })
    );
    return results;
  }

  /**
   * Format Go files
   */
  async formatGo(files) {
    const results = {
      formatted: [],
      failed: [],
      skipped: [],
    };

    if (!this.options.goTools) {
      files.forEach((file) =>
        results.skipped.push({
          file,
          language: 'go',
          reason: 'Go tools disabled',
        })
      );
      return results;
    }

    try {
      if (await this.checkGoFormat()) {
        console.log(chalk.blue('🐹 Using gofmt for Go files...'));
        return await this.formatWithGoTool(files);
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  gofmt not available: ${error.message}`));
    }

    console.log(chalk.yellow('⚠️  Go formatter not available. Install Go'));
    files.forEach((file) =>
      results.skipped.push({
        file,
        language: 'go',
        reason: 'Go formatter not available',
      })
    );
    return results;
  }

  /**
   * Format Rust files
   */
  async formatRust(files) {
    const results = {
      formatted: [],
      failed: [],
      skipped: [],
    };

    if (!this.options.rustTools) {
      files.forEach((file) =>
        results.skipped.push({
          file,
          language: 'rust',
          reason: 'Rust tools disabled',
        })
      );
      return results;
    }

    try {
      if (await this.checkRustFmt()) {
        console.log(chalk.blue('🦀 Using rustfmt for Rust files...'));
        return await this.formatWithRustTool(files);
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  rustfmt not available: ${error.message}`));
    }

    console.log(
      chalk.yellow('⚠️  Rust formatter not available. Install Rust and rustfmt')
    );
    files.forEach((file) =>
      results.skipped.push({
        file,
        language: 'rust',
        reason: 'Rust formatter not available',
      })
    );
    return results;
  }

  /**
   * Format Ruby files
   */
  async formatRuby(files) {
    const results = {
      formatted: [],
      failed: [],
      skipped: [],
    };

    if (!this.options.rubyTools) {
      files.forEach((file) =>
        results.skipped.push({
          file,
          language: 'ruby',
          reason: 'Ruby tools disabled',
        })
      );
      return results;
    }

    const formatters = [
      { name: 'rufo', command: 'rufo', check: this.checkRufo.bind(this) },
      {
        name: 'rubocop',
        command: 'rubocop',
        check: this.checkRubocop.bind(this),
      },
    ];

    for (const formatter of formatters) {
      try {
        if (await formatter.check()) {
          console.log(
            chalk.blue(`💎 Using ${formatter.name} for Ruby files...`)
          );
          return await this.formatWithRubyTool(files, formatter);
        }
      } catch (error) {
        console.warn(
          chalk.yellow(`⚠️  ${formatter.name} not available: ${error.message}`)
        );
      }
    }

    console.log(
      chalk.yellow('⚠️  No Ruby formatter available. Install rufo or rubocop')
    );
    files.forEach((file) =>
      results.skipped.push({
        file,
        language: 'ruby',
        reason: 'No Ruby formatter available',
      })
    );
    return results;
  }

  /**
   * Format Swift files
   */
  async formatSwift(files) {
    const results = {
      formatted: [],
      failed: [],
      skipped: [],
    };

    if (!this.options.swiftTools) {
      files.forEach((file) =>
        results.skipped.push({
          file,
          language: 'swift',
          reason: 'Swift tools disabled',
        })
      );
      return results;
    }

    try {
      if (await this.checkSwiftFormat()) {
        console.log(chalk.blue('🍎 Using swift-format for Swift files...'));
        return await this.formatWithSwiftTool(files);
      }
    } catch (error) {
      console.warn(
        chalk.yellow(`⚠️  swift-format not available: ${error.message}`)
      );
    }

    console.log(
      chalk.yellow('⚠️  Swift formatter not available. Install SwiftFormat')
    );
    files.forEach((file) =>
      results.skipped.push({
        file,
        language: 'swift',
        reason: 'Swift formatter not available',
      })
    );
    return results;
  }

  /**
   * Format Kotlin files
   */
  async formatKotlin(files) {
    const results = {
      formatted: [],
      failed: [],
      skipped: [],
    };

    if (!this.options.kotlinTools) {
      files.forEach((file) =>
        results.skipped.push({
          file,
          language: 'kotlin',
          reason: 'Kotlin tools disabled',
        })
      );
      return results;
    }

    try {
      if (await this.checkKtlint()) {
        console.log(chalk.blue('🎯 Using ktlint for Kotlin files...'));
        return await this.formatWithKotlinTool(files);
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  ktlint not available: ${error.message}`));
    }

    console.log(
      chalk.yellow('⚠️  Kotlin formatter not available. Install ktlint')
    );
    files.forEach((file) =>
      results.skipped.push({
        file,
        language: 'kotlin',
        reason: 'Kotlin formatter not available',
      })
    );
    return results;
  }

  /**
   * Format Scala files
   */
  async formatScala(files) {
    const results = {
      formatted: [],
      failed: [],
      skipped: [],
    };

    if (!this.options.scalaTools) {
      files.forEach((file) =>
        results.skipped.push({
          file,
          language: 'scala',
          reason: 'Scala tools disabled',
        })
      );
      return results;
    }

    try {
      if (await this.checkScalafmt()) {
        console.log(chalk.blue('🔷 Using scalafmt for Scala files...'));
        return await this.formatWithScalaTool(files);
      }
    } catch (error) {
      console.warn(
        chalk.yellow(`⚠️  scalafmt not available: ${error.message}`)
      );
    }

    console.log(
      chalk.yellow('⚠️  Scala formatter not available. Install scalafmt')
    );
    files.forEach((file) =>
      results.skipped.push({
        file,
        language: 'scala',
        reason: 'Scala formatter not available',
      })
    );
    return results;
  }

  /**
   * Format Dart files
   */
  async formatDart(files) {
    const results = {
      formatted: [],
      failed: [],
      skipped: [],
    };

    if (!this.options.dartTools) {
      files.forEach((file) =>
        results.skipped.push({
          file,
          language: 'dart',
          reason: 'Dart tools disabled',
        })
      );
      return results;
    }

    try {
      if (await this.checkDartFormat()) {
        console.log(chalk.blue('🎯 Using dart format for Dart files...'));
        return await this.formatWithDartTool(files);
      }
    } catch (error) {
      console.warn(
        chalk.yellow(`⚠️  dart format not available: ${error.message}`)
      );
    }

    console.log(
      chalk.yellow('⚠️  Dart formatter not available. Install Dart SDK')
    );
    files.forEach((file) =>
      results.skipped.push({
        file,
        language: 'dart',
        reason: 'Dart formatter not available',
      })
    );
    return results;
  }

  /**
   * Format Shell files
   */
  async formatShell(files) {
    const results = {
      formatted: [],
      failed: [],
      skipped: [],
    };

    if (!this.options.shellTools) {
      files.forEach((file) =>
        results.skipped.push({
          file,
          language: 'shell',
          reason: 'Shell tools disabled',
        })
      );
      return results;
    }

    const formatters = [
      { name: 'shfmt', command: 'shfmt', check: this.checkShfmt.bind(this) },
      {
        name: 'beautysh',
        command: 'beautysh',
        check: this.checkBeautysh.bind(this),
      },
    ];

    for (const formatter of formatters) {
      try {
        if (await formatter.check()) {
          console.log(
            chalk.blue(`🐚 Using ${formatter.name} for Shell files...`)
          );
          return await this.formatWithShellTool(files, formatter);
        }
      } catch (error) {
        console.warn(
          chalk.yellow(`⚠️  ${formatter.name} not available: ${error.message}`)
        );
      }
    }

    console.log(
      chalk.yellow(
        '⚠️  No Shell formatter available. Install shfmt or beautysh'
      )
    );
    files.forEach((file) =>
      results.skipped.push({
        file,
        language: 'shell',
        reason: 'No Shell formatter available',
      })
    );
    return results;
  }

  /**
   * Format SQL files
   */
  async formatSQL(files) {
    const results = {
      formatted: [],
      failed: [],
      skipped: [],
    };

    if (!this.options.sqlTools) {
      files.forEach((file) =>
        results.skipped.push({
          file,
          language: 'sql',
          reason: 'SQL tools disabled',
        })
      );
      return results;
    }

    const formatters = [
      {
        name: 'sql-formatter',
        command: 'sql-formatter',
        check: this.checkSQLFormatter.bind(this),
      },
      {
        name: 'pg_format',
        command: 'pg_format',
        check: this.checkPgFormat.bind(this),
      },
    ];

    for (const formatter of formatters) {
      try {
        if (await formatter.check()) {
          console.log(
            chalk.blue(`🗄️  Using ${formatter.name} for SQL files...`)
          );
          return await this.formatWithSQLTool(files, formatter);
        }
      } catch (error) {
        console.warn(
          chalk.yellow(`⚠️  ${formatter.name} not available: ${error.message}`)
        );
      }
    }

    console.log(
      chalk.yellow(
        '⚠️  No SQL formatter available. Install sql-formatter or pg_format'
      )
    );
    files.forEach((file) =>
      results.skipped.push({
        file,
        language: 'sql',
        reason: 'No SQL formatter available',
      })
    );
    return results;
  }

  /**
   * Format Docker files
   */
  async formatDocker(files) {
    const results = {
      formatted: [],
      failed: [],
      skipped: [],
    };

    try {
      if (await this.checkDockerfileLint()) {
        console.log(chalk.blue('🐳 Using dockerfilelint for Docker files...'));
        return await this.formatWithDockerTool(files);
      }
    } catch (error) {
      console.warn(
        chalk.yellow(`⚠️  dockerfilelint not available: ${error.message}`)
      );
    }

    console.log(
      chalk.yellow('⚠️  Docker formatter not available. Install dockerfilelint')
    );
    files.forEach((file) =>
      results.skipped.push({
        file,
        language: 'docker',
        reason: 'Docker formatter not available',
      })
    );
    return results;
  }

  /**
   * Format TOML files
   */
  async formatTOML(files) {
    const results = {
      formatted: [],
      failed: [],
      skipped: [],
    };

    try {
      if (await this.checkTOMLLint()) {
        console.log(chalk.blue('📋 Using toml-lint for TOML files...'));
        return await this.formatWithTOMLTool(files);
      }
    } catch (error) {
      console.warn(
        chalk.yellow(`⚠️  toml-lint not available: ${error.message}`)
      );
    }

    console.log(
      chalk.yellow('⚠️  TOML formatter not available. Install toml-lint')
    );
    files.forEach((file) =>
      results.skipped.push({
        file,
        language: 'toml',
        reason: 'TOML formatter not available',
      })
    );
    return results;
  }

  /**
   * Format INI files
   */
  async formatINI(files) {
    const results = {
      formatted: [],
      failed: [],
      skipped: [],
    };

    // INI files are typically simple and don't need complex formatting
    files.forEach((file) =>
      results.skipped.push({
        file,
        language: 'ini',
        reason: 'INI files typically do not need formatting',
      })
    );
    return results;
  }

  /**
   * Format PHP files
   */
  async formatPHP(files) {
    const results = {
      formatted: [],
      failed: [],
      skipped: [],
    };

    if (!this.options.phpTools) {
      files.forEach((file) =>
        results.skipped.push({
          file,
          language: 'php',
          reason: 'PHP tools disabled',
        })
      );
      return results;
    }

    // Try different PHP formatters in order of preference
    const formatters = [
      {
        name: 'PHP-CS-Fixer',
        command: process.env.HOME + '/.composer/vendor/bin/php-cs-fixer',
        check: this.checkPHP_CS_Fixer.bind(this),
      },
      { name: 'Pint', command: 'pint', check: this.checkPint.bind(this) },
      {
        name: 'PHP_CodeSniffer',
        command: 'phpcbf',
        check: this.checkPHPCBF.bind(this),
      },
    ];

    for (const formatter of formatters) {
      try {
        if (await formatter.check()) {
          console.log(
            chalk.blue(`🔧 Using ${formatter.name} for PHP files...`)
          );
          return await this.formatWithPHPTool(files, formatter);
        }
      } catch (error) {
        console.warn(
          chalk.yellow(`⚠️  ${formatter.name} not available: ${error.message}`)
        );
      }
    }

    // No PHP formatter available
    console.log(
      chalk.yellow(
        '⚠️  No PHP formatter available. Install php-cs-fixer, pint, or phpcbf'
      )
    );
    files.forEach((file) =>
      results.skipped.push({
        file,
        language: 'php',
        reason: 'No PHP formatter available',
      })
    );

    return results;
  }

  /**
   * Format files with a specific PHP tool
   */
  async formatWithPHPTool(files, formatter) {
    const results = {
      formatted: [],
      failed: [],
      skipped: [],
    };

    try {
      let command;

      switch (formatter.name) {
      case 'PHP-CS-Fixer':
        command = `${process.env.HOME}/.composer/vendor/bin/php-cs-fixer fix --using-cache=no ${files.join(' ')}`;
        break;
      case 'Pint':
        command = `pint ${files.join(' ')}`;
        break;
      case 'PHP_CodeSniffer':
        command = `phpcbf ${files.join(' ')}`;
        break;
      }

      execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: this.options.timeout,
      });

      files.forEach((file) => {
        results.formatted.push({ file, language: 'php', tool: formatter.name });
      });

      console.log(
        chalk.green(
          `✅ Formatted ${files.length} PHP files with ${formatter.name}`
        )
      );
    } catch (error) {
      console.warn(
        chalk.yellow(`⚠️  ${formatter.name} failed: ${error.message}`)
      );
      files.forEach((file) => {
        results.failed.push({
          file,
          language: 'php',
          error: error.message,
          tool: formatter.name,
        });
      });
    }

    return results;
  }

  /**
   * Check if PHP-CS-Fixer is available
   */
  async checkPHP_CS_Fixer() {
    try {
      const phpCsFixerPath =
        process.env.HOME + '/.composer/vendor/bin/php-cs-fixer';
      execSync(`${phpCsFixerPath} --version`, { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if Laravel Pint is available
   */
  async checkPint() {
    try {
      execSync('pint --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if PHP_CodeSniffer (phpcbf) is available
   */
  async checkPHPCBF() {
    try {
      execSync('phpcbf --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if a tool is available
   */
  checkToolAvailability(tool) {
    try {
      execSync(`${tool} --version`, { stdio: 'pipe' });
      return true;
    } catch (error) {
      throw new Error(
        `${tool} is not available. Install it with: npm install -g ${tool}`
      );
    }
  }

  /**
   * Format all staged files
   */
  async formatStagedFiles(gitManager) {
    try {
      const stagedFiles = await gitManager.getStagedFiles();
      const allFiles = [...stagedFiles];

      // Filter for files that can be formatted
      const formattableFiles = allFiles.filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return Object.keys(this.languageMap).includes(ext);
      });

      if (formattableFiles.length === 0) {
        console.log(chalk.blue('ℹ️  No files to format'));
        return null;
      }

      console.log(
        chalk.blue(`📝 Formatting ${formattableFiles.length} file(s)...`)
      );

      const results = await this.formatFiles(formattableFiles);

      // Re-stage formatted files
      if (results.formatted.length > 0) {
        await gitManager.git.add(results.formatted.map((f) => f.file));
        console.log(
          chalk.green(
            `✅ Re-staged ${results.formatted.length} formatted file(s)`
          )
        );
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to format staged files: ${error.message}`);
    }
  }

  /**
   * Generate formatting summary
   */
  generateSummary(results) {
    if (!results) {
      return { status: 'No files to format', total: 0 };
    }

    const summary = {
      status: results.summary.failed > 0 ? '⚠️ Partial Success' : '✅ Success',
      total: results.summary.total,
      formatted: results.summary.formatted,
      failed: results.summary.failed,
      skipped: results.summary.skipped,
      tools: [...new Set(results.formatted.map((f) => f.tool))],
    };

    return summary;
  }

  /**
   * Check what formatters are available in the project
   */
  async checkAvailableFormatters() {
    const available = {
      // Web/JS formatters
      prettier: false,

      // PHP formatters
      'php-cs-fixer': false,
      pint: false,
      phpcbf: false,

      // Python formatters
      black: false,
      autopep8: false,
      yapf: false,

      // Java formatters
      'google-java-format': false,
      spotless: false,
      'palantir-java-format': false,

      // C/C++ formatters
      'clang-format': false,
      astyle: false,
      uncrustify: false,

      // C# formatters
      'dotnet-format': false,
      csharpier: false,

      // Go formatter
      gofmt: false,

      // Rust formatter
      rustfmt: false,

      // Ruby formatters
      rufo: false,
      rubocop: false,

      // Swift formatter
      'swift-format': false,

      // Kotlin formatter
      ktlint: false,

      // Scala formatter
      scalafmt: false,

      // Dart formatter
      'dart format': false,

      // Shell formatters
      shfmt: false,
      beautysh: false,

      // SQL formatters
      'sql-formatter': false,
      pg_format: false,

      // Docker formatter
      dockerfilelint: false,

      // TOML formatter
      'toml-lint': false,
    };

    // Check Prettier
    try {
      execSync('npx prettier --version', { stdio: 'pipe' });
      available.prettier = true;
    } catch (error) {
      // Check if prettier is installed locally
      try {
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        if (await fs.pathExists(packageJsonPath)) {
          const packageJson = await fs.readJson(packageJsonPath);
          if (
            packageJson.devDependencies?.prettier ||
            packageJson.dependencies?.prettier
          ) {
            available.prettier = true;
          }
        }
      } catch (error) {
        // Not available
      }
    }

    // Check PHP tools
    available['php-cs-fixer'] = await this.checkPHP_CS_Fixer();
    available.pint = await this.checkPint();
    available.phpcbf = await this.checkPHPCBF();

    // Check Python tools
    available.black = await this.checkBlack();
    available.autopep8 = await this.checkAutopep8();
    available.yapf = await this.checkYAPF();

    // Check Java tools
    available['google-java-format'] = await this.checkGoogleJavaFormat();
    available.spotless = await this.checkSpotless();
    available['palantir-java-format'] = await this.checkPalantirJavaFormat();

    // Check C/C++ tools
    available['clang-format'] = await this.checkClangFormat();
    available.astyle = await this.checkAstyle();
    available.uncrustify = await this.checkUncrustify();

    // Check C# tools
    available['dotnet-format'] = await this.checkDotnetFormat();
    available.csharpier = await this.checkCSharpier();

    // Check Go tools
    available.gofmt = await this.checkGoFormat();

    // Check Rust tools
    available.rustfmt = await this.checkRustFmt();

    // Check Ruby tools
    available.rufo = await this.checkRufo();
    available.rubocop = await this.checkRubocop();

    // Check Swift tools
    available['swift-format'] = await this.checkSwiftFormat();

    // Check Kotlin tools
    available.ktlint = await this.checkKtlint();

    // Check Scala tools
    available.scalafmt = await this.checkScalafmt();

    // Check Dart tools
    available['dart format'] = await this.checkDartFormat();

    // Check Shell tools
    available.shfmt = await this.checkShfmt();
    available.beautysh = await this.checkBeautysh();

    // Check SQL tools
    available['sql-formatter'] = await this.checkSQLFormatter();
    available.pg_format = await this.checkPgFormat();

    // Check Docker tools
    available.dockerfilelint = await this.checkDockerfileLint();

    // Check TOML tools
    available['toml-lint'] = await this.checkTOMLLint();

    return available;
  }

  /**
   * Setup configuration files for formatters
   */
  async setupFormatterConfigs() {
    const configs = {};

    // Prettier config
    if (!(await fs.pathExists('.prettierrc'))) {
      const prettierConfig = {
        semi: true,
        trailingComma: 'es5',
        singleQuote: true,
        printWidth: 80,
        tabWidth: 2,
        useTabs: false,
      };

      await fs.writeJson('.prettierrc', prettierConfig, { spaces: 2 });
      configs.prettier = '.prettierrc';
      console.log(chalk.green('✅ Created .prettierrc'));
    }

    // PHP CS Fixer config
    if (!(await fs.pathExists('.php-cs-fixer.php'))) {
      const phpCsFixerConfig = `<?php

$finder = PhpCsFixer\\Finder::create()
    ->in(__DIR__)
    ->exclude(['vendor', 'node_modules', 'storage'])
    ->name(['*.php', '*.phtml']);

return (new PhpCsFixer\\Config())
    ->setRules([
        '@PSR12' => true,
        'array_syntax' => ['syntax' => 'short'],
        'ordered_imports' => ['sort_algorithm' => 'alpha'],
        'no_unused_imports' => true,
        'not_operator_with_successor_space' => true,
        'trailing_comma_in_multiline' => true,
        'phpdoc_scalar' => true,
        'unary_operator_spaces' => true,
        'binary_operator_spaces' => true,
        'blank_line_before_statement' => [
            'statements' => ['break', 'continue', 'declare', 'return', 'throw', 'try'],
        ],
    ])
    ->setFinder($finder);
`;

      await fs.writeFile('.php-cs-fixer.php', phpCsFixerConfig);
      configs['php-cs-fixer'] = '.php-cs-fixer.php';
      console.log(chalk.green('✅ Created .php-cs-fixer.php'));
    }

    return configs;
  }

  // ===== PYTHON FORMATTER METHODS =====

  async checkBlack() {
    try {
      execSync('black --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkAutopep8() {
    try {
      execSync('autopep8 --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkYAPF() {
    try {
      execSync('yapf --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async formatWithPythonTool(files, formatter) {
    const results = { formatted: [], failed: [], skipped: [] };

    try {
      let command;
      switch (formatter.name) {
      case 'Black':
        command = `black ${files.join(' ')}`;
        break;
      case 'autopep8':
        command = `autopep8 --in-place ${files.join(' ')}`;
        break;
      case 'yapf':
        command = `yapf --in-place ${files.join(' ')}`;
        break;
      }

      execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: this.options.timeout,
      });

      files.forEach((file) => {
        results.formatted.push({
          file,
          language: 'python',
          tool: formatter.name,
        });
      });

      console.log(
        chalk.green(
          `✅ Formatted ${files.length} Python files with ${formatter.name}`
        )
      );
    } catch (error) {
      files.forEach((file) => {
        results.failed.push({
          file,
          language: 'python',
          error: error.message,
          tool: formatter.name,
        });
      });
    }

    return results;
  }

  // ===== JAVA FORMATTER METHODS =====

  async checkGoogleJavaFormat() {
    try {
      execSync('google-java-format --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkSpotless() {
    try {
      execSync('gradlew spotlessCheck --dry-run', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkPalantirJavaFormat() {
    try {
      execSync('palantir-java-format --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async formatWithJavaTool(files, formatter) {
    const results = { formatted: [], failed: [], skipped: [] };

    try {
      let command;
      switch (formatter.name) {
      case 'Google Java Format':
        command = `google-java-format --replace ${files.join(' ')}`;
        break;
      case 'Spotless':
        command = 'gradlew spotlessApply';
        break;
      case 'Palantir Java Format':
        command = `palantir-java-format --replace ${files.join(' ')}`;
        break;
      }

      execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: this.options.timeout,
      });

      files.forEach((file) => {
        results.formatted.push({
          file,
          language: 'java',
          tool: formatter.name,
        });
      });

      console.log(
        chalk.green(
          `✅ Formatted ${files.length} Java files with ${formatter.name}`
        )
      );
    } catch (error) {
      files.forEach((file) => {
        results.failed.push({
          file,
          language: 'java',
          error: error.message,
          tool: formatter.name,
        });
      });
    }

    return results;
  }

  // ===== C/C++ FORMATTER METHODS =====

  async checkClangFormat() {
    try {
      execSync('clang-format --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkAstyle() {
    try {
      execSync('astyle --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkUncrustify() {
    try {
      execSync('uncrustify --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async formatWithCTool(files, formatter) {
    const results = { formatted: [], failed: [], skipped: [] };

    try {
      let command;
      switch (formatter.name) {
      case 'clang-format':
        command = `clang-format -i ${files.join(' ')}`;
        break;
      case 'astyle':
        command = `astyle ${files.join(' ')}`;
        break;
      case 'uncrustify':
        command = `uncrustify -l C --no-backup ${files.join(' ')}`;
        break;
      }

      execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: this.options.timeout,
      });

      files.forEach((file) => {
        results.formatted.push({
          file,
          language: files[0].includes('.cpp') ? 'cpp' : 'c',
          tool: formatter.name,
        });
      });

      console.log(
        chalk.green(
          `✅ Formatted ${files.length} C/C++ files with ${formatter.name}`
        )
      );
    } catch (error) {
      files.forEach((file) => {
        results.failed.push({
          file,
          language: files[0].includes('.cpp') ? 'cpp' : 'c',
          error: error.message,
          tool: formatter.name,
        });
      });
    }

    return results;
  }

  // ===== C# FORMATTER METHODS =====

  async checkDotnetFormat() {
    try {
      execSync('dotnet-format --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkCSharpier() {
    try {
      execSync('dotnet-csharpier --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async formatWithCSharpTool(files, formatter) {
    const results = { formatted: [], failed: [], skipped: [] };

    try {
      let command;
      switch (formatter.name) {
      case 'dotnet-format':
        command = 'dotnet-format';
        break;
      case 'csharpier':
        command = 'dotnet-csharpier .';
        break;
      }

      execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: this.options.timeout,
      });

      files.forEach((file) => {
        results.formatted.push({
          file,
          language: 'csharp',
          tool: formatter.name,
        });
      });

      console.log(
        chalk.green(
          `✅ Formatted ${files.length} C# files with ${formatter.name}`
        )
      );
    } catch (error) {
      files.forEach((file) => {
        results.failed.push({
          file,
          language: 'csharp',
          error: error.message,
          tool: formatter.name,
        });
      });
    }

    return results;
  }

  // ===== GO FORMATTER METHODS =====

  async checkGoFormat() {
    try {
      execSync('gofmt -version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async formatWithGoTool(files) {
    const results = { formatted: [], failed: [], skipped: [] };

    try {
      const command = `gofmt -w ${files.join(' ')}`;
      execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: this.options.timeout,
      });

      files.forEach((file) => {
        results.formatted.push({ file, language: 'go', tool: 'gofmt' });
      });

      console.log(
        chalk.green(`✅ Formatted ${files.length} Go files with gofmt`)
      );
    } catch (error) {
      files.forEach((file) => {
        results.failed.push({
          file,
          language: 'go',
          error: error.message,
          tool: 'gofmt',
        });
      });
    }

    return results;
  }

  // ===== RUST FORMATTER METHODS =====

  async checkRustFmt() {
    try {
      execSync('rustfmt --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async formatWithRustTool(files) {
    const results = { formatted: [], failed: [], skipped: [] };

    try {
      const command = `rustfmt ${files.join(' ')}`;
      execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: this.options.timeout,
      });

      files.forEach((file) => {
        results.formatted.push({ file, language: 'rust', tool: 'rustfmt' });
      });

      console.log(
        chalk.green(`✅ Formatted ${files.length} Rust files with rustfmt`)
      );
    } catch (error) {
      files.forEach((file) => {
        results.failed.push({
          file,
          language: 'rust',
          error: error.message,
          tool: 'rustfmt',
        });
      });
    }

    return results;
  }

  // ===== RUBY FORMATTER METHODS =====

  async checkRufo() {
    try {
      execSync('rufo --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkRubocop() {
    try {
      execSync('rubocop --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async formatWithRubyTool(files, formatter) {
    const results = { formatted: [], failed: [], skipped: [] };

    try {
      let command;
      switch (formatter.name) {
      case 'rufo':
        command = `rufo ${files.join(' ')}`;
        break;
      case 'rubocop':
        command = `rubocop -a ${files.join(' ')}`;
        break;
      }

      execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: this.options.timeout,
      });

      files.forEach((file) => {
        results.formatted.push({
          file,
          language: 'ruby',
          tool: formatter.name,
        });
      });

      console.log(
        chalk.green(
          `✅ Formatted ${files.length} Ruby files with ${formatter.name}`
        )
      );
    } catch (error) {
      files.forEach((file) => {
        results.failed.push({
          file,
          language: 'ruby',
          error: error.message,
          tool: formatter.name,
        });
      });
    }

    return results;
  }

  // ===== SWIFT FORMATTER METHODS =====

  async checkSwiftFormat() {
    try {
      execSync('swift-format --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async formatWithSwiftTool(files) {
    const results = { formatted: [], failed: [], skipped: [] };

    try {
      const command = `swift-format --in-place ${files.join(' ')}`;
      execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: this.options.timeout,
      });

      files.forEach((file) => {
        results.formatted.push({
          file,
          language: 'swift',
          tool: 'swift-format',
        });
      });

      console.log(
        chalk.green(
          `✅ Formatted ${files.length} Swift files with swift-format`
        )
      );
    } catch (error) {
      files.forEach((file) => {
        results.failed.push({
          file,
          language: 'swift',
          error: error.message,
          tool: 'swift-format',
        });
      });
    }

    return results;
  }

  // ===== KOTLIN FORMATTER METHODS =====

  async checkKtlint() {
    try {
      execSync('ktlint --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async formatWithKotlinTool(files) {
    const results = { formatted: [], failed: [], skipped: [] };

    try {
      const command = `ktlint -F ${files.join(' ')}`;
      execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: this.options.timeout,
      });

      files.forEach((file) => {
        results.formatted.push({ file, language: 'kotlin', tool: 'ktlint' });
      });

      console.log(
        chalk.green(`✅ Formatted ${files.length} Kotlin files with ktlint`)
      );
    } catch (error) {
      files.forEach((file) => {
        results.failed.push({
          file,
          language: 'kotlin',
          error: error.message,
          tool: 'ktlint',
        });
      });
    }

    return results;
  }

  // ===== SCALA FORMATTER METHODS =====

  async checkScalafmt() {
    try {
      execSync('scalafmt --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async formatWithScalaTool(files) {
    const results = { formatted: [], failed: [], skipped: [] };

    try {
      const command = `scalafmt ${files.join(' ')}`;
      execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: this.options.timeout,
      });

      files.forEach((file) => {
        results.formatted.push({ file, language: 'scala', tool: 'scalafmt' });
      });

      console.log(
        chalk.green(`✅ Formatted ${files.length} Scala files with scalafmt`)
      );
    } catch (error) {
      files.forEach((file) => {
        results.failed.push({
          file,
          language: 'scala',
          error: error.message,
          tool: 'scalafmt',
        });
      });
    }

    return results;
  }

  // ===== DART FORMATTER METHODS =====

  async checkDartFormat() {
    try {
      execSync('dart format --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async formatWithDartTool(files) {
    const results = { formatted: [], failed: [], skipped: [] };

    try {
      const command = `dart format ${files.join(' ')}`;
      execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: this.options.timeout,
      });

      files.forEach((file) => {
        results.formatted.push({ file, language: 'dart', tool: 'dart format' });
      });

      console.log(
        chalk.green(`✅ Formatted ${files.length} Dart files with dart format`)
      );
    } catch (error) {
      files.forEach((file) => {
        results.failed.push({
          file,
          language: 'dart',
          error: error.message,
          tool: 'dart format',
        });
      });
    }

    return results;
  }

  // ===== SHELL FORMATTER METHODS =====

  async checkShfmt() {
    try {
      execSync('shfmt --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkBeautysh() {
    try {
      execSync('beautysh --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async formatWithShellTool(files, formatter) {
    const results = { formatted: [], failed: [], skipped: [] };

    try {
      let command;
      switch (formatter.name) {
      case 'shfmt':
        command = `shfmt -w ${files.join(' ')}`;
        break;
      case 'beautysh':
        command = `beautysh ${files.join(' ')}`;
        break;
      }

      execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: this.options.timeout,
      });

      files.forEach((file) => {
        results.formatted.push({
          file,
          language: 'shell',
          tool: formatter.name,
        });
      });

      console.log(
        chalk.green(
          `✅ Formatted ${files.length} Shell files with ${formatter.name}`
        )
      );
    } catch (error) {
      files.forEach((file) => {
        results.failed.push({
          file,
          language: 'shell',
          error: error.message,
          tool: formatter.name,
        });
      });
    }

    return results;
  }

  // ===== SQL FORMATTER METHODS =====

  async checkSQLFormatter() {
    try {
      execSync('sql-formatter --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkPgFormat() {
    try {
      execSync('pg_format --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async formatWithSQLTool(files, formatter) {
    const results = { formatted: [], failed: [], skipped: [] };

    try {
      let command;
      switch (formatter.name) {
      case 'sql-formatter':
        command = `sql-formatter ${files.join(' ')}`;
        break;
      case 'pg_format':
        command = `pg_format -i 2 ${files.join(' ')}`;
        break;
      }

      execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: this.options.timeout,
      });

      files.forEach((file) => {
        results.formatted.push({ file, language: 'sql', tool: formatter.name });
      });

      console.log(
        chalk.green(
          `✅ Formatted ${files.length} SQL files with ${formatter.name}`
        )
      );
    } catch (error) {
      files.forEach((file) => {
        results.failed.push({
          file,
          language: 'sql',
          error: error.message,
          tool: formatter.name,
        });
      });
    }

    return results;
  }

  // ===== DOCKER FORMATTER METHODS =====

  async checkDockerfileLint() {
    try {
      execSync('dockerfilelint --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async formatWithDockerTool(files) {
    const results = { formatted: [], failed: [], skipped: [] };

    try {
      const command = `dockerfilelint --fix ${files.join(' ')}`;
      execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: this.options.timeout,
      });

      files.forEach((file) => {
        results.formatted.push({
          file,
          language: 'docker',
          tool: 'dockerfilelint',
        });
      });

      console.log(
        chalk.green(
          `✅ Formatted ${files.length} Docker files with dockerfilelint`
        )
      );
    } catch (error) {
      files.forEach((file) => {
        results.failed.push({
          file,
          language: 'docker',
          error: error.message,
          tool: 'dockerfilelint',
        });
      });
    }

    return results;
  }

  // ===== TOML FORMATTER METHODS =====

  async checkTOMLLint() {
    try {
      execSync('toml-lint --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async formatWithTOMLTool(files) {
    const results = { formatted: [], failed: [], skipped: [] };

    try {
      const command = `toml-lint --fix ${files.join(' ')}`;
      execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: this.options.timeout,
      });

      files.forEach((file) => {
        results.formatted.push({ file, language: 'toml', tool: 'toml-lint' });
      });

      console.log(
        chalk.green(`✅ Formatted ${files.length} TOML files with toml-lint`)
      );
    } catch (error) {
      files.forEach((file) => {
        results.failed.push({
          file,
          language: 'toml',
          error: error.message,
          tool: 'toml-lint',
        });
      });
    }

    return results;
  }
}

module.exports = CodeFormatter;
