/**
 * Auto Corrector - Automatically fixes detected errors using various strategies
 */

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const AIProviderFactory = require('../providers/ai-provider-factory');
const CodeFormatter = require('./code-formatter');

class AutoCorrector {
  constructor(options = {}) {
    this.options = {
      autoFixLint: options.autoFixLint !== false,
      useAIFixes: options.useAIFixes !== false,
      aiProvider: options.aiProvider || 'ollama',
      confirmFixes: options.confirmFixes !== false,
      formatCommand: options.formatCommand || 'npm run format',
      useAdvancedFormatting: options.useAdvancedFormatting !== false,
      ...options,
    };

    this.codeFormatter = new CodeFormatter({
      phpTools: options.phpTools !== false,
      htmlTools: options.htmlTools !== false,
      cssTools: options.cssTools !== false,
      jsTools: options.jsTools !== false,
      prettierConfig: options.prettierConfig,
      timeout: options.formatTimeout || 30000,
    });
  }

  /**
   * Attempt to fix all detected issues
   */
  async fixIssues(validationResults, stagedFiles = []) {
    const fixes = {
      applied: [],
      failed: [],
      skipped: [],
      summary: {
        lintFixes: 0,
        aiFixes: 0,
        totalFixes: 0,
      },
    };

    try {
      // Step 1: Auto-fix linting issues
      if (
        this.options.autoFixLint &&
        validationResults.fixableErrors.length > 0
      ) {
        console.log(chalk.blue('🔧 Auto-fixing linting issues...'));
        const lintFixes = await this.fixLintingIssues(
          validationResults.fixableErrors
        );
        fixes.applied.push(...lintFixes);
        fixes.summary.lintFixes = lintFixes.length;
      }

      // Step 2: Use AI to fix test failures and complex issues
      if (
        this.options.useAIFixes &&
        validationResults.testResults?.failedTests?.length > 0
      ) {
        console.log(chalk.blue('🤖 Using AI to fix test failures...'));
        const aiFixes = await this.fixWithAI(validationResults, stagedFiles);
        fixes.applied.push(...aiFixes);
        fixes.summary.aiFixes = aiFixes.length;
      }

      // Step 3: Format code after fixes
      if (fixes.applied.length > 0) {
        console.log(chalk.blue('📝 Formatting code...'));
        await this.formatCode();
      }

      // Step 4: Advanced multi-language formatting
      if (this.options.useAdvancedFormatting && stagedFiles.length > 0) {
        console.log(chalk.blue('🎨 Running advanced formatting...'));
        const formatResults = await this.codeFormatter.formatFiles(stagedFiles);

        if (formatResults.summary.formatted > 0) {
          fixes.applied.push(
            ...formatResults.formatted.map((f) => ({
              type: 'format',
              file: f.file,
              tool: f.tool,
              description: `Formatted with ${f.tool}`,
            }))
          );

          fixes.summary.formatFixes = formatResults.summary.formatted;
          fixes.summary.totalFixes += formatResults.summary.formatted;
        }
      }

      fixes.summary.totalFixes = fixes.applied.length;
      return fixes;
    } catch (error) {
      console.error(chalk.red(`Auto-correction failed: ${error.message}`));
      fixes.failed.push({
        type: 'system',
        error: error.message,
      });
      return fixes;
    }
  }

  /**
   * Fix linting issues using ESLint's auto-fix
   */
  async fixLintingIssues(fixableErrors) {
    const fixes = [];

    try {
      // Group errors by file
      const errorsByFile = this.groupErrorsByFile(fixableErrors);

      for (const [file, errors] of Object.entries(errorsByFile)) {
        try {
          // Run ESLint auto-fix on the file
          const command = `npx eslint "${file}" --fix`;
          execSync(command, { encoding: 'utf8', stdio: 'pipe' });

          fixes.push({
            type: 'lint',
            file,
            errorsFixed: errors.length,
            method: 'eslint-auto-fix',
          });

          console.log(
            chalk.green(`✅ Fixed ${errors.length} linting issues in ${file}`)
          );
        } catch (error) {
          console.warn(
            chalk.yellow(`⚠️  Could not auto-fix ${file}: ${error.message}`)
          );
          fixes.failed.push({
            type: 'lint',
            file,
            error: error.message,
          });
        }
      }
    } catch (error) {
      console.error(chalk.red(`Linting auto-fix failed: ${error.message}`));
    }

    return fixes;
  }

  /**
   * Use AI to fix complex issues like test failures
   */
  async fixWithAI(validationResults, stagedFiles) {
    const fixes = [];

    try {
      const provider = AIProviderFactory.create(this.options.aiProvider);

      for (const failedTest of validationResults.testResults.failedTests) {
        try {
          // Read the test file and related source files
          const context = await this.gatherFixContext(failedTest, stagedFiles);

          // Generate fix suggestion
          const fixSuggestion = await this.generateAIFix(
            provider,
            failedTest,
            context
          );

          if (fixSuggestion) {
            const shouldApply = await this.confirmFix(fixSuggestion);

            if (shouldApply) {
              await this.applyAIFix(fixSuggestion);

              fixes.push({
                type: 'ai',
                test: failedTest.name,
                file: fixSuggestion.file,
                method: 'ai-suggestion',
                description: fixSuggestion.description,
              });

              console.log(
                chalk.green(`✅ Applied AI fix for: ${failedTest.name}`)
              );
            } else {
              fixes.skipped.push({
                type: 'ai',
                test: failedTest.name,
                reason: 'user-rejected',
              });
            }
          }
        } catch (error) {
          console.warn(
            chalk.yellow(
              `⚠️  AI fix failed for ${failedTest.name}: ${error.message}`
            )
          );
          fixes.failed.push({
            type: 'ai',
            test: failedTest.name,
            error: error.message,
          });
        }
      }
    } catch (error) {
      console.error(chalk.red(`AI fixing failed: ${error.message}`));
    }

    return fixes;
  }

