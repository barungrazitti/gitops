/**
 * Tests for Test Validation functionality
 */

const TestValidator = require('../src/core/test-validator');
const AutoCorrector = require('../src/core/auto-corrector');
const GitManager = require('../src/core/git-manager');
const fs = require('fs-extra');
const path = require('path');

describe('Test Validation', () => {
  let testValidator;
  let autoCorrector;
  let gitManager;

  beforeEach(() => {
    testValidator = new TestValidator();
    autoCorrector = new AutoCorrector();
    gitManager = new GitManager();
  });

  describe('TestValidator', () => {
    describe('validateStagedChanges', () => {
      test('should return success when no errors found', async () => {
        const mockFiles = ['src/test.js'];

        // Mock successful linting and tests
        jest.spyOn(testValidator, 'runLinting').mockResolvedValue({
          success: true,
          errors: [],
          warnings: [],
          fixableErrors: [],
        });

        jest.spyOn(testValidator, 'runTests').mockResolvedValue({
          success: true,
          errors: [],
          warnings: [],
          failedTests: [],
        });

        const results = await testValidator.validateStagedChanges(mockFiles);

        expect(results.passed).toBe(true);
        expect(results.errors).toHaveLength(0);
        expect(results.warnings).toHaveLength(0);
      });

      test('should detect linting errors', async () => {
        const mockFiles = ['src/bad-code.js'];

        jest.spyOn(testValidator, 'runLinting').mockResolvedValue({
          success: false,
          errors: ['src/bad-code.js:1:1 error - Missing semicolon'],
          warnings: [],
          fixableErrors: [
            {
              file: 'src/bad-code.js',
              line: 1,
              message: 'Missing semicolon',
              fixable: true,
            },
          ],
        });

        jest.spyOn(testValidator, 'runTests').mockResolvedValue({
          success: true,
          errors: [],
          warnings: [],
          failedTests: [],
        });

        const results = await testValidator.validateStagedChanges(mockFiles);

        expect(results.passed).toBe(false);
        expect(results.errors).toHaveLength(1);
        expect(results.fixableErrors).toHaveLength(1);
      });

      test('should detect test failures', async () => {
        const mockFiles = ['src/failing-test.js'];

        jest.spyOn(testValidator, 'runLinting').mockResolvedValue({
          success: true,
          errors: [],
          warnings: [],
          fixableErrors: [],
        });

        jest.spyOn(testValidator, 'runTests').mockResolvedValue({
          success: false,
          errors: ['FAIL src/failing-test.js'],
          warnings: [],
          failedTests: [
            {
              name: 'should pass but fails',
              duration: '10ms',
              errors: ['Error: Expected true to be false'],
            },
          ],
        });

        const results = await testValidator.validateStagedChanges(mockFiles);

        expect(results.passed).toBe(false);
        expect(results.testResults.failedTests).toHaveLength(1);
      });
    });

    describe('isValidationAvailable', () => {
      test('should return true when package.json has test scripts', async () => {
        jest.spyOn(fs, 'pathExists').mockResolvedValue(true);
        jest.spyOn(fs, 'readJson').mockResolvedValue({
          scripts: {
            test: 'jest',
            lint: 'eslint src/',
          },
        });

        const available = await testValidator.isValidationAvailable();
        expect(available).toBe(true);
      });

      test('should return false when no test scripts found', async () => {
        jest.spyOn(fs, 'pathExists').mockResolvedValue(true);
        jest.spyOn(fs, 'readJson').mockResolvedValue({
          scripts: {
            build: 'webpack',
          },
        });

        const available = await testValidator.isValidationAvailable();
        expect(available).toBe(false);
      });

      test('should return false when no package.json found', async () => {
        jest.spyOn(fs, 'pathExists').mockResolvedValue(false);

        const available = await testValidator.isValidationAvailable();
        expect(available).toBe(false);
      });
    });

    describe('generateSummary', () => {
      test('should generate correct summary for passed validation', () => {
        const results = {
          passed: true,
          lintResults: { success: true },
          testResults: { success: true },
          errors: [],
          warnings: [],
          fixableErrors: [],
        };

        const summary = testValidator.generateSummary(results);

        expect(summary.status).toBe('✅ PASSED');
        expect(summary.lintStatus).toBe('✅');
        expect(summary.testStatus).toBe('✅');
        expect(summary.errorCount).toBe(0);
      });

      test('should generate correct summary for failed validation', () => {
        const results = {
          passed: false,
          lintResults: { success: false },
          testResults: { success: false, failedTests: [{}] },
          errors: ['Error 1', 'Error 2'],
          warnings: ['Warning 1'],
          fixableErrors: [{}, {}],
        };

        const summary = testValidator.generateSummary(results);

        expect(summary.status).toBe('❌ FAILED');
        expect(summary.lintStatus).toBe('❌');
        expect(summary.testStatus).toBe('❌');
        expect(summary.errorCount).toBe(2);
        expect(summary.warningCount).toBe(1);
        expect(summary.fixableCount).toBe(2);
        expect(summary.failedTestCount).toBe(1);
      });
    });
  });

  describe('AutoCorrector', () => {
    describe('fixIssues', () => {
      test('should apply linting fixes when available', async () => {
        const validationResults = {
          fixableErrors: [
            {
              file: 'src/test.js',
              line: 1,
              message: 'Missing semicolon',
              fixable: true,
            },
          ],
          testResults: { failedTests: [] },
        };

        jest.spyOn(autoCorrector, 'fixLintingIssues').mockResolvedValue([
          {
            type: 'lint',
            file: 'src/test.js',
            errorsFixed: 1,
            method: 'eslint-auto-fix',
          },
        ]);

        jest.spyOn(autoCorrector, 'formatCode').mockResolvedValue();

        const fixes = await autoCorrector.fixIssues(validationResults);

        expect(fixes.applied).toHaveLength(1);
        expect(fixes.summary.lintFixes).toBe(1);
        expect(fixes.summary.totalFixes).toBe(1);
      });

      test('should apply AI fixes for test failures', async () => {
        const validationResults = {
          fixableErrors: [],
          testResults: {
            failedTests: [
              {
                name: 'failing test',
                errors: ['Error details'],
                duration: '10ms',
              },
            ],
          },
        };

        jest.spyOn(autoCorrector, 'fixLintingIssues').mockResolvedValue([]);
        jest.spyOn(autoCorrector, 'fixWithAI').mockResolvedValue([
          {
            type: 'ai',
            test: 'failing test',
            file: 'src/test.js',
            method: 'ai-suggestion',
          },
        ]);
        jest.spyOn(autoCorrector, 'formatCode').mockResolvedValue();

        const fixes = await autoCorrector.fixIssues(validationResults);

        expect(fixes.applied).toHaveLength(1);
        expect(fixes.summary.aiFixes).toBe(1);
        expect(fixes.summary.totalFixes).toBe(1);
      });
    });

    describe('generateSummary', () => {
      test('should generate correct fix summary', () => {
        const fixes = {
          applied: [
            { type: 'lint', file: 'test.js' },
            { type: 'ai', test: 'failing test' },
          ],
          failed: [{ type: 'lint', file: 'bad.js' }],
          skipped: [{ type: 'ai', reason: 'user-rejected' }],
          summary: {
            lintFixes: 1,
            aiFixes: 1,
            totalFixes: 2,
          },
        };

        const summary = autoCorrector.generateSummary(fixes);

        expect(summary.totalFixes).toBe(2);
        expect(summary.lintFixes).toBe(1);
        expect(summary.aiFixes).toBe(1);
        expect(summary.applied).toBe(2);
        expect(summary.failed).toBe(1);
        expect(summary.skipped).toBe(1);
        expect(summary.success).toBe(false); // Because there are failures
      });
    });

    describe('groupErrorsByFile', () => {
      test('should group errors correctly by file', () => {
        const errors = [
          { file: 'test.js', line: 1, message: 'Error 1' },
          { file: 'test.js', line: 2, message: 'Error 2' },
          { file: 'other.js', line: 1, message: 'Error 3' },
        ];

        const grouped = autoCorrector.groupErrorsByFile(errors);

        expect(Object.keys(grouped)).toHaveLength(2);
        expect(grouped['test.js']).toHaveLength(2);
        expect(grouped['other.js']).toHaveLength(1);
      });
    });
  });

  describe('GitManager Extensions', () => {
    describe('createDualCommits', () => {
      test('should create single commit when no fixes', async () => {
        const mockCommit = { commit: 'abc123' };
        jest.spyOn(gitManager, 'commit').mockResolvedValue(mockCommit);

        const commits = await gitManager.createDualCommits('Test message');

        expect(commits).toHaveLength(1);
        expect(commits[0].type).toBe('original');
        expect(commits[0].message).toBe('Test message');
      });

      test('should create dual commits when fixes applied', async () => {
        const mockCommit1 = { commit: 'abc123' };
        const mockCommit2 = { commit: 'def456' };

        jest
          .spyOn(gitManager, 'commit')
          .mockResolvedValueOnce(mockCommit1)
          .mockResolvedValueOnce(mockCommit2);

        gitManager.git = {
          add: jest.fn().mockResolvedValue(),
        };

        const fixes = {
          applied: [{ type: 'lint', description: 'Fixed linting' }],
          summary: { totalFixes: 1 },
        };

        const commits = await gitManager.createDualCommits(
          'Test message',
          fixes
        );

        expect(commits).toHaveLength(2);
        expect(commits[0].type).toBe('original');
        expect(commits[1].type).toBe('corrected');
        expect(commits[1].fixes.totalFixes).toBe(1);
      });
    });

    describe('validation branch management', () => {
      test('should create validation branch with timestamp', async () => {
        const mockBranch = { current: 'main' };
        jest.spyOn(gitManager, 'getCurrentBranch').mockResolvedValue('main');
        jest.spyOn(gitManager.git, 'checkoutLocalBranch').mockResolvedValue();

        const result = await gitManager.createValidationBranch();

        expect(result.branch).toMatch(
          /^validation-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/
        );
        expect(result.previousBranch).toBe('main');
      });
    });
  });
});
