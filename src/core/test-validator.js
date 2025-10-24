/**
 * Test Validator - Runs tests and linting to detect errors in changed files
 */

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class TestValidator {
  constructor(options = {}) {
    this.options = {
      testCommand: options.testCommand || 'npm run test:quick',
      lintCommand: options.lintCommand || 'npm run lint',
      timeout: options.timeout || 30000,
      ...options,
    };
  }

  /**
   * Validate staged changes by running tests and linting
   */
  async validateStagedChanges(stagedFiles = []) {
    const results = {
      passed: true,
      lintResults: null,
      testResults: null,
      errors: [],
      warnings: [],
      fixableErrors: [],
    };

    try {
      // Run linting first (faster and more common)
      console.log(chalk.blue('🔍 Running linting checks...'));
      results.lintResults = await this.runLinting(stagedFiles);

      // Run tests if linting passes or has fixable issues
      console.log(chalk.blue('🧪 Running tests...'));
      results.testResults = await this.runTests(stagedFiles);

      // Aggregate results
      results.passed =
        results.lintResults.success && results.testResults.success;
      results.errors = [
        ...results.lintResults.errors,
        ...results.testResults.errors,
      ];
      results.warnings = [
        ...results.lintResults.warnings,
        ...results.testResults.warnings,
      ];
      results.fixableErrors = [...results.lintResults.fixableErrors];

      return results;
    } catch (error) {
      results.passed = false;
      results.errors.push(`Validation failed: ${error.message}`);
      return results;
    }
  }

  /**
   * Run linting on specified files
   */
  async runLinting(files = []) {
    const results = {
      success: true,
      errors: [],
      warnings: [],
      fixableErrors: [],
      output: '',
    };

    try {
      const targetFiles = files.length > 0 ? files.join(' ') : 'src/';
      const command = `${this.options.lintCommand} ${targetFiles}`;

      const output = execSync(command, {
        encoding: 'utf8',
        timeout: this.options.timeout,
        stdio: 'pipe',
      });

      results.output = output;
      results.success = true;
    } catch (error) {
      results.output = error.stdout || error.stderr || '';
      results.success = false;

      // Parse ESLint output for fixable errors
      const lines = results.output.split('\n');
      for (const line of lines) {
        if (line.includes('error') && !line.includes('warning')) {
          results.errors.push(line.trim());

          // Check if error is fixable
          if (line.includes('fixable')) {
            results.fixableErrors.push({
              file: this.extractFileFromLine(line),
              line: this.extractLineFromLine(line),
              message: line.trim(),
              fixable: true,
            });
          }
        } else if (line.includes('warning')) {
          results.warnings.push(line.trim());
        }
      }
    }

    return results;
  }

  /**
   * Run tests on specified files
   */
  async runTests(files = []) {
    const results = {
      success: true,
      errors: [],
      warnings: [],
      output: '',
      failedTests: [],
    };

    try {
      // Use quick test for faster feedback
      const command = this.options.testCommand;

      const output = execSync(command, {
        encoding: 'utf8',
        timeout: this.options.timeout,
        stdio: 'pipe',
      });

      results.output = output;
      results.success = true;
    } catch (error) {
      results.output = error.stdout || error.stderr || '';
      results.success = false;

      // Parse Jest output for failed tests
      const lines = results.output.split('\n');
      let currentTest = null;

      for (const line of lines) {
        // Detect failed test
        if (line.includes('✕') || line.includes('❌')) {
          const testMatch = line.match(/✕\s+(.+?)(?:\s*\((\d+ms)\))?$/);
          if (testMatch) {
            currentTest = {
              name: testMatch[1],
              duration: testMatch[2] || 'unknown',
              errors: [],
            };
            results.failedTests.push(currentTest);
          }
        }

        // Capture error details for current test
        if (currentTest && line.includes('Error:')) {
          currentTest.errors.push(line.trim());
        }

        // General error lines
        if (line.includes('FAIL') || line.includes('Error:')) {
          results.errors.push(line.trim());
        }
      }
    }

    return results;
  }

  /**
   * Get files that need validation based on git status
   */
  async getFilesToValidate(gitManager) {
    try {
      const stagedFiles = await gitManager.getStagedFiles();
      const unstagedFiles = await gitManager.getUnstagedFiles();

      // Filter for relevant file types
      const relevantExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json'];

      const filterRelevant = (files) =>
        files.filter((file) =>
          relevantExtensions.some((ext) => file.endsWith(ext))
        );

      return {
        staged: filterRelevant(stagedFiles),
        unstaged: filterRelevant(unstagedFiles),
      };
    } catch (error) {
      throw new Error(`Failed to get files for validation: ${error.message}`);
    }
  }

  /**
   * Check if validation is available for this project
   */
  async isValidationAvailable() {
    try {
      // Check if package.json exists and has test scripts
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (!(await fs.pathExists(packageJsonPath))) {
        return false;
      }

      const packageJson = await fs.readJson(packageJsonPath);
      const scripts = packageJson.scripts || {};

      return !!(scripts.test || scripts['test:quick'] || scripts.lint);
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract file path from ESLint output line
   */
  extractFileFromLine(line) {
    const match = line.match(/^([^\s:]+):/);
    return match ? match[1] : '';
  }

  /**
   * Extract line number from ESLint output line
   */
  extractLineFromLine(line) {
    const match = line.match(/:(\d+):/);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Generate summary report
   */
  generateSummary(results) {
    const summary = {
      status: results.passed ? '✅ PASSED' : '❌ FAILED',
      lintStatus: results.lintResults?.success ? '✅' : '❌',
      testStatus: results.testResults?.success ? '✅' : '❌',
      errorCount: results.errors.length,
      warningCount: results.warnings.length,
      fixableCount: results.fixableErrors.length,
      failedTestCount: results.testResults?.failedTests?.length || 0,
    };

    return summary;
  }
}

module.exports = TestValidator;
