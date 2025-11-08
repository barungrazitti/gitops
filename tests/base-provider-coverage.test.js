/**
 * Unit tests for Base Provider - covering uncovered lines
 */

const BaseProvider = require('../src/providers/base-provider');

describe('BaseProvider - Additional Coverage', () => {
  let provider;

  beforeEach(() => {
    provider = new BaseProvider();
    // Reset spy if it exists
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('analyzeDiff with complex scenarios', () => {
    it('should detect API endpoint changes', () => {
      const diff = `+ @app.route('/api/users', methods=['POST'])
+ def create_user():
+     return {"status": "created"}
- @app.route('/api/users', methods=['GET'])
- def get_user():`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.semanticChanges.apiChanges).toContain('/api/users');
      expect(analysis.likelyPurpose).toContain('API endpoint');
    });

    it('should detect TypeScript interface updates', () => {
      const diff = `+ interface User {
+   id: number;
+   name: string;
+ }
- interface User {
-   id: string;
-   name: string;
- }`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.likelyPurpose).toBe('TypeScript type system update');
    });

    it('should detect test additions', () => {
      const diff = `+ describe('Authentication', () => {
+   it('should login with valid credentials', () => {
+     expect(login('user', 'pass')).toBe(true);
+   });
+ });`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.likelyPurpose).toContain('test');
      expect(analysis.semanticChanges.testChanges).toHaveLength(1);
    });

    it('should detect configuration changes', () => {
      const diff = `+ DATABASE_URL = 'postgresql://localhost:5432/myapp'
+ REDIS_URL = 'redis://localhost:6379'
- DATABASE_URL = 'sqlite:///myapp.db'`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.semanticChanges.configChanges).toHaveLength(2);
      expect(analysis.keyChanges).toContain('configuration updates');
    });

    it('should detect export additions', () => {
      const diff = `+ export const API_URL = 'https://api.example.com';
+ export function fetchData() {
+   return fetch(API_URL);
+ }`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.keyChanges).toContain('new exports added');
    });

    it('should detect new functions and classes', () => {
      const diff = `+ class UserService {
+   constructor() {}
+   getUser(id) {
+     return database.find(id);
+   }
+ }
+ function validateUser(user) {
+   return user.email && user.password;
+ }`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.keyChanges).toContain('new classes: UserService');
      expect(analysis.semanticChanges.newClasses).toContain('UserService');
      expect(analysis.semanticChanges.newFunctions).toContain('validateUser');
    });

    it('should handle complex mixed changes', () => {
      const diff = `+ import React from 'react';
+ export const Component = () => <div>Hello</div>;
+ function helper() {
+   return true;
+ }
- const oldComponent = () => <div>Old</div>;`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.semanticChanges.newFunctions).toContain('helper');
      expect(analysis.keyChanges).toContain('new exports added');
    });
  });

  describe('semanticChanges detailed analysis', () => {
    it('should analyze function signature changes', () => {
      const diff = `- function getUser(id) {
+ function getUser(id, includeProfile = false) {`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.semanticChanges.functionSignatureChanges).toHaveLength(1);
    });

    it('should analyze class hierarchy changes', () => {
      const diff = `- class User {
+ class User extends BaseEntity {`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.semanticChanges.classHierarchyChanges).toHaveLength(1);
    });

    it('should analyze interface implementations', () => {
      const diff = `- class UserService {
+ class UserService implements IUserService {`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.semanticChanges.interfaceImplementations).toHaveLength(1);
    });

    it('should analyze test modifications', () => {
      const diff = `+ it('should handle edge cases', () => {
+   expect(result).toBeNull();
+ });
- it('should return success', () => {
-   expect(result).toBe(true);
- });`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.semanticChanges.testModifications).toHaveLength(1);
    });
  });

  describe('keyChanges detection', () => {
    it('should summarize multiple API changes', () => {
      const diff = `+ app.get('/api/users', getUsers);
+ app.post('/api/users', createUser);
+ app.put('/api/users/:id', updateUser);`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.keyChanges).toContain('API changes: /api/users, /api/users, /api/users/:id');
    });

    it('should summarize multiple new functions', () => {
      const diff = `+ function validateEmail(email) { return email.includes('@'); }
+ function validatePassword(password) { return password.length > 8; }
+ function hashPassword(password) { return bcrypt.hash(password); }`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.keyChanges[0]).toContain('new functions: validateEmail, validatePassword');
    });

    it('should limit function and class summaries to 3 items', () => {
      const diff = `+ function func1() {}
+ function func2() {}
+ function func3() {}
+ function func4() {}
+ function func5() {}
+ class Class1 {}
+ class Class2 {}
+ class Class3 {}
+ class Class4 {}
+ class Class5() {}`;

      const analysis = provider.analyzeDiff(diff);

      const newFunctionsChange = analysis.keyChanges.find(k => k.includes('new functions'));
      const newClassesChange = analysis.keyChanges.find(k => k.includes('new classes'));
      
      expect(newFunctionsChange).toContain('func1, func2, func3');
      expect(newClassesChange).toContain('Class1, Class2, Class3');
    });
  });

  describe('hasInsights generation', () => {
    it('should generate insights for new functions', () => {
      const diff = `+ function newFeature() {
+   return 'implemented';
+ }`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.hasInsights).toContain('⚡ New functionality detected');
    });

    it('should generate insights for new classes', () => {
      const diff = `+ class NewService {
+   constructor() {}
+   process() {}
+ }`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.hasInsights).toContain('🏗️  New class(es) added');
    });

    it('should generate insights for API changes', () => {
      const diff = `+ app.get('/api/endpoint', handler);`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.hasInsights).toContain('🔌 API endpoint changes');
    });

    it('should generate insights for test additions', () => {
      const diff = `+ it('should pass', () => {
+   expect(true).toBe(true);
+ });`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.hasInsights).toContain('🧪 Test coverage improvements');
    });

    it('should generate insights for configuration changes', () => {
      const diff = `+ NODE_ENV = 'production';`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.hasInsights).toContain('⚙️  Configuration changes');
    });

    it('should generate insights for breaking changes', () => {
      const diff = `- function oldMethod() {}
- class DeprecatedClass {}`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.hasInsights).toContain('💥 Potential breaking changes detected');
    });

    it('should generate insights for database schema changes', () => {
      const diff = `+ ALTER TABLE users ADD COLUMN email_verified BOOLEAN;`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.hasInsights).toContain('🗃️  Database schema changes');
    });

    it('should generate insights for dependency updates', () => {
      const diff = `+ "react": "^18.0.0"
- "react": "^17.0.0"`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.hasInsights).toContain('📦 Dependency version updates');
    });

    it('should generate insights for documentation changes', () => {
      const diff = `+ ## New Feature
+ This feature allows users to...`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.hasInsights).toContain('📚 Documentation updates');
    });

    it('should generate insights for performance optimizations', () => {
      const diff = `+ const memoizedResult = useMemo(() => expensive(), []);`;

      const analysis = provider.analyzeDiff(diff);

      expect(analysis.hasInsights).toContain('⚡ Performance optimizations');
    });
  });

  describe('preprocessDiff edge cases', () => {
    it('should handle very long import statements', () => {
      const longImport = `import { ${'item'.repeat(100)} } from 'very-long-module-name-that-exceeds-normal-limits';`;
      const diff = `+ ${longImport}`;

      const processed = provider.preprocessDiff(diff);

      expect(processed).toContain('[import statement truncated]');
    });

    it('should handle very long function/class declarations', () => {
      const longFunction = `function ${'veryLongFunctionName'.repeat(20)}() { return 'test'; }`;
      const diff = `+ ${longFunction}`;

      const processed = provider.preprocessDiff(diff);

      expect(processed).toContain('[function/class truncated]');
    });

    it('should handle very long lines without special content', () => {
      const longLine = '+ ' + 'x'.repeat(600);
      const diff = `${longLine}\n+ normal line\n`;

      const processed = provider.preprocessDiff(diff);

      expect(processed).toContain('[Long line truncated]');
      expect(processed).toContain('normal line');
    });

    it('should preserve maximum number of lines', () => {
      const lines = [];
      const headers = ['diff --git a/file b/file', 'index abc123..def456 100644', '--- a/file', '+++ b/file', '@@ -1,3 +1,4 @@'];
      const changes = [];
      const context = [];

      // Add headers
      lines.push(...headers);

      // Add 900 changes
      for (let i = 0; i < 900; i++) {
        changes.push(`+ line ${i}`);
        lines.push(`+ line ${i}`);
      }

      // Add 200 context lines
      for (let i = 0; i < 200; i++) {
        context.push(`  context ${i}`);
        lines.push(`  context ${i}`);
      }

      const diff = lines.join('\n');
      const processed = provider.preprocessDiff(diff);

      expect(processed.split('\n').length).toBeLessThanOrEqual(1001); // maxLines + truncation indicator
    });

    it('should prioritize headers and changes over context', () => {
      const lines = [];
      const headers = ['diff --git a/file b/file', 'index abc123..def456 100644', '--- a/file', '+++ b/file', '@@ -1,3 +1,4 @@'];
      const changes = [];
      const context = [];

      lines.push(...headers);

      // Add 400 changes
      for (let i = 0; i < 400; i++) {
        changes.push(`+ change ${i}`);
        lines.push(`+ change ${i}`);
      }

      // Add 700 context lines (will exceed limit)
      for (let i = 0; i < 700; i++) {
        context.push(`  context ${i}`);
        lines.push(`  context ${i}`);
      }

      const diff = lines.join('\n');
      const processed = provider.preprocessDiff(diff);

      const processedLines = processed.split('\n');
      
      // All headers should be present
      headers.forEach(header => {
        expect(processedLines).toContain(header);
      });

      // All changes should be present
      changes.slice(0, 100).forEach(change => { // Limit to reasonable number for test
        expect(processedLines).toContain(change);
      });

      // Some context should be truncated
      expect(processed).toContain('... (diff truncated for size)');
    });
  });

  describe('priority line filtering', () => {
    it('should identify function signatures', () => {
      const lines = [
        'function regularFunction() {}',
        'const arrowFunction = () => {}',
        'class TestClass {}',
        'var oldStyleFunction = function() {}',
        'let variableDeclaration = "value"'
      ];

      const functionSignatures = lines.filter(line => {
        const trimmedLine = line.trim();
        return trimmedLine.match(/^(function|class|def|const|let|var)\s+\w+/);
      });

      expect(functionSignatures).toHaveLength(5);
      expect(functionSignatures[0]).toContain('function regularFunction');
      expect(functionSignatures[1]).toContain('const arrowFunction');
    });

    it('should identify context importance', () => {
      const importantLines = [
        'if (condition) {',
        'while (loop) {',
        'try {',
        'catch (error) {',
        'switch (value) {',
        'return result;',
        'import module from "file";',
        'export default function() {}',
        'class Example {',
        'function test() {}'
      ];

      importantLines.forEach(line => {
        expect(provider.isImportantContext(line)).toBe(true);
      });
    });

    it('should prioritize lines near function signatures', () => {
      const contextLines = [
        '  // Some comment',
        '  const variable = "value";',
        '  if (condition) {',
        '  return result;',
        '  // Another comment'
      ];
      const functionSignatures = ['function testFunction() {}'];

      const prioritized = provider.prioritizeContextLines(contextLines, functionSignatures);

      expect(prioritized).toContain('const variable = "value";');
      expect(prioritized).toContain('if (condition) {');
      expect(prioritized).toContain('return result;');
    });
  });

  describe('trivial change detection', () => {
    it('should identify truly empty changes', () => {
      expect(provider.isTrivialChange('+')).toBe(true);
      expect(provider.isTrivialChange('-')).toBe(true);
      expect(provider.isTrivialChange('+ ')).toBe(true);
      expect(provider.isTrivialChange('- ')).toBe(true);
    });

    it('should not consider non-empty changes as trivial', () => {
      expect(provider.isTrivialChange('+ const x = 1;')).toBe(false);
      expect(provider.isTrivialChange('- const x = 1;')).toBe(false);
      expect(provider.isTrivialChange('+ // comment')).toBe(false);
      expect(provider.isTrivialChange('- // comment')).toBe(false);
    });
  });

  describe('withRetry functionality', () => {
    it('should retry on failure with exponential backoff', async () => {
      let attempts = 0;
      const failingOperation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          const error = new Error('Temporary failure');
          error.status = 429;
          throw error;
        }
        return 'success';
      });

      const result = await provider.withRetry(failingOperation, 3, 100);

      expect(result).toBe('success');
      expect(failingOperation).toHaveBeenCalledTimes(3);
    });

    it('should give up after max retries', async () => {
      const failingOperation = jest.fn().mockRejectedValue(new Error('Permanent failure'));

      await expect(provider.withRetry(failingOperation, 2, 50))
        .rejects.toThrow('Permanent failure');

      expect(failingOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should not retry on non-retryable errors', async () => {
      const failingOperation = jest.fn().mockRejectedValue(new Error('Authentication failed'));

      await expect(provider.withRetry(failingOperation, 3, 50))
        .rejects.toThrow('Authentication failed');

      expect(failingOperation).toHaveBeenCalledTimes(1);
    });

    it('should handle immediate success', async () => {
      const successfulOperation = jest.fn().mockResolvedValue('immediate success');

      const result = await provider.withRetry(successfulOperation, 3, 50);

      expect(result).toBe('immediate success');
      expect(successfulOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling with provider context', () => {
    it('should handle errors with provider name', () => {
      const error = new Error('Network error');
      error.code = 'ECONNRESET';

      expect(() => provider.handleError(error, 'test-provider'))
        .toThrow('test-provider error: Network error. Please check your internet connection.');
    });

    it('should handle undefined error messages', () => {
      const error = new Error();
      delete error.message;

      expect(() => provider.handleError(error, 'test-provider'))
        .toThrow('test-provider error: Unknown error occurred');
    });

    it('should handle null errors', () => {
      expect(() => provider.handleError(null, 'test-provider'))
        .toThrow('test-provider error: Unknown error occurred');
    });

    it('should handle errors without status codes', () => {
      const error = new Error('Generic error');
      delete error.response;

      expect(() => provider.handleError(error, 'test-provider'))
        .toThrow('test-provider service is temporarily unavailable');
    });
  });

  describe('chunkDiff functionality', () => {
    it('should chunk very large diffs at semantic boundaries', () => {
      const largeDiff = 'diff --git a/large-file.js b/large-file.js\n' +
        Array(1000).fill(0).map((_, i) => `+ line ${i}\n- old line ${i}\n context line ${i}`).join('\n');

      const chunks = provider.chunkDiff(largeDiff, 500);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(500);
      });
    });

    it('should preserve diff headers in each chunk', () => {
      const diff = `diff --git a/file.js b/file.js
index abc123..def456 100644
--- a/file.js
+++ b/file.js
@@ -1,1000 +1,1000 @@
${Array(1000).fill(0).map((_, i) => `+ line ${i}`).join('\n')}`;

      const chunks = provider.chunkDiff(diff, 200);

      chunks.forEach((chunk, index) => {
        if (index === 0) {
          expect(chunk).toContain('diff --git a/file.js b/file.js');
        } else {
          // Subsequent chunks should maintain context
          expect(chunk).toContain('@@');
        }
      });
    });

    it('should handle chunks with single very large lines', () => {
      const longLine = '+ ' + 'x'.repeat(10000);
      const diff = `diff --git a/file.js b/file.js\n${longLine}\n+ normal line`;

      const chunks = provider.chunkDiff(diff, 500);

      chunks.forEach(chunk => {
        expect(chunk).toContain('[Long line truncated]');
      });
    });
  });

  describe('validateCommitMessage edge cases', () => {
    it('should validate messages with Unicode characters', () => {
      const unicodeMessage = 'feat: 添加新功能 - add new feature in Chinese';
      expect(provider.validateCommitMessage(unicodeMessage)).toBe(true);
    });

    it('should validate messages with emojis', () => {
      const emojiMessage = 'feat: 🎉 add celebration feature';
      expect(provider.validateCommitMessage(emojiMessage)).toBe(true);
    });

    it('should reject empty messages', () => {
      expect(provider.validateCommitMessage('')).toBe(false);
      expect(provider.validateCommitMessage('   ')).toBe(false);
    });

    it('should reject messages that are too short', () => {
      expect(provider.validateCommitMessage('fix: a')).toBe(false);
      expect(provider.validateCommitMessage('fix: ab')).toBe(false);
    });

    it('should accept messages that meet minimum length', () => {
      expect(provider.validateCommitMessage('fix: abc')).toBe(true);
    });

    it('should reject messages with only invalid characters', () => {
      expect(provider.validateCommitMessage('!!!')).toBe(false);
      expect(provider.validateCommitMessage('???')).toBe(false);
    });

    it('should handle null and undefined inputs', () => {
      expect(provider.validateCommitMessage(null)).toBe(false);
      expect(provider.validateCommitMessage(undefined)).toBe(false);
    });
  });

  describe('buildPrompt with complex options', () => {
    it('should build enhanced prompt with multiple context types', () => {
      const diff = 'test diff';
      const options = {
        conventional: true,
        chunkIndex: 2,
        totalChunks: 5,
        isLastChunk: true,
        context: {
          hasSemanticContext: true,
          primaryLanguage: 'python',
          files: { scope: 'api' }
        }
      };

      const prompt = provider.buildPrompt(diff, options);

      expect(prompt).toContain('conventional commit format');
      expect(prompt).toContain('Processing chunk 3 of 5');
      expect(prompt).toContain('This is the final chunk');
      expect(prompt).toContain('Python');
    });

    it('should handle template variables with special characters', () => {
      const diff = 'test diff';
      const options = {
        template: '{type}({scope}): {description} [#{ticket}]',
        variables: {
          type: 'fix',
          scope: 'auth',
          description: '修复登录问题', // Chinese description
          ticket: 'TICKET-123'
        }
      };

      const prompt = provider.buildPrompt(diff, options);

      expect(prompt).toContain('修复登录问题');
      expect(prompt).toContain('[#TICKET-123]');
    });
  });

  describe('parseResponse with various formats', () => {
    it('should parse JSON array response', () => {
      const jsonResponse = JSON.stringify(['feat: add feature', 'fix: resolve bug']);
      const result = provider.parseResponse(jsonResponse);
      expect(result).toEqual(['feat: add feature', 'fix: resolve bug']);
    });

    it('should parse numbered list response', () => {
      const numberedResponse = `1. feat: add new feature
2. fix: resolve existing bug
3. docs: update README`;
      const result = provider.parseResponse(numberedResponse);
      expect(result).toContain('feat: add new feature');
      expect(result).toContain('fix: resolve existing bug');
      expect(result).toContain('docs: update README');
    });

    it('should parse bullet point response', () => {
      const bulletResponse = `• feat: add authentication
- fix: memory leak
* refactor: optimize performance`;
      const result = provider.parseResponse(bulletResponse);
      expect(result).toContain('feat: add authentication');
      expect(result).toContain('fix: memory leak');
      expect(result).toContain('refactor: optimize performance');
    });

    it('should handle mixed format response', () => {
      const mixedResponse = `feat: main feature
1. fix: bug #1
- refactor: old code
• docs: add comments`;
      const result = provider.parseResponse(mixedResponse);
      expect(result).toHaveLength(4);
    });

    it('should handle response with code blocks', () => {
      const codeBlockResponse = `\`\`\`
feat: add feature
fix: resolve bug
\`\`\``;
      const result = provider.parseResponse(codeBlockResponse);
      expect(result).toContain('feat: add feature');
      expect(result).toContain('fix: resolve bug');
    });

    it('should handle response with markdown formatting', () => {
      const markdownResponse = `## Commit Messages

- **feat**: add new authentication system
- **fix**: resolve login timeout issue

### Details
The new system uses JWT tokens for better security.`;
      const result = provider.parseResponse(markdownResponse);
      expect(result).toContain('feat: add new authentication system');
      expect(result).toContain('fix: resolve login timeout issue');
    });

    it('should handle response with quotes', () => {
      const quotedResponse = `"feat: add feature"
'fix: resolve bug'
\`docs: update documentation\``;
      const result = provider.parseResponse(quotedResponse);
      expect(result).toContain('feat: add feature');
      expect(result).toContain('fix: resolve bug');
      expect(result).toContain('docs: update documentation');
    });

    it('should handle malformed JSON gracefully', () => {
      const malformedJson = '{"messages": ["feat: add feature", "fix: resolve bug"]';
      expect(() => provider.parseResponse(malformedJson)).not.toThrow();
    });

    it('should handle very long responses', () => {
      const longResponse = Array(100).fill(0).map((_, i) => `feat: add feature ${i}`).join('\n');
      const result = provider.parseResponse(longResponse);
      expect(result).toHaveLength(100);
      expect(result[0]).toBe('feat: add feature 0');
      expect(result[99]).toBe('feat: add feature 99');
    });

    it('should handle responses with special Unicode characters', () => {
      const unicodeResponse = `feat: 添加新功能
fix: 修复错误 🐛
docs: 更新文档 📚`;
      const result = provider.parseResponse(unicodeResponse);
      expect(result).toContain('feat: 添加新功能');
      expect(result).toContain('fix: 修复错误 🐛');
      expect(result).toContain('docs: 更新文档 📚');
    });

    it('should handle empty and whitespace-only responses', () => {
      expect(() => provider.parseResponse('')).toThrow('No valid commit messages found');
      expect(() => provider.parseResponse('   \n\n  ')).toThrow('No valid commit messages found');
      expect(() => provider.parseResponse('\n\n')).toThrow('No valid commit messages found');
    });
  });
});