  /**
   * Gather context for AI fix generation
   */
  async gatherFixContext(failedTest, stagedFiles) {
    const context = {
      testError: failedTest.errors.join('\n'),
      testName: failedTest.name,
      files: {},
    };

    try {
      // Find the test file
      const testFile = await this.findTestFile(failedTest.name);
      if (testFile && (await fs.pathExists(testFile))) {
        context.files.test = {
          path: testFile,
          content: await fs.readFile(testFile, 'utf8'),
        };
      }

      // Read staged source files for context
      for (const file of stagedFiles) {
        if (await fs.pathExists(file)) {
          context.files[file] = {
            path: file,
            content: await fs.readFile(file, 'utf8'),
          };
        }
      }
    } catch (error) {
      console.warn(
        chalk.yellow(`⚠️  Could not gather full context: ${error.message}`)
      );
    }

    return context;
  }

  /**
   * Generate AI fix suggestion
   */
  async generateAIFix(provider, failedTest, context) {
    const prompt = `
The following test is failing:

Test: ${failedTest.name}
Errors:
${context.testError}

Test file content:
${context.files.test?.content || 'Not available'}

Related source files:
${Object.entries(context.files)
    .filter(([key]) => key !== 'test')
    .map(([key, value]) => `${key}:\n${value.content}`)
    .join('\n\n')}

Please provide a fix for this test failure. Respond with a JSON object containing:
{
  "file": "path to file to modify",
  "description": "brief description of the fix",
  "changes": [
    {
      "type": "replace" | "insert" | "delete",
      "line": line_number,
      "content": "new content"
    }
  ]
}

Only provide the JSON response, no additional text.
    `;

    try {
      const response = await provider.generateCommitMessages(prompt, {
        count: 1,
        language: 'en',
      });

      if (response && response.length > 0) {
        // Try to parse JSON response
        const jsonMatch = response[0].match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`AI fix generation failed: ${error.message}`));
    }

    return null;
  }

  /**
   * Confirm fix with user
   */
  async confirmFix(fixSuggestion) {
    if (!this.options.confirmFixes) {
      return true;
    }

    console.log(chalk.cyan('\n🔍 Suggested Fix:'));
    console.log(chalk.yellow(`File: ${fixSuggestion.file}`));
    console.log(chalk.yellow(`Description: ${fixSuggestion.description}`));

    console.log(chalk.cyan('\nChanges:'));
    fixSuggestion.changes.forEach((change, index) => {
      console.log(
        chalk.white(`${index + 1}. ${change.type} at line ${change.line}`)
      );
      if (change.content) {
        console.log(chalk.gray(`   ${change.content.substring(0, 100)}...`));
      }
    });

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Apply this fix?',
        default: true,
      },
    ]);

    return confirmed;
  }

  /**
   * Apply AI fix to file
   */
  async applyAIFix(fixSuggestion) {
    try {
      const filePath = fixSuggestion.file;
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');

      // Apply changes in reverse order to maintain line numbers
      const sortedChanges = fixSuggestion.changes.sort(
        (a, b) => b.line - a.line
      );

      for (const change of sortedChanges) {
        switch (change.type) {
        case 'replace':
          lines[change.line - 1] = change.content;
          break;
        case 'insert':
          lines.splice(change.line - 1, 0, change.content);
          break;
        case 'delete':
          lines.splice(change.line - 1, 1);
          break;
        }
      }

      await fs.writeFile(filePath, lines.join('\n'), 'utf8');
    } catch (error) {
      throw new Error(
        `Failed to apply fix to ${fixSuggestion.file}: ${error.message}`
      );
    }
  }

  /**
   * Format code using prettier or other formatter
   */
  async formatCode() {
    try {
      execSync(this.options.formatCommand, {
        encoding: 'utf8',
        stdio: 'pipe',
      });
      console.log(chalk.green('✅ Code formatted successfully'));
    } catch (error) {
      console.warn(
        chalk.yellow(`⚠️  Code formatting failed: ${error.message}`)
      );
    }
  }

  /**
   * Find test file based on test name
   */
  async findTestFile(testName) {
    try {
      // Search for test files that might contain this test
      const testDirs = ['tests/', 'test/', '__tests__/'];
      const testExtensions = ['.test.js', '.spec.js', '.test.ts', '.spec.ts'];

      for (const dir of testDirs) {
        for (const ext of testExtensions) {
          const files = (await fs.pathExists(dir)) ? await fs.readdir(dir) : [];

          for (const file of files) {
            if (file.endsWith(ext)) {
              const filePath = path.join(dir, file);
              const content = await fs.readFile(filePath, 'utf8');

              if (
                content.includes(testName) ||
                content.includes(testName.replace(/\s+/g, ' '))
              ) {
                return filePath;
              }
            }
          }
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Group errors by file
   */
  groupErrorsByFile(errors) {
    return errors.reduce((groups, error) => {
      const file = error.file || 'unknown';
      if (!groups[file]) {
        groups[file] = [];
      }
      groups[file].push(error);
      return groups;
    }, {});
  }

  /**
   * Generate fix summary
   */
  generateSummary(fixes) {
    return {
      totalFixes: fixes.summary.totalFixes,
      lintFixes: fixes.summary.lintFixes,
      aiFixes: fixes.summary.aiFixes,
      applied: fixes.applied.length,
      failed: fixes.failed.length,
      skipped: fixes.skipped.length,
      success: fixes.failed.length === 0,
    };
  }
}

module.exports = AutoCorrector;
